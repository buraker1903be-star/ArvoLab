import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import ThemeToggle from "@/app/_components/theme-toggle";

const errorMessages: Record<string, string> = {
  "missing-email": "E-posta adresi zorunludur.",
  "rate-limited": "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;
  const sent = params.sent === "1";

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
          <h2>Şifrenizi mi unuttunuz?</h2>
          <p>Hesabınıza bağlı e-posta adresini girin, şifrenizi yenilemeniz için bir bağlantı gönderelim.</p>
        </div>

        {sent ? (
          <p className="alert" data-tone="success" role="status">
            Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda ve aynı
            tarayıcıda açın; spam klasörünü de kontrol edin.
          </p>
        ) : null}
        {errorMessage ? <p className="alert" role="alert">{errorMessage}</p> : null}

        <form className="login-form" action={requestPasswordReset}>
          <label htmlFor="email">E-posta adresi</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="ornek@kurum.com" required />

          <button className="login-button" type="submit">
            Sıfırlama bağlantısı gönder
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <Link href="/" className="auth-back-link">
          <ArrowLeft size={15} aria-hidden="true" />
          Giriş sayfasına dön
        </Link>
      </div>
    </main>
  );
}
