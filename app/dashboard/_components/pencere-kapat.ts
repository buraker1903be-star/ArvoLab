"use client";

import { createContext, useContext } from "react";

/*
  PENCEREYİ İÇERİDEN KAPATMA (24.11.2026).

  Pencerenin içeriği, kendi "Vazgeç" düğmesini çizebilmek için pencereyi
  kapatmanın bir yoluna ihtiyaç duyuyor. Eskiden tek yol köşedeki ✕'ti;
  içerik kendi vazgeçme düğmesini isteyince ya kendi iç adımını açıp
  kapatıyordu (hesap silme: fazladan bir kapı) ya da hiç koymuyordu.

  Dışarıdan `acik`/`onAcikDegis` ile yönetmek her çağıran için işe
  yaramıyor: Ayarlar sunucu bileşeni, durumu tutamaz. Kapatma işlevi
  bağlamdan geçiyor; pencerenin dışında çağrılırsa null döner ve
  çağıran düğmeyi çizmez.
*/
export const PencereKapatBaglami = createContext<(() => void) | null>(null);

/** Açık pencereyi kapatır; pencere dışında null. */
export const usePencereKapat = (): (() => void) | null => useContext(PencereKapatBaglami);
