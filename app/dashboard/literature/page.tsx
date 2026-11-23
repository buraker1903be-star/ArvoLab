import DoiEkleKutusu from "./doi-ekle-kutusu";
import Link from "next/link";
import { BookMarked, ChevronRight, Download, FileUp, Link2, Plus, Sparkles } from "lucide-react";
import { getLiteratureSources } from "@/app/actions/literature";
import { goruntuleyiciKaynaklari } from "@/app/actions/kaynak-pdf";
import { kimlikMi } from "@/lib/kaynak-durumu";
import { getMyCitationChecks, getMyProjects, sonKaynakcaDenetimi } from "@/app/actions/citation-check";
import { literaturAsistaniAcik } from "@/app/actions/ai-literatur";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { belgeDili } from "@/lib/belge-dili";
import { createClient } from "@/lib/supabase/server";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import LiteraturPenceresi from "./literatur-penceresi";
import LiteraturAsistani from "./literatur-asistani";
import KaynakcaPenceresi from "../citations/kaynakca-penceresi";
import CalismaSecici from "../_components/calisma-secici";
import KaynakAlani from "./kaynak-alani";
import { DisaAktarma, IceAktarma } from "./kaynak-aktarim-araclari";
import { STIL_ETIKETLERI, stilAdi } from "@/lib/atif/stiller";
import { cslMi } from "@/lib/atif/csl-kimlik";
import type { CitationStyle } from "@/lib/citation-format";
import { dikkatKategorileri, kaynakcaOzeti, otekiKategoriler, ozetVurgusu, type KategoriAnahtari } from "@/lib/kaynakca-ozeti";
import { ayrintiVar, bulguSatirlari } from "@/lib/kaynakca-bulgulari";
import type { Metin } from "@/lib/dil";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Kaynaklar", en: "Sources" }) };
}

/* Kaynak PDF'lerini bulan sunucu işlemi kaynakça penceresinden çağrılıyor
   ve dış arşivlerden indiriyor (app/actions/kaynak-pdf.ts, bütçe 40 sn). */
/* 120 sn (03.11.2026): Kaynakça penceresindeki "Kaynağa sor" PDF'i okuyup
   modele soruyor; 60 sn'de uzun bir PDF'in cevabı yarıda kesiliyordu. */
export const maxDuration = 120;

/*
  KAYNAKLAR — TEK SAYFA, İKİ EŞİT KART (26.10.2026, kurum sahibinin isteği:
  "docktan butona basınca iki sekme çıkmasın; solda literatür, sağda
  kaynakça").

  Eskiden dock'taki Kaynaklar iki bölümlü bir uygulamaydı: Literatür
  sayfası (dizin araması, tarama asistanı ve üç durum grubunda bütün
  kaynaklar alt alta) ve ayrı bir Kaynakça doğrulama sayfası (denetim
  formu ve son kontroller). Öğrenci aynı nesneyle — kaynağıyla —
  çalışırken iki sayfa arasında gidip geliyordu ve ikisi de aşağı
  kayıyordu.

  Şimdi seçili çalışmanın kaynakları solda, kaynakçasının durumu sağda;
  sayfa kaymıyor (gb-tek-ekran, Çalışmalarım'la aynı kural), uzun liste
  kartın içinde kayar. İşin kendisi Çalışmalarım kartının açtığı AYNI
  pencerelerde: arama ve manuel ekleme (LiteraturPenceresi), denetim,
  asistan yorumu ve kaynak PDF'leri (KaynakcaPenceresi). İki yerde iki
  ayrı ekran yazılsaydı biri güncellenir, öteki unutulurdu.

  Liste seçili çalışmanın kaynakları; çalışmaya bağlanmamış kaynak
  varsa sayısı söyleniyor, kaybolmuş sanılmasın.
*/

type Durum = "to_review" | "read" | "used";
const SIRA: Durum[] = ["to_review", "read", "used"];

export default async function KaynaklarPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string; doi?: string; ekle?: string; sekme?: string; kaynak?: string; kapsam?: string; denetim?: string }>;
}) {
  const { calisma: istenen, doi: gelenDoi, ekle, sekme, kaynak: istenenKaynak, kapsam, denetim: istenenDenetim } = await searchParams;
  const t = await ceviri();
  const { tarihSaat } = await tarihler();
  const [
    { satirlar: calismalar, okunamadi: calismaOkunamadi },
    { satirlar: tumKaynaklar, okunamadi: kaynakOkunamadi },
    { satirlar: denetimler },
    asistanAcik,
  ] = await Promise.all([getMyProjects(), getLiteratureSources(), getMyCitationChecks(), literaturAsistaniAcik()]);

  /* Adresteki çalışma listede yoksa yok sayılır; yoksa en son açılan. */
  /* ?kaynak= (M5): atıf kartı ve editörün Kaynaklar aracı kaydın KENDİSİNE gelir; çalışma verilmemişse kaydın çalışması seçilir. */
  const odakKaynak = kimlikMi(istenenKaynak) ? tumKaynaklar.find((k) => k.id === istenenKaynak) ?? null : null;
  const calisma =
    calismalar.find((c) => c.id === istenen) ?? calismalar.find((c) => !!odakKaynak?.project_id && c.id === odakKaynak.project_id) ?? calismalar[0] ?? null;
  const sonDenetim = calisma ? await sonKaynakcaDenetimi(calisma.id) : null;
  /* Kopyalanan kaynakça çalışmanın diliyle ("n.d." mi "t.y." mi): editörün
     eklediği atıflarla aynı dil (lib/belge-dili.ts). */
  const kaynakcaDili = calisma ? await belgeDili(await createClient(), calisma.id, await aktifDil()) : await aktifDil();

  /*
    KAPSAM (22.11.2026): ya seçili çalışmanın kaynakları ya da HİÇBİR
    çalışmaya bağlı olmayanlar (?kapsam=bagsiz). Bağsız kaynaklar eskiden
    yalnızca "N kaynağınız bir çalışmaya bağlı değil" cümlesiyle
    söyleniyordu; açılacak bir yer yoktu.
  */
  const kapsamBagsiz = kapsam === "bagsiz";
  const kaynaklar = kapsamBagsiz
    ? tumKaynaklar.filter((k) => !k.project_id).sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum))
    : calisma
      ? tumKaynaklar
          .filter((k) => k.project_id === calisma.id)
          .sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum))
      : [];
  /* Satırdaki PDF durumu için: okunamazsa liste yine çizilir, yalnızca PDF eylemi çıkmaz.
     Bağsız kapsamda çalışma yok, dolayısıyla çalışmaya bağlı PDF listesi de yok. */
  const pdfSonucu = !kapsamBagsiz && calisma && kaynaklar.length ? await goruntuleyiciKaynaklari(calisma.id) : null;
  const pdfler = pdfSonucu && !("hata" in pdfSonucu) ? pdfSonucu.satirlar.map((p) => ({ id: p.id, doi: p.doi, kaynakId: p.kaynak_id ?? null })) : null;
  const say = (durum: Durum) => kaynaklar.filter((k) => k.status === durum).length;
  const bagsiz = tumKaynaklar.filter((k) => !k.project_id).length;
  const oncekiDenetimler = calisma ? denetimler.filter((d) => d.project_id === calisma.id) : [];

  /* "uyum /100" yerine kapsam ve açık sorun (lib/kaynakca-ozeti.ts, 20.11.2026). */
  const ozet = sonDenetim ? kaynakcaOzeti(sonDenetim) : null;
  const ton = ozet ? ozet.ton : "neutral";
  /*
    KATEGORİLER TOPLAMLA AYNI KAYNAKTAN (23.11.2026). Bu liste eskiden
    burada elle yazılıyordu ve BİÇİM satırları hiç yoktu: yalnızca biçim
    bulgusu olan bir denetimde üstte "2 açık sorun", altta kategorilerin
    hepsi "Yok" görünüyordu. Artık satırlar da toplam da
    lib/kaynakca-ozeti.ts'ten geliyor; ölçülmeyen kategori "Yok" değil
    "Denetlenmedi" yazıyor (yapılmamış denetim temiz rapor gibi
    görünmesin).
  */
  const KATEGORI_ADI: Record<KategoriAnahtari, Metin> = {
    bicimHatali: { tr: "Biçim hatası olan künye", en: "References with format errors" },
    bicimUyarili: { tr: "Biçim uyarısı olan künye", en: "References with format warnings" },
    karsiliksizAtif: { tr: "Kaynakçada karşılığı olmayan atıf", en: "Citations missing from the reference list" },
    atifsizKaynak: { tr: "Metinde atfı olmayan kaynak", en: "Sources not cited in the text" },
    bulunamayan: { tr: "Dizinlerde bulunamayan kaynak", en: "Sources not found in the indexes" },
    kilavuzAtifi: { tr: "Kılavuzun atıf örneğine uymayan atıf", en: "Citations that don't match the guideline's example" },
    ulasilamayan: { tr: "Dizine ulaşılamayan kaynak", en: "Sources whose indexes were unreachable" },
  };
  const OLCULMEDI_SEBEBI: Record<KategoriAnahtari, Metin> = {
    bicimHatali: { tr: "künye okunamadı", en: "no references were read" },
    bicimUyarili: { tr: "künye okunamadı", en: "no references were read" },
    karsiliksizAtif: { tr: "metinden atıf çıkarılamadı", en: "no citations could be extracted from the text" },
    atifsizKaynak: { tr: "metinden atıf çıkarılamadı", en: "no citations could be extracted from the text" },
    bulunamayan: { tr: "bu turda dizine bakılmadı", en: "the index wasn't queried this round" },
    kilavuzAtifi: { tr: "bu denetimde ölçülmedi", en: "not measured in this check" },
    ulasilamayan: { tr: "bu turda dizine bakılmadı", en: "the index wasn't queried this round" },
  };
  /* Şeritteki kısa ifade: "2 biçim uyarısı". Sayı kategoriyle birlikte
     yazılıyor; Türkçede çoğul eki yok, İngilizcede var. */
  const KATEGORI_SAYISI: Record<KategoriAnahtari, (n: number) => Metin> = {
    bicimHatali: (n) => ({ tr: `${n} biçim hatası`, en: `${n} format ${n === 1 ? "error" : "errors"}` }),
    bicimUyarili: (n) => ({ tr: `${n} biçim uyarısı`, en: `${n} format ${n === 1 ? "warning" : "warnings"}` }),
    karsiliksizAtif: (n) => ({ tr: `${n} karşılıksız atıf`, en: `${n} ${n === 1 ? "citation" : "citations"} without a reference` }),
    atifsizKaynak: (n) => ({ tr: `${n} atıfsız kaynak`, en: `${n} ${n === 1 ? "source" : "sources"} not cited` }),
    bulunamayan: (n) => ({ tr: `${n} bulunamayan kaynak`, en: `${n} ${n === 1 ? "source" : "sources"} not found` }),
    kilavuzAtifi: (n) => ({ tr: `${n} kılavuz dışı atıf`, en: `${n} ${n === 1 ? "citation" : "citations"} off the guideline` }),
    ulasilamayan: (n) => ({ tr: `${n} künyede dizine ulaşılamadı`, en: `index unreachable for ${n}` }),
  };
  /* Satırdaki rozetin tonu: kategorinin ağırlığı. */
  const TON: Record<KategoriAnahtari, "danger" | "warning" | "info"> = {
    bicimHatali: "danger",
    karsiliksizAtif: "danger",
    bicimUyarili: "warning",
    atifsizKaynak: "warning",
    bulunamayan: "warning",
    kilavuzAtifi: "warning",
    ulasilamayan: "info",
  };
  /* Kısa etiket (ayrıntı satırının rozetinde). */
  const KATEGORI_KISA: Record<KategoriAnahtari, Metin> = {
    bicimHatali: { tr: "Biçim hatası", en: "Format error" },
    bicimUyarili: { tr: "Biçim uyarısı", en: "Format warning" },
    karsiliksizAtif: { tr: "Karşılıksız atıf", en: "No reference" },
    atifsizKaynak: { tr: "Atıfsız kaynak", en: "Not cited" },
    bulunamayan: { tr: "Bulunamadı", en: "Not found" },
    kilavuzAtifi: { tr: "Kılavuz dışı", en: "Off guideline" },
    ulasilamayan: { tr: "Dizine ulaşılamadı", en: "Index unreachable" },
  };

  /* Ulaşılamayan satırı yalnızca VARSA çiziliyor: geçici arıza yoksa
     satır gürültü. Ötekiler "Tüm kontroller"de her zaman görünür —
     "Yok" da bir bilgi. */
  const vurgu = ozet ? ozetVurgusu(ozet) : { tur: "temiz" as const, anahtar: null, sayi: 0, dagilim: [] };
  const dikkat = ozet ? dikkatKategorileri(ozet).filter((k) => k.anahtar !== "ulasilamayan" || k.sayi > 0) : [];
  const otekiler = ozet ? otekiKategoriler(ozet).filter((k) => k.anahtar !== "ulasilamayan" || k.sayi > 0) : [];
  /*
    Ayrıntılı bulgu satırları: künye/atıf metni + gerçek uyarı
    (lib/kaynakca-bulgulari.ts). Liste UZUNSA kesiliyor; kalan sonuç
    ekranında. Satır sayısı bir TOPLAM değildir.
  */
  const AYRINTI_SINIRI = 12;
  const bulgular = sonDenetim
    ? bulguSatirlari(
        {
          references: sonDenetim.references,
          crossCheck: sonDenetim.crossCheck,
          academicVerification: sonDenetim.academicVerification as { reference?: string; status?: string }[],
          tyk: sonDenetim.tyk,
        },
        {
          atifsiz: t({ tr: "Kaynakçada var, metinde atfı yok", en: "In the reference list but not cited in the text" }),
          karsiliksiz: t({ tr: "Metinde atıf var, kaynakçada yok", en: "Cited in the text but missing from the reference list" }),
          bulunamayan: t({ tr: "Dizinlerde kayıt bulunamadı", en: "No record found in the indexes" }),
          ulasilamayan: t({ tr: "Dizine ulaşılamadı; tekrar denetleyin", en: "The index couldn't be reached; check again" }),
        },
      )
    : [];
  const gorunenBulgular = bulgular.slice(0, AYRINTI_SINIRI);
  const kalanBulgu = bulgular.length - gorunenBulgular.length;
  /* Eski kayıtta ayrıntı yoksa kategori+adet satırı çiziliyor. */
  const ayrintisizKategoriler = dikkat.filter((k) => !ayrintiVar(bulgular, k.anahtar));


  /* Adresteki denetim YALNIZCA bu çalışmanın geçmişindeyse kabul
     ediliyor: başkasının kimliğiyle pencere açılmasın (okuma zaten
     RLS'e takılır, burada ekran da tutarlı kalıyor). */
  const secilenDenetim = istenenDenetim && oncekiDenetimler.some((d) => d.id === istenenDenetim) ? istenenDenetim : null;

  const kaynakcaSekmesi = sekme === "kaynakca";
  const ekleMenusuAcik = ekle === "1" || typeof gelenDoi === "string";
  const kapsamAdresi = (bagsiz: boolean) =>
    calisma
      ? `/dashboard/literature?calisma=${encodeURIComponent(calisma.id)}${bagsiz ? "&kapsam=bagsiz" : ""}`
      : "/dashboard/literature";
  /* Ayrıntı, SON denetimin kendi sonuç ekranında açılıyor. */
  const ayrintiAdresi = `${kapsamAdresi(false)}&sekme=kaynakca${oncekiDenetimler[0] ? `&denetim=${encodeURIComponent(oncekiDenetimler[0].id)}` : ""}`;

  /*
    TEK BİRİNCİL EYLEM: "Kaynak ekle" (sayfa başlığının sağında). Üç yol
    (DOI, dosyadan içe aktarma, dizinlerde arama) menüde; hiçbiri
    kaldırılmadı. Menü <details>: JS'siz açılır, Esc ve dışarı tıklama
    AcilirKapatici'de.
  */
  const kaynakEkle = calisma ? (
    <details className="kaynak-ekle" open={ekleMenusuAcik || undefined}>
      <summary className="projects-primary-button">
        <Plus size={16} aria-hidden="true" />
        {t({ tr: "Kaynak ekle", en: "Add source" })}
      </summary>
      <div className="kaynak-ekle-menu" role="group" aria-label={t({ tr: "Kaynak ekleme yolları", en: "Ways to add a source" })}>
        <Link href={`/dashboard/literature?calisma=${encodeURIComponent(calisma.id)}&ekle=1`} className="kaynak-ekle-oge">
          <Link2 size={16} aria-hidden="true" />
          <span>
            <b>{t({ tr: "DOI ile ekle", en: "Add by DOI" })}</b>
            <small>{t({ tr: "Künye Crossref ve OpenAlex'ten dolar", en: "The reference fills in from Crossref and OpenAlex" })}</small>
          </span>
        </Link>
        <PanelDrawer
          triggerLabel={t({ tr: "Dosyadan içe aktar", en: "Import from a file" })}
          triggerIcon={<FileUp size={16} aria-hidden="true" />}
          triggerClassName="kaynak-ekle-oge"
          kicker={t({ tr: "Literatür", en: "Literature" })}
          title={t({ tr: "Kaynakları toplu ekleyin", en: "Add sources in bulk" })}
          description={t({
            tr: "Zotero, Mendeley ya da EndNote kütüphanenizi dosyayla aktarın ya da DOI'leri yapıştırın. Kaynaklar bu çalışmaya “Okunacak” olarak eklenir.",
            en: "Import your Zotero, Mendeley or EndNote library from a file, or paste DOIs. Sources are added to this work as “To read”.",
          })}
          boy="genis"
          basaridaKapan={false}
        >
          <IceAktarma projectId={calisma.id} mevcut={kaynaklar} />
        </PanelDrawer>
        <LiteraturPenceresi
          projectId={calisma.id}
          projeAdi={calisma.title}
          triggerLabel={t({ tr: "Dizinlerde ara", en: "Search the indexes" })}
          triggerClassName="kaynak-ekle-oge kaynak-bul-tetik"
        />
      </div>
    </details>
  ) : null;

  return (
    <main className="dashboard-page gb gb-tek-ekran kaynaklar-sayfasi">
      {/*
        ÇALIŞMA BAĞLAMI YAYINLANMIYOR (22.11.2026). Gezinme artık modül
        sayfalarında çalışma menüsüne geçmiyor (lib/os/uygulamalar.ts,
        adrestekiCalisma): hangi çalışmaya bakıldığı yukarıdaki çalışma
        seçicisinde yazıyor. Bağlamı yayınlamanın tek tüketicisi o menüydü.
      */}
      {/*
        ÜST ALAN (22.11.2026, onaylı mockup): Çalışmalarım ve ana sayfayla
        aynı dil — üst başlık, sayfa başlığı, tek cümlelik açıklama, sağda
        TEK birincil eylem. Eskiden başlığın altında çalışmanın adını da
        içeren üç satırlık bir açıklama vardı; aynı bilgi hemen altındaki
        çalışma seçicisinde zaten duruyor.
      */}
      <section className="kaynaklar-bas">
        <div className="kaynaklar-bas-metin">
          <p className="sayfa-ustbaslik">{t({ tr: "Araştırma alanınız", en: "Your research space" })}</p>
          <h1>{t({ tr: "Kaynaklar", en: "Sources" })}</h1>
          <p className="kaynaklar-aciklama">{t({ tr: "Okuyun, inceleyin, çalışmanızla ilişkilendirin.", en: "Read, review and link them to your work." })}</p>
          {/* Aktif çalışma seçimi her zaman görünür (tek çalışmada da). */}
          {calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/literature" hepGoster /> : null}
        </div>
        {calisma ? <div className="kaynaklar-bas-eylem">{kaynakEkle}</div> : null}
      </section>

      {calismaOkunamadi || kaynakOkunamadi ? (
        <p className="alert" role="alert">
          {calismaOkunamadi
            ? t({
                tr: "Çalışma listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Couldn't load your list of works; what's below may look incomplete. Your records are safe — refresh the page.",
              })
            : t({
                tr: "Kaynak listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Couldn't load your sources; what's below may look incomplete. Your records are safe — refresh the page.",
              })}
        </p>
      ) : null}

      {!calisma ? (
        <BosDurum
          ikon={BookMarked}
          baslik={t({ tr: "Önce bir çalışma başlatın", en: "Start a work first" })}
          aciklama={t({
            tr: "Kaynaklar bir çalışmaya bağlı tutulur: literatürünüz ve kaynakça denetiminiz o çalışmanın atıf stiline göre çalışır.",
            en: "Sources are kept with a work: your literature and reference list check follow that work's citation style.",
          })}
          eylem={{ etiket: t({ tr: "Yeni çalışma", en: "New work" }), href: "/dashboard/editor?yeni=1" }}
        />
      ) : (
        <>
          {/*
            KAYNAKLAR — PREMIUM ÇALIŞMA ALANI (17.11.2026, onaylı tasarım).
            Tek ana liste ve tek belirgin "Kaynak ekle" girişi; DOI, dosyadan
            içe aktarma ve dizinlerde arama o menüden. Kaynakça ayrı sekmede.

            Eskiden literatür ve kaynakça yan yana iki büyük karttı; başlıkta
            "İçe aktar", "Dışa aktar" ve birincil "Kaynak bul", altında her
            zaman açık bir DOI kutusu vardı — üç ayrı giriş, hangisinin
            "ekle" olduğu belli değildi. Hiçbir yol kaldırılmadı. Doğrulama ve
            önbellek kuralları (lib/academic-reference-verification.ts)
            değişmedi; "Doğrulandı"/"Olası eşleşme" ayrımı kaynakça
            sonuçlarında aynen duruyor.
          */}
          {/*
            Sekmeler solda, İKİNCİL eylemler sağda (mockup): tarama asistanı
            ve dışa aktarma sayfanın ana işi değil. İkisi de eskisi gibi
            kendi panelinde açılıyor; içerikleri değişmedi.
          */}
          <div className="kaynak-sekme-serit">
            <nav className="calisma-sekmeleri kaynak-sekmeleri" aria-label={t({ tr: "Kaynaklar ve kaynakça", en: "Sources and reference list" })}>
              <Link href={kapsamAdresi(kapsamBagsiz)} aria-current={kaynakcaSekmesi ? undefined : "page"}>
                {t({ tr: "Kütüphanem", en: "My library" })}
                {kaynaklar.length ? <span className="kaynak-sekme-sayi">{kaynaklar.length}</span> : null}
              </Link>
              <Link href={`/dashboard/literature?calisma=${encodeURIComponent(calisma.id)}&sekme=kaynakca`} aria-current={kaynakcaSekmesi ? "page" : undefined}>
                {t({ tr: "Kaynakça", en: "Reference list" })}
              </Link>
            </nav>
            <div className="kaynak-sekme-eylem">
              {asistanAcik ? (
                <PanelDrawer
                  triggerLabel={t({ tr: "Tarama asistanı", en: "Search assistant" })}
                  triggerIcon={<Sparkles size={15} aria-hidden="true" />}
                  triggerClassName="link-button"
                  kicker={t({ tr: "Literatür", en: "Literature" })}
                  title={t({ tr: "Tarama asistanı", en: "Search assistant" })}
                  description={t({
                    tr: "Asistan kaynak önermez: araştırma sorunuzdan veri tabanlarına yapıştırabileceğiniz arama dizeleri kurar ve listenizdeki boşlukları gösterir.",
                    en: "The assistant doesn't recommend sources: it builds search strings from your research question that you can paste into databases, and shows gaps in your list.",
                  })}
                  boy="genis"
                  basaridaKapan={false}
                >
                  <LiteraturAsistani projeler={[{ id: calisma.id, title: calisma.title }]} asistanAcik={asistanAcik} secilenCalisma={calisma.id} />
                </PanelDrawer>
              ) : null}
              {kaynaklar.length ? (
                <PanelDrawer
                  triggerLabel={t({ tr: "Dışa aktar", en: "Export" })}
                  triggerIcon={<Download size={15} aria-hidden="true" />}
                  triggerClassName="link-button"
                  kicker={t({ tr: "Literatür", en: "Literature" })}
                  title={t({ tr: "Kaynakça ve dışa aktarma", en: "Reference list and export" })}
                  description={t({
                    tr: "Kaynakçanızı çalışmanızın atıf stilinde kopyalayın ya da kaynaklarınızı başka bir programa aktarın.",
                    en: "Copy your reference list in your work's citation style, or export your sources to another program.",
                  })}
                  boy="genis"
                  basaridaKapan={false}
                >
                  <DisaAktarma
                    kaynaklar={kaynaklar}
                    dil={kaynakcaDili}
                    stil={(calisma.citation_style && calisma.citation_style in STIL_ETIKETLERI ? calisma.citation_style : "apa7") as CitationStyle}
                    stilAdi={cslMi(calisma.citation_style) ? stilAdi(calisma.citation_style) : STIL_ETIKETLERI[calisma.citation_style ?? "apa7"] ?? "APA 7"}
                    cslStil={cslMi(calisma.citation_style) ? calisma.citation_style : null}
                    calismaAdi={calisma.title}
                  />
                </PanelDrawer>
              ) : null}
            </div>
          </div>

          {kaynakcaSekmesi ? (
            <section className="kaynak-tek kaynakca-alan" aria-label={t({ tr: "Kaynakça", en: "Reference list" })}>
              {/*
                DENETİM ÖZETİ ŞERİDİ (23.11.2026 tasarım turu). Sekmelerin
                hemen altında tek ve kompakt: solda durum + incelenen künye
                sayısı + son denetimin tarihi ve saati, sağda ana eylem.
                Tek kategorili bulguda türün kendisi yazılıyor ("2 biçim
                uyarısı"); "2 açık sorun" kullanıcıyı neyin sorun olduğunu
                aramaya gönderiyordu.
              */}
              <div className="kaynakca-serit" data-tone={sonDenetim ? ton : "neutral"}>
                <span className="kaynakca-serit-govde">
                  <span className="kaynakca-serit-ana">
                    {sonDenetim && ozet ? <i className="kaynakca-nokta" data-tone={ton} aria-hidden="true" /> : null}
                    {!sonDenetim || !ozet
                      ? t({ tr: "Henüz denetlenmedi", en: "Not checked yet" })
                      : vurgu.tur === "temiz"
                        ? t({ tr: "Açık sorun yok", en: "No open issues" })
                        : vurgu.tur === "tek" && vurgu.anahtar
                          ? t(KATEGORI_SAYISI[vurgu.anahtar](vurgu.sayi))
                          : t({
                              tr: `${vurgu.sayi} açık sorun`,
                              en: `${vurgu.sayi} open ${vurgu.sayi === 1 ? "issue" : "issues"}`,
                            })}
                  </span>
                  {sonDenetim && ozet ? (
                    <span className="kaynakca-serit-meta">
                      {t({
                        tr: `${ozet.kunye} künye incelendi · son denetim ${tarihSaat(sonDenetim.tarih)}`,
                        en: `${ozet.kunye} ${ozet.kunye === 1 ? "reference" : "references"} checked · last check ${tarihSaat(sonDenetim.tarih)}`,
                      })}
                    </span>
                  ) : null}
                  {/* Dağılım TEK yerde: ayrı bir özet satırında tekrarlanmıyor. */}
                  {vurgu.tur === "coklu" ? (
                    <span className="kaynakca-serit-dagilim">
                      {vurgu.dagilim.map((k) => (
                        <span key={k.anahtar}>{t(KATEGORI_SAYISI[k.anahtar](k.sayi))}</span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <KaynakcaPenceresi
                  /* key: geçmişten başka bir denetim seçilince pencere
                     YENİDEN kuruluyor. PanelDrawer açık/kapalı durumunu
                     mount'ta okuyor; aynı örnekte `acikBasla` değişince
                     pencere açılmıyordu. */
                  key={secilenDenetim ?? "son-denetim"}
                  calisma={{ ...calisma, citation_style: calisma.citation_style ?? "apa7" }}
                  sonDenetim={sonDenetim ? { acikSorun: ozet?.acikSorun ?? null, tarih: sonDenetim.tarih } : null}
                  denetimId={secilenDenetim}
                  acikBasla={Boolean(secilenDenetim)}
                  triggerLabel={
                    secilenDenetim
                      ? t({ tr: "Seçilen denetimi aç", en: "Open the selected check" })
                      : sonDenetim
                        ? t({ tr: "Sonuçları aç", en: "Open results" })
                        : t({ tr: "Kaynakçamı denetle", en: "Check my reference list" })
                  }
                  triggerClassName="projects-primary-button button-compact kaynakca-serit-eylem"
                />
              </div>

              <div className="kaynakca-ikili">
                <article className="gb-kart kaynakca-bulgular">
                  {sonDenetim && ozet ? (
                    <>
                      <div className="kaynakca-bolum-bas">
                        <h3>{t({ tr: "İncelenmesi gerekenler", en: "What needs attention" })}</h3>
                        {dikkat.length ? (
                          <small>
                            {t({
                              tr: `${dikkat.length} kategori`,
                              en: `${dikkat.length} ${dikkat.length === 1 ? "category" : "categories"}`,
                            })}
                          </small>
                        ) : null}
                      </div>
                      {dikkat.length ? (
                        <ul className="kaynakca-liste">
                          {/*
                            Ayrıntısı olan bulgular künyesi ve GERÇEK uyarı
                            metniyle; aynı künyenin uyarıları tek satırda.
                            Satır sayısı bir toplam değildir — toplam
                            lib/kaynakca-ozeti.ts'ten gelir.
                          */}
                          {gorunenBulgular.map((b, i) => (
                            <li key={`${b.anahtar}-${i}`}>
                              <Link
                                className="kaynakca-satir"
                                href={ayrintiAdresi}
                                aria-label={`${t(KATEGORI_KISA[b.anahtar])}: ${b.metin}`}
                              >
                                <span className="kaynakca-satir-govde">
                                  <b>{b.metin}</b>
                                  {b.uyarilar.map((u) => (
                                    <small key={u}>
                                      <i className="kaynakca-nokta" data-tone={TON[b.anahtar]} aria-hidden="true" />
                                      {u}
                                    </small>
                                  ))}
                                </span>
                                <ChevronRight size={15} aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                          {/* Eski kayıtta ayrıntı yok: kategori ve adet. */}
                          {ayrintisizKategoriler.map((k) => (
                            <li key={k.anahtar}>
                              <Link className="kaynakca-satir" href={ayrintiAdresi}>
                                <span className="kaynakca-satir-govde">
                                  <b>{t(KATEGORI_ADI[k.anahtar])}</b>
                                  <small>
                                    <i className="kaynakca-nokta" data-tone={TON[k.anahtar]} aria-hidden="true" />
                                    {t({ tr: "ayrıntı bu kayıtta yok; sonuç ekranında inceleyin", en: "no detail in this record; review it on the results screen" })}
                                  </small>
                                </span>
                                <span className="status-pill" data-tone={TON[k.anahtar]}>{k.sayi}</span>
                                <ChevronRight size={15} aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="kaynakca-bos">{t({ tr: "İncelenmesi gereken bulgu yok.", en: "Nothing needs attention." })}</p>
                      )}
                      {kalanBulgu > 0 ? (
                        <Link className="kaynakca-daha" href={ayrintiAdresi}>
                          {t({
                            tr: `Bu kategorilerde ${kalanBulgu} kayıt daha var — sonuç ekranında görün`,
                            en: `${kalanBulgu} more entries in these categories — see them on the results screen`,
                          })}
                        </Link>
                      ) : null}
                      {ozet.dizindeBakilan != null && ozet.dizindeBakilan > 0 && ozet.dizindeBakilan < ozet.kunye ? (
                        <p className="kaynakca-kapsam">
                          {t({
                            tr: `Dizin doğrulaması ${ozet.dizindeBakilan}/${ozet.kunye} künyede yapıldı; kalanlara bu turda bakılmadı.`,
                            en: `Index verification covered ${ozet.dizindeBakilan}/${ozet.kunye} references; the rest weren't checked this round.`,
                          })}
                        </p>
                      ) : null}
                      {/*
                        TÜM KONTROLLER kapalı başlıyor: temiz ve
                        denetlenmemiş kategoriler erişilebilir kalsın ama
                        ilk bakışı doldurmasın. Sayı denetimin kategori
                        listesinden; satır sayısından türetilmiyor.
                      */}
                      <details className="kaynakca-tum">
                        <summary>
                          {/* Sayı, denetimin kategori listesinden (çizilen
                              satırların sayısı); bulgu satırlarından
                              türetilmiyor. */}
                          {t({
                            tr: `Tüm kontroller (${dikkat.length + otekiler.length})`,
                            en: `All checks (${dikkat.length + otekiler.length})`,
                          })}
                        </summary>
                        <ul className="kaynakca-liste">
                          {[...dikkat, ...otekiler].map((k) => (
                            <li key={k.anahtar}>
                              <span className="kaynakca-satir">
                                <span className="kaynakca-satir-govde">
                                  <b>{t(KATEGORI_ADI[k.anahtar])}</b>
                                  {k.olculdu && !k.toplamaKatilir ? (
                                    <small>{t({ tr: "geçici arıza; toplama katılmıyor", en: "temporary failure; not counted in the total" })}</small>
                                  ) : null}
                                  {k.olculdu ? null : <small>{t(OLCULMEDI_SEBEBI[k.anahtar])}</small>}
                                </span>
                                {k.olculdu ? (
                                  <span className="status-pill" data-tone={k.sayi ? TON[k.anahtar] : "success"}>
                                    {k.sayi
                                      ? k.anahtar === "ulasilamayan"
                                        ? t({ tr: `Dizine ulaşılamadı: ${k.sayi}`, en: `Index unreachable: ${k.sayi}` })
                                        : k.sayi
                                      : t({ tr: "Yok", en: "None" })}
                                  </span>
                                ) : (
                                  <span className="status-pill" data-tone="neutral">{t({ tr: "Denetlenmedi", en: "Not checked" })}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </>
                  ) : (
                    <p className="gb-bos">
                      {t({
                        tr: "Kaynakçanız editördeki metinden alınır ya da yapıştırılır; künyelerin biçimi, metindeki atıflarla eşleşmesi ve kaynakların gerçekten var olup olmadığı (Crossref, OpenAlex) birlikte denetlenir.",
                        en: "Your reference list is taken from your text in the editor or pasted in; the format of each reference, its match with in-text citations, and whether the source actually exists (Crossref, OpenAlex) are checked together.",
                      })}
                    </p>
                  )}
                </article>

                {/* Geçmiş kendi kartında; SON denetim burada tekrarlanmıyor. */}
                <aside className="gb-kart kaynakca-gecmis-kart" aria-label={t({ tr: "Denetim geçmişi", en: "Check history" })}>
                  <div className="kaynakca-bolum-bas">
                    <h3>{t({ tr: "Denetim geçmişi", en: "Check history" })}</h3>
                  </div>
                  {oncekiDenetimler.length > 1 ? (
                    <ul className="kaynakca-liste kaynakca-gecmis">
                      {oncekiDenetimler.slice(1).map((d) => (
                        <li key={d.id}>
                          <Link
                            className="kaynakca-satir"
                            href={`${kapsamAdresi(false)}&sekme=kaynakca&denetim=${encodeURIComponent(d.id)}`}
                            aria-label={t({
                              tr: `${tarihSaat(d.created_at)} denetiminin sonucunu aç`,
                              en: `Open the result of the check from ${tarihSaat(d.created_at)}`,
                            })}
                          >
                            <span className="kaynakca-satir-govde">
                              <b>{tarihSaat(d.created_at)}</b>
                            </span>
                            <ChevronRight size={15} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="kaynakca-bos">
                      {t({ tr: "Bu çalışmanın başka denetimi yok.", en: "This work has no other checks." })}
                    </p>
                  )}
                </aside>
              </div>
            </section>
          ) : (
          <section className="kaynak-tek kaynak-arastirma" aria-label={t({ tr: "Kaynaklar", en: "Sources" })}>
            {/* DOI kutusu yalnızca "DOI ile ekle" seçilince ya da adreste DOI varken. */}
            {ekleMenusuAcik ? (
              <DoiEkleKutusu
                projectId={calisma.id}
                ilkDeger={typeof gelenDoi === "string" ? gelenDoi.slice(0, 300) : ""}
                odakla
                aramaTetikleyicisi=".kaynak-bul-tetik"
              />
            ) : null}
            {kaynakOkunamadi ? (
              /*
                HATA ile BOŞ KÜTÜPHANE AYRI (22.11.2026). Okuma düşünce
                eskiden liste boş çiziliyordu: öğrenci topladığı literatürü
                kaybettiğini sanıyordu. Yukarıdaki uyarı zaten çıkıyor;
                burada "kaynak yok" mesajı YAZILMIYOR.
              */
              null
            ) : kaynaklar.length ? (
              <KaynakAlani
                /* Derin bağlantı değişince bileşen sıfırdan kurulur: seçim, sekme ve süzgeç yeni isteğe göre başlar. */
                key={`${kapsamBagsiz ? "bagsiz" : calisma.id}-${odakKaynak?.id ?? ""}`}
                kaynaklar={kaynaklar}
                projectId={kapsamBagsiz ? null : calisma.id}
                pdfler={pdfler}
                ilkSecim={odakKaynak && kaynaklar.some((k) => k.id === odakKaynak.id) ? odakKaynak.id : null}
                kapsamBagsiz={kapsamBagsiz}
              />
            ) : (
              <div className="pw-kaynak-bos">
                <BookMarked size={20} aria-hidden="true" />
                <p>
                  {kapsamBagsiz
                    ? t({
                        tr: "Bir çalışmaya bağlı olmayan kaynağınız yok. Bu liste, bir çalışmaya bağlanmadan eklenmiş kaynakları gösterir.",
                        en: "You have no sources outside a work. This list shows sources added without being linked to a work.",
                      })
                    : t({
                        tr: "Henüz kaynak yok. \"Kaynak ekle\" ile DOI yapıştırın, Zotero/Mendeley dosyanızı içe aktarın ya da OpenAlex ve Crossref dizinlerinde arayın. Okuduğunuzu ve metinde kullandığınızı burada işaretlersiniz.",
                        en: "No sources yet. Use \"Add source\" to paste a DOI, import your Zotero/Mendeley file or search the OpenAlex and Crossref indexes. Mark what you've read and cited here.",
                      })}
                </p>
              </div>
            )}

            {/*
              ÇALIŞMAYA BAĞLI OLMAYAN KAYNAKLAR her durumda erişilebilir:
              bağlantı listeden ayrı, SAYFADA duruyor. Liste bileşeninin
              içindeyken, seçili çalışmanın hiç kaynağı olmadığında (yani
              tam da bağımsız kaynaklara bakılacak durumda) bileşenle
              birlikte kayboluyordu.
            */}
            {kapsamBagsiz ? (
              <Link href={kapsamAdresi(false)} className="kaynak-liste-alt" scroll={false}>
                {t({ tr: "Çalışmanın kaynaklarına dön", en: "Back to the work's sources" })}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ) : bagsiz ? (
              <Link href={kapsamAdresi(true)} className="kaynak-liste-alt" scroll={false}>
                {t({
                  tr: `Çalışmaya bağlı olmayanlar · ${bagsiz}`,
                  en: `Not linked to a work · ${bagsiz}`,
                })}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </section>
          )}
        </>
      )}
    </main>
  );
}
