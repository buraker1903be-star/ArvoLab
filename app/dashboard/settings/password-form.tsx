"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { useActionState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { Dugme } from "@/app/_components/ui/dugme";
import { SifreGirdisi } from "@/app/_components/ui/sifre-girdisi";

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
    "login" görünümü yalnızca /reset-password'te (Signature OS 5 / Phase 2:
    ortak bileşenlerle çiziliyor). Alan adları, kimlikler, minLength ve eylem
    AYNI; kural sunucuda (resetPassword). "panel" görünümü Ayarlar'da ve bu
    fazın dışında, dokunulmadı.
  */
  if (variant === "login") {
    return (
      <form className="os5-kimlik-formu" action={formAction}>
        {state?.error ? (
          <Bildirim ton="hata" rol="alert">
            {state.error}
          </Bildirim>
        ) : null}
        <SifreGirdisi id="password" name="password" etiket={t({ tr: "Yeni şifre", en: "New password" })} autoComplete="new-password" minLength={8} required />
        <SifreGirdisi id="passwordConfirm" name="passwordConfirm" etiket={t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })} autoComplete="new-password" minLength={8} required />
        <Dugme type="submit" tamGenislik yukleniyor={pending} disabled={pending}>
          {pending ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : submitLabel}
          {pending ? null : <ArrowRight size={18} aria-hidden="true" />}
        </Dugme>
      </form>
    );
  }

  return (
    <form className="project-form-grid" action={formAction}>
      <label>
        <span>{t({ tr: "Yeni şifre", en: "New password" })}</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        <span>{t({ tr: "Yeni şifre (tekrar)", en: "Confirm new password" })}</span>
        <input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
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
