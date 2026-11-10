"use client";

import { KAGIT_ANAHTARI, KAGIT_GOC_ANAHTARI, kagitOku, type KagitTercihi } from "@/lib/kagit-gorunumu";

/*
  Kâğıt görünümünü kaydedip <html data-kagit>'e uygular (Phase 4.6 D4).
  Karar lib/kagit-gorunumu.ts'te; burası yalnızca tarayıcıya dokunur.
  YALNIZCA GÖRÜNÜM: editöre, belgeye ya da sunucuya hiçbir şey yazılmaz;
  bu yüzden kâğıt değiştirmek otomatik kaydı, sürüm oluşturmayı ya da
  updated_at'i tetiklemez (mobil/kâğıt kabul betikleri bunu sınar).
  Tema tercihine dokunmaz: tema ve kâğıt iki ayrı anahtar.
*/
export function kagitTercihiniUygula(tercih: KagitTercihi) {
  try {
    window.localStorage.setItem(KAGIT_ANAHTARI, tercih);
    // Kullanıcı seçtiyse göç kararı bir daha verilmesin (betik zaten işaretlemiş olmalı).
    window.localStorage.setItem(KAGIT_GOC_ANAHTARI, "1");
  } catch {
    // Gizli sekmede depolama kapalı olabilir: seçim yalnızca bu sayfada geçerli olur.
  }
  document.documentElement.setAttribute("data-kagit", tercih);
}

/** <html>'deki güncel tercih (ön boyama betiği yazar). Sunucuda çağrılmaz. */
export function kagitDurumu(): KagitTercihi {
  return kagitOku(document.documentElement.getAttribute("data-kagit"));
}

/** useSyncExternalStore aboneliği: öznitelik değişince (başka sekme dahil). */
export function kagitAbone(degisti: () => void) {
  const gozcu = new MutationObserver(degisti);
  gozcu.observe(document.documentElement, { attributes: true, attributeFilter: ["data-kagit"] });
  return () => gozcu.disconnect();
}
