"use client";

import { useEffect, useRef, type RefObject } from "react";
import { enUstPencere } from "./odak-tuzagi";

/*
  AÇIK PENCERENİN KATMANI, ESCAPE'İ VE SAYFA KAYDIRMA KİLİDİ (24.11.2026).

  Üçü birbirine bağlı olduğu için tek yerde: katman yazılmadan "en
  üstteki pencere" bilinemez, en üstteki bilinmeden Escape doğru pencereyi
  kapatamaz, açık pencere sayılmadan kaydırma kilidi doğru zamanda
  kalkamaz.

  Bu kod PanelDrawer'da vardı, Dialog'da YOKTU. Dialog da aynı
  `.drawer-root` kökünü ve aynı `drawer-open` kilidini kullandığı hâlde
  Escape'i koşulsuz işliyor ve kilidi koşulsuz kaldırıyordu: iki pencere
  aynı anda açıldığında tek Escape ikisini birden kapatır, üstteki
  kapanınca alttaki pencerenin arkasındaki sayfa kaymaya başlardı. İki
  bileşen aynı davranışı iki kez yazdığı sürece biri geride kalıyor.
*/
export function usePencereKatmani(
  kokRef: RefObject<HTMLElement | null>,
  acik: boolean,
  kapat: () => void,
): void {
  /* Geri çağırım ref'te: satır içi bir kapatma fonksiyonu her çizimde
     değişir ve etkiyi yeniden kurdururdu (katman baştan sayılırdı). */
  const kapatRef = useRef(kapat);
  useEffect(() => {
    kapatRef.current = kapat;
  });

  useEffect(() => {
    if (!acik) return;
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
    const onKeyDown = (event: KeyboardEvent) => {
      /* İçteki seçici ya da takvim Escape'i işlediyse (preventDefault)
         pencere açık kalır. Eskiden takvimi kapatan Esc yarım doldurulmuş
         "Yeni çalışma" penceresini de kapatıyor, yazılanlar gidiyordu. */
      if (event.key !== "Escape" || event.defaultPrevented) return;
      /* İÇ İÇE PENCERE: Escape yalnızca en üsttekini kapatır. */
      if (enUstPencere() !== kokRef.current) return;
      kapatRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add("drawer-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      /* Altta açık bir pencere kaldıysa sayfa kilidi sürmeli. */
      if (!document.querySelector(".drawer-root.open")) {
        document.documentElement.classList.remove("drawer-open");
      }
    };
  }, [kokRef, acik]);
}
