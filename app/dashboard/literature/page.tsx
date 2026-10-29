import { BookMarked, Download, FileUp, Sparkles } from "lucide-react";
import { getLiteratureSources } from "@/app/actions/literature";
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
import KaynakListesi from "./kaynak-listesi";
import { DisaAktarma, IceAktarma } from "./kaynak-aktarim-araclari";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import type { CitationStyle } from "@/lib/citation-format";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Kaynaklar", en: "Sources" }) };
}

/* Kaynak PDF'lerini bulan sunucu işlemi kaynakça penceresinden çağrılıyor
   ve dış arşivlerden indiriyor (app/actions/kaynak-pdf.ts, bütçe 40 sn). */
export const maxDuration = 60;

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
  searchParams: Promise<{ calisma?: string }>;
}) {
  const { calisma: istenen } = await searchParams;
  const t = await ceviri();
  const { tarih, tarihSaat } = await tarihler();
  const [
    { satirlar: calismalar, okunamadi: calismaOkunamadi },
    { satirlar: tumKaynaklar, okunamadi: kaynakOkunamadi },
    { satirlar: denetimler },
    asistanAcik,
  ] = await Promise.all([getMyProjects(), getLiteratureSources(), getMyCitationChecks(), literaturAsistaniAcik()]);

  /* Adresteki çalışma listede yoksa yok sayılır; yoksa en son açılan. */
  const calisma = calismalar.find((c) => c.id === istenen) ?? calismalar[0] ?? null;
  const sonDenetim = calisma ? await sonKaynakcaDenetimi(calisma.id) : null;
  /* Kopyalanan kaynakça çalışmanın diliyle ("n.d." mi "t.y." mi): editörün
     eklediği atıflarla aynı dil (lib/belge-dili.ts). */
  const kaynakcaDili = calisma ? await belgeDili(await createClient(), calisma.id, await aktifDil()) : await aktifDil();

  const kaynaklar = calisma
    ? tumKaynaklar
        .filter((k) => k.project_id === calisma.id)
        .sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum))
    : [];
  const say = (durum: Durum) => kaynaklar.filter((k) => k.status === durum).length;
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
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Kaynaklar", en: "Sources" })}</h1>
          <p>
            {calisma
              ? t({
                  tr: `“${calisma.title}” çalışmasının literatürü ve kaynakçası. Kaynak özeti ya da yorum üretilmez; künyeler dizinlerde doğrulanır.`,
                  en: `Literature and reference list for “${calisma.title}”. No source summaries or commentary are generated; references are verified against the indexes.`,
                })
              : t({ tr: "Çalışmalarınızın literatürü ve kaynakçası tek yerde.", en: "Your works' literature and reference lists in one place." })}
          </p>
        </div>
        {calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/literature" /> : null}
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
        <section className="gb-sutunlar kaynaklar-ikili" aria-label={t({ tr: "Literatür ve kaynakça", en: "Literature and reference list" })}>
          <article className="gb-kart gb-sutun">
            <header className="gb-kart-bas">
              <div>
                <h2>{t({ tr: "Literatür", en: "Literature" })}</h2>
                <p>
                  {kaynaklar.length
                    ? t({
                        tr: `${kaynaklar.length} kaynak · ${say("to_review")} okunacak · ${say("read")} okundu · ${say("used")} metinde`,
                        en: `${kaynaklar.length} ${kaynaklar.length === 1 ? "source" : "sources"} · ${say("to_review")} to read · ${say("read")} read · ${say("used")} cited`,
                      })
                    : t({ tr: "Bu çalışmaya bağlı kaynak yok", en: "No sources linked to this work" })}
                </p>
              </div>
              <div className="pencere-dugmeler">
                {asistanAcik ? (
                  <PanelDrawer
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
                ) : null}
                {/* Toplu ekleme ve dışa aktarma (27.10.2026): Zotero/Mendeley dosyası,
                    DOI listesi; RIS/BibTeX indirme ve stilinde kaynakça kopyalama. */}
                <PanelDrawer
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
                </PanelDrawer>
                {kaynaklar.length ? (
                  <PanelDrawer
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
                      stilAdi={STIL_ETIKETLERI[calisma.citation_style ?? "apa7"] ?? "APA 7"}
                      calismaAdi={calisma.title}
                    />
                  </PanelDrawer>
                ) : null}
                <LiteraturPenceresi
                  projectId={calisma.id}
                  projeAdi={calisma.title}
                  triggerLabel={t({ tr: "Kaynak bul", en: "Find sources" })}
                  triggerClassName="projects-primary-button button-compact"
                />
              </div>
            </header>
            {kaynaklar.length ? (
              <KaynakListesi kaynaklar={kaynaklar} />
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

          <article className="gb-kart gb-sutun">
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
                triggerClassName="projects-primary-button button-compact"
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
