"use client";

import { useEffect, type RefObject } from "react";

/*
  Açık pencerede odağı içeride tutar.

  Pencerelere `aria-modal="true"` verilmişti ama bu yalnızca bir BİLDİRİMDİR:
  tarayıcı odağı kendiliğinden hapsetmez. Tab tuşuyla ilerleyen kullanıcı
  pencereden çıkıp arkadaki sayfaya geçiyor, oradan yazmaya çalışıyor ve
  neden bir şey olmadığını anlamıyordu. Fare kullanıcısı bunu hiç görmüyor,
  yalnızca klavyeyle çalışanlar yaşıyordu.

  Kapatma davranışı korunur: Escape ve arka plana tıklama pencereyi kapatan
  bileşenin kendi işidir, burada yalnızca odak yönetilir.
*/

const ODAKLANABILIR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useOdakTuzagi(kapsayici: RefObject<HTMLElement | null>, acik: boolean) {
  useEffect(() => {
    if (!acik) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const kok = kapsayici.current;
      if (!kok) return;

      const adaylar = [...kok.querySelectorAll<HTMLElement>(ODAKLANABILIR)].filter(
        // Gizli öğeler sırada görünmemeli; offsetParent yoksa çizilmiyordur.
        (oge) => oge.offsetParent !== null || oge === document.activeElement,
      );
      if (!adaylar.length) {
        // İçeride odaklanacak bir şey yoksa pencerenin kendisinde kalınır.
        event.preventDefault();
        kok.focus();
        return;
      }

      const ilk = adaylar[0];
      const son = adaylar[adaylar.length - 1];
      const odaktaki = document.activeElement;

      /*
        Odak pencerenin dışındaysa (arka plandan Tab'la gelinmişse) uca
        değil, yöne uygun kenara alınır.
      */
      if (!kok.contains(odaktaki)) {
        event.preventDefault();
        (event.shiftKey ? son : ilk).focus();
        return;
      }
      if (event.shiftKey && odaktaki === ilk) {
        event.preventDefault();
        son.focus();
      } else if (!event.shiftKey && odaktaki === son) {
        event.preventDefault();
        ilk.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [kapsayici, acik]);
}
