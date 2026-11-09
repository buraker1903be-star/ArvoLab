"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
  RAY İPUCU (V4.3-B1, K-1). 64 px rayda (tablet; masaüstünde daraltılmış
  kenar çubuğu) öğeler yalnızca simge. Adın görünen kopyası bu balon:
  klavye odağında ve fareli cihazda imleçte çıkar.

  NEDEN ORTAK İPUCU (data-ipucu) DEĞİL: kenar çubuğu bir kaydırma kabı
  (overflow), içindeki ::after balonu rayın dışına taşamaz, kesilirdi
  (overlays.css'teki not). Bu yüzden balon body'ye çizilir, konumu
  öğenin ekrandaki kutusundan.

  NEDEN title DEĞİL: tarayıcının title balonu klavye odağında hiç
  çıkmıyor, dokunmatikte yok ve bir saniye gecikiyor. Eskiden rayda ad
  yalnızca title'daydı (ad metni display: none idi).

  ERİŞİLEBİLİRLİK: öğenin adı zaten erişilebilir (os-gezinme-ad görünmez
  ama okunur), balon onun görünen kopyası: aria-hidden, ikinci kez
  okunmasın. WCAG 1.4.13: Esc kapatır; imleç balonun üstüne geçince
  kapanmaz; odak ya da imleç gidince kapanır.
*/
const HEDEF = ".os-gezinme-oge, .os-gezinme-yeni, .os-gezinme-marka";

type Balon = { metin: string; x: number; y: number };

export function RayIpucu({ etkin, kokId }: { etkin: boolean; kokId: string }) {
  const [balon, setBalon] = useState<Balon | null>(null);
  const kapatZamani = useRef<number | null>(null);
  const balonUstunde = useRef(false);

  useEffect(() => {
    const kok = document.getElementById(kokId);
    // Ray değilken dinlenmez; çizim zaten null döner. Kalan balon temizlemede (aşağıda) silinir.
    if (!etkin || !kok) return;
    const iptal = () => {
      if (kapatZamani.current !== null) window.clearTimeout(kapatZamani.current);
      kapatZamani.current = null;
    };
    const goster = (hedef: Element) => {
      iptal();
      const ad = hedef.querySelector(".os-gezinme-ad")?.textContent?.trim() || hedef.getAttribute("aria-label")?.trim();
      if (!ad) return;
      const r = hedef.getBoundingClientRect();
      setBalon({ metin: ad, x: r.right + 8, y: r.top + r.height / 2 });
    };
    // İmleç öğeden balona geçerken arada boşluk var: kısa bir gecikmeyle kapanır, balona girerse kapanmaz.
    const gecikmeliKapat = () => {
      iptal();
      kapatZamani.current = window.setTimeout(() => {
        if (!balonUstunde.current) setBalon(null);
      }, 150);
    };
    const fareli = window.matchMedia("(hover: hover) and (pointer: fine)");
    const uzerinde = (e: PointerEvent) => {
      if (!fareli.matches) return;
      const hedef = (e.target as Element).closest(HEDEF);
      if (hedef && kok.contains(hedef)) goster(hedef);
    };
    const ayrildi = (e: PointerEvent) => {
      const hedef = (e.target as Element).closest(HEDEF);
      if (hedef && !hedef.contains(e.relatedTarget as Node | null)) gecikmeliKapat();
    };
    const odaklandi = (e: FocusEvent) => {
      const hedef = (e.target as Element).closest(HEDEF);
      if (hedef && (e.target as Element).matches(":focus-visible")) goster(hedef);
    };
    const odakGitti = () => {
      iptal();
      setBalon(null);
    };
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") odakGitti();
    };
    kok.addEventListener("pointerover", uzerinde);
    kok.addEventListener("pointerout", ayrildi);
    kok.addEventListener("focusin", odaklandi);
    kok.addEventListener("focusout", odakGitti);
    kok.addEventListener("scroll", odakGitti, { passive: true });
    document.addEventListener("keydown", tus);
    return () => {
      iptal();
      setBalon(null);
      kok.removeEventListener("pointerover", uzerinde);
      kok.removeEventListener("pointerout", ayrildi);
      kok.removeEventListener("focusin", odaklandi);
      kok.removeEventListener("focusout", odakGitti);
      kok.removeEventListener("scroll", odakGitti);
      document.removeEventListener("keydown", tus);
    };
  }, [etkin, kokId]);

  if (!etkin || !balon) return null;
  return createPortal(
    <div
      className="ray-ipucu"
      aria-hidden="true"
      ref={(el) => {
        // Konum satır içi stil yazılmadan (check:css) CSS değişkeniyle verilir.
        el?.style.setProperty("--ray-ipucu-x", `${balon.x}px`);
        el?.style.setProperty("--ray-ipucu-y", `${balon.y}px`);
      }}
      onPointerEnter={() => {
        balonUstunde.current = true;
      }}
      onPointerLeave={() => {
        balonUstunde.current = false;
        setBalon(null);
      }}
    >
      {balon.metin}
    </div>,
    document.body,
  );
}
