import DoiEkleKutusu from "./doi-ekle-kutusu";
import Link from "next/link";
import { BookMarked, Download, FileUp, Link2, Plus, Sparkles } from "lucide-react";
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
import { kaynakcaOzeti } from "@/lib/kaynakca-ozeti";

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
  searchParams: Promise<{ calisma?: string; doi?: string; ekle?: string; sekme?: string; kaynak?: string; kapsam?: string }>;
}) {
  const { calisma: istenen, doi: gelenDoi, ekle, sekme, kaynak: istenenKaynak, kapsam } = await searchParams;
  const t = await ceviri();
  const { tarih, tarihSaat } = await tarihler();
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
  /* Son denetimin bulguları: her biri ayrı satır, tek bir "doğrulandı" yok. */
  const bulgular = sonDenetim
    ? [
        { ad: t({ tr: "Metinde atfı olmayan kaynak", en: "Sources not cited in the text" }), sayi: sonDenetim.crossCheck.referencesWithoutCitation.length },
        { ad: t({ tr: "Kaynakçada karşılığı olmayan atıf", en: "Citations missing from the reference list" }), sayi: sonDenetim.crossCheck.citationsWithoutReference.length },
        { ad: t({ tr: "Dizinlerde bulunamayan kaynak", en: "Sources not found in the indexes" }), sayi: sonDenetim.verificationSummary.notFound },
        /* Dizine ulaşılamayanlar "bulunamayan"a katılmıyor (12.11.2026); ayrı satır, yalnızca varsa.
           Eski kayıtlarda alan yok. */
        ...((sonDenetim.verificationSummary.unreachable ?? 0) > 0
          ? [{ ad: t({ tr: "Dizine ulaşılamayan kaynak (tekrar denetleyin)", en: "Sources whose indexes were unreachable (check again)" }), sayi: sonDenetim.verificationSummary.unreachable ?? 0 }]
          : []),
        ...(sonDenetim.tyk ? [{ ad: t({ tr: "Kılavuzun atıf örneğine uymayan atıf", en: "Citations that don't match the guideline's example" }), sayi: sonDenetim.tyk.length }] : []),
      ]
    : [];

  const kaynakcaSekmesi = sekme === "kaynakca";
  const ekleMenusuAcik = ekle === "1" || typeof gelenDoi === "string";
  const kapsamAdresi = (bagsiz: boolean) =>
    calisma
      ? `/dashboard/literature?calisma=${encodeURIComponent(calisma.id)}${bagsiz ? "&kapsam=bagsiz" : ""}`
      : "/dashboard/literature";

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
          <p className="kaynaklar-ustbaslik">{t({ tr: "Araştırma alanınız", en: "Your research space" })}</p>
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
            <section className="kaynak-tek" aria-label={t({ tr: "Kaynakça", en: "Reference list" })}>
          <article className="gb-kart gb-sutun kaynak-tek-kart">
            <header className="gb-kart-bas">
              <div>
                <h2>{t({ tr: "Kaynakça", en: "Reference list" })}</h2>
                <p>
                  {sonDenetim
                    ? t({
                        tr: `Son denetim ${tarihSaat(sonDenetim.tarih)} · ${sonDenetim.toplamKaynak} künye`,
                        en: `Last checked ${tarihSaat(sonDenetim.tarih)} · ${sonDenetim.toplamKaynak} ${sonDenetim.toplamKaynak === 1 ? "reference" : "references"}`,
                      })
                    : t({ tr: "Henüz denetlenmedi", en: "Not checked yet" })}
                </p>
              </div>
              <KaynakcaPenceresi
                calisma={{ ...calisma, citation_style: calisma.citation_style ?? "apa7" }}
                sonDenetim={sonDenetim ? { acikSorun: ozet?.acikSorun ?? null, tarih: sonDenetim.tarih } : null}
                triggerLabel={sonDenetim ? t({ tr: "Sonuçları aç", en: "Open results" }) : t({ tr: "Kaynakçamı denetle", en: "Check my reference list" })}
                triggerClassName="projects-primary-button button-compact"
              />
            </header>
            {sonDenetim ? (
              <>
                {/* Açık sorun ve kapsam; genel uygunluk onayı verilmez. */}
                <div className="kaynakca-puan" data-tone={ton}>
                  <b>{ozet?.acikSorun ?? 0}</b>
                  <span>
                    {t({
                      tr: `açık sorun · ${ozet?.kunye ?? 0} künye denetlendi (biçim, atıf eşleşmesi, dizin)`,
                      en: `open ${ozet?.acikSorun === 1 ? "issue" : "issues"} · ${ozet?.kunye ?? 0} references checked (format, citation matching, index)`,
                    })}
                  </span>
                </div>
                <ul className="gb-liste">
                  {bulgular.map((b) => (
                    <li key={b.ad} className="gb-satir">
                      <span className="gb-satir-govde">
                        <b>{b.ad}</b>
                      </span>
                      <span className="status-pill" data-tone={b.sayi ? "warning" : "success"}>
                        {b.sayi ? b.sayi : t({ tr: "Yok", en: "None" })}
                      </span>
                    </li>
                  ))}
                </ul>
                {oncekiDenetimler.length > 1 ? (
                  <>
                    <h3 className="calisma-durum-alt">{t({ tr: "Önceki denetimler", en: "Previous checks" })}</h3>
                    <ul className="gb-liste">
                      {oncekiDenetimler.slice(1).map((d) => (
                        <li key={d.id} className="gb-satir">
                          <span className="gb-satir-govde">
                            <b>{tarih(d.created_at)}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
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
                bagsizSayisi={bagsiz}
                bagsizAdresi={kapsamAdresi(!kapsamBagsiz)}
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
                {kapsamBagsiz ? (
                  <Link href={kapsamAdresi(false)} className="projects-filter-button button-compact">
                    {t({ tr: "Çalışmanın kaynaklarına dön", en: "Back to the work's sources" })}
                  </Link>
                ) : null}
              </div>
            )}
          </section>
          )}
        </>
      )}
    </main>
  );
}
