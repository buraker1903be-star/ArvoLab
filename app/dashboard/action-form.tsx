"use client";

import { useActionState, type CSSProperties, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth-guards";
import { announceActionSuccess, showToast } from "./_components/toast-events";

interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionResult | undefined>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Doluysa gönderimden önce onay penceresi gösterilir (silme vb. geri alınamaz işlemler için). */
  confirmMessage?: string;
  /** Başarıda gösterilecek bildirim metni */
  successMessage?: string;
}

// Server action sonucunu kullanıcıya yansıtır:
// - hata: formun içinde, kontrolün yanında (pencerede formun en üstünde)
// - başarı: iOS benzeri bildirim + açık PanelDrawer penceresini kapatır
// React, başarılı gönderimden sonra formu kendiliğinden sıfırlar.
export default function ActionForm({ action, children, className, style, confirmMessage, successMessage }: ActionFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = (await action(formData)) ?? null;
    if (result?.success) {
      showToast("success", successMessage ?? "İşlem tamamlandı.");
      announceActionSuccess();
    }
    return result;
  }, null);

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
    </form>
  );
}
