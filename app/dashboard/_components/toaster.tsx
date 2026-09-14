"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { TOAST_EVENT, type ToastDetail } from "./toast-events";

type Toast = ToastDetail & { id: number };

// iOS benzeri cam bildirim: masaüstünde üstten, mobilde sekme çubuğunun
// hemen üstünden kayarak gelir. Başarı 3.8 sn, hata 8 sn görünür.
export default function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const { kind, text } = (event as CustomEvent<ToastDetail>).detail;
      setToast({ kind, text, id: Date.now() });
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setToast(null), kind === "success" ? 3800 : 8000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!toast) return null;
  const success = toast.kind === "success";

  return (
    <div
      key={toast.id}
      className={success ? "toast is-success" : "toast"}
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
    >
      <span className="toast-icon" aria-hidden="true">
        {success ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          "!"
        )}
      </span>
      <div className="toast-body">
        <strong>{success ? toast.text : "İşlem tamamlanamadı"}</strong>
        <span>{success ? "İşlem başarıyla tamamlandı." : toast.text}</span>
      </div>
      <button className="toast-close" type="button" onClick={() => setToast(null)} aria-label="Bildirimi kapat">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
