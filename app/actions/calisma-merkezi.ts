"use server";

import { createClient } from "@/lib/supabase/server";
import type { AsistanBulgusu, CalismaOzeti } from "@/lib/calisma-ozeti";
import { calismaKilavuzu } from "@/app/actions/guidelines";
import { metinListeTutarsizliklari, type KaynakSatiri, type Tutarsizlik } from "@/lib/calisma-tutarlilik";
import { loadAppliedGuidelines } from "@/lib/guideline-rules";
import { manuscriptReadiness } from "@/lib/manuscript-readiness";

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
function sonBulgular(findings: unknown): AsistanBulgusu[] {
  const liste = Array.isArray(findings) ? findings : (findings as { bulgular?: unknown })?.bulgular;
  return Array.isArray(liste) ? (liste as AsistanBulgusu[]).slice(0, 3) : [];
}

/*
  "okunamadi": çalışma yok DEĞİL, okunamadı.

  Eskiden ikisi de null dönüyordu ve sayfa notFound() çiziyordu: geçici
  bir veritabanı arızasında kullanıcıya TEZİNİN OLMADIĞI söyleniyordu.
  Olabilecek en kötü hata mesajı; panelin geri kalanında (lib/liste-sonucu.ts)
  bu ayrım zaten yapılıyordu, burada yapılmıyordu.
*/
export const CALISMA_OKUNAMADI = "okunamadi" as const;

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
      "id, title, project_type, status, progress, university, institute, department, citation_style, research_method, due_date, priority, assignee_name, updated_at, guideline_id",
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
      .select("created_at, findings", { count: "exact" })
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
          .then((sonuc) => (sonuc.data ? { ...sonuc.data, match_level: "university" as const } : null))
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
  const uygulananlar = await loadAppliedGuidelines(supabase, calisma.guideline_id ? [calisma.guideline_id] : []);
  const hazirlik =
    musvedde.data
      ? manuscriptReadiness({
          manuscript: musvedde.data,
          guideline: (calisma.guideline_id ? uygulananlar.get(calisma.guideline_id) : null) ?? null,
          projectType: calisma.project_type,
          citationStyle: calisma.citation_style ?? "apa7",
        })
      : null;

  return {
    calisma,
    hazirlik,
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
      sonBulgular: sonBulgular(asistan.data?.[0]?.findings),
    },
    /* Stil geçmezse çıkarıcı APA'ya düşer ve IEEE/Vancouver/MLA yazan
       öğrenciye her kaynak "metinde atfı yok" görünürdü. */
    tutarsizliklar: metinListeTutarsizliklari(
      musvedde.data?.plain_text ?? null,
      kaynakListesi.data ?? [],
      calisma.citation_style,
    ),
    kilavuz: kilavuz
      ? {
          id: kilavuz.id,
          baslik: kilavuz.document_title,
          surum: kilavuz.version_label,
          kurum: kilavuz.university_name,
          enstitu: kilavuz.institute_name,
          atifStili: kilavuz.citation_style,
        }
      : null,
  };
}

/**
 * Birden çok çalışma için metin–literatür tutarsızlıkları, iki sorguda.
 *
 * Çalışma listesinde kontrolörün onaylamadan ÖNCE durumu görmesi için.
 * Tek tek `calismaOzeti` çağırmak çalışma başına on sorgu ederdi; burada
 * yalnızca denetimin gerçekten ihtiyaç duyduğu iki tablo okunur.
 *
 * Hangi çalışmaların geleceğine `taranacakCalismalar` karar verir
 * (lib/toplu-tutarsizlik.ts) — tam metin çekmek pahalıdır.
 */
export async function topluTutarsizliklar(projectIds: string[]): Promise<Map<string, Tutarsizlik[]>> {
  const sonuc = new Map<string, Tutarsizlik[]>();
  if (!projectIds.length) return sonuc;

  const supabase = await createClient();
  const [musveddeler, kaynaklar, calismalar] = await Promise.all([
    supabase.from("project_manuscripts").select("project_id, plain_text").in("project_id", projectIds),
    supabase
      .from("literature_sources")
      .select("project_id, id, title, authors, year, status")
      .in("project_id", projectIds)
      .limit(2000),
    /* Atıf stili çalışmanın kendi kaydında; onsuz denetim her kaynakçayı
       APA sanıyor ve numara stillerinde her kaynağı "atıfsız" sayıyordu. */
    supabase.from("academic_projects").select("id, citation_style").in("id", projectIds),
  ]);

  // Okuma düşerse liste yine açılır; yalnızca rozet çıkmaz.
  for (const okuma of [musveddeler, kaynaklar, calismalar])
    if (okuma.error) console.error("[merkez] toplu tutarsızlık okunamadı:", okuma.error.message);

  const stilHaritasi = new Map((calismalar.data ?? []).map((satir) => [satir.id, satir.citation_style]));

  const kaynakHaritasi = new Map<string, KaynakSatiri[]>();
  for (const satir of kaynaklar.data ?? []) {
    const liste = kaynakHaritasi.get(satir.project_id) ?? [];
    liste.push(satir);
    kaynakHaritasi.set(satir.project_id, liste);
  }

  for (const musvedde of musveddeler.data ?? []) {
    const tutarsizliklar = metinListeTutarsizliklari(
      musvedde.plain_text ?? null,
      kaynakHaritasi.get(musvedde.project_id) ?? [],
      stilHaritasi.get(musvedde.project_id),
    );
    if (tutarsizliklar.length) sonuc.set(musvedde.project_id, tutarsizliklar);
  }
  return sonuc;
}
