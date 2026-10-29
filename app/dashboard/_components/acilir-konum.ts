"use client";

import { useLayoutEffect, type RefObject } from "react";
import { acilirKonum } from "@/lib/acilir-konum";

/*
  Açılır pencereyi tarayıcının ÜST KATMANINDA açar ve düğmeye göre
  konumlar (29.10.2026). Neden: lib/acilir-konum.ts. Pencere öğesinde
  `popover="manual"` olmalı; konum CSS değişkenleriyle (--acilir-x,
  --acilir-y, --acilir-w) taşınıyor — TSX'te satır içi stil yazılmıyor.

  Popover desteklemeyen eski tarayıcıda pencere yine `position: fixed`
  ile doğru yerde açılır, yalnızca dönüşümlü bir atanın içinde kalırsa
  kırpılabilir.
*/
export function useAcilirKonum(acik: boolean, dugme: RefObject<HTMLElement | null>, pencere: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = pencere.current;
    if (!el) return;
    const destek = typeof el.showPopover === "function";
    if (!acik) {
      if (destek && el.matches(":popover-open")) el.hidePopover();
      return;
    }
    if (destek && !el.matches(":popover-open")) el.showPopover();
    const yerlestir = () => {
      const kutu = dugme.current?.getBoundingClientRect();
      if (!kutu) return;
      const k = acilirKonum(kutu, { genislik: el.offsetWidth, yukseklik: el.offsetHeight }, { genislik: window.innerWidth, yukseklik: window.innerHeight });
      el.style.setProperty("--acilir-x", `${k.x}px`);
      el.style.setProperty("--acilir-y", `${k.y}px`);
      el.style.setProperty("--acilir-w", `${Math.round(kutu.width)}px`);
      el.toggleAttribute("data-yukari", k.yukari);
    };
    /* İlk ölçü genişlik değişkeni yazılmadan alınıyor; ikinci tur gerçek boyla. */
    yerlestir();
    yerlestir();
    /* Sayfa ya da kayan kart kaydırılınca pencere düğmeyle birlikte gider. */
    window.addEventListener("resize", yerlestir);
    window.addEventListener("scroll", yerlestir, true);
    return () => {
      window.removeEventListener("resize", yerlestir);
      window.removeEventListener("scroll", yerlestir, true);
    };
  }, [acik, dugme, pencere]);
}
