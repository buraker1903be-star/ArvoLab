import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import CitationCheckForm from "./citation-check-form";

export default async function CitationsPage() {
  const [projects, history] = await Promise.all([getMyProjects(), getMyCitationChecks()]);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kaynakça</span>
          <h1 className="brand-type">Kaynakça Doğrulama</h1>
          <p>
            Kaynakça listenizi yapıştırın; sistem içerik üretmez, yalnızca
            APA 7 format kurallarını ve metin içi atıf / kaynakça
            tutarlılığını kural bazlı olarak denetler. Tam bir belgeyi
            (.docx/.pdf) yükleyip analiz etmek isterseniz{" "}
            <a href="/dashboard/documents" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Belge Kontrol
            </a>{" "}
            sayfasını kullanın.
          </p>
        </div>
      </section>

      <CitationCheckForm projects={projects} />

      {history.length > 0 && (
        <section style={{ marginTop: 32 }}>
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
