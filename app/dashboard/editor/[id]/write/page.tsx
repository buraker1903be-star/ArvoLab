import { CalismaBaglamiYayinla } from "@/app/dashboard/_components/calisma-baglami";
import { calismaAdresi } from "@/lib/calisma-karti";
import { etikKaydiOku } from "@/lib/etik/oku";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { calismaKilavuzuOku } from "@/lib/guideline-rules";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import { calismaResimKlasorleri, refreshImageUrls } from "@/lib/manuscript-images";
import { detectFormatLoss } from "@/lib/format-loss";
import { ozetOku, yapiSorunlariniTemizle } from "@/lib/kontrol-gecmisi";
import type { ManuscriptCheckResult } from "@/app/actions/manuscript";
import ManuscriptEditor from "./manuscript-editor";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { belgeDili } from "@/lib/belge-dili";
import type { SinirProfili } from "@/lib/makale/ozet-ve-sinirlar";

// Bu sayfanın sunucu eylemleri (Word'den aktarma, resimli dönüştürme) büyük dosyalarda zaman alabilir.
export const maxDuration = 60;

/*
  "?teslim=<madde>" ile gelinirse editör teslim kontrolünü o maddede
  açıyor. Parametre SUNUCUDA okunuyor: istemcide okumak ya effect
  içinde state yazmayı (lint buna izin vermiyor, haklı olarak) ya da
  sayfayı bir Suspense sınırına sokan useSearchParams'ı gerektirirdi;
  ikincisi editörün ilk çizimini geciktiriyor.
*/
export default async function WriteManuscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ teslim?: string; asistan?: string; baslik?: string }>;
}) {
  const { id } = await params;
  const { teslim, asistan, baslik } = await searchParams;
  const supabase = await createClient();
  const t = await ceviri();

  /*
    İKİ AŞAMA (Phase 2, 04.11.2026). Eskiden beş sıralı bekleme vardı:
    çalışma → ana grup → son kontrolün tam sonucu → resim bağlantıları →
    yazar adı. Çalışma satırına ihtiyacı olmayanlar (müsvedde, kullanıcı ve
    adı, kontrol geçmişi ve en yenisinin sonucu, belge dili, etik) artık
    çalışma satırıyla AYNI anda okunuyor; zincir halinde olanlar (.then)
    kendi kolunda bekliyor. Çalışma bulunamazsa sonuç yine 404: öbür
    okumalar RLS altında boş döner, kullanılmaz.
  */
  const [{ data: project }, manuscript, { user, authorFullName }, kontrolYaniti, dokumanDili, etik] = await Promise.all([
    supabase
      .from("academic_projects")
      .select("id, title, guideline_id, university, institute, department, project_type, citation_style, owner_id, assignee_id, due_date, status, ornek_atif")
      .eq("id", id)
      .maybeSingle(),
    getManuscript(id),
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return { user: null, authorFullName: "" };
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
      return { user: data.user, authorFullName: profile?.full_name ?? "" };
    }),
    /* Kılavuz ve kaynakça kontrolü geçmişi: son 10 çalıştırma; en
       yenisinin tamamı açılışta gösteriliyor (migration 20261026202222).
       Okunamazsa editör geçmişsiz açılır, akış düşmez. Tam sonuç (künye
       listesi büyük olabilir) yalnızca en yenisi için okunuyor. */
    supabase
      .from("yazim_kontrolleri")
      .select("id, created_at, hata, uyari, eksik_bolum, kelime")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(async (gecmisYaniti) => {
        const ilk = gecmisYaniti.data?.[0];
        const { data: sonSatir } = ilk
          ? await supabase.from("yazim_kontrolleri").select("sonuc, yapi").eq("id", ilk.id).maybeSingle()
          : { data: null };
        return { gecmisYaniti, sonSatir };
      }),
    /* Şekil/tablo etiketleri, içindekiler ve kapak BELGENİN dilinde (lib/belge-dili.ts). */
    aktifDil().then((arayuz) => belgeDili(supabase, id, arayuz)),
    /* Etik kurul kaydı: teslim kontrolünün etik satırı (lib/etik/durum.ts). */
    etikKaydiOku(supabase, id),
  ]);

  // Çalışma yoksa ya da kullanıcının erişimi yoksa (RLS) boş editör yerine 404.
  if (!project) notFound();

  const { gecmisYaniti, sonSatir } = kontrolYaniti;
  if (gecmisYaniti.error) console.error("[kontrol] geçmiş okunamadı", gecmisYaniti.error.message);
  const gecmisSatirlari = gecmisYaniti.data ?? [];
  const kontrolGecmisi = gecmisSatirlari.map(ozetOku);
  const sonKontrol = sonSatir
    ? { sonuc: sonSatir.sonuc as ManuscriptCheckResult, yapi: yapiSorunlariniTemizle(sonSatir.yapi) }
    : null;

  /*
    MAKALE PROFİLİ (Makale Aşama 2, 05.11.2026): editörün teslim listesi
    makalede kelime/özet/anahtar kelime sınırlarını buradan alır, üniversite
    kılavuzundan değil. Yalnızca makale türünde okunur; RLS çalışmayı
    görebilene sınırlar. Okunamazsa liste "profil yok" gibi davranır
    (sınır uydurulmaz), hata günlüğe yazılır.
  */
  const makaleProfiliSorgusu =
    project.project_type === "article"
      ? supabase
          .from("makale_profili")
          .select("dil, kelime_siniri, ozet_siniri, anahtar_en_az, anahtar_en_cok, ozet, anahtar_kelimeler")
          .eq("project_id", id)
          .maybeSingle()
      : null;

  const [{ kilavuz: guideline, okunamadi: kilavuzOkunamadi }, content, makaleProfiliYaniti] = await Promise.all([
    /* Katalogda eşleşme yoksa öğrencinin kendi yüklediği kılavuz
       uygulanıyor (lib/guideline-rules.ts: calismaKilavuzu). */
    calismaKilavuzuOku(supabase, id, project.guideline_id),
    // Resim bağlantılarının süresi dolmasın: açılışta depo yolundan yeniden imzalanır.
    // Kabul edilen resim klasörleri: çalışmanın kendisi (yeni yol) ve yazarları (eski yol).
    manuscript ? refreshImageUrls(manuscript.content, calismaResimKlasorleri(project)) : Promise.resolve(null),
    makaleProfiliSorgusu,
  ]);
  if (makaleProfiliYaniti?.error) console.error("[makale] editörde profil okunamadı:", makaleProfiliYaniti.error.message);
  const makaleProfili: SinirProfili | null | undefined =
    project.project_type === "article"
      ? makaleProfiliYaniti?.data
        ? { ...(makaleProfiliYaniti.data as SinirProfili), anahtar_kelimeler: (makaleProfiliYaniti.data as SinirProfili).anahtar_kelimeler ?? [] }
        : null
      : undefined;
  const sync = resolveGuidelineSync(guideline, manuscript, await aktifDil());
  // Eski kayıt hatasından etkilenen belge: kullanıcıya neyin kaybolduğu gösterilir.
  const formatLoss = manuscript ? detectFormatLoss(manuscript.content) : null;

  return (
    /* "gb": diğer modül sayfaları gibi tam genişlik. Üç sütunlu düzende
       (araçlar, belge, kontroller) --content-max sınırı belgeyi daraltıyor,
       sayfa öbür ekranlardan dar görünüyordu. */
    /* "yazim-sayfasi": başlık satırı, belge ve yazım paneli tek ızgarada (workspace.css, Signature OS Phase 2). */
    <main className="dashboard-page gb yazim-sayfasi">
      {/* Çalışma kenar çubuğuna bildirilir (Phase 3, os-gezinme.tsx): Yazım bölümü orada etkin görünür. */}
      <CalismaBaglamiYayinla id={project.id} baslik={project.title ?? ""} tur={project.project_type} />
      {/*
        BAŞLIK SATIRI (Signature OS Phase 2): belge simgesi, başlık ve kayıt
        durumu solda; belge işlemleri (paylaş, dışa aktar, Arvo AI, panel)
        sağda. Kayıt durumu ve işlemler editörün durumuna bağlı, portal ile
        #yazma-durum ve #yazma-eylemleri kutularına yerleşiyor
        (manuscript-editor.tsx).

        "Çalışmalarım" geri düğmesi tablet ve masaüstünde kalktı: üst
        çubuktaki konum yolu (Çalışmalarım › çalışma › Yazım) aynı yere,
        çalışmanın kendi merkezine götürüyor. Telefonda konum yolu yok;
        orada simge olarak duruyor.
      */}
      <header className="yazma-basligi">
        <Link href={calismaAdresi(id)} className="projects-filter-button yazma-geri" aria-label={t({ tr: "Çalışma özetine dön", en: "Back to work overview" })}>
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        <div className="yazma-baslik">
          <FileText size={18} aria-hidden="true" className="yazma-baslik-simge" />
          <h1 title={project.title ?? undefined}>{project.title ?? t({ tr: "Çalışma", en: "Work" })}</h1>
          <span id="yazma-durum" className="yazma-durum" />
        </div>
        <div className="cluster yazma-eylemleri" id="yazma-eylemleri" />
      </header>

      {kilavuzOkunamadi ? (
        /* Geçici arıza: editör kılavuzsuz açılıyor. Söylenmezse öğrenci biçimin
           neden değiştiğini anlamaz ya da kılavuzunu silinmiş sanıp yeniden yükler. */
        <p className="alert" data-tone="warning" role="alert">
          {t({
            tr: "Kılavuzunuz şu anda okunamadı; bu oturumda kılavuzun biçim kuralları uygulanmıyor. Kılavuzunuz silinmedi — sayfayı yenileyin. Kılavuz ve kaynakça kontrolünü yeniledikten sonra çalıştırın.",
            en: "Your guideline could not be read right now; its formatting rules are not applied in this session. Your guideline was not deleted — refresh the page. Run the guideline and reference check after refreshing.",
          })}
        </p>
      ) : null}

      <ManuscriptEditor
        projectId={id}
        etik={etik}
        kullaniciId={user?.id ?? null}
        belgeDili={dokumanDili}
        acilacakMadde={teslim ?? null}
        asistanAcikBasla={asistan === "1"}
        /* Makale sekmesindeki bölüm denetiminden gelinen başlık (Makale Aşama 2). */
        acilacakBaslik={typeof baslik === "string" ? baslik.slice(0, 300) : null}
        kurumGirili={Boolean(project.university)}
        initialContent={content}
        formatLoss={formatLoss?.affected ? formatLoss : null}
        initialUpdatedAt={manuscript?.updatedAt ?? null}
        initialMargins={sync.margins}
        initialPageSize={sync.pageSize}
        initialShowPageNumbers={sync.showPageNumbers}
        initialCoverPage={manuscript?.coverPage}
        guideline={guideline}
        guidelineSync={{ mode: sync.mode, source: sync.source, changes: sync.changes }}
        editHref={`/dashboard/editor/${id}/edit`}
        /* Yeni tezde içindekiler AÇIK başlar (27.10.2026): tez kılavuzlarının
           hepsi istiyor ve kutu kapalıyken öğrenci Word/PDF çıktısında
           içindekiler olmadığını teslimde fark ediyordu. Makale ve projede kapalı. */
        initialIncludeToc={manuscript?.includeToc ?? (project.project_type ?? "thesis") === "thesis"}
        kontrolGecmisi={kontrolGecmisi}
        sonKontrol={sonKontrol}
        initialHeadingNumbering={sync.headingNumbering}
        dueDate={project.due_date ?? null}
        projectStatus={project.status ?? null}
        citationStyle={project.citation_style ?? "apa7"}
        ornekAtif={project.ornek_atif ?? null}
        makaleProfili={makaleProfili}
        projectDefaults={{
          title: project.title ?? "",
          university: project.university ?? "",
          institute: project.institute ?? "",
          department: project.department ?? "",
          authorName: authorFullName,
          projectType: project.project_type ?? "thesis",
        }}
      />
    </main>
  );
}
