import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import CitationCheckForm from "./citation-check-form";

export default async function CitationsPage() {
  const [projects, history] = await Promise.all([getMyProjects(), getMyCitationChecks()]);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kaynakça</span>
          <h1 className="brand-type">Kaynakça ve Atıf Doğrulama</h1>
          <p>
            Kaynakçanızı APA 7 biçimi, metin içi atıf tutarlılığı ve gerçek
            akademik kayıt eşleşmesi açısından denetleyin. Crossref ve OpenAlex
            sonuçları DOI bilgisiyle karşılaştırılır; her kaynak için Google
            Scholar araması da sunulur. Tam bir belgeyi (.docx/.pdf) incelemek
            için{" "}
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
            {history.map((historyItem) => (
              <article className="project-card" key={historyItem.id}>
                <div className="project-card-main">
                  <div>
                    <h2>{historyItem.project_title || "İsimsiz kontrol"}</h2>
                    <p>{new Date(historyItem.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                  <div className="project-progress">
                    <strong>{historyItem.compliance_score ?? "-"}/100</strong>
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
