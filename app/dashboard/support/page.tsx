import { LifeBuoy, Plus } from "lucide-react";
import {
  createSupportRequest,
  getMySupportRequests,
  getAllSupportRequests,
  updateSupportRequestStatus,
} from "@/app/actions/support";
import { getCurrentProfile } from "@/app/actions/profile";

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Hata bildirimi",
  access: "Erişim sorunu",
  feature_request: "Özellik talebi",
  billing: "Fatura/Ödeme",
  other: "Diğer",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İşleme alındı",
  resolved: "Çözüldü",
};

const errorMessages: Record<string, string> = {
  "missing-fields": "Konu ve mesaj alanları zorunludur.",
  "save-failed": "Talep gönderilirken bir hata oluştu.",
};

type SupportPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  const [myRequests, allRequests] = await Promise.all([
    getMySupportRequests(),
    isAdmin ? getAllSupportRequests() : Promise.resolve([]),
  ]);

  async function handleUpdateStatus(requestId: string, status: string) {
    "use server";
    await updateSupportRequestStatus(requestId, status);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Destek</span>
          <h1 className="brand-type">Uygulama Destek Talebi</h1>
          <p>
            ArvoLab uygulamasıyla ilgili bir hata, erişim sorunu ya da
            özellik talebiniz varsa buradan iletin. Bu, akademik danışmanlık
            talebi değildir — akademik destek için &quot;Uzman
            Desteği&quot; sayfasını kullanın.
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
          <p>Sorununuzu veya talebinizi kısaca açıklayın.</p>
        </div>

        <form className="project-form-grid" action={createSupportRequest}>
          <label className="project-form-full">
            <span>Konu</span>
            <input name="subject" type="text" placeholder="Kısa bir başlık" required />
          </label>

          <label>
            <span>Kategori</span>
            <select name="category" defaultValue="other">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Öncelik</span>
            <select name="priority" defaultValue="normal">
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </label>

          <label className="project-form-full">
            <span>Mesaj</span>
            <textarea name="message" rows={5} placeholder="Sorunu veya talebi detaylandırın" required />
          </label>

          <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="projects-primary-button">
              <Plus size={16} />
              Talebi gönder
            </button>
          </div>
        </form>
      </section>

      {isAdmin && allRequests.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>
            <LifeBuoy size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Tüm Açık Talepler (Sistem Yöneticisi görünümü)
          </h2>
          <div className="projects-list">
            {allRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{CATEGORY_LABELS[r.category]}</span>
                    <h2>{r.subject}</h2>
                    <p>{r.message}</p>
                  </div>
                </div>
                <div className="project-card-meta">
                  <span>Öncelik: {r.priority}</span>
                  <span>{STATUS_LABELS[r.status]}</span>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  {r.status !== "in_progress" && (
                    <form action={handleUpdateStatus.bind(null, r.id, "in_progress")}>
                      <button type="submit" className="projects-filter-button">İşleme al</button>
                    </form>
                  )}
                  {r.status !== "resolved" && (
                    <form action={handleUpdateStatus.bind(null, r.id, "resolved")}>
                      <button type="submit" className="projects-primary-button">Çözüldü işaretle</button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Taleplerim</h2>
        {myRequests.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Henüz bir destek talebiniz yok.</p>
        ) : (
          <div className="projects-list">
            {myRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{STATUS_LABELS[r.status]}</span>
                    <h2>{r.subject}</h2>
                    <p>{CATEGORY_LABELS[r.category]} · {new Date(r.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
