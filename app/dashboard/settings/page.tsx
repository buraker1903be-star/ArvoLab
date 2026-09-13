import { redirect } from "next/navigation";
import { KeyRound, Save, UserRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { ROLE_LABELS } from "@/lib/project-labels";
import { changePassword } from "@/app/actions/auth";
import { updateMyProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import PasswordForm from "./password-form";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.user.id)
    .maybeSingle();

  let organizationName: string | null = null;
  if (ctx.organizationId) {
    const { data: organization } = await ctx.supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    organizationName = organization?.name ?? null;
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Hesap</span>
          <h1 className="brand-type">Ayarlar</h1>
          <p>Profil bilgilerinizi ve şifrenizi buradan yönetin. Rol ve kurum değişiklikleri Sistem Yöneticisi tarafından yapılır.</p>
        </div>
      </section>

      <section className="project-form-card" style={{ marginBottom: 24 }}>
        <div className="project-form-heading">
          <h2>
            <UserRound size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Profil
          </h2>
          <p>Ad soyadınız kapak sayfası ve ekip listesinde kullanılır.</p>
        </div>

        <dl className="settings-facts">
          <div>
            <dt>E-posta</dt>
            <dd>{ctx.user.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{ctx.role ? ROLE_LABELS[ctx.role] : "—"}</dd>
          </div>
          <div>
            <dt>Kurum</dt>
            <dd>{organizationName ?? "Kuruma bağlı değil"}</dd>
          </div>
        </dl>

        <ActionForm action={updateMyProfile} className="project-form-grid" successMessage="Profiliniz güncellendi.">
          <label>
            <span>Ad soyad</span>
            <input name="fullName" type="text" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required />
          </label>
          <div className="project-form-actions" style={{ alignSelf: "end" }}>
            <button type="submit" className="projects-primary-button">
              <Save size={16} />
              Kaydet
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>
            <KeyRound size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Şifre değiştir
          </h2>
          <p>En az 8 karakter. Şifrenizi değiştirdikten sonra diğer cihazlardaki oturumlarınız açık kalabilir.</p>
        </div>
        <PasswordForm action={changePassword} variant="panel" submitLabel="Şifreyi güncelle" />
      </section>
    </main>
  );
}
