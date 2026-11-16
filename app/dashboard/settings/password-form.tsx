"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useActionState, type FormEvent } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { Dugme } from "@/app/_components/ui/dugme";
import { SifreGirdisi } from "@/app/_components/ui/sifre-girdisi";
import { EN_KISA_SIFRE, SIFRE_ESLESMEDI, sifreKuraliHatasi } from "@/lib/kimlik-kurallari";

interface PasswordFormProps {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /** "login": ilk şifre / kurtarma sayfası, "panel": Ayarlar (mevcut şifre ister). */
  variant: "login" | "panel";
  submitLabel: string;
}

export default function PasswordForm({ action, variant, submitLabel }: PasswordFormProps) {
  const t = useCeviri();
  const [state, formAction, pending] = useActionState(action, null);

  /*
    Tarayıcı minLength'i kendisi denetler; 64 karakter, 72 bayt, tekrar ve
    yaygın şifre kurallarını bilmez. Aynı kural fonksiyonu
    (lib/kimlik-kurallari.ts) burada da çalışır ki kullanıcı göndermeden
    NEDENİ görsün. Bu yalnızca kolaylık: sunucu (applyNewPassword) aynı
    denetimi kendisi yapar.

    maxLength BİLEREK YOK (G1-D, 11.11.2026): tarayıcı fazlasını hiç
    uyarmadan kırpıyordu; 73 karakter giren kullanıcının şifresi ilk 64
    karakteriyle kaydedilmişti.

    "Tekrar" kutusu kural mesajı yerine eşleşme mesajı taşır; iki kutudan
    biri değişince eşleşme yeniden hesaplanır.
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
  const kuralAciklamasi = t({
    tr: `En az ${EN_KISA_SIFRE} karakter. Yaygın şifreler kabul edilmez.`,
    en: `At least ${EN_KISA_SIFRE} characters. Common passwords are not accepted.`,
  });

  if (variant === "login") {
    return (
      <form className="os5-kimlik-formu" action={formAction}>
        {state?.error ? (
          <Bildirim ton="hata" rol="alert">
            {state.error}
          </Bildirim>
        ) : null}
        <SifreGirdisi id="password" name="password" etiket={t({ tr: "Yeni şifre", en: "New password" })} autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={sifreDenetle} aciklama={kuralAciklamasi} required />
        <SifreGirdisi id="passwordConfirm" name="passwordConfirm" etiket={t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })} autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={tekrarDenetle} required />
        <Dugme type="submit" tamGenislik yukleniyor={pending} disabled={pending}>
          {pending ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : submitLabel}
          {pending ? null : <ArrowRight size={18} aria-hidden="true" />}
        </Dugme>
      </form>
    );
  }

  /*
    Ayarlar: mevcut şifre ZORUNLU (16.11.2026). Eskiden açık bir oturum
    tek başına şifreyi değiştirmeye yetiyordu; oturumu ele geçiren biri
    (açık bırakılmış bilgisayar, çalınan çerez) şifreyi değiştirip asıl
    sahibini dışarıda bırakabiliyordu. Sunucu (changePassword) mevcut
    şifreyi Supabase'e karşı doğrular; buradaki alan yalnızca onu taşır.
  */
  return (
    <form className="project-form-grid" action={formAction}>
      <SifreGirdisi id="currentPassword" name="currentPassword" etiket={t({ tr: "Mevcut şifre", en: "Current password" })} autoComplete="current-password" required />
      <SifreGirdisi id="newPassword" name="password" etiket={t({ tr: "Yeni şifre", en: "New password" })} autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={sifreDenetle} aciklama={kuralAciklamasi} required />
      <SifreGirdisi id="newPasswordConfirm" name="passwordConfirm" etiket={t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })} autoComplete="new-password" minLength={EN_KISA_SIFRE} onInput={tekrarDenetle} required />
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
      {state?.success && state.warning ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.warning}
        </p>
      ) : state?.success ? (
        <p role="status" className="action-form-message action-form-success">
          {t({ tr: "Şifreniz güncellendi. Diğer cihazlardaki oturumlar kapatıldı.", en: "Your password has been updated. Sessions on other devices have been signed out." })}
        </p>
      ) : null}
    </form>
  );
}
