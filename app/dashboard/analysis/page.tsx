import { BarChart3, FileText, Trash2 } from "lucide-react";
import AnalysisTools from "./analysis-tools";
import AnalizSecici from "./analiz-secici";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import { analizSonucuSil, calismaAnalizleri, getAnalizSonuclari } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import { trTarih } from "@/lib/tr-time";
import PanelDrawer from "../_components/panel-drawer";
import CalismaSecici from "../_components/calisma-secici";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";

export const metadata = { title: "Analiz Merkezi" };

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
          <h1>Analiz Merkezi</h1>
          <p>
            {calisma
              ? `“${calisma.title}” çalışmasının analizleri. Testleri ArvoLab hesaplar; asistan sonucu okur, sayı üretmez.`
              : "Verinizi yükleyin, analizi seçin; testleri ArvoLab hesaplar."}
          </p>
        </div>
        <div className="pencere-dugmeler">
          {bagsizlar.length ? (
            <PanelDrawer
              triggerLabel="Bağlı olmayan sonuçlar"
              triggerClassName="projects-filter-button button-compact"
              kicker="Analiz"
              title="Çalışmaya bağlı olmayan sonuçlar"
              description="Eski Analiz Merkezi'nde çalışma seçilmeden kaydedilmiş sonuçlar. Kayıtlar düzenlenemez; gerekmiyorsa silin."
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
                            {analizEtiketi(s.analiz_turu)} · {trTarih(s.created_at)}
                          </small>
                        </span>
                      </summary>
                      <p className="analiz-apa">{s.apa_metni}</p>
                    </details>
                    <ActionForm
                      action={analizSonucuSil.bind(null, s.id)}
                      confirmMessage={`"${s.baslik}" kaydı silinsin mi? Geri alınamaz.`}
                      successMessage="Sonuç silindi."
                    >
                      <button type="submit" className="projects-filter-button button-compact" aria-label={`${s.baslik}: sil`}>
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
            triggerLabel="Hazır çıktıyı biçimlendir"
            triggerIcon={<FileText size={15} aria-hidden="true" />}
            triggerClassName="projects-filter-button button-compact"
            kicker="Analiz"
            title="SPSS çıktısını biçimlendirin"
            description="Analizi başka programda yaptıysanız çıktıdaki değerleri yapıştırın; çalışmanızın kılavuzuna göre raporlama biçimine çevrilir."
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
          {calismaOkunamadi ? "Çalışma listeniz" : "Kayıtlı analizleriniz"} okunamadı; aşağısı eksik görünebilir.
          Kayıtlarınız yerinde duruyor — sayfayı yenileyin.
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
          baslik="Önce bir çalışma başlatın"
          aciklama="Analiz sonuçları bir çalışmaya bağlı tutulur: sayılar o çalışmanın kılavuzundaki biçimle yazılır ve editörde tezinize eklenir."
          eylem={{ etiket: "Yeni çalışma", href: "/dashboard/editor?yeni=1" }}
        />
      )}
    </main>
  );
}
