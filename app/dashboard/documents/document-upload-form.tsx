"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { uploadAndAnalyzeDocument } from "@/app/actions/document-upload";

interface Project {
  id: string;
  title: string;
  university: string | null;
}

interface AnalysisResult {
  complianceScore: number | null;
  referenceSectionFound: boolean;
  references: { raw: string; issues: { field: string; message: string; severity: string }[] }[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
}

export default function DocumentUploadForm({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      formData.set("projectId", projectId || "");
      formData.set("projectTitle", selectedProject ? selectedProject.title : projectTitle);

      const res = await uploadAndAnalyzeDocument(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.analysis) {
        setResult(res.analysis as AnalysisResult);
      }
      formRef.current?.reset();
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="project-form-card" style={{ marginTop: 20 }}>
      <div className="project-form-heading">
        <h2>Doküman Yükle (DOCX / PDF)</h2>
        <p>
          Tez veya makalenizi yükleyin; sistem metni okuyup kaynakça bölümünü
          otomatik tespit ederek APA 7 kural denetiminden geçirir. Dosya
          içeriği yalnızca sizin ve yetkili rollerin görebileceği şekilde
          saklanır; ArvoLab içerik üretmez, sadece denetler.
        </p>
      </div>

      <form
        ref={formRef}
        className="project-form-grid"
        action={handleSubmit}
      >
        {projects.length > 0 ? (
          <label>
            <span>Bağlı çalışma (opsiyonel)</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Seçili çalışma yok</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Çalışma başlığı (opsiyonel etiket)</span>
            <input
              type="text"
              placeholder="Örn. Eğitim Bilimleri Yüksek Lisans Tezi"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </label>
        )}

        <label className="project-form-full">
          <span>Dosya (.docx veya .pdf, en fazla 20 MB)</span>
          <input
            type="file"
            name="file"
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="projects-primary-button" disabled={loading}>
            <UploadCloud size={16} />
            {loading ? "Yükleniyor ve analiz ediliyor..." : "Yükle ve Analiz Et"}
          </button>
          {fileName ? (
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{fileName}</span>
          ) : null}
        </div>
      </form>

      {error && (
        <p className="login-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          {result.referenceSectionFound ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                Uyum Skoru: {result.complianceScore}/100
              </div>

              {result.references.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Kaynak Bazlı Sorunlar
                  </h3>
                  {result.references.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 8 }}>
                      <div style={{ color: "var(--muted-foreground)" }}>{r.raw}</div>
                      {r.issues.length === 0 ? (
                        <div style={{ color: "#16a34a" }}>Sorun bulunamadı.</div>
                      ) : (
                        r.issues.map((issue, j) => (
                          <div
                            key={j}
                            style={{ color: issue.severity === "error" ? "#dc2626" : "#d97706" }}
                          >
                            [{issue.severity}] {issue.message}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Kaynakçada olup metinde atıfı bulunmayanlar
                </h3>
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  {result.crossCheck.referencesWithoutCitation.map((r, i) => (
                    <li key={i}>{r.raw}</li>
                  ))}
                  {result.crossCheck.referencesWithoutCitation.length === 0 && (
                    <li style={{ listStyle: "none", marginLeft: -18, color: "#16a34a" }}>Yok</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Metinde atıfı olup kaynakçada bulunmayanlar
                </h3>
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  {result.crossCheck.citationsWithoutReference.map((c, i) => (
                    <li key={i}>{c.raw}</li>
                  ))}
                  {result.crossCheck.citationsWithoutReference.length === 0 && (
                    <li style={{ listStyle: "none", marginLeft: -18, color: "#16a34a" }}>Yok</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--warning)" }}>
              Belgede otomatik olarak &quot;Kaynakça&quot; / &quot;References&quot; başlığı
              bulunamadı, bu yüzden atıf denetimi yapılamadı. Aşağıdaki
              &quot;Kaynakça Kontrolü&quot; bölümünden metni elle yapıştırarak
              kontrol edebilirsiniz.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
