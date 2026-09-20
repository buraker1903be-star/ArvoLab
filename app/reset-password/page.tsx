import { resetPassword } from "@/app/actions/auth";
import PasswordForm from "@/app/dashboard/settings/password-form";
import ThemeToggle from "@/app/_components/theme-toggle";

// Proxy, oturumu olmayan ziyaretçiyi bu sayfadan giriş sayfasına yönlendirir;
// buraya yalnızca /auth/confirm üzerinden doğrulanmış bağlantıyla gelinir.
export default function ResetPasswordPage() {
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
          <span className="login-kicker">Şifre sıfırlama</span>
          <h2>Yeni şifrenizi belirleyin</h2>
          <p>En az 8 karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.</p>
        </div>

        <PasswordForm action={resetPassword} variant="login" submitLabel="Şifreyi kaydet ve devam et" />
      </div>
    </main>
  );
}
