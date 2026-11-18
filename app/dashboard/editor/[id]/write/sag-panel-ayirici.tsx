"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { SAG_PANEL_SINIRI } from "@/lib/calisma-alani-yerlesimi";
import type { SagPanel } from "@/lib/os/uygulamalar";

/*
  BELGE | SAĞ PANEL AYIRICISI. 16.11.2026'da yalnızca PDF için yazıldı
  (pdf-panel-ayirici.tsx): asistan paneli sabit 400 px'lik yüzen bir
  kutuydu ve boyutlanamıyordu. 19.11.2026'dan (bağlamlı çalışma alanı)
  beri Arvo AI ve PDF AYNI yuvayı ve bu ayırıcıyı paylaşır; sınırlar panel
  türüne göre (AI 360–420, PDF 440–600; lib/calisma-alani-yerlesimi.ts).

  Denetimli bileşen: genişliği editör tutar, çünkü genişlik yerleşim
  kararına girer (belge okunabilirlik sınırının altına itilmez; en geniş
  değer `enCok`). Klavyeyle de ayarlanır (ok tuşları 24 px, Home/End
  sınırlar): sürükleme tek yol olsaydı fare kullanmayan öğrenci genişliği
  değiştiremezdi. Bırakınca tercih kaydedilir (onDegis(_, true)).
*/
export default function SagPanelAyirici({
  panel,
  genislik,
  enCok,
  onDegis,
  yerlesim,
}: {
  panel: SagPanel;
  genislik: number;
  enCok: number;
  onDegis: (genislik: number, kaydet: boolean) => void;
  yerlesim: () => HTMLElement | null;
}) {
  const t = useCeviri();
  const sinir = SAG_PANEL_SINIRI[panel];
  const ust = Math.max(sinir.enAz, Math.min(sinir.enCok, enCok));
  const sinirla = (n: number) => Math.round(Math.min(ust, Math.max(sinir.enAz, n)));
  /* Sürüklemenin son değeri: bırakınca kaydedilir (render sırasında değil, olayda yazılır). */
  const sonRef = useRef(genislik);

  const basla = (e: PointerEvent<HTMLDivElement>) => {
    const kap = yerlesim();
    if (!kap) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    sonRef.current = genislik;
    const sag = kap.getBoundingClientRect().right;
    const tasi = (h: globalThis.PointerEvent) => {
      sonRef.current = sinirla(sag - h.clientX);
      onDegis(sonRef.current, false);
    };
    const birak = () => {
      window.removeEventListener("pointermove", tasi);
      window.removeEventListener("pointerup", birak);
      onDegis(sonRef.current, true);
    };
    window.addEventListener("pointermove", tasi);
    window.addEventListener("pointerup", birak);
  };

  const tus = (e: KeyboardEvent<HTMLDivElement>) => {
    // Sol ok paneli genişletir (ayırıcı sola gider), sağ ok daraltır.
    const adimlar: Record<string, number> = { ArrowLeft: 24, ArrowRight: -24 };
    if (e.key in adimlar) {
      e.preventDefault();
      onDegis(sinirla(genislik + adimlar[e.key]), true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onDegis(e.key === "Home" ? ust : sinir.enAz, true);
    }
  };

  return (
    <div
      className="pdf-panel-ayirici"
      role="separator"
      aria-orientation="vertical"
      aria-label={
        panel === "pdf"
          ? t({ tr: "Belge ile PDF arasındaki genişliği ayarla", en: "Resize between document and PDF" })
          : t({ tr: "Belge ile Arvo AI arasındaki genişliği ayarla", en: "Resize between document and Arvo AI" })
      }
      aria-valuemin={sinir.enAz}
      aria-valuemax={ust}
      aria-valuenow={genislik}
      tabIndex={0}
      onPointerDown={basla}
      onKeyDown={tus}
    />
  );
}
