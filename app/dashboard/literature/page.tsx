import { CalismaBaglamiYayinla } from "../_components/calisma-baglami";
import DoiEkleKutusu from "./doi-ekle-kutusu";
import { BookMarked, Download, FileUp, Sparkles } from "lucide-react";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { kaynakBaglamlari } from "@/lib/kaynak-kutuphanesi";
import { dipnotMetinleri } from "@/lib/tiptap-text";
import { splitBodyAndReferences } from "@/lib/text-split";
import { stilTanimi } from "@/lib/atif/stiller";
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
import CalismaSecimDurumu from "../_components/calisma-secim-durumu";
import { calismaSec } from "@/lib/calisma-secimi";
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import SayfaEylemleri from "../_components/sayfa/sayfa-eylemleri";
import KaynakListesi from "./kaynak-listesi";
import { DisaAktarma, IceAktarma } from "./kaynak-aktarim-araclari";
import { STIL_ETIKETLERI, stilAdi } from "@/lib/atif/stiller";
import { cslMi } from "@/lib/atif/csl-kimlik";
import type { CitationStyle } from "@/lib/citation-format";

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
  searchParams: Promise<{ calisma?: string; doi?: string; ekle?: string }>;
}) {
  const { calisma: istenen, doi: gelenDoi, ekle } = await searchParams;
  const t = await ceviri();
  const { tarih, tarihSaat } = await tarihler();
  const [
    { satirlar: calismalar, okunamadi: calismaOkunamadi },
    { satirlar: tumKaynaklar, okunamadi: kaynakOkunamadi },
    { satirlar: denetimler },
    asistanAcik,
  ] = await Promise.all([getMyProjects(), getLiteratureSources(), getMyCitationChecks(), literaturAsistaniAcik()]);

  /*
    Adresteki çalışma yoksa BAŞKA ÇALIŞMAYA GEÇİLMEZ (4.3.5, B1; lib/calisma-secimi.ts).
    Eskiden listedeki ilk çalışma sessizce açılıyordu: başka bir çalışmanın
    verisi görünüyor, oraya ekleme yapılabiliyordu.
  */
  const secim = calismaSec(calismalar, istenen, calismaOkunamadi);
  const calisma = secim.tur === "secili" ? secim.calisma : null;
  const sonDenetim = calisma ? await sonKaynakcaDenetimi(calisma.id) : null;
  /* Kopyalanan kaynakça çalışmanın diliyle ("n.d." mi "t.y." mi): editörün
     eklediği atıflarla aynı dil (lib/belge-dili.ts). */
  const kaynakcaDili = calisma ? await belgeDili(await createClient(), calisma.id, await aktifDil()) : await aktifDil();

  const kaynaklar = calisma
    ? tumKaynaklar
        .filter((k) => k.project_id === calisma.id)
        .sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum))
    : [];
  const baglam = calisma && kaynaklar.length ? await kaynaklarinYeri(calisma.id, calisma.citation_style, kaynaklar) : null;
  const bagsiz = tumKaynaklar.filter((k) => !k.project_id).length;
  const oncekiDenetimler = calisma ? denetimler.filter((d) => d.project_id === calisma.id) : [];

  const skor = sonDenetim ? sonDenetim.complianceScore : null;
  const ton = skor == null ? "neutral" : skor >= 85 ? "success" : skor >= 60 ? "warning" : "danger";
  /* Son denetimin bulguları: her biri ayrı satır, tek bir "doğrulandı" yok. */
  const bulgular = sonDenetim
    ? [
        { ad: t({ tr: "Metinde atfı olmayan kaynak", en: "Sources not cited in the text" }), sayi: sonDenetim.crossCheck.referencesWithoutCitation.length },
        { ad: t({ tr: "Kaynakçada karşılığı olmayan atıf", en: "Citations missing from the reference list" }), sayi: sonDenetim.crossCheck.citationsWithoutReference.length },
        { ad: t({ tr: "Dizinlerde bulunamayan kaynak", en: "Sources not found in the indexes" }), sayi: sonDenetim.verificationSummary.notFound },
        ...(sonDenetim.tyk ? [{ ad: t({ tr: "Kılavuzun atıf örneğine uymayan atıf", en: "Citations that don't match the guideline's example" }), sayi: sonDenetim.tyk.length }] : []),
      ]
    : [];

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      {/* Adreste çalışma seçiliyse (?calisma=) gezinme o çalışmanın bölümlerini gösterir (Phase 3, os-gezinme.tsx). */}
      {calisma && secim.tur === "secili" && secim.adrestenMi ? <CalismaBaglamiYayinla id={calisma.id} baslik={calisma.title} tur={calisma.project_type} /> : null}
      {/* Ortak sayfa başlığı (Signature OS 4.1). Açıklama artık çalışmanın
          adını tekrar etmiyor: ad çalışma seçicide yazıyor. */}
      <SayfaBasligi
        baslik={t({ tr: "Kaynaklar", en: "Sources" })}
        aciklama={
          calisma
            ? t({
                tr: "Literatür ve kaynakça. Kaynak özeti ya da yorum üretilmez; künyeler dizinlerde doğrulanır.",
                en: "Literature and reference list. No source summaries or commentary are generated; references are verified against the indexes.",
              })
            : t({ tr: "Çalışmalarınızın literatürü ve kaynakçası tek yerde.", en: "Your works' literature and reference lists in one place." })
        }
        baglam={calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/literature" /> : null}
        /*
          Sayfanın eylemleri BAŞLIKTA (4.2, referans uygulama): birincil
          "Kaynak bul"; sık kullanılan "İçe aktar" satırda; tarama asistanı ve
          dışa aktarma "⋯" menüsünde. 4.1'de Literatür kartının başındaydı;
          kart başlığı, sayfa başlığı ve eylem kutusu üç katman oluyordu.
          Toplu ekleme ve dışa aktarma (27.10.2026): Zotero/Mendeley dosyası,
          DOI listesi; RIS/BibTeX indirme ve stilinde kaynakça kopyalama.
        */
        eylemler={
          calisma ? (
            <SayfaEylemleri
              etiket={t({ tr: "Literatür eylemleri", en: "Literature actions" })}
              birincil={
                <LiteraturPenceresi
                  projectId={calisma.id}
                  projeAdi={calisma.title}
                  triggerLabel={t({ tr: "Kaynak bul", en: "Find sources" })}
                  triggerClassName="projects-primary-button button-compact kaynak-bul-tetik"
                />
              }
              ikincil={[
                <PanelDrawer
                  key="ice-aktar"
                  triggerLabel={t({ tr: "İçe aktar", en: "Import" })}
                  triggerIcon={<FileUp size={15} aria-hidden="true" />}
                  triggerClassName="projects-filter-button button-compact"
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
                </PanelDrawer>,
              ]}
              tasma={[
                asistanAcik ? (
                  <PanelDrawer
                    key="tarama-asistani"
                    triggerLabel={t({ tr: "Tarama asistanı", en: "Search assistant" })}
                    triggerIcon={<Sparkles size={15} aria-hidden="true" />}
                    triggerClassName="projects-filter-button button-compact"
                    kicker={t({ tr: "Literatür", en: "Literature" })}
                    title={t({ tr: "Tarama asistanı", en: "Search assistant" })}
                    description={t({
                      tr: "Asistan kaynak önermez: araştırma sorunuzdan veri tabanlarına yapıştırabileceğiniz arama dizeleri kurar ve listenizdeki boşlukları gösterir.",
                      en: "The assistant doesn't recommend sources: it builds search strings from your research question that you can paste into databases, and shows gaps in your list.",
                    })}
                    boy="genis"
                    basaridaKapan={false}
                  >
                    <LiteraturAsistani
                      projeler={[{ id: calisma.id, title: calisma.title }]}
                      asistanAcik={asistanAcik}
                      secilenCalisma={calisma.id}
                    />
                  </PanelDrawer>
                ) : null,
                kaynaklar.length ? (
                  <PanelDrawer
                    key="disa-aktar"
                    triggerLabel={t({ tr: "Dışa aktar", en: "Export" })}
                    triggerIcon={<Download size={15} aria-hidden="true" />}
                    triggerClassName="projects-filter-button button-compact"
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
                ) : null,
              ]}
            />
          ) : null
        }
      />

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

      {secim.tur === "bulunamadi" || secim.tur === "secim-gerekli" ? (
        <CalismaSecimDurumu
          tur={secim.tur}
          calismalar={calismalar}
          yol="/dashboard/literature"
          ek={{ doi: typeof gelenDoi === "string" ? gelenDoi.slice(0, 300) : undefined, ekle }}
          bolum={{ ad: { tr: "Kaynaklar", en: "Sources" }, hal: { tr: "kaynaklarını", en: "sources" } }}
        />
      ) : !calisma ? (
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
        <section className="gb-sutunlar kaynaklar-ikili" aria-label={t({ tr: "Literatür ve kaynakça", en: "Literature and reference list" })}>
          <article className="gb-kart gb-sutun">
            {/* Kart başlığı yalnızca ad (4.2): sayıların hepsi hemen alttaki süzgeç
                düğmelerinde; "3 kaynak · 1 okunacak…" alt başlığı onları tekrar
                ediyordu. Eylemler sayfa başlığında. */}
            <header className="gb-kart-bas kaynak-kart-bas">
              <h2>{t({ tr: "Literatür", en: "Literature" })}</h2>
            </header>
            {/* DOI ile ekleme görünür (Phase 3): eskiden "İçe aktar" penceresinin içindeydi. */}
            <DoiEkleKutusu
              projectId={calisma.id}
              calismaAdi={calisma.title}
              ilkDeger={typeof gelenDoi === "string" ? gelenDoi.slice(0, 300) : ""}
              odakla={ekle === "1" || typeof gelenDoi === "string"}
              aramaTetikleyicisi=".kaynak-bul-tetik"
            />
            {kaynaklar.length ? (
              <KaynakListesi kaynaklar={kaynaklar} projectId={calisma.id} baglam={baglam} />
            ) : (
              <p className="gb-bos">
                {t({
                  tr: "\"Kaynak bul\" ile OpenAlex ve Crossref dizinlerinde arayın, \"İçe aktar\" ile Zotero/Mendeley kütüphanenizi ya da DOI listenizi ekleyin. Okuduğunuzu ve metinde kullandığınızı burada işaretlersiniz.",
                  en: "Search the OpenAlex and Crossref indexes with \"Find sources\", or add your Zotero/Mendeley library or a DOI list with \"Import\". Mark what you've read and cited here.",
                })}
              </p>
            )}
            {bagsiz ? (
              <p className="hint">
                {t({
                  tr: `${bagsiz} kaynağınız bir çalışmaya bağlı değil; burada görünmüyor.`,
                  en: `${bagsiz} of your ${bagsiz === 1 ? "sources isn't" : "sources aren't"} linked to a work and ${bagsiz === 1 ? "doesn't" : "don't"} appear here.`,
                })}
              </p>
            ) : null}
          </article>

          <article className="gb-kart gb-sutun kaynakca-kart">
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
                sonDenetim={sonDenetim ? { skor, tarih: sonDenetim.tarih } : null}
                triggerLabel={sonDenetim ? t({ tr: "Sonuçları aç", en: "Open results" }) : t({ tr: "Kaynakçamı denetle", en: "Check my reference list" })}
                /* İkincil (4.1): ekranın tek birincil eylemi "Kaynak bul". */
                triggerClassName="projects-filter-button button-compact"
              />
            </header>
            {sonDenetim ? (
              <>
                {/* Puan çalışmanın kendi atıf stiline göre; stil adı yazılmıyor. */}
                <div className="kaynakca-puan" data-tone={ton}>
                  <b>{skor}</b>
                  <span>{t({ tr: "/100 kaynakça uyumu", en: "/100 reference list compliance" })}</span>
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
                          <span className="gb-zaman">{d.compliance_score ?? "—"}/100</span>
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
      )}
    </main>
  );
}

/*
  KAYNAĞIN ÇALIŞMADAKİ YERİ (Signature OS 4.2): metinde atıf, kanıt
  matrisindeki iddialar, çalışma klasöründe DOI'si aynı PDF. Karar saf
  modülde (lib/kaynak-kutuphanesi.ts); burada yalnızca üç okuma. Biri
  okunamazsa o bilgi "bilinmiyor" gösterilir — "yok" değil: okunamayan
  kanıt listesi "hiçbir iddiada kullanılmıyor" demek olmazdı.
*/
async function kaynaklarinYeri(projectId: string, atifStili: string | null, kaynaklar: LiteratureSource[]) {
  const supabase = await createClient();
  const [musvedde, kanit, pdf] = await Promise.all([
    /* content: dipnot metinleri için (4.3.5) — dipnotlu stilde atıf orada; plain_text dipnotları bilerek dışarıda bırakır. */
    supabase.from("project_manuscripts").select("plain_text, content").eq("project_id", projectId).maybeSingle(),
    supabase.from("kanit_kayitlari").select("kaynak_id").eq("project_id", projectId),
    supabase.from("kaynak_pdfleri").select("doi").eq("project_id", projectId).in("durum", ["indirildi", "yuklendi"]),
  ]);
  if (musvedde.error) console.error("[kaynaklar] müsvedde metni okunamadı:", musvedde.error.message);
  if (kanit.error) console.error("[kaynaklar] kanıt kayıtları okunamadı:", kanit.error.message);
  if (pdf.error) console.error("[kaynaklar] kaynak PDF'leri okunamadı:", pdf.error.message);
  const atifTuru = stilTanimi(atifStili).tur;
  const duz = musvedde.error ? null : (musvedde.data?.plain_text ?? "");
  const govdeMetni = duz === null ? null : splitBodyAndReferences(`\n${duz}\n`).bodyText;
  return {
    satirlar: kaynakBaglamlari(kaynaklar, {
      govdeMetni,
      atifTuru,
      dipnotlar: musvedde.error ? null : dipnotMetinleri(musvedde.data?.content ?? null),
      kanitKaynaklari: (kanit.data ?? []).map((k) => k.kaynak_id as string | null),
      pdfDoileri: (pdf.data ?? []).map((p) => p.doi as string | null),
    }),
    /* Metinden okunamamanın sebebi: ayrıntıda tek cümleyle söylenir. */
    /* Dipnotlu stil artık dipnot metinlerinden okunuyor (4.3.5); metinden okunamayan yalnızca numaralı stil. */
    metinSebebi: musvedde.error ? ("okunamadi" as const) : atifTuru === "numara" ? atifTuru : !govdeMetni?.trim() ? ("bos" as const) : null,
    kanitOkunamadi: Boolean(kanit.error),
    pdfOkunamadi: Boolean(pdf.error),
  };
}
