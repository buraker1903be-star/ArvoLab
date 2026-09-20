"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { TOAST_EVENT, type ToastDetail } from "./toast-events";

type Toast = ToastDetail & { id: number };

/*
  iOS benzeri cam bildirim: masaüstünde üstten, mobilde sekme çubuğunun
  hemen üstünden kayarak gelir. Başarı 3.8 sn, hata 8 sn görünür.

  Bildirimler YIĞINDA durur. Eskiden tek bir bildirim tutuluyordu ve yenisi
  öncekini eziyordu: literatür sayfasında art arda iki kaynağı "Okundu"
  yapan kullanıcı yalnızca ikinci onayı görüyor, birinci işlemin olup
  olmadığını bilemiyordu.

  Yığın en fazla ÜÇ bildirim gösterir; daha fazlası ekranı kaplar ve
  okunmadan kaybolur. Taşarsa en eskisi düşer, çünkü kullanıcının en son
  yaptığı iş en önemlisidir.
*/

const EN_FAZLA = 3;

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Her bildirimin kendi zamanlayıcısı var; biri diğerini iptal etmemeli.
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    const sayac = { deger: 0 };
    const kaldir = (id: number) => {
      setToasts((onceki) => onceki.filter((toast) => toast.id !== id));
      const timer = timers.current.get(id);
      if (timer) window.clearTimeout(timer);
      timers.current.delete(id);
    };

    const onToast = (event: Event) => {
      const { kind, text } = (event as CustomEvent<ToastDetail>).detail;
      // Date.now() aynı milisaniyede iki bildirimde çakışırdı; sayaç eklenir.
      const id = Date.now() * 1000 + (sayac.deger = (sayac.deger + 1) % 1000);
      setToasts((onceki) => [...onceki, { kind, text, id }].slice(-EN_FAZLA));
      timers.current.set(
        id,
        window.setTimeout(() => kaldir(id), kind === "success" ? 3800 : 8000),
      );
    };

    window.addEventListener(TOAST_EVENT, onToast);
    const acikZamanlayicilar = timers.current;
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const timer of acikZamanlayicilar.values()) window.clearTimeout(timer);
      acikZamanlayicilar.clear();
    };
  }, []);

  if (!toasts.length) return null;

  const kapat = (id: number) => {
    setToasts((onceki) => onceki.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  };

  return (
    <div className="toast-yigini">
      {toasts.map((toast) => {
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
            <button className="toast-close" type="button" onClick={() => kapat(toast.id)} aria-label="Bildirimi kapat">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
