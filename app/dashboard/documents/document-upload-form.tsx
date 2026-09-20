"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { analyzeUploadedDocument } from "@/app/actions/document-upload";
import { createClient } from "@/lib/supabase/client";

interface Project {
  id: string;
  title: string;
  university: string | null;
}

interface GuidelineComplianceView {
  sections: { section: string; found: boolean }[];
  missingSections: string[];
  citationStyleExpected: string;
  citationStyleMatches: boolean | null;
}

interface AnalysisResult {
  complianceScore: number | null;
  referenceSectionFound: boolean;
  references: { raw: string; issues: { field: string; message: string; severity: string }[] }[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
  guidelineCompliance?: GuidelineComplianceView | null;
}

export default function DocumentUploadForm({
  projects,
  secilenCalisma = "",
}: {
  projects: Project[];
  /* Çalışma merkezinden gelindiyse o çalışma hazır seçili gelir; kullanıcı
     aynı seçimi her sayfada yeniden yapmasın. */
  secilenCalisma?: string;
}) {
  const [projectId, setProjectId] = useState(secilenCalisma);
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
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        setError("Lütfen bir dosya seçin.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("Dosya boyutu 20 MB sınırını aşıyor.");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        return;
      }

      // 1) Dosyayı DOĞRUDAN TARAYICIDAN Supabase Storage'a yükle.
      // Bu, dosyanın Vercel'in sunucu fonksiyonu üzerinden geçmesini
      // engeller — Vercel'in platform seviyesinde ~4.5 MB'lık, hiçbir
      // ayarla aşılamayan bir istek boyutu sınırı vardır. Gerçek tez/
      // makale dosyaları bunu kolayca aşabildiği için, dosya transferi
      // tamamen Vercel'i atlayarak doğrudan Supabase'e yapılır.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        setError("Dosya depolamaya yüklenirken hata oluştu.");
        return;
      }

      // 2) Yalnızca küçük metin verisiyle (dosya yolu vb.) sunucu
      // fonksiyonunu çağır; dosyanın kendisi buraya gelmez.
      const selectedProject = projects.find((p) => p.id === projectId);
      const res = await analyzeUploadedDocument({
        storagePath,
        fileName: file.name,
        mimeType: file.type || "",
        fileSize: file.size,
        projectId: projectId || null,
        projectTitle: selectedProject ? selectedProject.title : projectTitle || null,
      });

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
    <section className="project-form-card mt-md">
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

        <div className="project-form-actions">
          <button type="submit" className="projects-primary-button" disabled={loading}>
            <UploadCloud size={16} aria-hidden="true" />
            {loading ? "Yükleniyor ve analiz ediliyor..." : "Yükle ve Analiz Et"}
          </button>
          {fileName ? (
            <span className="muted text-base">{fileName}</span>
          ) : null}
        </div>
      </form>

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="results-divider">
          {result.guidelineCompliance ? (
            <div className="result-block">
              <h3 className="result-heading">
                Kılavuz Uygunluğu
              </h3>
              {result.guidelineCompliance.sections.length > 0 ? (
                <ul className="result-list">
                  {result.guidelineCompliance.sections.map((s, i) => (
                    <li key={i} className="tone-text" data-tone={s.found ? "success" : "danger"}>
                      {s.found ? "✓" : "✗"} {s.section}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-base">
                  Seçili kılavuzda zorunlu bölüm tanımlanmamış.
                </p>
              )}
              {result.guidelineCompliance.citationStyleMatches === false ? (
                <p className="tone-text text-base" data-tone="warning">
                  Kılavuz {result.guidelineCompliance.citationStyleExpected.toUpperCase()} kaynakça sistemi bekliyor, çalışmanızda farklı bir sistem seçili.
                </p>
              ) : null}
            </div>
          ) : null}

          {result.referenceSectionFound ? (
            <>
              <div className="result-heading-lg">
                Uyum Skoru: {result.complianceScore}/100
              </div>

              {result.references.length > 0 && (
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
              )}

              <div>
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
            </>
          ) : (
            <p className="tone-text" data-tone="warning">
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
