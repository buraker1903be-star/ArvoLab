import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import CitationCheckForm from "./citation-check-form";

export default async function DocumentsPage() {
  const [projects, history] = await Promise.all([
    getMyProjects(),
    getMyCitationChecks(),
  ]);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Belge kontrolü</span>
          <h1 className="brand-type">APA 7 Kaynakça Doğrulama</h1>
          <p>
            Bu araç içerik üretmez; yalnızca kaynakça formatını ve metin içi
            atıf / kaynakça tutarlılığını kural bazlı olarak denetler.
          </p>
        </div>
      </section>

      <CitationCheckForm projects={projects} />

      {history.length > 0 && (
        <section className="dashboard-page" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Son Kontroller</h2>
          <div className="projects-list">
            {history.map((h) => (
              <article className="project-card" key={h.id}>
                <div className="project-card-main">
                  <div>
                    <h2>{h.project_title || "İsimsiz kontrol"}</h2>
                    <p>{new Date(h.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="project-progress">
                    <strong>{h.compliance_score ?? "-"}/100</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
