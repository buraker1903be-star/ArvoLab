"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login } from "@/app/actions/auth";
import { useCeviri } from "./dil-saglayici";

/*
  Giriş formu (02.11.2026, giriş sayfası yeniden yazılırken ayrıldı).
  İstemci bileşeni yalnızca iki şey için: şifreyi göster/gizle ve gönderim
  sürerken düğmenin kilitlenmesi. Eskiden düğmeye iki kez basan kullanıcı
  iki giriş isteği gönderiyordu ve yavaş bağlantıda sayfa hiçbir şey
  olmuyormuş gibi duruyordu. Doğrulama ve yönlendirme sunucuda
  (app/actions/auth.ts → login); form JavaScript yüklenmeden de çalışır.
*/
function GonderDugmesi() {
  const t = useCeviri();
  const { pending } = useFormStatus();
  return (
    <button className="login-button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <LoaderCircle size={18} className="giris-donen" aria-hidden="true" />
          {t({ tr: "Giriş yapılıyor…", en: "Signing in…" })}
        </>
      ) : (
        <>
          {t({ tr: "Giriş yap", en: "Sign in" })}
          <ArrowRight size={18} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export default function GirisFormu({ next }: { next: string }) {
  const t = useCeviri();
  const [goster, setGoster] = useState(false);

  return (
    <form className="login-form" action={login}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="email">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
        required
      />

      <div className="password-label-row">
        <label htmlFor="password">{t({ tr: "Şifre", en: "Password" })}</label>
        <Link href="/forgot-password">{t({ tr: "Şifremi unuttum", en: "Forgot password" })}</Link>
      </div>
      <div className="giris-sifre">
        <input
          id="password"
          name="password"
          type={goster ? "text" : "password"}
          autoComplete="current-password"
          placeholder={t({ tr: "Şifrenizi girin", en: "Enter your password" })}
          required
        />
        <button
          type="button"
          className="giris-sifre-goster"
          onClick={() => setGoster((g) => !g)}
          aria-pressed={goster}
          aria-controls="password"
          aria-label={goster ? t({ tr: "Şifreyi gizle", en: "Hide password" }) : t({ tr: "Şifreyi göster", en: "Show password" })}
        >
          {goster ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>

      <GonderDugmesi />
    </form>
  );
}
