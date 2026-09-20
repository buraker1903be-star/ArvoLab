import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import CitationCheckForm from "./citation-check-form";
import { trTarihSaat } from "@/lib/tr-time";

export default async function CitationsPage() {
  const [projects, history] = await Promise.all([getMyProjects(), getMyCitationChecks()]);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kaynakça</span>
          <h1>Kaynakça ve Atıf Doğrulama</h1>
          <p>
            Kaynakçanızı APA 7 biçimi, metin içi atıf tutarlılığı ve gerçek
            akademik kayıt eşleşmesi açısından denetleyin. Crossref ve OpenAlex
            sonuçları DOI bilgisiyle karşılaştırılır; her kaynak için Google
            Scholar araması da sunulur. Tam bir belgeyi (.docx/.pdf) incelemek
            için{" "}
            <a href="/dashboard/documents" className="link-accent">
              Belge Kontrol
            </a>{" "}
            sayfasını kullanın.
          </p>
        </div>
      </section>

      <CitationCheckForm projects={projects} />

      {history.length > 0 && (
        <section className="section mt-lg">
          <h2 className="section-title">Son Kontroller</h2>
          <div className="projects-list">
            {history.map((historyItem) => (
              <article className="project-card" key={historyItem.id}>
                <div className="project-card-main">
                  <div>
                    <h2>{historyItem.project_title || "İsimsiz kontrol"}</h2>
                    <p>{trTarihSaat(historyItem.created_at)}</p>
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
