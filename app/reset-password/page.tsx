import { resetPassword } from "@/app/actions/auth";
import PasswordForm from "@/app/dashboard/settings/password-form";

// Proxy, oturumu olmayan ziyaretçiyi bu sayfadan giriş sayfasına yönlendirir;
// buraya yalnızca /auth/confirm üzerinden doğrulanmış bağlantıyla gelinir.
export default function ResetPasswordPage() {
  return (
    <main className="auth-simple-page">
      <div className="login-card">
        <div className="login-heading">
          <span className="login-kicker">Şifre sıfırlama</span>
          <h2 className="brand-type">Yeni şifrenizi belirleyin</h2>
          <p>En az 8 karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.</p>
        </div>

        <PasswordForm action={resetPassword} variant="login" submitLabel="Şifreyi kaydet ve devam et" />
      </div>
    </main>
  );
}
