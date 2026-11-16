"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { PANEL_VARSAYILAN, panelGenisligiSinirla } from "@/lib/pdf-goruntu";

/*
  EDİTÖR | PDF AYIRICISI (16.11.2026, Yazım Stüdyosu). Masaüstünde editör
  ile PDF paneli arasındaki sürüklenebilir çizgi. Genişlik yerleşimin
  (.manuscript-layout) --pdf-panel-genislik değişkenine DOM API'siyle
  yazılır (TSX'te satır içi stil yok) ve bu tarayıcıda hatırlanır.
  Klavyeyle de ayarlanır (ok tuşları 24 px, Home/End sınırlar): sürükleme
  tek yol olsaydı fare kullanmayan öğrenci genişliği değiştiremezdi.
  Sınırlar lib/pdf-goruntu.ts: editör okunamayacak kadar daralmaz.
*/

const ANAHTAR = "arvolab.pdfPanelGenisligi";

function okunan(): number {
  try {
    const deger = Number(window.localStorage.getItem(ANAHTAR));
    return deger > 0 ? deger : PANEL_VARSAYILAN;
  } catch {
    return PANEL_VARSAYILAN;
  }
}

/*
  Editör ile panelin PAYLAŞTIĞI genişlik: yerleşimin iç eni eksi ayırıcının
  kendisi ve iki sütun aralığı. İlk sürüm yerleşimin tüm enini veriyordu ve
  Home tuşuyla panel en genişe çekilince editör sütunu 420 yerine 392 px'e
  iniyordu (tarayıcı kabulünde M5 ölçtü): 26 px ayırıcı + aralık hesaba
  girmiyordu.
*/
function paylasilanGenislik(kap: HTMLElement, ayirici: HTMLElement | null): number {
  const stil = getComputedStyle(kap);
  const ic = kap.clientWidth - (parseFloat(stil.paddingLeft) || 0) - (parseFloat(stil.paddingRight) || 0);
  const aralik = parseFloat(stil.columnGap) || 0;
  return ic - (ayirici?.offsetWidth ?? 0) - 2 * aralik;
}

export default function PdfPanelAyirici({ yerlesim }: { yerlesim: () => HTMLElement | null }) {
  const t = useCeviri();
  const genislikRef = useRef(PANEL_VARSAYILAN);
  const ayiriciRef = useRef<HTMLDivElement>(null);

  const uygula = useCallback(
    (istenen: number, kaydet: boolean) => {
      const kap = yerlesim();
      if (!kap) return;
      const deger = panelGenisligiSinirla(istenen, paylasilanGenislik(kap, ayiriciRef.current));
      genislikRef.current = deger;
      kap.style.setProperty("--pdf-panel-genislik", `${deger}px`);
      ayiriciRef.current?.setAttribute("aria-valuenow", String(deger));
      if (kaydet) {
        try {
          window.localStorage.setItem(ANAHTAR, String(deger));
        } catch {
          /* Gizli sekme: tercih hatırlanmaz, ayırıcı yine çalışır. */
        }
      }
    },
    [yerlesim],
  );

  useEffect(() => {
    uygula(okunan(), false);
    const yeniden = () => uygula(genislikRef.current, false);
    window.addEventListener("resize", yeniden);
    return () => {
      window.removeEventListener("resize", yeniden);
      yerlesim()?.style.removeProperty("--pdf-panel-genislik");
    };
  }, [uygula, yerlesim]);

  const basla = (e: PointerEvent<HTMLDivElement>) => {
    const kap = yerlesim();
    if (!kap) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const sag = kap.getBoundingClientRect().right;
    const tasi = (h: globalThis.PointerEvent) => uygula(sag - h.clientX, false);
    const birak = () => {
      window.removeEventListener("pointermove", tasi);
      window.removeEventListener("pointerup", birak);
      uygula(genislikRef.current, true);
    };
    window.addEventListener("pointermove", tasi);
    window.addEventListener("pointerup", birak);
  };

  const tus = (e: KeyboardEvent<HTMLDivElement>) => {
    const adimlar: Record<string, number> = { ArrowLeft: 24, ArrowRight: -24 };
    if (e.key in adimlar) {
      e.preventDefault();
      uygula(genislikRef.current + adimlar[e.key], true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      uygula(e.key === "Home" ? 1e6 : 0, true);
    }
  };

  return (
    <div
      ref={ayiriciRef}
      className="pdf-panel-ayirici"
      role="separator"
      aria-orientation="vertical"
      aria-label={t({ tr: "Editör ile PDF arasındaki genişliği ayarla", en: "Resize between editor and PDF" })}
      aria-valuemin={0}
      tabIndex={0}
      onPointerDown={basla}
      onKeyDown={tus}
    />
  );
}
