"use server";

import { CALISMA_OKUNAMADI } from "@/lib/calisma-ozeti";
import { createClient } from "@/lib/supabase/server";
import type { AsistanBulgusu, CalismaOzeti } from "@/lib/calisma-ozeti";
import { kayitliLiteraturCevabi } from "@/lib/ai/literatur-taramasi";
import { calismaKilavuzu } from "@/app/actions/guidelines";
import { metinListeTutarsizliklari } from "@/lib/calisma-tutarlilik";
import { calismaKilavuzuOku } from "@/lib/guideline-rules";
import { manuscriptReadiness } from "@/lib/manuscript-readiness";
import { etikKaydiOku } from "@/lib/etik/oku";
import { aktifDil } from "@/lib/dil-sunucu";

/*
  Çalışma merkezinin verisi: bir çalışmaya bağlı bütün birimler tek yerde.

  Neden gerekti: ArvoLab'ın birimleri (literatür, kaynakça denetimi, belgeler,
  müsvedde, danışmanlık) veritabanında zaten academic_projects'e bağlıydı ama
  arayüzde birbirini görmüyordu. Kullanıcı literatürü bir sayfada topluyor,
  kaynakçayı başka sayfada denetliyor, ikisinin aynı teze ait olduğunu
  yalnızca kendi aklında tutuyordu.

  Okumalar RLS'e tabi; çalışma erişimi orada kararlaştırılıyor. Burada
  yalnızca sayım ve son kayıt var, yazma yok.
*/

/** Kayıtlı bulgular iki biçimde olabilir: dizi ya da {bulgular,aramalar}. */
function sonBulgular(findings: unknown, yetenek: unknown): AsistanBulgusu[] {
  const liste = Array.isArray(findings) ? findings : (findings as { bulgular?: unknown })?.bulgular;
  /* Literatür bulguları kayıttaki serbest metinden değil koddan çizilir (PR #105);
     kod taşımayan eski bulgu düşer. */
  if (yetenek === "literatur") return kayitliLiteraturCevabi({ bulgular: liste }, "").bulgular.slice(0, 3);
  return Array.isArray(liste) ? (liste as AsistanBulgusu[]).slice(0, 3) : [];
}

export async function calismaOzeti(
  projectId: string,
): Promise<CalismaOzeti | null | typeof CALISMA_OKUNAMADI> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !projectId) return null;

  const { data: calisma, error } = await supabase
    .from("academic_projects")
    .select(
      "id, title, project_type, status, progress, university, institute, department, citation_style, research_method, due_date, priority, assignee_name, updated_at, guideline_id, ornek_atif",
    )
    .eq("id", projectId)
    .maybeSingle();

  /*
    RLS erişimi olmayana satırı hiç göstermiyor — o durumda hata YOK, veri
    boş gelir ve "bulunamadı" doğru cevaptır. Gerçek bir hata ise ayrı:
    kullanıcıya tezinin yok olduğunu söylememeli.
  */
  if (error) {
    console.error("[merkez] çalışma okunamadı:", error.message);
    return CALISMA_OKUNAMADI;
  }
  if (!calisma) return null;

  const sayim = (tablo: string) =>
    supabase.from(tablo).select("id", { count: "exact", head: true }).eq("project_id", projectId);

  const [musvedde, literatur, okunan, kullanilan, denetim, belgeler, danismanlik, asistan, kilavuz, kaynakListesi] = await Promise.all([
    supabase.from("project_manuscripts").select("*").eq("project_id", projectId).maybeSingle(),
    sayim("literature_sources"),
    supabase
      .from("literature_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "read"),
    supabase
      .from("literature_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "used"),
    supabase
      .from("citation_checks")
      .select("id, compliance_score, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sayim("document_uploads"),
    sayim("consultancy_requests"),
    supabase
      .from("ai_assistant_runs")
      .select("created_at, capability, findings", { count: "exact" })
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1),
    /*
      Kılavuz önce çalışmaya BAĞLI olandan okunur (academic_projects.
      guideline_id): kullanıcı onu bilerek seçmiş. Ada göre eşleştirme
      yalnızca bağlı kılavuz yoksa devreye girer — kaba bir tahmindir,
      seçilmiş olanın önüne geçmemeli.
    */
    calisma.guideline_id
      ? supabase
          .from("thesis_guidelines")
          .select("id, university_name, institute_name, document_title, version_label, citation_style, academic_unit_id")
          .eq("id", calisma.guideline_id)
          .maybeSingle()
          /* Bu dalda da hata yutuluyordu: bağlı kılavuz okunamayınca ekran
             "onaylı kılavuz bulunamadı" diyordu. */
          .then((sonuc) => ({
            kilavuz: sonuc.data ? { ...sonuc.data, match_level: "university" as const } : null,
            okunamadi: Boolean(sonuc.error),
          }))
      : calismaKilavuzu(calisma.university, calisma.institute),
    // Tutarsızlık denetimi için kaynakların kendisi gerekiyor, sayısı değil.
    supabase
      .from("literature_sources")
      .select("id, title, authors, year, status")
      .eq("project_id", projectId)
      .limit(500),
  ]);

  for (const sonuc of [literatur, okunan, kullanilan, belgeler, danismanlik, denetim, musvedde, asistan, kaynakListesi])
    if (sonuc.error) console.error("[merkez] birim okunamadı:", sonuc.error.message);

  /*
    Teslim hazırlığı: editördeki "Teslim kontrolü" ve ana sayfadaki çubukla
    aynı hesap (lib/manuscript-readiness.ts). Asıl yeri burası — çalışmanın
    bütün birimlerinin toplandığı sayfa.
  */
  /*
    UYGULANAN kılavuz: katalogdaki ya da öğrencinin kendi yüklediği.
    Eskiden yalnızca katalog okunuyordu; kendi kılavuzunu yükleyen
    öğrencinin teslim listesi "Kılavuz yok — Kılavuzumu yükle" demeye
    devam ediyordu, editör ise kuralları uyguluyordu.
  */
  const { kilavuz: uygulanan, okunamadi: uygulananOkunamadi } = await calismaKilavuzuOku(supabase, calisma.id, calisma.guideline_id);
  const dil = await aktifDil();
  // Etik kurul satırı teslim listesinde (lib/etik/durum.ts); okunamazsa satır yok.
  const etik = musvedde.data ? await etikKaydiOku(supabase, calisma.id) : null;
  const hazirlik =
    musvedde.data
      ? manuscriptReadiness({
          etik,
          manuscript: musvedde.data,
          guideline: uygulanan,
          projectType: calisma.project_type,
          citationStyle: calisma.citation_style ?? "apa7",
          // Editörle aynı: kurumsuz kullanıcı "Kurum seç" değil "Kılavuzumu yükle"ye yönlenir.
          hasInstitution: Boolean(calisma.university),
        }, dil)
      : null;

  return {
    calisma,
    hazirlik,
    uygulanan,
    musvedde: musvedde.data ? { kelime: musvedde.data.word_count ?? 0, guncellendi: musvedde.data.updated_at } : null,
    literatur: {
      toplam: literatur.count ?? 0,
      okunan: okunan.count ?? 0,
      kullanilan: kullanilan.count ?? 0,
    },
    kaynakca: denetim.data
      ? { id: denetim.data.id, skor: denetim.data.compliance_score, tarih: denetim.data.created_at }
      : null,
    belgeSayisi: belgeler.count ?? 0,
    danismanlikSayisi: danismanlik.count ?? 0,
    asistan: {
      toplam: asistan.count ?? 0,
      sonTarih: asistan.data?.[0]?.created_at ?? null,
      sonBulgular: sonBulgular(asistan.data?.[0]?.findings, asistan.data?.[0]?.capability),
    },
    /* Stil geçmezse çıkarıcı APA'ya düşer ve IEEE/Vancouver/MLA yazan
       öğrenciye her kaynak "metinde atfı yok" görünürdü. */
    tutarsizliklar: metinListeTutarsizliklari(
      musvedde.data?.plain_text ?? null,
      kaynakListesi.data ?? [],
      calisma.citation_style,
      dil,
    ),
    /*
      Atıf stili uyarısı UYGULANAN kılavuza göre (katalogdaki onaylı ya da
      öğrencinin yüklediği). Eskiden guideline_id boşken (26.10.2026'dan beri
      her yeni çalışma) kılavuz üniversite adına göre kataloğun canlı
      sütunlarından tahmin ediliyordu: öğrenci uygulanmayan bir kılavuz
      adına kırmızı uyarı görüyor, "Kılavuza göre düzelt" de "bağlı onaylı
      kılavuz yok" diye düşüyordu; yüklediği kılavuzla çelişen stil ise
      hiç uyarılmıyordu. Ada göre eşleşme yalnızca uygulanan yoksa,
      bilgi için kalıyor.
    */
    kilavuz: uygulanan
      ? {
          id: uygulanan.id,
          baslik: uygulanan.label,
          surum: uygulanan.versionLabel,
          kurum: uygulanan.universityName || null,
          enstitu: uygulanan.instituteName,
          atifStili: uygulanan.citationStyle,
        }
      : kilavuz.kilavuz
        ? {
            id: kilavuz.kilavuz.id,
            baslik: kilavuz.kilavuz.document_title,
            surum: kilavuz.kilavuz.version_label,
            kurum: kilavuz.kilavuz.university_name,
            enstitu: kilavuz.kilavuz.institute_name,
            /* Uygulanmayan kılavuzun stili uyarı doğurmaz: düzeltme düğmesi onu uygulayamaz. */
            atifStili: null,
          }
        : null,
    /* Uygulanan kılavuzun okunamaması da "okunamadı": pencere "yükleyin" demesin. */
    kilavuzOkunamadi: kilavuz.okunamadi || uygulananOkunamadi,
  };
}

/*
  Toplu tutarsızlık taraması (topluTutarsizliklar) 20.11.2026'da kaldırıldı:
  yalnızca personelin kurum listesinde, onaydan önce rozet göstermek için
  kullanılıyordu ve o ekran kalktı. Tek çalışmanın tutarsızlıkları
  calismaOzeti'nde duruyor.
*/
