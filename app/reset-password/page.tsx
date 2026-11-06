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
// Signature OS 5 / Phase 2: yalnızca yerleşim değişti.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ ilk?: string }> }) {
  const t = await ceviri();
  /*
    ?ilk=1: kayıt doğrulamasından gelen yeni kullanıcı (G1, 06.11.2026).
    Kayıt artık şifre almıyor; şifre burada, adresin sahibi olduğu
    kanıtlanmış oturumda ilk kez belirleniyor. Akış sıfırlamayla aynı,
    yalnızca metin farklı.
  */
  const ilk = (await searchParams).ilk === "1";
  return (
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1>{ilk ? t({ tr: "Şifrenizi belirleyin", en: "Set your password" }) : t({ tr: "Yeni şifrenizi belirleyin", en: "Set your new password" })}</h1>
        <p>
          {ilk
            ? t({
                tr: "E-postanız doğrulandı. En az 8 karakterlik bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.",
                en: "Your email is verified. Enter a password of at least 8 characters. After saving you will be taken to your dashboard.",
              })
            : t({
                tr: "En az 8 karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.",
                en: "Enter a new password of at least 8 characters. After saving you will be taken to your dashboard.",
              })}
        </p>
      </header>

      <PasswordForm action={resetPassword} variant="login" submitLabel={t({ tr: "Şifreyi kaydet ve devam et", en: "Save password and continue" })} />
    </KimlikYerlesimi>
  );
}
