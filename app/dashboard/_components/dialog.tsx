"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOdakTuzagi } from "./odak-tuzagi";
import { odagiIadeEt } from "./odak-iadesi";
import { usePencereKatmani } from "./pencere-katmani";
import { PencereKapatBaglami } from "./pencere-kapat";
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
  gorunum,
  boy = "dar",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  description?: string;
  /*
    Signature OS 5 görünümü (isteğe bağlı). Verilmezse pencere eskisi gibi
    çizilir: ekranlar Phase 3–5'te tek tek geçirilecek. Davranış (odak
    tuzağı, Esc, odak iadesi) iki görünümde de aynı koddan gelir.
  */
  gorunum?: "os5";
  /*
    PENCERE GENİŞLİĞİ (24.11.2026). Dialog'un TEK boyu vardı: 520 px.
    Kısayol listesi 1440 px'lik ekranda 520 px'e sıkışıp 792 px'e uzuyor
    ve kendi içinde kayıyordu, iki yanında 460'ar piksel boş alan
    dururken; tuş açıklamaları iki satıra kırılıyordu (tasarım
    incelemesi, bulgu 2). Değerler PanelDrawer ile aynı ve kuralları da
    artık aynı yerde (app/styles/overlays.css). Varsayılan "dar" eski
    520 px'i koruyor: kısa formlar daralmaya devam etsin.
  */
  boy?: "dar" | "onay" | "orta" | "genis" | "tam";
  children: ReactNode;
}) {
  const t = useCeviri();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const kokRef = useRef<HTMLDivElement>(null);
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
  /* Katman, Escape ve sayfa kilidi PanelDrawer ile AYNI koddan
     (pencere-katmani.ts): Dialog eskiden Escape'i koşulsuz işliyor ve
     kilidi koşulsuz kaldırıyordu, yani iki pencere açıkken tek tuş
     ikisini birden kapatıyordu. */
  usePencereKatmani(kokRef, open, onClose);

  useEffect(() => {
    if (!open) return;
    const oncekiOdak = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>("textarea, input, select");
      (firstField ?? dialogRef.current)?.focus();
    });
    return () => {
      /* Odak iadesi odak-iadesi.ts'te: açılış anındaki öğe menü kapandığı
         için gizlendiyse odak menünün görünür düğmesine döner, eskiden
         sayfanın gövdesine düşüyordu. */
      odagiIadeEt(oncekiOdak);
    };
  }, [open]);

  if (!isClient) return null;

  return createPortal(
    <div ref={kokRef} className={open ? "drawer-root open" : "drawer-root"} data-boy={boy}>
      <button className="drawer-backdrop" type="button" aria-label={t({ tr: "Pencereyi kapat", en: "Close window" })} tabIndex={open ? 0 : -1} onClick={onClose} />
      <section
        ref={dialogRef}
        className={gorunum === "os5" ? "drawer os5-pencere" : "drawer"}
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
        <div className="drawer-body">
          <PencereKapatBaglami.Provider value={onClose}>{children}</PencereKapatBaglami.Provider>
        </div>
      </section>
    </div>,
    document.body
  );
}
