"use client";

import { useEffect } from "react";

/*
  AÇILIR MENÜLER DIŞARI TIKLAYINCA KAPANIR (26.10.2026, kurum sahibinin
  geri bildirimi: "boşa tıklayınca kapanmıyor").

  Kullanıcı menüsü ve kartların ⋯ menüsü JavaScript'siz açılan <details>:
  sunucuda çiziliyor, ama <details> yalnızca kendi başlığına tıklanınca
  kapanıyor. Menü açık kalıp sayfanın üstünü örtüyordu; Escape de
  kapatmıyordu. Panelde bir kez çizilen bu bileşen dışarıya tıklamayı,
  menüdeki bir bağlantıya tıklamayı ve Escape'i dinleyip açık menüyü
  kapatıyor. Menülerin kendisi sunucu bileşeni olarak kalıyor.
*/
const SECICI = "details.os-kullanici[open], details.kart-menu[open]";

export default function AcilirKapatici() {
  useEffect(() => {
    const kapat = (haric?: Element | null) => {
      document.querySelectorAll<HTMLDetailsElement>(SECICI).forEach((menu) => {
        if (menu !== haric) menu.open = false;
      });
    };
    const onPointerDown = (olay: PointerEvent) => {
      const hedef = olay.target as Element | null;
      kapat(hedef?.closest("details.os-kullanici, details.kart-menu"));
    };
    // Menüdeki bağlantıyla sayfa değişince panel yeniden çizilmiyor; menü açık kalıyordu.
    const onClick = (olay: MouseEvent) => {
      const hedef = olay.target as Element | null;
      if (hedef?.closest("a") && hedef.closest("details.os-kullanici, details.kart-menu")) kapat();
    };
    const onKeyDown = (olay: KeyboardEvent) => {
      if (olay.key === "Escape") kapat();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return null;
}
