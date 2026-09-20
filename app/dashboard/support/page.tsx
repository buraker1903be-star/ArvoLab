import { LifeBuoy, Plus } from "lucide-react";
import {
  createSupportRequest,
  getMySupportRequests,
  getAllSupportRequests,
  updateSupportRequestStatus,
} from "@/app/actions/support";
import { getCurrentProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import { statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";

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

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  const [myRequests, allRequests] = await Promise.all([
    getMySupportRequests(),
    isAdmin ? getAllSupportRequests() : Promise.resolve([]),
  ]);

  async function handleUpdateStatus(requestId: string, status: string) {
    "use server";
    return updateSupportRequestStatus(requestId, status);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Destek</span>
          <h1>Uygulama Destek Talebi</h1>
          <p>
            ArvoLab uygulamasıyla ilgili bir hata, erişim sorunu ya da
            özellik talebiniz varsa buradan iletin. Bu, akademik danışmanlık
            talebi değildir — akademik destek için &quot;Uzman
            Desteği&quot; sayfasını kullanın.
          </p>
        </div>
        <PanelDrawer
          triggerLabel="Yeni talep"
          triggerIcon={<Plus size={16} aria-hidden="true" />}
          kicker="Destek"
          title="Yeni destek talebi"
          description="Sorununuzu veya talebinizi kısaca açıklayın."
        >
          <ActionForm className="project-form-grid" action={createSupportRequest} successMessage="Destek talebiniz iletildi.">
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
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="project-form-full">
              <span>Mesaj</span>
              <textarea name="message" rows={5} placeholder="Sorunu veya talebi detaylandırın" required />
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

      {isAdmin && allRequests.length > 0 && (
        <section className="section">
          <h2 className="section-title">
            <LifeBuoy size={16} aria-hidden="true" />
            Tüm Açık Talepler (Sistem Yöneticisi görünümü)
          </h2>
          <div className="projects-list">
            {allRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <div className="pill-row">
                      <span className="status-pill" data-tone={statusTone(r.status)}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="status-pill" data-tone="neutral">
                        {CATEGORY_LABELS[r.category]}
                      </span>
                    </div>
                    <h2>{r.subject}</h2>
                    <p>{r.message}</p>
                  </div>
                </div>
                <div className="project-card-meta">
                  <span>Öncelik: {PRIORITY_LABELS[r.priority] ?? r.priority}</span>
                  <span>{trTarihSaat(r.created_at)}</span>
                </div>
                <div className="cluster mt-sm">
                  {r.status !== "in_progress" && (
                    <ActionForm action={handleUpdateStatus.bind(null, r.id, "in_progress")} successMessage="Talep işleme alındı.">
                      <button type="submit" className="projects-filter-button">İşleme al</button>
                    </ActionForm>
                  )}
                  {r.status !== "resolved" && (
                    <ActionForm action={handleUpdateStatus.bind(null, r.id, "resolved")} successMessage="Talep çözüldü olarak işaretlendi.">
                      <button type="submit" className="projects-primary-button">Çözüldü işaretle</button>
                    </ActionForm>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Taleplerim</h2>
        {myRequests.length === 0 ? (
          <p className="muted text-base">Henüz bir destek talebiniz yok.</p>
        ) : (
          <div className="projects-list">
            {myRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill" data-tone={statusTone(r.status)}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <h2>{r.subject}</h2>
                    <p>{CATEGORY_LABELS[r.category]} · {trTarihSaat(r.created_at)}</p>
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
