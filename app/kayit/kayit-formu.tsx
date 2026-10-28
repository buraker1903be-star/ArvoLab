"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signUp } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/auth-guards";
import { EN_KISA_SIFRE } from "@/lib/kayit";

const AYDINLATMA = "https://arvo-os.com/gizlilik";

/*
  Kayıt formu.

  Başarıda form YERİNE bir bilgi ekranı geliyor: kullanıcının yapacağı tek
  iş posta kutusuna bakmak, formu tekrar doldurmaya çalışması yalnızca hız
  sınırını yakar. "Gönderdik" demek de yetmiyor — nereye baktığı, ne kadar
  geçerli olduğu ve spam klasörü tek tek yazılıyor; doğrulama postası
  gelmeyen kullanıcı destek talebine dönüşüyor.
*/
export default function KayitFormu() {
  const t = useCeviri();
  const [durum, gonder, bekliyor] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await signUp(_onceki, formData)) ?? null,
    null,
  );

  if (durum?.success) {
    return (
      <div className="login-heading">
        <span className="login-kicker">{t({ tr: "Son adım", en: "Last step" })}</span>
        <h2>{t({ tr: "Posta kutunuza bakın", en: "Check your inbox" })}</h2>
        <p>
          {t({
            tr: "Adresinize bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda hesabınız açılır ve doğrudan çalışma alanınıza girersiniz. Bağlantı 24 saat geçerli; e-postayı göremiyorsanız spam klasörünü kontrol edin.",
            en: "We sent a verification link to your address. Clicking it activates your account and takes you straight to your workspace. The link is valid for 24 hours; if you don't see the email, check your spam folder.",
          })}
        </p>
        <p className="muted text-sm">
          {t({
            tr: "Bu adresle zaten bir hesabınız varsa yeni hesap açılmaz; bunun yerine giriş bağlantısı gönderilir.",
            en: "If you already have an account with this address, no new account is created; we send you a sign-in link instead.",
          })}
        </p>
        <Link href="/" className="projects-filter-button">
          {t({ tr: "Giriş ekranına dön", en: "Back to sign in" })}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="login-heading">
        <span className="login-kicker">{t({ tr: "Kayıt", en: "Sign up" })}</span>
        <h2>{t({ tr: "ArvoLab hesabı oluşturun", en: "Create your ArvoLab account" })}</h2>
        <p>
          {t({
            tr: "Tezinizi yazmaya, kaynak bulmaya ve kılavuz denetimine birkaç dakika içinde başlayın.",
            en: "Start writing your thesis, finding sources and checking against your guidelines within minutes.",
          })}
        </p>
      </div>

      {durum?.error ? (
        <p className="alert" role="alert">
          {durum.error}
        </p>
      ) : null}

      <form className="login-form" action={gonder}>
        <label htmlFor="fullName">{t({ tr: "Ad soyad", en: "Full name" })}</label>
        <input id="fullName" name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} required />

        <label htmlFor="email">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t({ tr: "ornek@kurum.edu.tr", en: "name@university.edu" })}
          required
        />

        <label htmlFor="password">{t({ tr: "Şifre", en: "Password" })}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={EN_KISA_SIFRE}
          required
        />
        <p className="muted text-sm">{t({ tr: `En az ${EN_KISA_SIFRE} karakter.`, en: `At least ${EN_KISA_SIFRE} characters.` })}</p>

        <label className="secim-satiri">
          <input type="checkbox" name="kvkk" required />
          <span>
            {t({ tr: "", en: "I have read the " })}
            <a href={AYDINLATMA} target="_blank" rel="noreferrer">
              {t({ tr: "Aydınlatma metnini", en: "privacy notice" })}
            </a>
            {t({
              tr: " okudum, kişisel verilerimin işlenmesini onaylıyorum.",
              en: " and consent to the processing of my personal data.",
            })}
          </span>
        </label>

        <button className="login-button" type="submit" disabled={bekliyor}>
          {bekliyor ? t({ tr: "Gönderiliyor…", en: "Sending…" }) : t({ tr: "Hesabımı oluştur", en: "Create my account" })}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <p className="muted text-sm">
        {t({ tr: "Hesabınız var mı?", en: "Already have an account?" })} <Link href="/">{t({ tr: "Giriş yapın", en: "Sign in" })}</Link>
      </p>
    </>
  );
}
