import { ShieldAlert, UserCog, Building2, Plus } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/profile";
import { getAllProfiles, getOrganizations, updateUserRole, updateUserOrganization, createOrganization } from "@/app/actions/team";
import { ROLE_LABELS, type UserRole } from "@/lib/project-labels";

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
        <section className="project-form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <ShieldAlert size={28} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
            Bu sayfaya yalnızca Sistem Yöneticisi ve Kurucu rolleri erişebilir.
          </p>
        </section>
      </main>
    );
  }

  const [members, organizations] = await Promise.all([getAllProfiles(), getOrganizations()]);

  async function handleRoleChange(userId: string, formData: FormData) {
    "use server";
    const role = String(formData.get("role") ?? "");
    await updateUserRole(userId, role);
  }

  async function handleOrgChange(userId: string, formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organizationId") ?? "");
    await updateUserOrganization(userId, organizationId);
  }

  async function handleCreateOrganization(formData: FormData) {
    "use server";
    await createOrganization(formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Yönetim</span>
          <h1 className="brand-type">Ekip Yönetimi</h1>
          <p>
            Yeni kayıt olan her kullanıcı varsayılan olarak <strong>Üye / Öğrenci</strong>{" "}
            rolüyle başlar ve yalnızca kendi çalışmasını görür. Bir kullanıcıyı
            AkademikMerkez personeli yapmak için aşağıdan rolünü değiştirin.
          </p>
        </div>
      </section>

      <section className="project-form-card" style={{ marginBottom: 24 }}>
        <div className="project-form-heading">
          <h2>
            <Building2 size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Yeni Kurum Ekle
          </h2>
          <p>Kullanıcıları bir kuruma bağlamak için önce kurumu burada oluşturun.</p>
        </div>
        <form className="project-form-grid" action={handleCreateOrganization}>
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
        </form>
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
          {members.map((m) => (
            <article className="project-card" key={m.id}>
              <div className="project-card-main">
                <div>
                  <span className="project-status">{ROLE_LABELS[m.role]}</span>
                  <h2>{m.full_name || "İsimsiz kullanıcı"}</h2>
                  <p style={{ fontFamily: "monospace", fontSize: 11 }}>{m.id}</p>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <form action={handleRoleChange.bind(null, m.id)} style={{ display: "flex", gap: 8 }}>
                  <select
                    name="role"
                    defaultValue={m.role}
                    style={{
                      height: 38,
                      padding: "0 10px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="projects-filter-button" style={{ height: 38 }}>
                    Rolü kaydet
                  </button>
                </form>

                {organizations.length > 0 && (
                  <form action={handleOrgChange.bind(null, m.id)} style={{ display: "flex", gap: 8 }}>
                    <select
                      name="organizationId"
                      defaultValue={m.organization_id ?? ""}
                      style={{
                        height: 38,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    >
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
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
