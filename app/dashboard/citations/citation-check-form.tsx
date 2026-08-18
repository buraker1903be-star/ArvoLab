"use client";

import { useState } from "react";
import { runCitationCheck } from "@/app/actions/citation-check";

interface Project {
  id: string;
  title: string;
  university: string | null;
}

interface CheckResultRef {
  raw: string;
  issues: { field: string; message: string; severity: string }[];
}

interface AcademicMatch {
  provider: "crossref" | "openalex";
  title: string;
  year: number | null;
  doi: string | null;
  authors: string[];
  venue: string | null;
  url: string;
  citedByCount: number | null;
  confidence: number;
}

interface AcademicVerification {
  reference: string;
  status: "verified" | "possible_match" | "not_found" | "insufficient_data";
  googleScholarUrl: string;
  bestMatch: AcademicMatch | null;
  matches: AcademicMatch[];
}

interface CheckResult {
  complianceScore: number;
  references: CheckResultRef[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
  academicVerification: AcademicVerification[];
  verificationSummary: {
    verified: number;
    possible: number;
    notFound: number;
    insufficientData: number;
  };
}

const STATUS_META = {
  verified: { label: "Doğrulandı", color: "#15803d", background: "#f0fdf4" },
  possible_match: { label: "Olası eşleşme", color: "#b45309", background: "#fffbeb" },
  not_found: { label: "Kayıt bulunamadı", color: "#b91c1c", background: "#fef2f2" },
  insufficient_data: { label: "Yetersiz veri", color: "#475569", background: "#f8fafc" },
} as const;

export default function CitationCheckForm({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("");
  const [referenceList, setReferenceList] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      const res = await runCitationCheck({
        projectId: projectId || null,
        projectTitle: selectedProject ? selectedProject.title : projectTitle || null,
        referenceList,
        bodyText,
      });
      if ("error" in res) {
        setError(res.error as string);
      } else {
        setResult(res as CheckResult);
      }
    } catch {
      setError("Akademik veri kaynaklarına erişilirken bir hata oluştu. Lütfen yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="project-form-card" style={{ marginTop: 20 }}>
      <div className="project-form-heading">
        <h2>Kaynakça ve Atıf Doğrulama</h2>
        <p>
          Kaynakları APA 7 kuralları, metin içi atıf eşleşmesi ve akademik kayıt
          varlığı açısından birlikte kontrol edin.
        </p>
      </div>

      <div style={{
        padding: "12px 14px",
        marginBottom: 18,
        border: "1px solid #bae6fd",
        borderRadius: 12,
        background: "#f0f9ff",
        color: "#0c4a6e",
        fontSize: 13,
        lineHeight: 1.55,
      }}>
        Bibliyografik bilgiler Crossref ve OpenAlex üzerinden doğrulanır. Her sonuçta
        ayrıca Google Scholar’da aynı kaynağı açan bağımsız arama bağlantısı verilir.
        Tek seferde en fazla 25 kaynak kontrol edilir.
      </div>

      <div className="project-form-grid">
        {projects.length > 0 ? (
          <label>
            <span>Bağlı çalışma (opsiyonel)</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Seçili çalışma yok</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
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
          <span>Kaynakça listesi</span>
          <textarea
            rows={8}
            placeholder={"Yılmaz, A. (2020). Örnek makale başlığı. Dergi Adı, 12(3), 45-60. https://doi.org/..."}
            value={referenceList}
            onChange={(e) => setReferenceList(e.target.value)}
          />
        </label>

        <label className="project-form-full">
          <span>Metin (metin içi atıf kontrolü için, opsiyonel)</span>
          <textarea
            rows={6}
            placeholder="...önceki çalışmalarda (Yılmaz, 2020) belirtildiği gibi..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </label>
      </div>

      <div className="project-form-actions">
        <button
          type="button"
          className="projects-primary-button"
          onClick={handleCheck}
          disabled={loading || !referenceList.trim()}
        >
          {loading ? "Crossref, OpenAlex ve Scholar kontrol ediliyor..." : "Kaynakları Doğrula ve Kaydet"}
        </button>
      </div>

      {error && (
        <p className="login-error" role="alert" style={{ marginTop: 12 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <strong style={{ padding: "9px 12px", borderRadius: 10, background: "#f1f5f9" }}>
              APA 7 Uyum: {result.complianceScore}/100
            </strong>
            <span style={{ padding: "9px 12px", borderRadius: 10, color: "#15803d", background: "#f0fdf4" }}>
              {result.verificationSummary.verified} doğrulandı
            </span>
            <span style={{ padding: "9px 12px", borderRadius: 10, color: "#b45309", background: "#fffbeb" }}>
              {result.verificationSummary.possible} olası eşleşme
            </span>
            <span style={{ padding: "9px 12px", borderRadius: 10, color: "#b91c1c", background: "#fef2f2" }}>
              {result.verificationSummary.notFound} bulunamadı
            </span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              Akademik Kayıt Doğrulaması
            </h3>
            <div style={{ display: "grid", gap: 10 }}>
              {result.academicVerification.map((item, index) => {
                const meta = STATUS_META[item.status];
                return (
                  <article key={index} style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginBottom: 7 }}>
                          {item.reference}
                        </div>
                        {item.bestMatch ? (
                          <>
                            <strong style={{ display: "block", fontSize: 14, lineHeight: 1.4 }}>
                              {item.bestMatch.title}
                            </strong>
                            <div style={{ fontSize: 12, marginTop: 5, color: "var(--muted-foreground)" }}>
                              {item.bestMatch.authors.slice(0, 4).join(", ") || "Yazar bilgisi yok"}
                              {item.bestMatch.year ? ` · ${item.bestMatch.year}` : ""}
                              {item.bestMatch.venue ? ` · ${item.bestMatch.venue}` : ""}
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 9, fontSize: 12 }}>
                              {item.bestMatch.url && (
                                <a href={item.bestMatch.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700 }}>
                                  {item.bestMatch.doi ? `DOI: ${item.bestMatch.doi}` : "Akademik kaydı aç"}
                                </a>
                              )}
                              <span>
                                {item.bestMatch.provider === "crossref" ? "Crossref" : "OpenAlex"}
                                {" · "}eşleşme %{Math.round(item.bestMatch.confidence * 100)}
                              </span>
                              {item.bestMatch.citedByCount !== null && (
                                <span>{item.bestMatch.citedByCount} atıf</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 13 }}>
                            Crossref ve OpenAlex üzerinde yeterince güçlü bir eşleşme bulunamadı.
                          </div>
                        )}
                      </div>
                      <span style={{
                        flexShrink: 0,
                        color: meta.color,
                        background: meta.background,
                        borderRadius: 999,
                        padding: "5px 9px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <a
                      href={item.googleScholarUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-block", marginTop: 10, color: "#1a73e8", fontSize: 12, fontWeight: 700 }}
                    >
                      Google Scholar’da kontrol et ↗
                    </a>
                  </article>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>APA 7 Biçim Sorunları</h3>
            {result.references.map((reference, index) => (
              <div key={index} style={{ fontSize: 13, marginBottom: 8 }}>
                <div style={{ color: "var(--muted-foreground)" }}>{reference.raw}</div>
                {reference.issues.length === 0 ? (
                  <div style={{ color: "#16a34a" }}>Biçim sorunu bulunamadı.</div>
                ) : reference.issues.map((issue, issueIndex) => (
                  <div key={issueIndex} style={{ color: issue.severity === "error" ? "#dc2626" : "#d97706" }}>
                    [{issue.severity}] {issue.message}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Kaynakçada olup metinde atıfı bulunmayanlar
            </h3>
            <ul style={{ fontSize: 13, paddingLeft: 18 }}>
              {result.crossCheck.referencesWithoutCitation.map((reference, index) => <li key={index}>{reference.raw}</li>)}
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
              {result.crossCheck.citationsWithoutReference.map((citation, index) => <li key={index}>{citation.raw}</li>)}
              {result.crossCheck.citationsWithoutReference.length === 0 && (
                <li style={{ listStyle: "none", marginLeft: -18, color: "#16a34a" }}>Yok</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
