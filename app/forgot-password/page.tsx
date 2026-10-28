import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import ThemeToggle from "@/app/_components/theme-toggle";
import { ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Şifremi unuttum", en: "Forgot password" }) };
}

const errorMessages: Record<string, Metin> = {
  "missing-email": { tr: "E-posta adresi zorunludur.", en: "Email address is required." },
  "rate-limited": {
    tr: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
    en: "Too many attempts. Try again in a few minutes.",
  },
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const t = await ceviri();
  const hata = params.error ? errorMessages[params.error] : undefined;
  const errorMessage = hata ? t(hata) : null;
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
          <span className="login-kicker">{t({ tr: "Şifre sıfırlama", en: "Password reset" })}</span>
          <h2>{t({ tr: "Şifrenizi mi unuttunuz?", en: "Forgot your password?" })}</h2>
          <p>
            {t({
              tr: "Hesabınıza bağlı e-posta adresini girin, şifrenizi yenilemeniz için bir bağlantı gönderelim.",
              en: "Enter the email address linked to your account and we will send you a link to reset your password.",
            })}
          </p>
        </div>

        {sent ? (
          <p className="alert" data-tone="success" role="status">
            {t({
              tr: "Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda ve aynı tarayıcıda açın; spam klasörünü de kontrol edin.",
              en: "If this address is registered, a reset link will arrive within a few minutes. Open it on this device in the same browser, and check your spam folder.",
            })}
          </p>
        ) : null}
        {errorMessage ? <p className="alert" role="alert">{errorMessage}</p> : null}

        <form className="login-form" action={requestPasswordReset}>
          <label htmlFor="email">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t({ tr: "ornek@kurum.com", en: "name@university.edu" })}
            required
          />

          <button className="login-button" type="submit">
            {t({ tr: "Sıfırlama bağlantısı gönder", en: "Send reset link" })}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <Link href="/" className="auth-back-link">
          <ArrowLeft size={15} aria-hidden="true" />
          {t({ tr: "Giriş sayfasına dön", en: "Back to sign in" })}
        </Link>
      </div>
    </main>
  );
}
