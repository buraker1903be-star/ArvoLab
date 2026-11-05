"use client";

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import { ekranSinifi, MASAUSTU_EN_AZ, TELEFON_EN_FAZLA, type EkranSinifi } from "@/lib/os/kirilimlar";

/*
  EKRAN SINIFI KANCASI. Signature OS 4.1'de (05.11.2026) yazım panelinden
  (editor/[id]/write/yan-panel.tsx) buraya taşındı: sayfa eylemleri ve
  veri tablosu da ekran boyuna göre FARKLI ÖĞE çiziyor (CSS ile gizlemek
  yetmiyor: tablo hücresindeki pencere düğmesi iki kez çizilirse iki ayrı
  pencere doğar).

  İLK ÇİZİM (4.2): eskiden sunucuda ve hidrasyonda hep masaüstüydü ve
  telefonda görünüm hidrasyondan sonra değişiyordu (Kanıt Matrisi tablodan
  kartlara, sayfa 719 → 1613 px). Artık panel düzeni istek başlıklarından
  bir tahmin veriyor (lib/os/kirilimlar.ts ekranTahmini) ve sunucu ile
  hidrasyon aynı tahminle çiziyor; sonrası gerçek genişlik.
*/
const EkranIpucu = createContext<EkranSinifi>("masaustu");

export function EkranIpucuSaglayici({ tahmin, children }: { tahmin: EkranSinifi; children: ReactNode }) {
  return createElement(EkranIpucu.Provider, { value: tahmin }, children);
}

function abone(degisti: () => void) {
  const sorgular = [window.matchMedia(`(max-width: ${TELEFON_EN_FAZLA}px)`), window.matchMedia(`(min-width: ${MASAUSTU_EN_AZ}px)`)];
  sorgular.forEach((s) => s.addEventListener("change", degisti));
  return () => sorgular.forEach((s) => s.removeEventListener("change", degisti));
}

export function useEkranSinifi(): EkranSinifi {
  const tahmin = useContext(EkranIpucu);
  return useSyncExternalStore(abone, () => ekranSinifi(window.innerWidth), () => tahmin);
}
