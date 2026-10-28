"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceActionSuccess, showToast } from "@/app/dashboard/_components/toast-events";
import { UploadCloud } from "lucide-react";
import { analyzeUploadedDocument } from "@/app/actions/document-upload";
import { createClient } from "@/lib/supabase/client";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  gomulu = false,
}: {
  projects: Project[];
  /* Çalışma merkezinden gelindiyse o çalışma hazır seçili gelir; kullanıcı
     aynı seçimi her sayfada yeniden yapmasın. */
  secilenCalisma?: string;
  /*
    Belge Kontrol sayfasının "Belge yükle" penceresinde: çalışma sabit
    (seçici çizilmez), sonuç pencerede gösterilmez — belge sol karttaki
    listeye düşer ve sonuçları sağ kartta okunur. Sonucu iki yerde çizmek
    biri güncellenip öteki unutulan iki ekran demekti.
  */
  gomulu?: boolean;
}) {
  const router = useRouter();
  const t = useCeviri();
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
        setError(t({ tr: "Lütfen bir dosya seçin.", en: "Please choose a file." }));
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(t({ tr: "Dosya boyutu 20 MB sınırını aşıyor.", en: "The file exceeds the 20 MB size limit." }));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(t({ tr: "Oturum bulunamadı. Lütfen tekrar giriş yapın.", en: "No session found. Please sign in again." }));
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
        setError(t({ tr: "Dosya depolamaya yüklenirken hata oluştu.", en: "An error occurred while uploading the file to storage." }));
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
      if (res.cozumlenemedi) {
        // Kayıt listede "Hata" olarak duruyor; sebebi hemen görülsün.
        showToast("error", res.cozumlenemedi);
        if (gomulu) {
          announceActionSuccess();
          router.refresh();
        } else {
          setError(res.cozumlenemedi);
        }
      } else if (gomulu) {
        showToast("success", t({ tr: "Belge yüklendi ve denetlendi.", en: "Document uploaded and checked." }));
        // Yükleme penceresi kapanır; yeni belge listede seçili açılır (page.tsx anahtarı).
        announceActionSuccess();
        router.refresh();
      } else if (res.analysis) {
        setResult(res.analysis as AnalysisResult);
      }
      formRef.current?.reset();
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={gomulu ? undefined : "project-form-card mt-md"}>
      {gomulu ? null : (
      <div className="project-form-heading">
        <h2>{t({ tr: "Doküman Yükle (DOCX / PDF)", en: "Upload Document (DOCX / PDF)" })}</h2>
        <p>
          {t({
            tr: "Tez veya makalenizi yükleyin; sistem metni okuyup kaynakça bölümünü otomatik tespit ederek APA 7 kural denetiminden geçirir. Dosya içeriği yalnızca sizin ve yetkili rollerin görebileceği şekilde saklanır; ArvoLab içerik üretmez, sadece denetler.",
            en: "Upload your thesis or article; the system reads the text, detects the reference list automatically and checks it against APA 7 rules. File contents are stored so that only you and authorized roles can see them; ArvoLab doesn't generate content, it only checks.",
          })}
        </p>
      </div>
      )}

      <form
        ref={formRef}
        className="project-form-grid"
        action={handleSubmit}
      >
        {gomulu ? null : projects.length > 0 ? (
          <label>
            <span>{t({ tr: "Bağlı çalışma (opsiyonel)", en: "Linked work (optional)" })}</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t({ tr: "Seçili çalışma yok", en: "No work selected" })}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>{t({ tr: "Çalışma başlığı (opsiyonel etiket)", en: "Work title (optional label)" })}</span>
            <input
              type="text"
              placeholder={t({ tr: "Örn. Eğitim Bilimleri Yüksek Lisans Tezi", en: "E.g. Master's Thesis in Educational Sciences" })}
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </label>
        )}

        <label className="project-form-full">
          <span>{t({ tr: "Dosya (.docx veya .pdf, en fazla 20 MB)", en: "File (.docx or .pdf, up to 20 MB)" })}</span>
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
            {loading ? t({ tr: "Yükleniyor ve analiz ediliyor...", en: "Uploading and analyzing..." }) : t({ tr: "Yükle ve Analiz Et", en: "Upload and Analyze" })}
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
                {t({ tr: "Kılavuz Uygunluğu", en: "Guideline Compliance" })}
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
                  {t({ tr: "Seçili kılavuzda zorunlu bölüm tanımlanmamış.", en: "The selected guideline defines no required sections." })}
                </p>
              )}
              {result.guidelineCompliance.citationStyleMatches === false ? (
                <p className="tone-text text-base" data-tone="warning">
                  {t({
                    tr: `Kılavuz ${result.guidelineCompliance.citationStyleExpected.toUpperCase()} kaynakça sistemi bekliyor, çalışmanızda farklı bir sistem seçili.`,
                    en: `The guideline expects the ${result.guidelineCompliance.citationStyleExpected.toUpperCase()} citation system, but a different system is selected in your work.`,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {result.referenceSectionFound ? (
            <>
              <div className="result-heading-lg">
                {t({ tr: "Uyum Skoru:", en: "Compliance Score:" })} {result.complianceScore}/100
              </div>

              {result.references.length > 0 && (
                <div className="result-block">
                  <h3 className="result-heading">
                    {t({ tr: "Kaynak Bazlı Sorunlar", en: "Issues by Source" })}
                  </h3>
                  <div className="stack-sm text-base">
                    {result.references.map((r, i) => (
                      <div key={i}>
                        <div className="muted">{r.raw}</div>
                        {r.issues.length === 0 ? (
                          <div className="tone-text" data-tone="success">{t({ tr: "Sorun bulunamadı.", en: "No issues found." })}</div>
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
                  {t({ tr: "Kaynakçada olup metinde atıfı bulunmayanlar", en: "In the reference list but not cited in the text" })}
                </h3>
                <ul className="result-list">
                  {result.crossCheck.referencesWithoutCitation.map((r, i) => (
                    <li key={i}>{r.raw}</li>
                  ))}
                  {result.crossCheck.referencesWithoutCitation.length === 0 && (
                    <li className="result-ok">{t({ tr: "Yok", en: "None" })}</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="result-heading">
                  {t({ tr: "Metinde atıfı olup kaynakçada bulunmayanlar", en: "Cited in the text but missing from the reference list" })}
                </h3>
                <ul className="result-list">
                  {result.crossCheck.citationsWithoutReference.map((c, i) => (
                    <li key={i}>{c.raw}</li>
                  ))}
                  {result.crossCheck.citationsWithoutReference.length === 0 && (
                    <li className="result-ok">{t({ tr: "Yok", en: "None" })}</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <p className="tone-text" data-tone="warning">
              {t({
                tr: "Belgede otomatik olarak \"Kaynakça\" / \"References\" başlığı bulunamadı, bu yüzden atıf denetimi yapılamadı. Aşağıdaki \"Kaynakça Kontrolü\" bölümünden metni elle yapıştırarak kontrol edebilirsiniz.",
                en: "No \"References\" / \"Kaynakça\" heading was detected in the document, so the citation check couldn't be run. You can paste the text manually in the \"Reference List Check\" section below to check it.",
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
