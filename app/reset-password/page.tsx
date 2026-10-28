import { resetPassword } from "@/app/actions/auth";
import PasswordForm from "@/app/dashboard/settings/password-form";
import ThemeToggle from "@/app/_components/theme-toggle";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yeni şifre", en: "New password" }) };
}

// Proxy, oturumu olmayan ziyaretçiyi bu sayfadan giriş sayfasına yönlendirir;
// buraya yalnızca /auth/confirm üzerinden doğrulanmış bağlantıyla gelinir.
export default async function ResetPasswordPage() {
  const t = await ceviri();
  return (
    <main className="auth-simple-page">
      {/* Giriş sayfasında tema düğmesi vardı, kardeş sayfalarında yoktu:
          koyu temadaki kullanıcı buraya gelince değiştiremiyordu. Stil
          (auth.css .auth-theme-toggle) zaten yazılmıştı, bağlanmamıştı. */}
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-heading">
          <span className="login-kicker">{t({ tr: "Şifre sıfırlama", en: "Password reset" })}</span>
          <h2>{t({ tr: "Yeni şifrenizi belirleyin", en: "Set your new password" })}</h2>
          <p>
            {t({
              tr: "En az 8 karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.",
              en: "Enter a new password of at least 8 characters. After saving you will be taken to your dashboard.",
            })}
          </p>
        </div>

        <PasswordForm action={resetPassword} variant="login" submitLabel={t({ tr: "Şifreyi kaydet ve devam et", en: "Save password and continue" })} />
      </div>
    </main>
  );
}
