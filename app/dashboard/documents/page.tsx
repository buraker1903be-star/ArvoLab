import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import { getMyDocumentUploads } from "@/app/actions/document-upload";
import { runOriginalityCheck, getOriginalityChecksForDocument } from "@/app/actions/originality";
import CitationCheckForm from "./citation-check-form";
import DocumentUploadForm from "./document-upload-form";
import { ShieldQuestion } from "lucide-react";

export default async function DocumentsPage() {
  const [projects, history, uploads] = await Promise.all([
    getMyProjects(),
    getMyCitationChecks(),
    getMyDocumentUploads(),
  ]);

  const originalityResults = await Promise.all(
    uploads
      .filter((u) => u.status === "analyzed")
      .map(async (u) => ({ documentId: u.id, checks: await getOriginalityChecksForDocument(u.id) }))
  );
  const originalityMap = new Map(originalityResults.map((r) => [r.documentId, r.checks[0] ?? null]));

  async function handleRunOriginality(documentId: string) {
    "use server";
    await runOriginalityCheck(documentId);
  }

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
            {uploads.map((u) => {
              const originality = originalityMap.get(u.id);
              return (
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

                  {u.status === "analyzed" ? (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      {originality ? (
                        <div style={{ fontSize: 13 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color:
                                originality.overall_similarity >= 40
                                  ? "#dc2626"
                                  : originality.overall_similarity >= 15
                                  ? "#d97706"
                                  : "#16a34a",
                            }}
                          >
                            ArvoLab Ön-Kontrol: en yüksek örtüşme %{originality.overall_similarity}
                            {" "}({originality.compared_document_count} belgeyle karşılaştırıldı)
                          </div>
                          {originality.matches.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
                              %{m.similarity} — {m.fileName}
                              {m.sampleOverlap ? ` · örnek: "${m.sampleOverlap}"` : ""}
                            </div>
                          ))}
                          <form action={handleRunOriginality.bind(null, u.id)} style={{ marginTop: 8 }}>
                            <button type="submit" className="projects-filter-button">
                              <ShieldQuestion size={14} />
                              Yeniden tara
                            </button>
                          </form>
                        </div>
                      ) : (
                        <form action={handleRunOriginality.bind(null, u.id)}>
                          <button type="submit" className="projects-filter-button">
                            <ShieldQuestion size={14} />
                            ArvoLab Ön-Kontrolü Çalıştır (orijinallik taraması)
                          </button>
                        </form>
                      )}
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
                        Bu tarama yalnızca erişim yetkiniz olan ArvoLab belge
                        havuzuyla karşılaştırır; Turnitin&apos;in yerini tutmaz.
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
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
