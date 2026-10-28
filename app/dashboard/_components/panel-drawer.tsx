"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { enUstPencere, useOdakTuzagi } from "./odak-tuzagi";
import { ACTION_SUCCESS_EVENT } from "./toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  /**
   * Pencere genişliği: form için "orta", tablo ve zincir için "genis",
   * yan yana iki kartlı çalışma pencereleri (arama + sonuçlar) için "tam".
   */
  boy?: "orta" | "genis" | "tam";
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
  /*
    Sayfa açılırken pencere de açık gelsin mi? Bir akışın sıradaki adımı
    bu pencereyse (yeni tezde kılavuz yükleme) öğrenciyi düğme aratmadan
    oraya bırakmak için. Kapatılabilir; zorlamaz.
  */
  acikBasla?: boolean;
  /*
    DIŞARIDAN YÖNETİLEN PENCERE: açılması bir işe bağlıysa ("Kaynakçayı
    yorumlat" önce asistanı çağırıp sonra pencereyi açıyor) ya da birden
    çok düğme aynı pencereyi açıyorsa (geçmiş sorgular). `acik` verilirse
    durum dışarıda; `tetiksiz` ile kendi düğmesi çizilmez.
  */
  acik?: boolean;
  onAcikDegis?: (acik: boolean) => void;
  tetiksiz?: boolean;
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
  acikBasla = false,
  acik,
  onAcikDegis,
  tetiksiz = false,
  children,
}: PanelDrawerProps) {
  const t = useCeviri();
  const [icAcik, setIcAcik] = useState(acikBasla);
  const open = acik ?? icAcik;
  /* Geri çağırım ref'te: satır içi bir fonksiyon her çizimde değişir ve
     açık pencerenin etkisini (odak, dinleyiciler) yeniden kurdururdu —
     odak her çizimde pencereye geri çekilirdi. */
  const degisRef = useRef(onAcikDegis);
  useEffect(() => {
    degisRef.current = onAcikDegis;
  });
  const setOpen = useCallback((deger: boolean) => {
    degisRef.current?.(deger);
    setIcAcik(deger);
  }, []);
  const titleId = useId();
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const dialogRef = useRef<HTMLElement>(null);
  const kokRef = useRef<HTMLDivElement>(null);
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
    /*
      İÇ İÇE PENCERE (Literatür → Manuel kaynak ekle): Escape yalnızca en
      üstteki pencereyi kapatır. Eskiden her açık pencere kendi dinleyicisiyle
      kapanıyordu ve tek tuş ikisini birden kapatıyordu.
    */
    /*
      KATMAN: açılan pencere, o an açık olanların ÜSTÜNE çizilir. Belge
      sırasına güvenilemiyor: iç pencerenin kökü (portal) dıştakinden
      önce ekleniyor ve iç pencere arkada kalıyordu. Sıra açılış anında
      sayılıp köke yazılıyor; en üstteki = en büyük katman.
    */
    const kok = kokRef.current;
    if (kok) {
      const katman = String(document.querySelectorAll(".drawer-root.open").length);
      kok.dataset.katman = katman;
      kok.style.setProperty("--katman", katman);
    }
    const enUsttekiMi = () => enUstPencere() === kokRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && enUsttekiMi()) setOpen(false);
    };
    const onSuccess = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    if (basaridaKapan) window.addEventListener(ACTION_SUCCESS_EVENT, onSuccess);
    document.documentElement.classList.add("drawer-open");
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ACTION_SUCCESS_EVENT, onSuccess);
      // Altta açık bir pencere kaldıysa sayfa kilidi sürmeli.
      if (!document.querySelector(".drawer-root.open")) document.documentElement.classList.remove("drawer-open");
    };
  }, [open, basaridaKapan, setOpen]);

  const drawer = (
    <div ref={kokRef} className={open ? "drawer-root open" : "drawer-root"} data-boy={boy}>
      <button
        className="drawer-backdrop"
        type="button"
        aria-label={t({ tr: "Pencereyi kapat", en: "Close window" })}
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
          <button className="drawer-close" type="button" aria-label={t({ tr: "Kapat", en: "Close" })} onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>
  );

  return (
    <>
      {tetiksiz ? null : (
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
      )}
      {isClient ? createPortal(drawer, document.body) : null}
    </>
  );
}
