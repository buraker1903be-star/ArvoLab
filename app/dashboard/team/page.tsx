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

const ROLE_ORDER: UserRole[] = [
  "client",
  "employee",
  "expert",
  "controller",
  "academic_manager",
  "system_admin",
  "founder",
];

const compactSelectStyle = {
  height: 38,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: 12,
} as const;

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  if (!isAdmin) {
    return (
      <main className="dashboard-page">
        <section className="project-form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <ShieldAlert size={28} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
            Bu sayfaya yalnızca Sistem Yöneticisi ve Kurucu rolleri erişebilir.
          </p>
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
          <h1 className="brand-type">Ekip Yönetimi</h1>
          <p>
            Yeni kullanıcıları e-postayla davet edin, rollerini ve kurumlarını belirleyin. Davetsiz kayıt olan
            kullanıcılar <strong>Üye / Öğrenci</strong> rolüyle başlar ve yalnızca kendi çalışmasını görür.
          </p>
        </div>
      </section>

      <section className="project-form-card" style={{ marginBottom: 24 }}>
        <div className="project-form-heading">
          <h2>
            <MailPlus size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Kullanıcı Davet Et
          </h2>
          <p>
            Davet edilen kişiye şifresini belirleyeceği bir bağlantı gönderilir. Rol ve kurum davetle birlikte atanır.
          </p>
        </div>
        {directoryAvailable ? (
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
            <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="projects-primary-button">
                <MailPlus size={16} />
                Davet gönder
              </button>
            </div>
          </ActionForm>
        ) : (
          <p className="login-error" role="alert" style={{ margin: 0 }}>
            Davet, e-posta listesi ve erişim durdurma için sunucuda <code>SUPABASE_SECRET_KEY</code> ortam değişkeni
            tanımlı olmalı.
          </p>
        )}
      </section>

      <section className="project-form-card" style={{ marginBottom: 24 }}>
        <div className="project-form-heading">
          <h2>
            <Building2 size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Yeni Kurum Ekle
          </h2>
          <p>Kullanıcıları bir kuruma bağlamak için önce kurumu burada oluşturun.</p>
        </div>
        <ActionForm className="project-form-grid" action={handleCreateOrganization} successMessage="Kurum eklendi.">
          <label>
            <span>Kurum adı</span>
            <input name="name" type="text" placeholder="Örn. AkademikMerkez" required />
          </label>
          <div className="project-form-actions">
            <button type="submit" className="projects-primary-button">
              <Plus size={16} />
              Kurumu ekle
            </button>
          </div>
        </ActionForm>
        {organizations.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>
            Mevcut kurumlar: {organizations.map((o) => o.name).join(", ")}
          </p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>
          <UserCog size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
          Kullanıcılar ({members.length})
        </h2>
        <div className="projects-list">
          {members.map((m) => {
            const isSelf = m.id === profile?.id;
            return (
              <article className="project-card" key={m.id}>
                <div className="project-card-main">
                  <div>
                    <span className="project-status">{ROLE_LABELS[m.role]}</span>
                    {m.pendingInvite ? (
                      <span className="project-status" style={{ marginLeft: 8 }}>
                        Davet bekliyor
                      </span>
                    ) : null}
                    {m.disabled ? (
                      <span className="project-status" style={{ marginLeft: 8, color: "var(--danger)" }}>
                        Erişim durduruldu
                      </span>
                    ) : null}
                    <h2>
                      {m.full_name || "İsimsiz kullanıcı"}
                      {isSelf ? " (siz)" : ""}
                    </h2>
                    <p>{m.email ?? <span style={{ fontFamily: "monospace", fontSize: 11 }}>{m.id}</span>}</p>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <ActionForm
                    action={handleRoleChange.bind(null, m.id)}
                    style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                    successMessage="Rol kaydedildi."
                  >
                    <select name="role" defaultValue={m.role} style={compactSelectStyle} disabled={isSelf} aria-label="Rol">
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="projects-filter-button" style={{ height: 38 }} disabled={isSelf}>
                      Rolü kaydet
                    </button>
                  </ActionForm>

                  {organizations.length > 0 && (
                    <ActionForm
                      action={handleOrgChange.bind(null, m.id)}
                      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      successMessage="Kurum kaydedildi."
                    >
                      <select name="organizationId" defaultValue={m.organization_id ?? ""} style={compactSelectStyle} aria-label="Kurum">
                        <option value="">Kurum yok</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="projects-filter-button" style={{ height: 38 }}>
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
                    >
                      <button
                        type="submit"
                        className="projects-filter-button"
                        style={{ height: 38, color: m.disabled ? "var(--success)" : "var(--danger)" }}
                      >
                        {m.disabled ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        {m.disabled ? "Erişimi aç" : "Erişimi durdur"}
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
