import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import { getMyDocumentUploads } from "@/app/actions/document-upload";
import CitationCheckForm from "./citation-check-form";
import DocumentUploadForm from "./document-upload-form";

export default async function DocumentsPage() {
  const [projects, history, uploads] = await Promise.all([
    getMyProjects(),
    getMyCitationChecks(),
    getMyDocumentUploads(),
  ]);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Belge kontrolü</span>
          <h1 className="brand-type">Doküman ve Kaynakça Doğrulama</h1>
          <p>
            Bu araç içerik üretmez; yalnızca yüklediğiniz belgeyi okuyarak
            kaynakça formatını ve metin içi atıf / kaynakça tutarlılığını
            kural bazlı olarak denetler.
          </p>
        </div>
      </section>

      <DocumentUploadForm projects={projects} />

      {uploads.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Yüklenen Belgeler</h2>
          <div className="projects-list">
            {uploads.map((u) => (
              <article className="project-card" key={u.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">
                      {u.status === "analyzed"
                        ? "Analiz edildi"
                        : u.status === "failed"
                        ? "Hata"
                        : "İşleniyor"}
                    </span>
                    <h2>{u.file_name}</h2>
                    <p>
                      {u.project_title || "Bağımsız yükleme"} ·{" "}
                      {new Date(u.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="project-progress">
                    <strong>
                      {u.analysis?.referenceSectionFound
                        ? `${u.analysis.complianceScore}/100`
                        : "—"}
                    </strong>
                  </div>
                </div>
                {u.status === "failed" && u.error_message ? (
                  <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
                    {u.error_message}
                  </p>
                ) : null}
                {u.status === "analyzed" && u.analysis && !u.analysis.referenceSectionFound ? (
                  <p style={{ color: "var(--warning)", fontSize: 13, marginTop: 8 }}>
                    Kaynakça bölümü otomatik tespit edilemedi.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Manuel Kaynakça Kontrolü</h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12 }}>
          Dosya yüklemek yerine kaynakça listenizi doğrudan yapıştırmak
          isterseniz aşağıdaki formu kullanabilirsiniz.
        </p>
        <CitationCheckForm projects={projects} />
      </section>

      {history.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Son Manuel Kontroller</h2>
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
