import DataAnalyzer from "./data-analyzer";
import AnalysisTools from "./analysis-tools";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import CalismaSerit from "../_components/calisma-serit";

export default async function AnalysisPage({
  searchParams,
}: {
  // Çalışma merkezinden "Analiz" adımıyla gelindiğinde çalışma hazır seçili gelsin.
  searchParams: Promise<{ calisma?: string }>;
}) {
  // Anahtar yoksa düğme boşuna tıklanmasın; karar sunucuda verilir çünkü
  // ortam değişkeni istemciye taşınmaz (AGENTS.md: sırlar NEXT_PUBLIC_ değil).
  const [asistanAcik, calismalar, { calisma: secilenCalisma }] = await Promise.all([
    analizAsistaniAcik(),
    getMyProjects(),
    searchParams,
  ]);
  /*
    Gelen kimlik listede yoksa yok sayılır: seçili görünmeyen bir değerle
    açılan <select> kullanıcıya "seçim yaptım" izlenimi verirdi.
    key= ile bileşen yeniden kurulur; başlangıç durumu etkiyle değil
    yeniden kurulumla güncellenir (React 19: etkide setState yasak).
  */
  const hazirCalisma = calismalar.some((c) => c.id === secilenCalisma) ? secilenCalisma! : "";

  return (
    <main className="dashboard-page">
      <CalismaSerit calismaId={hazirCalisma || undefined} aktif="analiz" />
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Analiz merkezi</span>
          <h1>Veri Analizi ve İstatistik Asistanı</h1>
          <p>
            Excel/CSV verinizi yükleyip gerçek istatistiksel testler
            çalıştırabilir, ya da SPSS&apos;ten kopyaladığınız hazır çıktıyı
            APA 7 biçimine çevirebilirsiniz. Sistem sayısal sonucu hesaplar
            ve anlamlılığı işaretler; bulguların araştırma bağlamındaki
            yorumu her zaman size/uzmanınıza aittir.
          </p>
        </div>
      </section>

      <div className="stack">
        <DataAnalyzer />
        <AnalysisTools
          key={hazirCalisma}
          asistanAcik={asistanAcik}
          calismalar={calismalar}
          secilenCalisma={hazirCalisma}
        />
      </div>
    </main>
  );
}
