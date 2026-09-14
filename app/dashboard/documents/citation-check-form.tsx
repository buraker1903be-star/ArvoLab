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

interface CheckResult {
  complianceScore: number;
  references: CheckResultRef[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
}

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="project-form-card mt-md">
      <div className="project-form-heading">
        <h2>Kaynakça ve Atıf Kontrolü</h2>
        <p>Bir çalışma seçin veya geçici bir başlık girin, ardından kaynakça listenizi yapıştırın.</p>
      </div>

      <div className="project-form-grid">
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
          <span>Kaynakça listesi</span>
          <textarea
            rows={8}
            placeholder={"Yılmaz, A. (2020). Örnek kitap başlığı. Yayınevi.\n\nDemir, B., & Kaya, C. (2019). Bir makale başlığı. Dergi Adı, 12(3), 45-60."}
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
          disabled={loading || !referenceList}
        >
          {loading ? "Kontrol ediliyor..." : "Kontrol Et ve Kaydet"}
        </button>
      </div>

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="results-divider">
          <div className="result-heading-lg">
            Uyum Skoru: {result.complianceScore}/100
          </div>

          <div className="result-block">
            <h3 className="result-heading">
              Kaynak Bazlı Sorunlar
            </h3>
            <div className="stack-sm text-base">
              {result.references.map((r, i) => (
                <div key={i}>
                  <div className="muted">{r.raw}</div>
                  {r.issues.length === 0 ? (
                    <div className="tone-text" data-tone="success">Sorun bulunamadı.</div>
                  ) : (
                    r.issues.map((issue, j) => (
                      <div
                        key={j}
                        className="tone-text"
                        data-tone={issue.severity === "error" ? "danger" : "warning"}
                      >
                        [{issue.severity}] {issue.message}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="result-block">
            <h3 className="result-heading">
              Kaynakçada olup metinde atıfı bulunmayanlar
            </h3>
            <ul className="result-list">
              {result.crossCheck.referencesWithoutCitation.map((r, i) => (
                <li key={i}>{r.raw}</li>
              ))}
              {result.crossCheck.referencesWithoutCitation.length === 0 && (
                <li className="result-ok">Yok</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="result-heading">
              Metinde atıfı olup kaynakçada bulunmayanlar
            </h3>
            <ul className="result-list">
              {result.crossCheck.citationsWithoutReference.map((c, i) => (
                <li key={i}>{c.raw}</li>
              ))}
              {result.crossCheck.citationsWithoutReference.length === 0 && (
                <li className="result-ok">Yok</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
