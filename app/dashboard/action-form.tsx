"use client";

import { useActionState, useRef, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
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
// - hata: formun içinde, kontrolün yanında (pencerede formun en üstünde);
//   yazılanlar KORUNUR (React'in <form action> otomatik sıfırlaması hata
//   dönen gönderimlerde de formu boşaltıyordu, bu yüzden gönderimi biz başlatıyoruz)
// - başarı: iOS benzeri bildirim + form sıfırlanır + açık PanelDrawer penceresi kapanır
export default function ActionForm({ action, children, className, style, confirmMessage, successMessage }: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_previous, formData) => {
    const result = (await action(formData)) ?? null;
    if (result?.success) {
      showToast("success", successMessage ?? "İşlem tamamlandı.");
      formRef.current?.reset();
      announceActionSuccess();
    }
    return result;
  }, null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };

  return (
    // method="post": sayfa henüz etkileşimli değilken gönderilse bile alanlar (notlar vb.) adres çubuğuna yazılmaz.
    <form ref={formRef} method="post" onSubmit={handleSubmit} className={className} style={style} aria-busy={pending}>
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
