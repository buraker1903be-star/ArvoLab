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

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  accepted: "Üstlenildi",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

const errorMessages: Record<string, string> = {
  "save-failed": "Talep oluşturulurken bir hata oluştu.",
};

type ExpertRequestsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ExpertRequestsPage({ searchParams }: ExpertRequestsPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  const [projects, myRequests, profile] = await Promise.all([
    getMyProjects(),
    getMyRequests(),
    getCurrentProfile(),
  ]);

  const canActAsExpert = isExpertEligible(profile?.role);
  const [openRequests, assignedToMe] = canActAsExpert
    ? await Promise.all([getOpenRequests(), getAssignedToMe()])
    : [[], []];

  async function handleAccept(requestId: string) {
    "use server";
    await acceptRequest(requestId);
  }
  async function handleComplete(requestId: string) {
    "use server";
    await completeRequest(requestId);
  }
  async function handleCancel(requestId: string) {
    "use server";
    await cancelRequest(requestId);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Danışmanlık</span>
          <h1 className="brand-type">Uzmandan Destek İste</h1>
          <p>
            Çalışmanızı kendiniz yürütebilir ya da ihtiyaç duyduğunuzda
            kurum uzmanlarından profesyonel danışmanlık talep edebilirsiniz.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <p className="login-error" role="alert" style={{ marginBottom: 16 }}>
          {errorMessage}
        </p>
      ) : null}

      <section className="project-form-card" style={{ marginBottom: 24 }}>
        <div className="project-form-heading">
          <h2>Yeni Talep Oluştur</h2>
          <p>Hangi konuda desteğe ihtiyacınız var, kısaca belirtin.</p>
        </div>

        <form className="project-form-grid" action={createConsultancyRequest}>
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

          <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="projects-primary-button">
              <Plus size={16} />
              Talebi gönder
            </button>
          </div>
        </form>
      </section>

      {canActAsExpert && openRequests.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>
            <HandHelping size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Açık Talepler
          </h2>
          <div className="projects-list">
            {openRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{requestTypeLabel(r.request_type)}</span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                <form action={handleAccept.bind(null, r.id)} style={{ marginTop: 10 }}>
                  <button type="submit" className="projects-primary-button">
                    <CheckCircle2 size={15} />
                    Talebi üstlen
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}

      {canActAsExpert && assignedToMe.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Bana Atananlar</h2>
          <div className="projects-list">
            {assignedToMe.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{STATUS_LABELS[r.status]}</span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                {r.status === "accepted" ? (
                  <form action={handleComplete.bind(null, r.id)} style={{ marginTop: 10 }}>
                    <button type="submit" className="projects-primary-button">
                      <CheckCircle2 size={15} />
                      Tamamlandı olarak işaretle
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Taleplerim</h2>
        {myRequests.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Henüz bir destek talebiniz yok.
          </p>
        ) : (
          <div className="projects-list">
            {myRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{STATUS_LABELS[r.status]}</span>
                    <h2>{r.project_title || "Bağımsız talep"}</h2>
                    <p>{requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}</p>
                  </div>
                </div>
                {r.status === "open" ? (
                  <form action={handleCancel.bind(null, r.id)} style={{ marginTop: 10 }}>
                    <button type="submit" className="projects-filter-button">
                      <XCircle size={14} />
                      İptal et
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
