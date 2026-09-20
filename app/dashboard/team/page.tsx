import { Ban, Building2, MailPlus, Plus, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/profile";
import {
  createOrganization,
  getAllProfiles,
  getOrganizations,
  inviteUser,
  setUserAccess,
  updateUserOrganization,
  updateUserRole,
} from "@/app/actions/team";
import { ROLE_LABELS, type UserRole } from "@/lib/project-labels";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";

const ROLE_ORDER: UserRole[] = [
  "client",
  "employee",
  "expert",
  "controller",
  "academic_manager",
  "system_admin",
  "founder",
];

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  if (!isAdmin) {
    return (
      <main className="dashboard-page">
        <section className="empty-state">
          <ShieldAlert size={28} aria-hidden="true" />
          <p>Bu sayfaya yalnızca Sistem Yöneticisi ve Kurucu rolleri erişebilir.</p>
        </section>
      </main>
    );
  }

  const [{ members, directoryAvailable }, organizations] = await Promise.all([getAllProfiles(), getOrganizations()]);
  const assignableRoles = profile?.role === "founder" ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== "founder");

  async function handleRoleChange(userId: string, formData: FormData) {
    "use server";
    const role = String(formData.get("role") ?? "");
    return updateUserRole(userId, role);
  }

  async function handleOrgChange(userId: string, formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organizationId") ?? "");
    return updateUserOrganization(userId, organizationId);
  }

  async function handleCreateOrganization(formData: FormData) {
    "use server";
    return createOrganization(formData);
  }

  async function handleInvite(formData: FormData) {
    "use server";
    return inviteUser(formData);
  }

  async function handleAccess(userId: string, enabled: boolean) {
    "use server";
    return setUserAccess(userId, enabled);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Yönetim</span>
          <h1>Ekip Yönetimi</h1>
          <p>
            Yeni kullanıcıları e-postayla davet edin, rollerini ve kurumlarını belirleyin. Davetsiz kayıt olan
            kullanıcılar <strong>Üye / Öğrenci</strong> rolüyle başlar ve yalnızca kendi çalışmasını görür.
          </p>
        </div>
        <div className="cluster">
          <PanelDrawer
            triggerLabel="Kurum ekle"
            triggerIcon={<Building2 size={16} aria-hidden="true" />}
            triggerClassName="projects-filter-button"
            kicker="Ekip"
            title="Yeni kurum ekle"
            description="Kullanıcıları bir kuruma bağlamak için önce kurumu oluşturun."
          >
            <ActionForm className="project-form-grid" action={handleCreateOrganization} successMessage="Kurum eklendi.">
              <label className="project-form-full">
                <span>Kurum adı</span>
                <input name="name" type="text" placeholder="Örn. AkademikMerkez" required />
              </label>
              {organizations.length > 0 ? (
                <p className="hint project-form-full">Mevcut kurumlar: {organizations.map((o) => o.name).join(", ")}</p>
              ) : null}
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  Kurumu ekle
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>

          {directoryAvailable ? (
            <PanelDrawer
              triggerLabel="Kullanıcı davet et"
              triggerIcon={<MailPlus size={16} aria-hidden="true" />}
              kicker="Ekip"
              title="Kullanıcı davet et"
              description="Davet edilen kişiye şifresini belirleyeceği bir bağlantı gönderilir. Rol ve kurum davetle birlikte atanır."
            >
              <ActionForm className="project-form-grid" action={handleInvite} successMessage="Davet e-postası gönderildi.">
                <label>
                  <span>E-posta</span>
                  <input name="email" type="email" placeholder="ornek@kurum.com" autoComplete="off" required />
                </label>
                <label>
                  <span>Ad soyad</span>
                  <input name="fullName" type="text" placeholder="Ayşe Demir" maxLength={120} />
                </label>
                <label>
                  <span>Rol</span>
                  <select name="role" defaultValue="employee">
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Kurum</span>
                  <select name="organizationId" defaultValue={profile?.organization_id ?? ""}>
                    <option value="">Kurum yok</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <MailPlus size={16} aria-hidden="true" />
                    Davet gönder
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          ) : null}
        </div>
      </section>

      {!directoryAvailable ? (
        <p className="alert" data-tone="warning" role="status">
          Davet, e-posta listesi ve erişim durdurma için sunucuda <code>SUPABASE_SECRET_KEY</code> ortam değişkeni
          tanımlı olmalı.
        </p>
      ) : null}

      <section className="section">
        <h2 className="section-title">
          <UserCog size={16} aria-hidden="true" />
          Kullanıcılar ({members.length})
        </h2>
        {/* Eskiden liste boşken başlığın altı tamamen boş bir <div> kalıyordu. */}
        {members.length === 0 ? (
          <BosDurum
            kompakt
            ikon={UserCog}
            aciklama="Listelenecek kullanıcı yok. Yeni kullanıcılar davet edildiğinde ya da kayıt olduğunda burada görünür."
          />
        ) : (
        <div className="projects-list">
          {members.map((m) => {
            const isSelf = m.id === profile?.id;
            return (
              <article className="project-card" key={m.id}>
                <div className="project-card-main">
                  <div>
                    <div className="pill-row">
                      <span className="status-pill" data-tone="neutral">{ROLE_LABELS[m.role]}</span>
                      {m.pendingInvite ? (
                        <span className="status-pill" data-tone="warning">
                          Davet bekliyor
                        </span>
                      ) : null}
                      {m.disabled ? (
                        <span className="status-pill" data-tone="danger">
                          Erişim durduruldu
                        </span>
                      ) : null}
                    </div>
                    <h2>
                      {m.full_name || "İsimsiz kullanıcı"}
                      {isSelf ? " (siz)" : ""}
                    </h2>
                    <p>{m.email ?? <span className="mono">{m.id}</span>}</p>
                  </div>
                </div>

                <div className="cluster cluster-lg cluster-spaced">
                  <ActionForm
                    action={handleRoleChange.bind(null, m.id)}
                    className="cluster"
                    successMessage="Rol kaydedildi."
                  >
                    <select name="role" defaultValue={m.role} className="compact-select" disabled={isSelf} aria-label="Rol">
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="projects-filter-button button-compact" disabled={isSelf}>
                      Rolü kaydet
                    </button>
                  </ActionForm>

                  {organizations.length > 0 && (
                    <ActionForm
                      action={handleOrgChange.bind(null, m.id)}
                      className="cluster"
                      successMessage="Kurum kaydedildi."
                    >
                      <select name="organizationId" defaultValue={m.organization_id ?? ""} className="compact-select" aria-label="Kurum">
                        <option value="">Kurum yok</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="projects-filter-button button-compact">
                        Kurumu kaydet
                      </button>
                    </ActionForm>
                  )}

                  {directoryAvailable && !isSelf ? (
                    <ActionForm
                      action={handleAccess.bind(null, m.id, m.disabled)}
                      confirmMessage={
                        m.disabled
                          ? `${m.full_name || m.email || "Bu kullanıcı"} için erişim yeniden açılsın mı?`
                          : `${m.full_name || m.email || "Bu kullanıcı"} için erişim durdurulsun mu? Kullanıcı giriş yapamaz; açık oturumu en geç 1 saat içinde kapanır.`
                      }
                      successMessage={m.disabled ? "Erişim yeniden açıldı." : "Erişim durduruldu."}
                    >
                      <button
                        type="submit"
                        className={m.disabled ? "button-success button-compact" : "button-danger button-compact"}
                      >
                        {m.disabled ? <ShieldCheck size={14} aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />}
                        {m.disabled ? "Erişimi aç" : "Erişimi durdur"}
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        )}
      </section>
    </main>
  );
}
