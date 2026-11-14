"use client";

import { GEZINME_DAR, GEZINME_DAR_ANAHTARI, GEZINME_OZNITELIGI, darDegeri } from "@/lib/os5/gezinme";
import { MASAUSTU_EN_AZ } from "@/lib/os/kirilimlar";

/*
  Kenar çubuğu dar/açık tercihini kaydedip <html>'e uygular (Phase 5.1c).
  Tema yardımcısıyla (app/_components/tema.ts) aynı düzen: karar
  lib/os5/gezinme.ts'te, burası yalnızca tarayıcıya dokunur. İlk boyamadaki
  değeri ön boyama betiği yazar (app/layout.tsx); bu modül yalnızca
  kullanıcı düğmeye bastığında çalışır.
*/
export function gezinmeTercihiniUygula(dar: boolean) {
  try {
    window.localStorage.setItem(GEZINME_DAR_ANAHTARI, darDegeri(dar));
  } catch {
    // Gizli sekmede depolama kapalı olabilir: seçim yalnızca bu sayfada geçerli olur.
  }
  const kok = document.documentElement;
  if (dar) kok.setAttribute(GEZINME_OZNITELIGI, GEZINME_DAR);
  else kok.removeAttribute(GEZINME_OZNITELIGI);
}

/** <html>'deki güncel durum (ön boyama betiği ya da düğme yazar). Sunucuda çağrılmaz. */
export function gezinmeDarMi(): boolean {
  return document.documentElement.getAttribute(GEZINME_OZNITELIGI) === GEZINME_DAR;
}

/*
  useSyncExternalStore aboneliği: özniteliği izler. Başka sekmedeki
  değişikliği ön boyama betiği zaten özniteliğe yansıtıyor; burada ayrıca
  storage olayı dinlemek aynı değişikliği iki yoldan getirirdi.
*/
export function gezinmeAbone(degisti: () => void) {
  const gozcu = new MutationObserver(degisti);
  gozcu.observe(document.documentElement, { attributes: true, attributeFilter: [GEZINME_OZNITELIGI] });
  return () => gozcu.disconnect();
}

/*
  MASAÜSTÜ Mİ (Phase 5.1d-4): Ctrl+K'daki "kenar çubuğunu daralt/genişlet"
  komutu yalnızca ≥1200 px'te anlamlı. Tablette ray, telefonda alt çubuk
  var; orada tercihi değiştirmek ekranda hiçbir şeyi değiştirmez ama
  kaydı değiştirir ve kullanıcı masaüstüne dönünce beklemediği bir hâlle
  karşılaşırdı. Sınır CSS'le aynı sabitten (lib/os/kirilimlar.ts).
*/
const MASAUSTU_SORGUSU = `(min-width: ${MASAUSTU_EN_AZ}px)`;

export function masaustuMu(): boolean {
  return window.matchMedia(MASAUSTU_SORGUSU).matches;
}

export function masaustuAbone(degisti: () => void) {
  const sorgu = window.matchMedia(MASAUSTU_SORGUSU);
  sorgu.addEventListener("change", degisti);
  return () => sorgu.removeEventListener("change", degisti);
}
