import { BarChart3, FileText, Trash2 } from "lucide-react";
import AnalysisTools from "./analysis-tools";
import AnalizSecici from "./analiz-secici";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import { analizSonucuSil, calismaAnalizleri, getAnalizSonuclari } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import PanelDrawer from "../_components/panel-drawer";
import CalismaSecici from "../_components/calisma-secici";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Analiz Merkezi", en: "Analysis Centre" }) };
}

/*
  ANALİZ MERKEZİ — TEK EKRAN, İKİ KART (26.10.2026, Kaynaklar sayfasıyla
  aynı düzen).

  Eskiden sayfa alt alta dört bölümdü: veri yükleme ve "SPSS tarzı
  kapsamlı rapor", test seçimi, SPSS çıktısı biçimlendirici ile kod
  kitabı denetimi, en altta kaydedilen sonuçlar kartları. Öğrenci
  sonucunu bulmak için sayfayı metrelerce kaydırıyordu ve sonuç
  çalışmasına bağlanmadan kaydedilebiliyordu.

  Şimdi Çalışmalarım kartının Analiz penceresinin AYNISI sayfada: solda
  veri, yöntem kartları, sonuç ve asistanın notları; sağda seçili
  çalışmanın analizleri ve teze ekleme sırası. Hazır SPSS çıktısını
  biçimlendirme ve kod kitabı denetimi başlıktaki pencerede.

  Eskiden çalışmaya bağlanmadan kaydedilmiş sonuçlar kaybolmasın diye
  başlıkta ayrı bir pencerede listeleniyor.
*/
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  const { calisma: istenen } = await searchParams;
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih } = await tarihler();
  const [asistanAcik, { satirlar: calismalar, okunamadi: calismaOkunamadi }, { satirlar: tumSonuclar, okunamadi: sonucOkunamadi }] = await Promise.all([
    analizAsistaniAcik(),
    getMyProjects(),
    getAnalizSonuclari(),
  ]);

  /* Adresteki çalışma listede yoksa yok sayılır; yoksa en son açılan. */
  const calisma = calismalar.find((c) => c.id === istenen) ?? calismalar[0] ?? null;
  const { satirlar: analizler, okunamadi: analizOkunamadi } = calisma
    ? await calismaAnalizleri(calisma.id)
    : { satirlar: [], okunamadi: false };
  const bagsizlar = tumSonuclar.filter((s) => !s.project_id);

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Analiz Merkezi", en: "Analysis Centre" })}</h1>
          <p>
            {calisma
              ? t({
                  tr: `“${calisma.title}” çalışmasının analizleri. Testleri ArvoLab hesaplar; asistan sonucu okur, sayı üretmez.`,
                  en: `Analyses for “${calisma.title}”. ArvoLab computes the tests; the assistant reads the result and never produces numbers.`,
                })
              : t({ tr: "Verinizi yükleyin, analizi seçin; testleri ArvoLab hesaplar.", en: "Upload your data and choose an analysis; ArvoLab computes the tests." })}
          </p>
        </div>
        <div className="pencere-dugmeler">
          {bagsizlar.length ? (
            <PanelDrawer
              triggerLabel={t({ tr: "Bağlı olmayan sonuçlar", en: "Unlinked results" })}
              triggerClassName="projects-filter-button button-compact"
              kicker={t({ tr: "Analiz", en: "Analysis" })}
              title={t({ tr: "Çalışmaya bağlı olmayan sonuçlar", en: "Results not linked to a project" })}
              description={t({
                tr: "Eski Analiz Merkezi'nde çalışma seçilmeden kaydedilmiş sonuçlar. Kayıtlar düzenlenemez; gerekmiyorsa silin.",
                en: "Results saved in the old Analysis Centre without choosing a project. Records cannot be edited; delete them if you no longer need them.",
              })}
              boy="genis"
              basaridaKapan={false}
            >
              <ul className="gb-liste">
                {bagsizlar.map((s) => (
                  <li key={s.id} className="analiz-satiri">
                    <details>
                      <summary>
                        <span className="kanit-kayit-govde">
                          <b>{s.baslik}</b>
                          <small>
                            {analizEtiketi(s.analiz_turu, dil)} · {tarih(s.created_at)}
                          </small>
                        </span>
                      </summary>
                      <p className="analiz-apa">{s.apa_metni}</p>
                    </details>
                    <ActionForm
                      action={analizSonucuSil.bind(null, s.id)}
                      confirmMessage={t({ tr: `"${s.baslik}" kaydı silinsin mi? Geri alınamaz.`, en: `Delete "${s.baslik}"? This cannot be undone.` })}
                      successMessage={t({ tr: "Sonuç silindi.", en: "Result deleted." })}
                    >
                      <button type="submit" className="projects-filter-button button-compact" aria-label={t({ tr: `${s.baslik}: sil`, en: `${s.baslik}: delete` })}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </PanelDrawer>
          ) : null}
          {/* SPSS'te yapılmış analizin çıktısını biçimlendirme ve kod kitabı
              denetimi: ayrı iş, sayfayı uzatmasın diye pencerede. */}
          <PanelDrawer
            triggerLabel={t({ tr: "Hazır çıktıyı biçimlendir", en: "Format existing output" })}
            triggerIcon={<FileText size={15} aria-hidden="true" />}
            triggerClassName="projects-filter-button button-compact"
            kicker={t({ tr: "Analiz", en: "Analysis" })}
            title={t({ tr: "SPSS çıktısını biçimlendirin", en: "Format SPSS output" })}
            description={t({
              tr: "Analizi başka programda yaptıysanız çıktıdaki değerleri yapıştırın; çalışmanızın kılavuzuna göre raporlama biçimine çevrilir.",
              en: "If you ran the analysis in another program, paste the values from its output; they are converted to the reporting style required by your project's guideline.",
            })}
            boy="genis"
            basaridaKapan={false}
          >
            <AnalysisTools
              key={calisma?.id ?? ""}
              asistanAcik={asistanAcik}
              calismalar={calismalar}
              secilenCalisma={calisma?.id ?? ""}
            />
          </PanelDrawer>
          {calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/analysis" /> : null}
        </div>
      </section>

      {calismaOkunamadi || analizOkunamadi || sonucOkunamadi ? (
        <p className="alert" role="alert">
          {calismaOkunamadi
            ? t({
                tr: "Çalışma listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Your project list could not be loaded; what follows may look incomplete. Your records are safe — refresh the page.",
              })
            : t({
                tr: "Kayıtlı analizleriniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Your saved analyses could not be loaded; what follows may look incomplete. Your records are safe — refresh the page.",
              })}
        </p>
      ) : null}

      {calisma ? (
        <AnalizSecici
          key={calisma.id}
          projectId={calisma.id}
          calisma={calisma}
          asistanAcik={asistanAcik}
          analizler={analizler}
          sayfa
        />
      ) : (
        <BosDurum
          ikon={BarChart3}
          baslik={t({ tr: "Önce bir çalışma başlatın", en: "Start a project first" })}
          aciklama={t({
            tr: "Analiz sonuçları bir çalışmaya bağlı tutulur: sayılar o çalışmanın kılavuzundaki biçimle yazılır ve editörde tezinize eklenir.",
            en: "Analysis results are kept with a project: numbers are written in the style of that project's guideline and added to your thesis in the editor.",
          })}
          eylem={{ etiket: t({ tr: "Yeni çalışma", en: "New project" }), href: "/dashboard/editor?yeni=1" }}
        />
      )}
    </main>
  );
}
