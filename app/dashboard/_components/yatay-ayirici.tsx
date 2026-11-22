"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

/*
  SAĞ SÜTUNU BOYUTLANDIRAN AYIRICI — ORTAK (22.11.2026).

  Mantık 16.11.2026'da editörün PDF paneli için yazılmıştı
  (sag-panel-ayirici.tsx); Kaynaklar araştırma alanı da liste ile kaynak
  paneli arasında AYNI davranışı istiyor. İki kopya yazılsaydı biri
  klavye desteğini alır, öteki almazdı — bu yüzden mantık buraya çıktı ve
  editörün bileşeni ince bir sarmalayıcı oldu (sınırları ve adı o veriyor).

  Denetimli bileşen: genişliği ÇAĞIRAN tutar, çünkü genişlik yerleşim
  kararına girer (editörde belgenin okunabilirlik sınırı, Kaynaklar'da
  listenin en az genişliği). Klavyeyle de ayarlanır (ok tuşları 24 px,
  Home/End sınırlar): sürükleme tek yol olsaydı fare kullanmayan öğrenci
  genişliği değiştiremezdi. Bırakınca tercih kaydedilir (onDegis(_, true)).

  Geometri her iki kullanımda da aynı: panel SAĞDA, ayırıcı sola
  sürüklenince panel genişler. Genişlik kabın sağ kenarından ölçülür.
*/
export default function YatayAyirici({
  genislik,
  enAz,
  enCok,
  onDegis,
  yerlesim,
  etiket,
  className = "pdf-panel-ayirici",
}: {
  /** Sağdaki panelin şu anki genişliği (px). */
  genislik: number;
  enAz: number;
  enCok: number;
  /** `kaydet` false ise sürükleme sürüyor; true ise bırakıldı (tercih yazılır). */
  onDegis: (genislik: number, kaydet: boolean) => void;
  /** Genişliğin ölçüleceği kap; sağ kenarı taban alınır. */
  yerlesim: () => HTMLElement | null;
  /** Ekran okuyucunun okuyacağı ad ("… arasındaki genişliği ayarla"). */
  etiket: string;
  className?: string;
}) {
  const ust = Math.max(enAz, enCok);
  const sinirla = (n: number) => Math.round(Math.min(ust, Math.max(enAz, n)));
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
      onDegis(e.key === "Home" ? ust : enAz, true);
    }
  };

  return (
    <div
      className={className}
      role="separator"
      aria-orientation="vertical"
      aria-label={etiket}
      aria-valuemin={enAz}
      aria-valuemax={ust}
      aria-valuenow={genislik}
      tabIndex={0}
      onPointerDown={basla}
      onKeyDown={tus}
    />
  );
}
