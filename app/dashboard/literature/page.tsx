import { BookMarked, Download, FileUp, Sparkles } from "lucide-react";
import { getLiteratureSources } from "@/app/actions/literature";
import { getMyCitationChecks, getMyProjects, sonKaynakcaDenetimi } from "@/app/actions/citation-check";
import { literaturAsistaniAcik } from "@/app/actions/ai-literatur";
import { trTarih, trTarihSaat } from "@/lib/tr-time";
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

export const metadata = { title: "Kaynaklar" };

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
  const [
    { satirlar: calismalar, okunamadi: calismaOkunamadi },
    { satirlar: tumKaynaklar, okunamadi: kaynakOkunamadi },
    { satirlar: denetimler },
    asistanAcik,
  ] = await Promise.all([getMyProjects(), getLiteratureSources(), getMyCitationChecks(), literaturAsistaniAcik()]);

  /* Adresteki çalışma listede yoksa yok sayılır; yoksa en son açılan. */
  const calisma = calismalar.find((c) => c.id === istenen) ?? calismalar[0] ?? null;
  const sonDenetim = calisma ? await sonKaynakcaDenetimi(calisma.id) : null;

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
        { ad: "Metinde atfı olmayan kaynak", sayi: sonDenetim.crossCheck.referencesWithoutCitation.length },
        { ad: "Kaynakçada karşılığı olmayan atıf", sayi: sonDenetim.crossCheck.citationsWithoutReference.length },
        { ad: "Dizinlerde bulunamayan kaynak", sayi: sonDenetim.verificationSummary.notFound },
        ...(sonDenetim.tyk ? [{ ad: "Kılavuzun atıf örneğine uymayan atıf", sayi: sonDenetim.tyk.length }] : []),
      ]
    : [];

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Kaynaklar</h1>
          <p>
            {calisma
              ? `“${calisma.title}” çalışmasının literatürü ve kaynakçası. Kaynak özeti ya da yorum üretilmez; künyeler dizinlerde doğrulanır.`
              : "Çalışmalarınızın literatürü ve kaynakçası tek yerde."}
          </p>
        </div>
        {calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/literature" /> : null}
      </section>

      {calismaOkunamadi || kaynakOkunamadi ? (
        <p className="alert" role="alert">
          {calismaOkunamadi ? "Çalışma listeniz" : "Kaynak listeniz"} okunamadı; aşağısı eksik görünebilir. Kayıtlarınız
          yerinde duruyor — sayfayı yenileyin.
        </p>
      ) : null}

      {!calisma ? (
        <BosDurum
          ikon={BookMarked}
          baslik="Önce bir çalışma başlatın"
          aciklama="Kaynaklar bir çalışmaya bağlı tutulur: literatürünüz ve kaynakça denetiminiz o çalışmanın atıf stiline göre çalışır."
          eylem={{ etiket: "Yeni çalışma", href: "/dashboard/editor?yeni=1" }}
        />
      ) : (
        <section className="gb-sutunlar kaynaklar-ikili" aria-label="Literatür ve kaynakça">
          <article className="gb-kart gb-sutun">
            <header className="gb-kart-bas">
              <div>
                <h2>Literatür</h2>
                <p>
                  {kaynaklar.length
                    ? `${kaynaklar.length} kaynak · ${say("to_review")} okunacak · ${say("read")} okundu · ${say("used")} metinde`
                    : "Bu çalışmaya bağlı kaynak yok"}
                </p>
              </div>
              <div className="pencere-dugmeler">
                {asistanAcik ? (
                  <PanelDrawer
                    triggerLabel="Tarama asistanı"
                    triggerIcon={<Sparkles size={15} aria-hidden="true" />}
                    triggerClassName="projects-filter-button button-compact"
                    kicker="Literatür"
                    title="Tarama asistanı"
                    description="Asistan kaynak önermez: araştırma sorunuzdan veri tabanlarına yapıştırabileceğiniz arama dizeleri kurar ve listenizdeki boşlukları gösterir."
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
                  triggerLabel="İçe aktar"
                  triggerIcon={<FileUp size={15} aria-hidden="true" />}
                  triggerClassName="projects-filter-button button-compact"
                  kicker="Literatür"
                  title="Kaynakları toplu ekleyin"
                  description="Zotero, Mendeley ya da EndNote kütüphanenizi dosyayla aktarın ya da DOI'leri yapıştırın. Kaynaklar bu çalışmaya “Okunacak” olarak eklenir."
                  boy="genis"
                  basaridaKapan={false}
                >
                  <IceAktarma projectId={calisma.id} mevcut={kaynaklar} />
                </PanelDrawer>
                {kaynaklar.length ? (
                  <PanelDrawer
                    triggerLabel="Dışa aktar"
                    triggerIcon={<Download size={15} aria-hidden="true" />}
                    triggerClassName="projects-filter-button button-compact"
                    kicker="Literatür"
                    title="Kaynakça ve dışa aktarma"
                    description="Kaynakçanızı çalışmanızın atıf stilinde kopyalayın ya da kaynaklarınızı başka bir programa aktarın."
                    boy="genis"
                    basaridaKapan={false}
                  >
                    <DisaAktarma
                      kaynaklar={kaynaklar}
                      stil={(calisma.citation_style && calisma.citation_style in STIL_ETIKETLERI ? calisma.citation_style : "apa7") as CitationStyle}
                      stilAdi={STIL_ETIKETLERI[calisma.citation_style ?? "apa7"] ?? "APA 7"}
                      calismaAdi={calisma.title}
                    />
                  </PanelDrawer>
                ) : null}
                <LiteraturPenceresi
                  projectId={calisma.id}
                  projeAdi={calisma.title}
                  triggerLabel="Kaynak bul"
                  triggerClassName="projects-primary-button button-compact"
                />
              </div>
            </header>
            {kaynaklar.length ? (
              <KaynakListesi kaynaklar={kaynaklar} />
            ) : (
              <p className="gb-bos">
                &quot;Kaynak bul&quot; ile OpenAlex ve Crossref dizinlerinde arayın, &quot;İçe aktar&quot; ile Zotero/Mendeley
                kütüphanenizi ya da DOI listenizi ekleyin. Okuduğunuzu ve metinde kullandığınızı burada işaretlersiniz.
              </p>
            )}
            {bagsiz ? <p className="hint">{bagsiz} kaynağınız bir çalışmaya bağlı değil; burada görünmüyor.</p> : null}
          </article>

          <article className="gb-kart gb-sutun">
            <header className="gb-kart-bas">
              <div>
                <h2>Kaynakça</h2>
                <p>
                  {sonDenetim
                    ? `Son denetim ${trTarihSaat(sonDenetim.tarih)} · ${sonDenetim.toplamKaynak} künye`
                    : "Henüz denetlenmedi"}
                </p>
              </div>
              <KaynakcaPenceresi
                calisma={{ ...calisma, citation_style: calisma.citation_style ?? "apa7" }}
                sonDenetim={sonDenetim ? { skor, tarih: sonDenetim.tarih } : null}
                triggerLabel={sonDenetim ? "Sonuçları aç" : "Kaynakçamı denetle"}
                triggerClassName="projects-primary-button button-compact"
              />
            </header>
            {sonDenetim ? (
              <>
                {/* Puan çalışmanın kendi atıf stiline göre; stil adı yazılmıyor. */}
                <div className="kaynakca-puan" data-tone={ton}>
                  <b>{skor}</b>
                  <span>/100 kaynakça uyumu</span>
                </div>
                <ul className="gb-liste">
                  {bulgular.map((b) => (
                    <li key={b.ad} className="gb-satir">
                      <span className="gb-satir-govde">
                        <b>{b.ad}</b>
                      </span>
                      <span className="status-pill" data-tone={b.sayi ? "warning" : "success"}>
                        {b.sayi ? b.sayi : "Yok"}
                      </span>
                    </li>
                  ))}
                </ul>
                {oncekiDenetimler.length > 1 ? (
                  <>
                    <h3 className="calisma-durum-alt">Önceki denetimler</h3>
                    <ul className="gb-liste">
                      {oncekiDenetimler.slice(1).map((d) => (
                        <li key={d.id} className="gb-satir">
                          <span className="gb-satir-govde">
                            <b>{trTarih(d.created_at)}</b>
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
                Kaynakçanız editördeki metinden alınır ya da yapıştırılır; künyelerin biçimi, metindeki atıflarla
                eşleşmesi ve kaynakların gerçekten var olup olmadığı (Crossref, OpenAlex) birlikte denetlenir.
              </p>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
