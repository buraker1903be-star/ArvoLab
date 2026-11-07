"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOdakTuzagi } from "./odak-tuzagi";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  dokunmatikteAlanaOdak = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  description?: string;
  children: ReactNode;
  /**
   * false: dokunmatik ekranda açılınca ilk alana değil pencerenin kendisine
   * odaklanır (sanal klavye açılmaz). Masaüstünde davranış aynı kalır.
   */
  dokunmatikteAlanaOdak?: boolean;
}) {
  const t = useCeviri();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // aria-modal tek başına odağı hapsetmez; Tab arka plana kaçıyordu.
  useOdakTuzagi(dialogRef, open);

  /*
    Geri çağırım ref'te (PanelDrawer'daki gibi). Pencereler satır içi bir
    kapatma fonksiyonu veriyor; etki ona bağlıyken HER ÇİZİMDE sökülüp
    yeniden kuruluyordu: odak editöre dönüp sonra ilk alana atlıyordu.
    "Kaynak ekle"de başlığa yazılan ilk harften sonra imleç DOI kutusuna
    kaçıyor, sonraki harfler oraya yazılıyordu.
  */
  const kapatRef = useRef(onClose);
  const alanaOdakRef = useRef(dokunmatikteAlanaOdak);
  useEffect(() => {
    kapatRef.current = onClose;
    alanaOdakRef.current = dokunmatikteAlanaOdak;
  });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      // İçteki seçici ya da takvim Escape'i kendisi işlediyse pencere kapanmaz.
      if (event.key === "Escape" && !event.defaultPrevented) kapatRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add("drawer-open");
    window.requestAnimationFrame(() => {
      /*
        UX M3 (07.11.2026): atıf penceresi telefonda açılır açılmaz isteğe
        bağlı Sayfa kutusuna odaklanıyor, sanal klavye pencerenin yarısını
        örtüyordu; kullanıcı önce kaynak seçmek istiyor. Böyle pencerelerde
        dokunmatik ekranda odak pencerenin kendisine verilir: Tab sırası ve
        ekran okuyucu yine pencerenin başından başlar.
      */
      const dokunmatik = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      const firstField = dokunmatik && !alanaOdakRef.current ? null : dialogRef.current?.querySelector<HTMLElement>("textarea, input, select");
      (firstField ?? dialogRef.current)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("drawer-open");
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!isClient) return null;

  return createPortal(
    <div className={open ? "drawer-root open" : "drawer-root"}>
      <button className="drawer-backdrop" type="button" aria-label={t({ tr: "Pencereyi kapat", en: "Close window" })} tabIndex={open ? 0 : -1} onClick={onClose} />
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
          <button className="drawer-close" type="button" aria-label={t({ tr: "Kapat", en: "Close" })} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
