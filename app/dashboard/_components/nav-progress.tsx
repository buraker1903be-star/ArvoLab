"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/*
  Panel içi bağlantıya tıklanınca üstte ince bir çizgi ilerler, sayfa gelince
  tamamlanıp kaybolur. Sunucu bileşenleri veriyi getirirken ekran birkaç yüz
  milisaniye hareketsiz kalıyordu; tıklamanın karşılık bulduğu görünmüyordu.
  Sayfa 150 ms'den hızlı gelirse çizgi hiç görünmez (yanıp sönme olmasın).
*/
export default function NavProgress() {
  const yol = usePathname();
  const arama = useSearchParams();
  const [genislik, setGenislik] = useState(0);
  const [gorunur, setGorunur] = useState(false);
  const zamanlayicilar = useRef<number[]>([]);

  const temizle = () => {
    zamanlayicilar.current.forEach(clearTimeout);
    zamanlayicilar.current = [];
  };

  useEffect(() => {
    const tikla = (olay: MouseEvent) => {
      const a = (olay.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || olay.metaKey || olay.ctrlKey || olay.shiftKey || olay.button !== 0) return;
      const hedef = new URL(a.href, location.href);
      if (hedef.origin !== location.origin) return;
      if (hedef.pathname === location.pathname && hedef.search === location.search) return;
      temizle();
      zamanlayicilar.current.push(
        window.setTimeout(() => {
          setGorunur(true);
          let g = 14;
          setGenislik(g);
          const adim = () => {
            g = Math.min(88, g + (88 - g) * 0.2);
            setGenislik(g);
            zamanlayicilar.current.push(window.setTimeout(adim, 150));
          };
          adim();
        }, 150),
      );
    };
    document.addEventListener("click", tikla, true);
    return () => {
      document.removeEventListener("click", tikla, true);
      temizle();
    };
  }, []);

  // Yeni sayfa geldi: çizgiyi tamamla ve gizle.
  useEffect(() => {
    temizle();
    // setState doğrudan effect gövdesinde çağrılmaz (react-hooks kuralı); sıradaki göreve bırakılır.
    const t0 = window.setTimeout(() => setGenislik((g) => (g > 0 ? 100 : 0)), 0);
    const t1 = window.setTimeout(() => setGorunur(false), 220);
    const t2 = window.setTimeout(() => setGenislik(0), 400);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [yol, arama]);

  if (!gorunur && genislik === 0) return null;
  return (
    <span className={`nav-progress${gorunur ? "" : " is-done"}`} aria-hidden="true">
      <i style={{ width: `${genislik}%` }} />
    </span>
  );
}
