import DataAnalyzer from "./data-analyzer";
import AnalysisTools from "./analysis-tools";

export default function AnalysisPage() {
  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Analiz merkezi</span>
          <h1 className="brand-type">Veri Analizi ve İstatistik Asistanı</h1>
          <p>
            Excel/CSV verinizi yükleyip gerçek istatistiksel testler
            çalıştırabilir, ya da SPSS&apos;ten kopyaladığınız hazır çıktıyı
            APA 7 biçimine çevirebilirsiniz. Sistem sayısal sonucu hesaplar
            ve anlamlılığı işaretler; bulguların araştırma bağlamındaki
            yorumu her zaman size/uzmanınıza aittir.
          </p>
        </div>
      </section>

      <div style={{ display: "grid", gap: 24 }}>
        <DataAnalyzer />
        <AnalysisTools />
      </div>
    </main>
  );
}
