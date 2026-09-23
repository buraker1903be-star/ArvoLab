import { getMyProjects } from "@/app/actions/citation-check";
import { deleteDocumentUpload, getMyDocumentUploads, reanalyzeDocument } from "@/app/actions/document-upload";
import { runOriginalityCheck, getOriginalityChecksForDocument } from "@/app/actions/originality";

// Belge yükleme + analiz (mammoth/pdf-parse) büyük dosyalarda Vercel'in
// varsayılan 10 saniyelik zaman aşımını aşabilir; bu da kullanıcıya
// uygulama içi hata göstermeden ham bir tarayıcı hatasına ("This page
// couldn't load") yol açar. Bu sayfadaki server action'lar (dosya
// yükleme, AI geri bildirimi, orijinallik taraması) için süreyi
// 60 saniyeye çıkarıyoruz.
export const maxDuration = 60;
import { getLatestFeedback } from "@/app/actions/ai-feedback";
import { aiFeedbackConfigured } from "@/lib/ai-feedback";
import DocumentUploadForm from "./document-upload-form";
import AiFeedbackButton from "./ai-feedback-button";
import ActionForm from "../action-form";
import { FolderOpen, RotateCcw, ShieldQuestion, Trash2 } from "lucide-react";
import BosDurum from "../_components/bos-durum";
import { similarityTone, statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";
import CalismaSerit from "../_components/calisma-serit";

export default async function DocumentsPage({
  searchParams,
}: {
  // Çalışma merkezinden "Belge" adımıyla gelindiğinde çalışma hazır seçili gelsin.
  searchParams: Promise<{ calisma?: string }>;
}) {
  const aiAcik = aiFeedbackConfigured();
  const [projects, { satirlar: uploads, okunamadi: belgeOkunamadi }, { calisma: secilenCalisma }] = await Promise.all([
    getMyProjects(),
    getMyDocumentUploads(),
    searchParams,
  ]);
  /*
    Gelen kimlik listede yoksa yok sayılır: seçili görünmeyen bir değerle
    açılan <select> kullanıcıya "seçim yaptım" izlenimi verirdi.
  */
  const hazirCalisma = projects.some((p) => p.id === secilenCalisma) ? secilenCalisma! : "";

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

  async function handleReanalyze(documentId: string) {
    "use server";
    const sonuc = await reanalyzeDocument(documentId);
    return sonuc.error ? { error: sonuc.error } : { success: true };
  }

  return (
    <main className="dashboard-page">
      <CalismaSerit calismaId={hazirCalisma || undefined} aktif="belge" />
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Belge kontrol</span>
          <h1>Belge Kontrol</h1>
          <p>
            Tam bir tez/makale dosyası (.docx/.pdf) yükleyin; sistem metni okuyup
            kaynakça formatını, kılavuz uygunluğunu ve ArvoLab belge havuzuyla
            örtüşmeyi denetler.
          </p>
          {/* Uzun açıklama katlandı: 770 karakterlik bir paragraf, asıl işi
              (yükleme formunu) ekranın altına itiyordu. Bilgi kaybolmuyor,
              isteyen açıyor. */}
          <details className="sayfa-detay">
            <summary>Bu sayfa ne yapar, ne yapmaz?</summary>
            <p>
              Sistem içerik <strong>üretmez</strong>. İsteğe bağlı olarak belgenizin yapısı ve
              akıcılığı hakkında yapay zeka destekli bir geri bildirim alabilirsiniz; bu geri
              bildirim yalnızca öğreticidir, tezinize doğrudan kopyalanacak bir metin içermez.
              Yalnızca kaynakça listenizi kontrol etmek isterseniz{" "}
              <a href="/dashboard/citations" className="link-accent">
                Kaynakça Doğrulama
              </a>{" "}
              sayfasını kullanın.
            </p>
          </details>
        </div>
      </section>

      <DocumentUploadForm key={hazirCalisma} projects={projects} secilenCalisma={hazirCalisma} />

      <section className="section mt-lg">
        <h2 className="section-title">Yüklenen Belgeler</h2>
        {/* Okunamadı ile "belge yüklemediniz" ayrı: ikincisi yeni
            kullanıcıya doğru, birincisi belgelerini kaybettiğini
            düşündürürdü. */}
        {belgeOkunamadi ? (
          <p className="alert" data-tone="danger" role="alert">
            Belge listeniz yüklenemedi. Yüklediğiniz belgeler yerinde duruyor; sayfayı yenileyin.
          </p>
        ) : uploads.length === 0 ? (
          /* Eskiden bölüm tamamen gizleniyordu: yeni kullanıcı yükleme
             formundan başka bir şey görmüyordu. */
          <BosDurum
            kompakt
            ikon={FolderOpen}
            aciklama="Henüz belge yüklemediniz. Yüklediğiniz her belgenin kaynakça, kılavuz uygunluğu ve orijinallik sonuçları burada saklanır."
          />
        ) : (
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
                  {/*
                    Başarısız satırın tek eylemi "sil"di: kullanıcı ilk
                    denediği şeyde hata alıyor ve ürün ona çıkış yolu
                    sunmuyordu. Dosya depoda duruyor; çözümleme geçici bir
                    sebepten düşmüş olabilir.
                  */}
                  {u.status === "failed" ? (
                    <ActionForm
                      action={handleReanalyze.bind(null, u.id)}
                      className="mt-sm"
                      successMessage="Belge yeniden çözümlendi."
                    >
                      <button type="submit" className="projects-filter-button">
                        <RotateCcw size={14} aria-hidden="true" />
                        Yeniden çözümle
                      </button>
                    </ActionForm>
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
                          <ActionForm action={handleRunOriginality.bind(null, u.id)} className="mt-sm" successMessage="Orijinallik taraması tamamlandı; sonuç aşağıda.">
                            <button type="submit" className="projects-filter-button">
                              <ShieldQuestion size={14} aria-hidden="true" />
                              Yeniden tara
                            </button>
                          </ActionForm>
                        </div>
                      ) : (
                        <ActionForm action={handleRunOriginality.bind(null, u.id)} successMessage="Orijinallik taraması tamamlandı; sonuç aşağıda.">
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
                        configured={aiAcik}
                      />
                    </div>
                  ) : null}

                  <ActionForm
                    action={handleDelete.bind(null, u.id)}
                    className="mt-sm"
                    confirmMessage={`"${u.file_name}" belgesini silmek istediğinize emin misiniz? Dosya, analiz sonuçları, orijinallik taramaları ve AI geri bildirimleri kalıcı olarak silinir.`}
                    successMessage="Belge silindi."
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
        )}
      </section>
    </main>
  );
}
