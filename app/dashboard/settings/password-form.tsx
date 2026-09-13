"use client";

import { useActionState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";

interface PasswordFormProps {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /** "login": giriş sayfası görünümü, "panel": dashboard kart formu. */
  variant: "login" | "panel";
  submitLabel: string;
}

export default function PasswordForm({ action, variant, submitLabel }: PasswordFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  if (variant === "login") {
    return (
      <form className="login-form" action={formAction}>
        {state?.error ? <p className="login-error" role="alert">{state.error}</p> : null}
        <label htmlFor="password">Yeni şifre</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <label htmlFor="passwordConfirm">Yeni şifre (tekrar)</label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
        <button className="login-button" type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    );
  }

  return (
    <form className="project-form-grid" action={formAction}>
      <label>
        <span>Yeni şifre</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        <span>Yeni şifre (tekrar)</span>
        <input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
        <button type="submit" className="projects-primary-button" disabled={pending}>
          <KeyRound size={16} />
          {pending ? "Kaydediliyor…" : submitLabel}
        </button>
      </div>
      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="action-form-message action-form-success">
          Şifreniz güncellendi.
        </p>
      ) : null}
    </form>
  );
}
