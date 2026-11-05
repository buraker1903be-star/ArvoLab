"use client";

import { useSyncExternalStore } from "react";
import { ekranSinifi, MASAUSTU_EN_AZ, TELEFON_EN_FAZLA, type EkranSinifi } from "@/lib/os/kirilimlar";

/*
  EKRAN SINIFI KANCASI. Signature OS 4.1'de (05.11.2026) yazım panelinden
  (editor/[id]/write/yan-panel.tsx) buraya taşındı: sayfa eylemleri ve
  veri tablosu da ekran boyuna göre FARKLI ÖĞE çiziyor (CSS ile gizlemek
  yetmiyor: tablo hücresindeki pencere düğmesi iki kez çizilirse iki ayrı
  pencere doğar). Sunucuda ve ilk çizimde masaüstü.
*/
function abone(degisti: () => void) {
  const sorgular = [window.matchMedia(`(max-width: ${TELEFON_EN_FAZLA}px)`), window.matchMedia(`(min-width: ${MASAUSTU_EN_AZ}px)`)];
  sorgular.forEach((s) => s.addEventListener("change", degisti));
  return () => sorgular.forEach((s) => s.removeEventListener("change", degisti));
}

export function useEkranSinifi(): EkranSinifi {
  return useSyncExternalStore(abone, () => ekranSinifi(window.innerWidth), () => "masaustu");
}
