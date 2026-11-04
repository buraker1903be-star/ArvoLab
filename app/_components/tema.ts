"use client";

import { KOYU_SORGUSU, TEMA_ANAHTARI, temaCoz, tercihOku, type Tema, type TemaTercihi } from "@/lib/tema";

/*
  Tema tercihini kaydedip <html>'e uygular (Phase 4.1). Tema düğmesi ve
  Ctrl+K aynı yolu kullanır; eskiden ikisi de kendi kopyasını yazıyordu
  (theme-toggle.tsx ve os-komut-paleti.tsx'te ayrı ayrı setAttribute).
  Karar lib/tema.ts'te; burası yalnızca tarayıcıya dokunur.
*/
export function temaTercihiniUygula(tercih: TemaTercihi) {
  try {
    window.localStorage.setItem(TEMA_ANAHTARI, tercih);
  } catch {
    // Gizli sekmede depolama kapalı olabilir: seçim yalnızca bu sayfada geçerli olur.
  }
  let sistemKoyu = false;
  try {
    sistemKoyu = window.matchMedia(KOYU_SORGUSU).matches;
  } catch {
    // matchMedia yoksa sistem açık sayılır.
  }
  const kok = document.documentElement;
  kok.setAttribute("data-theme", temaCoz(tercih, sistemKoyu));
  kok.setAttribute("data-theme-tercih", tercih);
}

/** <html>'deki güncel durum (ön boyama betiği yazar). Sunucuda çağrılmaz. */
export function temaDurumu(): { tercih: TemaTercihi; tema: Tema } {
  const kok = document.documentElement;
  return {
    tercih: tercihOku(kok.getAttribute("data-theme-tercih")),
    tema: kok.getAttribute("data-theme") === "dark" ? "dark" : "light",
  };
}

/** useSyncExternalStore aboneliği: iki özniteliği de dinler. */
export function temaAbone(degisti: () => void) {
  const gozcu = new MutationObserver(degisti);
  gozcu.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-tercih"] });
  return () => gozcu.disconnect();
}
