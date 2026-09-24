"use client";

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
  const [durum, gonder, bekliyor] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await signUp(_onceki, formData)) ?? null,
    null,
  );

  if (durum?.success) {
    return (
      <div className="login-heading">
        <span className="login-kicker">Son adım</span>
        <h2>Posta kutunuza bakın</h2>
        <p>
          Adresinize bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda hesabınız açılır ve doğrudan
          çalışma alanınıza girersiniz. Bağlantı 24 saat geçerli; e-postayı göremiyorsanız spam klasörünü kontrol edin.
        </p>
        <p className="muted text-sm">
          Bu adresle zaten bir hesabınız varsa yeni hesap açılmaz; bunun yerine giriş bağlantısı gönderilir.
        </p>
        <Link href="/" className="projects-filter-button">
          Giriş ekranına dön
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="login-heading">
        <span className="login-kicker">Kayıt</span>
        <h2>ArvoLab hesabı oluşturun</h2>
        <p>Tezinizi yazmaya, kaynak bulmaya ve kılavuz denetimine birkaç dakika içinde başlayın.</p>
      </div>

      {durum?.error ? (
        <p className="alert" role="alert">
          {durum.error}
        </p>
      ) : null}

      <form className="login-form" action={gonder}>
        <label htmlFor="fullName">Ad soyad</label>
        <input id="fullName" name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} required />

        <label htmlFor="email">E-posta adresi</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="ornek@kurum.edu.tr" required />

        <label htmlFor="password">Şifre</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={EN_KISA_SIFRE}
          required
        />
        <p className="muted text-sm">En az {EN_KISA_SIFRE} karakter.</p>

        <label className="secim-satiri">
          <input type="checkbox" name="kvkk" required />
          <span>
            <a href={AYDINLATMA} target="_blank" rel="noreferrer">
              Aydınlatma metnini
            </a>{" "}
            okudum, kişisel verilerimin işlenmesini onaylıyorum.
          </span>
        </label>

        <button className="login-button" type="submit" disabled={bekliyor}>
          {bekliyor ? "Gönderiliyor…" : "Hesabımı oluştur"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <p className="muted text-sm">
        Hesabınız var mı? <Link href="/">Giriş yapın</Link>
      </p>
    </>
  );
}
