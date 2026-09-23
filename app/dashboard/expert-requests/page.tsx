import { listeBasarili } from "@/lib/liste-sonucu";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import { CheckCircle2, HandHelping, Plus, XCircle } from "lucide-react";
import {
  createConsultancyRequest,
  getMyRequests,
  getOpenRequests,
  getAssignedToMe,
  acceptRequest,
  completeRequest,
  cancelRequest,
} from "@/app/actions/consultancy";
import { getMyProjects } from "@/app/actions/citation-check";
import { getCurrentProfile } from "@/app/actions/profile";
import { isExpertEligible, requestTypeLabel } from "@/lib/project-labels";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import { statusTone } from "@/lib/status-tone";
import BosDurum from "../_components/bos-durum";
import { Inbox } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  accepted: "Üstlenildi",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

export default async function ExpertRequestsPage() {
  const [projects, { satirlar: myRequests, okunamadi: taleplerOkunamadi }, profile] = await Promise.all([
    getMyProjects(),
    getMyRequests(),
    getCurrentProfile(),
  ]);

  const canActAsExpert = isExpertEligible(profile?.role);
  const [{ satirlar: openRequests }, { satirlar: assignedToMe }] = canActAsExpert
    ? await Promise.all([getOpenRequests(), getAssignedToMe()])
    : [listeBasarili<ConsultancyRequest>([]), listeBasarili<ConsultancyRequest>([])];

  async function handleAccept(requestId: string) {
    "use server";
    return acceptRequest(requestId);
  }
  async function handleComplete(requestId: string) {
    "use server";
    return completeRequest(requestId);
  }
  async function handleCancel(requestId: string) {
    "use server";
    return cancelRequest(requestId);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Danışmanlık</span>
          <h1>Uzmandan Destek İste</h1>
          <p>
            Çalışmanızı kendiniz yürütebilir ya da ihtiyaç duyduğunuzda
            kurum uzmanlarından profesyonel danışmanlık talep edebilirsiniz.
          </p>
        </div>
        <PanelDrawer
          triggerLabel="Yeni talep"
          triggerIcon={<Plus size={16} aria-hidden="true" />}
          kicker="Danışmanlık"
          title="Uzmandan destek iste"
          description="Hangi konuda desteğe ihtiyacınız var, kısaca belirtin."
        >
          <ActionForm className="project-form-grid" action={createConsultancyRequest} successMessage="Talebiniz uzmanlara iletildi.">
            {projects.length > 0 ? (
              <label>
                <span>Bağlı çalışma (opsiyonel)</span>
                <select name="projectId" defaultValue="">
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
                <input name="projectTitle" type="text" placeholder="Örn. Eğitim Bilimleri Tezi" />
              </label>
            )}

            <label>
              <span>Destek türü</span>
              <select name="requestType" defaultValue="analysis">
                <option value="analysis">Analiz desteği</option>
                <option value="editing">Dil/biçim düzenleme</option>
                <option value="methodology">Metodoloji danışmanlığı</option>
                <option value="statistics">İstatistik desteği</option>
                <option value="full_review">Kapsamlı inceleme</option>
                <option value="other">Diğer</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>Mesaj</span>
              <textarea name="message" rows={4} placeholder="İhtiyacınızı kısaca açıklayın" />
            </label>

            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Talebi gönder
              </button>
            </div>
          </ActionForm>
        </PanelDrawer>
      </section>

      {canActAsExpert && (
        <section className="section">
          <h2 className="section-title">
            <HandHelping size={16} aria-hidden="true" />
            Açık Talepler
          </h2>
          {/* Eskiden bölüm boşken tamamen gizleniyordu: uzman rolündeki
              kullanıcı böyle bir bölümün var olduğunu bile bilmiyordu. */}
          {openRequests.length === 0 ? (
            <BosDurum kompakt ikon={HandHelping} aciklama="Şu an üstlenebileceğiniz açık talep yok. Yeni bir talep açıldığında burada görünür." />
          ) : (
          <div className="projects-list">
            {openRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill">{requestTypeLabel(r.request_type)}</span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                <ActionForm action={handleAccept.bind(null, r.id)} className="mt-sm" successMessage="Talebi üstlendiniz.">
                  <button type="submit" className="projects-primary-button">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Talebi üstlen
                  </button>
                </ActionForm>
              </article>
            ))}
          </div>
          )}
        </section>
      )}

      {canActAsExpert && (
        <section className="section">
          <h2 className="section-title">Bana Atananlar</h2>
          {assignedToMe.length === 0 ? (
            <BosDurum kompakt ikon={Inbox} aciklama="Üzerinize atanmış talep yok. Açık taleplerden birini üstlendiğinizde burada listelenir." />
          ) : (
          <div className="projects-list">
            {assignedToMe.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill" data-tone={statusTone(r.status)}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                {r.status === "accepted" ? (
                  <ActionForm action={handleComplete.bind(null, r.id)} className="mt-sm" successMessage="Talep tamamlandı.">
                    <button type="submit" className="projects-primary-button">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Tamamlandı olarak işaretle
                    </button>
                  </ActionForm>
                ) : null}
              </article>
            ))}
          </div>
          )}
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Taleplerim</h2>
        {/* Okunamadı ile "talebiniz yok" ayrı. Burada özellikle önemli:
            listesi boş görünen öğrenci, zaten açık olan bir talebi
            yeniden açabilirdi. */}
        {taleplerOkunamadi ? (
          <p className="alert" data-tone="danger" role="alert">
            Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.
          </p>
        ) : myRequests.length === 0 ? (
          <BosDurum kompakt ikon={Inbox} aciklama="Henüz uzman desteği talebiniz yok. Yöntem, analiz ya da yazım konusunda takıldığınız bir noktada yukarıdaki “Yeni talep” ile uzmana ulaşabilirsiniz." />
        ) : (
          <div className="projects-list">
            {myRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill" data-tone={statusTone(r.status)}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                {r.status === "open" ? (
                  <ActionForm
                    action={handleCancel.bind(null, r.id)}
                    className="mt-sm"
                    confirmMessage="Bu destek talebini iptal etmek istediğinize emin misiniz?"
                    successMessage="Talep iptal edildi."
                  >
                    <button type="submit" className="projects-filter-button">
                      <XCircle size={14} aria-hidden="true" />
                      İptal et
                    </button>
                  </ActionForm>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
