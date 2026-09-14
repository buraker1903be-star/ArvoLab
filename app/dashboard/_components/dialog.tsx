"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const subscribeNothing = () => () => undefined;

// Dışarıdan açılıp kapatılan pencere (PanelDrawer'ın tetikleyicisiz hali).
// Aynı görünümü kullanır: masaüstünde ortada, telefonda alttan kayan sayfa.
export default function Dialog({
  open,
  onClose,
  title,
  kicker,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add("drawer-open");
    window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>("textarea, input, select");
      (firstField ?? dialogRef.current)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("drawer-open");
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!isClient) return null;

  return createPortal(
    <div className={open ? "drawer-root open" : "drawer-root"}>
      <button className="drawer-backdrop" type="button" aria-label="Pencereyi kapat" tabIndex={open ? 0 : -1} onClick={onClose} />
      <section
        ref={dialogRef}
        className="drawer drawer-compact"
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
          <button className="drawer-close" type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
