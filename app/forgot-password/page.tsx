import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
import GonderDugmesi from "@/app/_components/kimlik/gonder-dugmesi";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { Girdi } from "@/app/_components/ui/girdi";
import { ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Şifremi unuttum", en: "Forgot password" }) };
}

/*
  Şifremi unuttum SAYFASI: JavaScript'siz giriş ve e-postalardaki
  bağlantılar buraya gelir (giriş ekranında aynı iş bir pencerede,
  sifre-sifirlama-penceresi.tsx). Signature OS 5 / Phase 2'de ortak kimlik
  yerleşimine geçti; eylem (requestPasswordReset), ?error= ve ?sent=1
  eşlemeleri aynı. Tema düğmesi artık yerleşimin araç satırında: eskiden
  sağ üstte sabit konumlu ayrı bir kutuydu.
*/
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
  const sent = params.sent === "1";

  return (
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1>{t({ tr: "Şifrenizi mi unuttunuz?", en: "Forgot your password?" })}</h1>
        <p>
          {t({
            tr: "Hesabınıza bağlı e-posta adresini girin, şifrenizi yenilemeniz için bir bağlantı gönderelim.",
            en: "Enter the email address linked to your account and we will send you a link to reset your password.",
          })}
        </p>
      </header>

      {sent || hata ? (
        <div className="os5-kimlik-bildirimler">
          {sent ? (
            <Bildirim ton="basari" rol="status">
              {t({
                tr: "Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda ve aynı tarayıcıda açın; spam klasörünü de kontrol edin.",
                en: "If this address is registered, a reset link will arrive within a few minutes. Open it on this device in the same browser, and check your spam folder.",
              })}
            </Bildirim>
          ) : null}
          {hata ? (
            <Bildirim ton="hata" rol="alert">
              {t(hata)}
            </Bildirim>
          ) : null}
        </div>
      ) : null}

      <form className="os5-kimlik-formu" action={requestPasswordReset}>
        <Girdi
          id="email"
          name="email"
          type="email"
          etiket={t({ tr: "E-posta adresi", en: "Email address" })}
          autoComplete="email"
          inputMode="email"
          placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
          required
        />
        <GonderDugmesi
          metin={t({ tr: "Sıfırlama bağlantısı gönder", en: "Send reset link" })}
          bekleyen={t({ tr: "Gönderiliyor…", en: "Sending…" })}
          sonEk={<ArrowRight size={18} aria-hidden="true" />}
        />
      </form>

      <Link href="/" className="os5-kimlik-geri">
        <ArrowLeft size={16} aria-hidden="true" />
        {t({ tr: "Giriş sayfasına dön", en: "Back to sign in" })}
      </Link>
    </KimlikYerlesimi>
  );
}
