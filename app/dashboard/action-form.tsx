"use client";

import { useActionState, type CSSProperties, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth-guards";

interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionResult | undefined>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Doluysa gönderimden önce onay penceresi gösterilir (silme vb. geri alınamaz işlemler için). */
  confirmMessage?: string;
  successMessage?: string;
}

// Server action'ın döndürdüğü { error } sonucunu formun hemen altında gösterir.
// Önceden sayfalardaki satır içi "use server" sarmalayıcıları bu sonucu
// atıyordu; yetkisiz ya da başarısız işlemler kullanıcıya hiç yansımıyordu.
export default function ActionForm({ action, children, className, style, confirmMessage, successMessage }: ActionFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, formData) => (await action(formData)) ?? null,
    null
  );

  return (
    <form
      action={formAction}
      className={className}
      style={style}
      aria-busy={pending}
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) event.preventDefault();
            }
          : undefined
      }
    >
      <fieldset disabled={pending} className="action-form-fieldset">
        {children}
      </fieldset>
      {state?.error ? (
        <p role="alert" className="action-form-message action-form-error">
          {state.error}
        </p>
      ) : null}
      {successMessage && state?.success ? (
        <p role="status" className="action-form-message action-form-success">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}
