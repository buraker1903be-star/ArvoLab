import { resetPassword } from "@/app/actions/auth";
import PasswordForm from "@/app/dashboard/settings/password-form";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yeni şifre", en: "New password" }) };
}

// Proxy, oturumu olmayan ziyaretçiyi bu sayfadan giriş sayfasına yönlendirir;
// buraya yalnızca /auth/confirm üzerinden doğrulanmış bağlantıyla gelinir.
// Signature OS 5 / Phase 2: yalnızca yerleşim değişti. Şifre kuralı ve
// eylem (resetPassword) aynı; "en az 8" metni sunucudaki kuralı
// (app/actions/auth.ts MIN_PASSWORD_LENGTH) aynen söylüyor.
export default async function ResetPasswordPage() {
  const t = await ceviri();
  return (
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1>{t({ tr: "Yeni şifrenizi belirleyin", en: "Set your new password" })}</h1>
        <p>
          {t({
            tr: "En az 8 karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.",
            en: "Enter a new password of at least 8 characters. After saving you will be taken to your dashboard.",
          })}
        </p>
      </header>

      <PasswordForm action={resetPassword} variant="login" submitLabel={t({ tr: "Şifreyi kaydet ve devam et", en: "Save password and continue" })} />
    </KimlikYerlesimi>
  );
}
