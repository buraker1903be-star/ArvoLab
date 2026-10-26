"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOdakTuzagi } from "./odak-tuzagi";
import { ACTION_SUCCESS_EVENT } from "./toast-events";

const subscribeNothing = () => () => undefined;

type PanelDrawerProps = {
  triggerLabel: string;
  /** Tetikleyici düğmedeki simge (ör. <Plus size={16} />) */
  triggerIcon?: ReactNode;
  /** Tetikleyici düğmenin sınıfı */
  triggerClassName?: string;
  title: string;
  description?: string;
  /** Başlığın üstündeki küçük etiket */
  kicker?: string;
  /** Düğmenin ikinci satırı (karo görünümü: "3 madde eksik"). */
  triggerNote?: string;
  /** Pencere genişliği: form için "orta", tablo ve zincir için "genis". */
  boy?: "orta" | "genis";
  /**
   * Bir işlem başarıyla bitince pencere kapansın mı?
   *
   * Varsayılan EVET: tek seferlik formlarda (yeni kaynak, iddia ekle)
   * kaydedip kapanmak bekleniyor. İçinde birden çok işlem yapılan
   * pencerelerde (kanıt kaydı: metin ekle, değerlendir, not yaz) HAYIR —
   * her kayıttan sonra kapanan pencere kullanıcıyı aynı kaydı yeniden
   * açmaya zorluyordu. ArvoOS'taki PanelModal'ın basaridaKapan'ı.
   */
  basaridaKapan?: boolean;
  children: ReactNode;
};

// Masaüstünde ortada açılan pencere, telefonda (≤760px) iOS gibi alttan
// kayan sayfa. Görünüm: app/styles/overlays.css.
// Pencere belgenin köküne (body) portal ile çizilir: sayfa içindeki
// animasyonlu/transform'lu bir üst öğe position:fixed'i kendine hapsetmesin.
// İçindeki ActionForm başarıyla bitince ("arvolab:action-success") kapanır.
export default function PanelDrawer({
  triggerLabel,
  triggerIcon,
  triggerClassName = "projects-primary-button",
  title,
  description,
  kicker,
  triggerNote,
  boy = "orta",
  basaridaKapan = true,
  children,
}: PanelDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // aria-modal tek başına odağı hapsetmez; Tab arka plana kaçıyordu.
  useOdakTuzagi(dialogRef, open);

  useEffect(() => {
    if (!open) {
      // Kapanınca odak, pencereyi açan düğmeye geri döner
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onSuccess = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    if (basaridaKapan) window.addEventListener(ACTION_SUCCESS_EVENT, onSuccess);
    document.documentElement.classList.add("drawer-open");
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ACTION_SUCCESS_EVENT, onSuccess);
      document.documentElement.classList.remove("drawer-open");
    };
  }, [open, basaridaKapan]);

  const drawer = (
    <div className={open ? "drawer-root open" : "drawer-root"} data-boy={boy}>
      <button
        className="drawer-backdrop"
        type="button"
        aria-label="Pencereyi kapat"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <section
        ref={dialogRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        inert={!open}
      >
        <header className="drawer-header">
          <div>
            {kicker ? <span className="dashboard-kicker">{kicker}</span> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="drawer-close" type="button" aria-label="Kapat" onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {triggerIcon}
        {triggerNote ? (
          <span className="drawer-tetik-metin">
            <b>{triggerLabel}</b>
            {triggerNote}
          </span>
        ) : (
          triggerLabel
        )}
      </button>
      {isClient ? createPortal(drawer, document.body) : null}
    </>
  );
}
