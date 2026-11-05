"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { sekmeKaydirmasi } from "@/lib/os/sekme-kaydirma";

/*
  Çalışma sekmelerinin şeridi (calisma-sekmeleri.tsx). Tek işi: sayfa
  açılınca etkin sekmeyi şeritte görünür kılmak (lib/os/sekme-kaydirma.ts).
  scrollIntoView kullanılmadı: o, sayfanın kendisini de dikeyde
  kaydırabiliyor; burada yalnızca şeridin yatay kaydırması değişiyor.
  Bağlantılar sunucuda çiziliyor; bu bileşen yalnızca sarmalıyor.
*/
export default function SekmeSeridi({ etiket, children }: { etiket: string; children: ReactNode }) {
  const serit = useRef<HTMLElement>(null);

  useEffect(() => {
    const kutu = serit.current;
    const etkin = kutu?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!kutu || !etkin) return;
    kutu.scrollLeft = sekmeKaydirmasi({
      serit: kutu.clientWidth,
      icerik: kutu.scrollWidth,
      kaydirma: kutu.scrollLeft,
      /* offsetLeft şeride değil en yakın konumlu ataya göre; dikdörtgenden hesaplanıyor. */
      sol: etkin.getBoundingClientRect().left - kutu.getBoundingClientRect().left + kutu.scrollLeft,
      genislik: etkin.getBoundingClientRect().width,
    });
  }, []);

  return (
    <nav ref={serit} className="segmented calisma-sekmeleri" aria-label={etiket}>
      {children}
    </nav>
  );
}
