"use client";

import { ArrowRight } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Girdi } from "@/app/_components/ui/girdi";
import { SifreGirdisi } from "@/app/_components/ui/sifre-girdisi";
import GonderDugmesi from "@/app/_components/kimlik/gonder-dugmesi";
import { useCeviri } from "./dil-saglayici";
import SifreSifirlamaPenceresi from "./sifre-sifirlama-penceresi";

/*
  Giriş formu (02.11.2026, giriş sayfası yeniden yazılırken ayrıldı).
  İstemci bileşeni yalnızca iki şey için: şifreyi göster/gizle ve gönderim
  sürerken düğmenin kilitlenmesi. Eskiden düğmeye iki kez basan kullanıcı
  iki giriş isteği gönderiyordu ve yavaş bağlantıda sayfa hiçbir şey
  olmuyormuş gibi duruyordu. Doğrulama ve yönlendirme sunucuda
  (app/actions/auth.ts → login); form JavaScript yüklenmeden de çalışır.

  Signature OS 5 / Phase 2: alanlar ortak bileşenlerle (Girdi, SifreGirdisi)
  çiziliyor. Alan adları (email, password, next), kimlikler ve autocomplete
  değerleri DEĞİŞMEDİ: tarayıcının kayıtlı şifre doldurması onlara bakıyor,
  şifre sıfırlama penceresi de girişte yazılan adresi #email'den alıyor.
  "Şifremi unuttum" şifre alanının ALTINA indi; sekme sırası artık
  e-posta → şifre → göster → şifremi unuttum → giriş (eskiden bağlantı
  şifre alanından önce geliyordu ve şifreye giderken araya giriyordu).
*/
export default function GirisFormu({ next }: { next: string }) {
  const t = useCeviri();

  return (
    <form className="os5-kimlik-formu" action={login}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
      <div className="os5-kimlik-sifre">
        <SifreGirdisi
          id="password"
          name="password"
          etiket={t({ tr: "Şifre", en: "Password" })}
          autoComplete="current-password"
          placeholder={t({ tr: "Şifrenizi girin", en: "Enter your password" })}
          required
        />
        {/* Pencere olarak açılır (sifre-sifirlama-penceresi.tsx); JS yoksa sayfaya gider. */}
        <div className="os5-kimlik-satir">
          <SifreSifirlamaPenceresi />
        </div>
      </div>
      <GonderDugmesi
        metin={t({ tr: "Giriş yap", en: "Sign in" })}
        bekleyen={t({ tr: "Giriş yapılıyor…", en: "Signing in…" })}
        sonEk={<ArrowRight size={18} aria-hidden="true" />}
      />
    </form>
  );
}
