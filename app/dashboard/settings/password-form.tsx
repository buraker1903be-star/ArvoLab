"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useActionState, type FormEvent } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";
import { EN_KISA_SIFRE, SIFRE_ESLESMEDI, sifreKuraliHatasi } from "@/lib/kimlik-kurallari";

interface PasswordFormProps {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /** "login": giriş sayfası görünümü, "panel": dashboard kart formu. */
  variant: "login" | "panel";
  submitLabel: string;
}

export default function PasswordForm({ action, variant, submitLabel }: PasswordFormProps) {
  const t = useCeviri();
  const [state, formAction, pending] = useActionState(action, null);
  /*
    Tarayıcı minLength'i kendisi denetler; 64 karakter, 72 bayt, tekrar ve
    yaygın şifre kurallarını bilmez. Aynı kural fonksiyonu
    (lib/kimlik-kurallari.ts) burada da çalışır ki kullanıcı göndermeden NEDENİ
    görsün. Bu yalnızca kolaylık: sunucu (applyNewPassword) aynı denetimi
    kendisi yapar.

    maxLength BİLEREK YOK (G1-D, 11.11.2026). Eskiden maxLength=64 vardı ve
    tarayıcı 64'ü aşan yazmayı da yapıştırmayı da HİÇ UYARMADAN kırpıyordu:
    gerçek testte 73 karakter giren kullanıcının şifresi ilk 64 karakteriyle
    kaydedildi, kullanıcı kaydedilen şifreyi bilmiyordu. Artık her karakter
    kutuda kalır; 65 ve üstü "en fazla 64" mesajıyla gönderilmez.

    "Tekrar" kutusu: kural mesajı yerine eşleşme mesajı. İki kutudan biri
    değişince eşleşme yeniden hesaplanır (yalnızca tekrar kutusuna bakmak,
    önce tekrarı sonra şifreyi düzelten kullanıcıda eski mesajı bırakırdı).
  */
  const eslesmeyiDenetle = (form: HTMLFormElement | null) => {
    const sifre = form?.elements.namedItem("password");
    const tekrar = form?.elements.namedItem("passwordConfirm");
    if (!(sifre instanceof HTMLInputElement) || !(tekrar instanceof HTMLInputElement)) return;
    tekrar.setCustomValidity(tekrar.value && tekrar.value !== sifre.value ? t(SIFRE_ESLESMEDI) : "");
  };
  const sifreDenetle = (e: FormEvent<HTMLInputElement>) => {
    const kutu = e.currentTarget;
    const hata = kutu.value ? sifreKuraliHatasi(kutu.value) : null;
    kutu.setCustomValidity(hata ? t(hata) : "");
    eslesmeyiDenetle(kutu.form);
  };
  const tekrarDenetle = (e: FormEvent<HTMLInputElement>) => eslesmeyiDenetle(e.currentTarget.form);

  if (variant === "login") {
    return (
      <form className="login-form" action={formAction}>
        {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
        <label htmlFor="password">{t({ tr: "Yeni şifre", en: "New password" })}</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={sifreDenetle} required />
        <label htmlFor="passwordConfirm">{t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })}</label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={tekrarDenetle} required />
        <button className="login-button" type="submit" disabled={pending}>
          {pending ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : submitLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    );
  }

  return (
    <form className="project-form-grid" action={formAction}>
      <label>
        <span>{t({ tr: "Yeni şifre", en: "New password" })}</span>
        <input name="password" type="password" autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={sifreDenetle} required />
      </label>
      <label>
        <span>{t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })}</span>
        <input name="passwordConfirm" type="password" autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={tekrarDenetle} required />
      </label>
      <div className="project-form-actions">
        <button type="submit" className="projects-primary-button" disabled={pending}>
          <KeyRound size={16} aria-hidden="true" />
          {pending ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : submitLabel}
        </button>
      </div>
      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="action-form-message action-form-success">
          {t({ tr: "Şifreniz güncellendi.", en: "Your password has been updated." })}
        </p>
      ) : null}
    </form>
  );
}
