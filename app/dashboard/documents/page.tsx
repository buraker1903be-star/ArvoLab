import { getMyProjects } from "@/app/actions/citation-check";
import { deleteDocumentUpload, getMyDocumentUploads } from "@/app/actions/document-upload";
import { runOriginalityCheck, getOriginalityChecksForDocument } from "@/app/actions/originality";

// Belge yükleme + analiz (mammoth/pdf-parse) büyük dosyalarda Vercel'in
// varsayılan 10 saniyelik zaman aşımını aşabilir; bu da kullanıcıya
// uygulama içi hata göstermeden ham bir tarayıcı hatasına ("This page
// couldn't load") yol açar. Bu sayfadaki server action'lar (dosya
// yükleme, AI geri bildirimi, orijinallik taraması) için süreyi
// 60 saniyeye çıkarıyoruz.
export const maxDuration = 60;
import { getLatestFeedback } from "@/app/actions/ai-feedback";
import DocumentUploadForm from "./document-upload-form";
import AiFeedbackButton from "./ai-feedback-button";
import ActionForm from "../action-form";
import { ShieldQuestion, Trash2 } from "lucide-react";
import { similarityTone, statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";

export default async function DocumentsPage() {
  const [projects, uploads] = await Promise.all([
    getMyProjects(),
    getMyDocumentUploads(),
  ]);

  const originalityResults = await Promise.all(
    uploads
      .filter((u) => u.status === "analyzed")
      .map(async (u) => ({ documentId: u.id, checks: await getOriginalityChecksForDocument(u.id) }))
  );
  const originalityMap = new Map(originalityResults.map((r) => [r.documentId, r.checks[0] ?? null]));

  const feedbackResults = await Promise.all(
    uploads
      .filter((u) => u.status === "analyzed")
      .map(async (u) => ({ documentId: u.id, feedback: await getLatestFeedback(u.id) }))
  );
  const feedbackMap = new Map(feedbackResults.map((r) => [r.documentId, r.feedback]));

  async function handleRunOriginality(documentId: string) {
    "use server";
    const result = await runOriginalityCheck(documentId);
    return result.error ? { error: result.error } : { success: true };
  }

  async function handleDelete(documentId: string) {
    "use server";
    return deleteDocumentUpload(documentId);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Belge kontrol</span>
          <h1>Belge Kontrol</h1>
          <p>
            Tam bir tez/makale dosyası (.docx/.pdf) yükleyin; sistem içerik
            üretmez, yalnızca metni okuyup kaynakça formatını, kılavuz
            uygunluğunu ve ArvoLab belge havuzuyla örtüşmeyi (orijinallik
            ön-kontrolü) denetler. Ayrıca isteğe bağlı olarak, belgenizin
            yapısı ve akıcılığı hakkında yapay zeka destekli (ChatGPT) bir
            geri bildirim alabilirsiniz — bu geri bildirim yalnızca
            öğreticidir, tezinize/makalenize doğrudan kopyalanacak bir metin
            içermez. Yalnızca kaynakça listenizi kontrol etmek
            isterseniz{" "}
            <a href="/dashboard/citations" className="link-accent">
              Kaynakça Doğrulama
            </a>{" "}
            sayfasını kullanın.
          </p>
        </div>
      </section>

      <DocumentUploadForm projects={projects} />

      {uploads.length > 0 && (
        <section className="section mt-lg">
          <h2 className="section-title">Yüklenen Belgeler</h2>
          <div className="projects-list">
            {uploads.map((u) => {
              const originality = originalityMap.get(u.id);
              return (
                <article className="project-card" key={u.id}>
                  <div className="project-card-main">
                    <div>
                      <span className="status-pill" data-tone={statusTone(u.status)}>
                        {u.status === "analyzed"
                          ? "Analiz edildi"
                          : u.status === "failed"
                          ? "Hata"
                          : "İşleniyor"}
                      </span>
                      <h2>{u.file_name}</h2>
                      <p>
                        {u.project_title || "Bağımsız yükleme"} ·{" "}
                        {trTarihSaat(u.created_at)}
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
                    <p className="tone-text text-base mt-sm" data-tone="danger">
                      {u.error_message}
                    </p>
                  ) : null}
                  {u.status === "analyzed" && u.analysis && !u.analysis.referenceSectionFound ? (
                    <p className="tone-text text-base mt-sm" data-tone="warning">
                      Kaynakça bölümü otomatik tespit edilemedi.
                    </p>
                  ) : null}

                  {u.status === "analyzed" ? (
                    <div className="results-divider">
                      {originality ? (
                        <div className="text-base">
                          <div className="tone-text" data-tone={similarityTone(originality.overall_similarity)}>
                            ArvoLab Ön-Kontrol: en yüksek örtüşme %{originality.overall_similarity}
                            {" "}({originality.compared_document_count} belgeyle karşılaştırıldı)
                          </div>
                          {originality.matches.slice(0, 3).map((m, i) => (
                            <div key={i} className="muted">
                              %{m.similarity} — {m.fileName}
                              {m.sampleOverlap ? ` · örnek: "${m.sampleOverlap}"` : ""}
                            </div>
                          ))}
                          <ActionForm action={handleRunOriginality.bind(null, u.id)} className="mt-sm">
                            <button type="submit" className="projects-filter-button">
                              <ShieldQuestion size={14} aria-hidden="true" />
                              Yeniden tara
                            </button>
                          </ActionForm>
                        </div>
                      ) : (
                        <ActionForm action={handleRunOriginality.bind(null, u.id)}>
                          <button type="submit" className="projects-filter-button">
                            <ShieldQuestion size={14} aria-hidden="true" />
                            ArvoLab Ön-Kontrolü Çalıştır (orijinallik taraması)
                          </button>
                        </ActionForm>
                      )}
                      <p className="hint">
                        Bu tarama yalnızca erişim yetkiniz olan ArvoLab belge
                        havuzuyla karşılaştırır; Turnitin&apos;in yerini tutmaz.
                      </p>

                      <AiFeedbackButton
                        documentId={u.id}
                        initialFeedback={feedbackMap.get(u.id)?.feedback_text ?? null}
                      />
                    </div>
                  ) : null}

                  <ActionForm
                    action={handleDelete.bind(null, u.id)}
                    className="mt-sm"
                    confirmMessage={`"${u.file_name}" belgesini silmek istediğinize emin misiniz? Dosya, analiz sonuçları, orijinallik taramaları ve AI geri bildirimleri kalıcı olarak silinir.`}
                  >
                    <button type="submit" className="button-danger">
                      <Trash2 size={14} aria-hidden="true" />
                      Belgeyi sil
                    </button>
                  </ActionForm>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
