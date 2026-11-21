import { etikKaydiOku } from "@/lib/etik/oku";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { calismaKilavuzuOku } from "@/lib/guideline-rules";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import { calismaResimKlasorleri, refreshImageUrls } from "@/lib/manuscript-images";
import { detectFormatLoss } from "@/lib/format-loss";
import { ozetOku, yapiSorunlariniTemizle } from "@/lib/kontrol-gecmisi";
import type { ManuscriptCheckResult } from "@/app/actions/manuscript";
import ManuscriptEditor from "./manuscript-editor";
import { CalismaBaglamiYayinla } from "../../../_components/calisma-baglami";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { belgeDili } from "@/lib/belge-dili";
import { denemeAsistanHakkim } from "@/lib/ai/erisim";

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
  searchParams: Promise<{ teslim?: string; asistan?: string; ice?: string }>;
}) {
  const { id } = await params;
  const { teslim, asistan, ice } = await searchParams;
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
  const [{ data: project }, manuscript, { user, authorFullName, denemeKalan }, kontrolYaniti, dokumanDili, etik] = await Promise.all([
    supabase
      .from("academic_projects")
      .select("id, title, guideline_id, university, institute, department, project_type, citation_style, owner_id, assignee_id, due_date, status, ornek_atif")
      .eq("id", id)
      .maybeSingle(),
    getManuscript(id),
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return { user: null, authorFullName: "", denemeKalan: null };
      /*
        Deneme hesabı (21.11.2026): satır içi öneri denemenin 2 asistan
        hakkından düşüyor; editör bunu açmadan önce söylemek için kalan
        hakkı bilmeli. Abone ve kurum üyesi için null döner (sayım
        yalnızca denemede yapılıyor). Okunamazsa uyarı gösterilmez ama hak
        yine korunur: sınırı sunucu uygular (lib/ai/erisim.ts), bu değer
        yalnızca ekrandaki açıklama için; editör bir okuma hatası yüzünden
        açılmamazlık etmemeli.
      */
      const [{ data: profile }, deneme] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", data.user.id).single(),
        denemeAsistanHakkim(data.user.id).catch((hata: unknown) => {
          console.error("[deneme] hak okunamadı", hata);
          return null;
        }),
      ]);
      const denemeKalan = deneme?.denemede ? deneme.kalan : null;
      return { user: data.user, authorFullName: profile?.full_name ?? "", denemeKalan };
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

  const [{ kilavuz: guideline, okunamadi: kilavuzOkunamadi }, content] = await Promise.all([
    /* Katalogda eşleşme yoksa öğrencinin kendi yüklediği kılavuz
       uygulanıyor (lib/guideline-rules.ts: calismaKilavuzu). */
    calismaKilavuzuOku(supabase, id, project.guideline_id),
    // Resim bağlantılarının süresi dolmasın: açılışta depo yolundan yeniden imzalanır.
    // Kabul edilen resim klasörleri: çalışmanın kendisi (yeni yol) ve yazarları (eski yol).
    manuscript ? refreshImageUrls(manuscript.content, calismaResimKlasorleri(project)) : Promise.resolve(null),
  ]);
  const sync = resolveGuidelineSync(guideline, manuscript, await aktifDil());
  // Eski kayıt hatasından etkilenen belge: kullanıcıya neyin kaybolduğu gösterilir.
  const formatLoss = manuscript ? detectFormatLoss(manuscript.content) : null;

  return (
    /* "gb": diğer modül sayfaları gibi tam genişlik. Üç sütunlu düzende
       (araçlar, belge, kontroller) --content-max sınırı belgeyi daraltıyor,
       sayfa öbür ekranlardan dar görünüyordu. */
    <main className="dashboard-page gb yazma-sayfasi">
      {/*
        Başlık satırı kalktı (görsel uyum, 19.11.2026: "tekrarlanan çalışma
        başlığını kaldır; iki kompakt bant"). Üst çubuk zaten "Belge ·
        <çalışmanın adı>" yazıyor (header-title.tsx); bu satır adı ikinci kez
        yazıyor, belgeyi 100 px aşağı itiyordu. Eylemler üst çubuğun yuvasında
        (#ust-cubuk-yuva, manuscript-editor.tsx portalı). Sayfanın h1'i
        ekran okuyucu için yerinde.
      */}
      <h1 className="sr-only">{project.title ?? t({ tr: "Çalışma", en: "Work" })}</h1>

      {/* Çalışmayı gezinmeye bildirir: başlık ve tür çalışma menüsünde görünür (os-gezinme.tsx). */}
      <CalismaBaglamiYayinla id={project.id} baslik={project.title ?? ""} tur={project.project_type} />

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
        denemeKalan={denemeKalan}
        belgeDili={dokumanDili}
        acilacakMadde={teslim ?? null}
        asistanAcikBasla={asistan === "1"}
        /* Yeni çalışma penceresinin "Word dosyasından içe aktar" çıkışı (?ice=1). */
        iceAktarAcikBasla={ice === "1"}
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
