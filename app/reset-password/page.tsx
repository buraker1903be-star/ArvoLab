import { ilkSifredenCik, resetPassword, yeniDogrulamaIste } from "@/app/actions/auth";
import PasswordForm from "@/app/dashboard/settings/password-form";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { ceviri } from "@/lib/dil-sunucu";
import { EN_KISA_SIFRE, EN_UZUN_SIFRE } from "@/lib/kimlik-kurallari";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yeni şifre", en: "New password" }) };
}

// Proxy, oturumu olmayan ziyaretçiyi bu sayfadan giriş sayfasına yönlendirir;
// buraya yalnızca /auth/confirm üzerinden doğrulanmış bağlantıyla gelinir.
// Signature OS 5 / Phase 2: yalnızca yerleşim değişti.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ ilk?: string; cikis?: string }> }) {
  const t = await ceviri();
  /*
    ?ilk=1: kayıt doğrulamasından gelen yeni kullanıcı (G1, 06.11.2026).
    Kayıt artık şifre almıyor; şifre burada, adresin sahibi olduğu
    kanıtlanmış oturumda ilk kez belirleniyor. Akış sıfırlamayla aynı,
    yalnızca metin farklı.
  */
  const sorgu = await searchParams;
  const ilk = sorgu.ilk === "1";
  // Yalnızca tanınan değer: sorgudaki metin ekrana yansıtılmaz.
  const cikisHatasi = sorgu.cikis === "hata";
  return (
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1>{ilk ? t({ tr: "Şifrenizi belirleyin", en: "Set your password" }) : t({ tr: "Yeni şifrenizi belirleyin", en: "Set your new password" })}</h1>
        <p>
          {ilk
            ? t({
                tr: `E-postanız doğrulandı. ${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} karakterlik bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz.`,
                en: `Your email is verified. Enter a password of ${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} characters. After saving you will be taken to your dashboard.`,
              })
            : t({
                tr: `${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} karakterlik yeni bir şifre girin. Kaydettikten sonra panele yönlendirileceksiniz; diğer cihazlardaki oturumlar kapatılır.`,
                en: `Enter a new password of ${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} characters. After saving you will be taken to your dashboard and sessions on other devices will be signed out.`,
              })}
        </p>
      </header>

      {cikisHatasi ? (
        <div className="os5-kimlik-bildirimler">
          <Bildirim ton="hata" rol="alert">
            {t({ tr: "Çıkış yapılamadı. Bağlantınızı kontrol edip tekrar deneyin.", en: "Could not sign out. Check your connection and try again." })}
          </Bildirim>
        </div>
      ) : null}

      <PasswordForm action={resetPassword} variant="login" submitLabel={t({ tr: "Şifreyi kaydet ve devam et", en: "Save password and continue" })} />

      {/*
        R1 (G1 Aşama 8.3): bu ekranın tek çıkışı buydu ve yoktu. İkisi de
        yalnızca bu tarayıcının oturumunu kapatır (app/actions/auth.ts);
        kendiliğinden çalışmaz, kullanıcının düğmesidir.
      */}
      <div className="os5-kimlik-kurtarma">
        <form action={yeniDogrulamaIste}>
          {ilk ? <input type="hidden" name="ilk" value="1" /> : null}
          <button type="submit" className="os5-kimlik-geri">
            {t({ tr: "Yeni doğrulama bağlantısı iste", en: "Request a new verification link" })}
          </button>
        </form>
        <form action={ilkSifredenCik}>
          {ilk ? <input type="hidden" name="ilk" value="1" /> : null}
          <button type="submit" className="os5-kimlik-geri">
            {t({ tr: "Çıkış yap", en: "Sign out" })}
          </button>
        </form>
      </div>
    </KimlikYerlesimi>
  );
}
