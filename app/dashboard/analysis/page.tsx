import AnalysisTools from "./analysis-tools";

export default function AnalysisPage() {
  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Analiz merkezi</span>
          <h1 className="brand-type">SPSS ve MAXQDA Çıktı Asistanı</h1>
          <p>
            Bu araçlar yeni analiz yapmaz veya sonuç üretmez; yalnızca sizin
            zaten hesapladığınız istatistik değerlerini APA 7 biçimine
            çevirir ve nitel kod listenizin kalitesini kontrol eder. Analiz
            ve yorum sorumluluğu araştırmacıya/uzmana aittir.
          </p>
        </div>
      </section>

      <AnalysisTools />
    </main>
  );
}
