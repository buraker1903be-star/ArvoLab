/*
  Kaydedilemeyen metnin NEREDE durduğunu söyleyen cümle.

  Bu cümle uzun süre sunucu hata metinlerinin içinde geçiyordu
  ("…yazdıklarınız bu tarayıcıda saklanıyor") ve iki sorunu vardı:

  1. Sunucu bunu BİLEMEZ. Taslağın tarayıcıya yazılıp yazılmadığını yalnızca
     istemci görür.
  2. Yazma sessizce başarısız olabiliyordu: localStorage büyük tezde ~5 MB
     sınırına dayanıyor, gizli sekmede kapalı, site verisi engelliyse yok.
     O anda kullanıcıya metninin güvende olduğu söyleniyordu — tam da sunucu
     kaydının başarısız olduğu anda. Kullanıcı sekmeyi kapatıyor ve bir tez
     bölümü gidiyor.

  Saf modül; testi tests/unit/taslak-durumu.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";

export const TASLAK_GUVENDE_METIN: Metin = {
  tr: "Yazdıklarınız bu tarayıcıda saklanıyor.",
  en: "Your writing is being kept in this browser.",
};

export const TASLAK_YAZILAMADI_METIN: Metin = {
  tr: "DİKKAT: yazdıklarınız bu tarayıcıya da kaydedilemedi (depolama dolu ya da kapalı) — sayfayı kapatmayın, metni kopyalayıp güvenli bir yere alın.",
  en: "WARNING: your writing could not be saved in this browser either (storage is full or disabled) — do not close the page; copy the text and keep it somewhere safe.",
};

export const TASLAK_GUVENDE = TASLAK_GUVENDE_METIN.tr;

export const TASLAK_YAZILAMADI = TASLAK_YAZILAMADI_METIN.tr;

/**
 * Hata metnine taslağın gerçek durumunu ekler.
 * `taslakYazildi` false ise güvence cümlesi KURULMAZ.
 */
export function kayitHatasiMetni(mesaj: string, taslakYazildi: boolean, dil: Dil = "tr"): string {
  const govde = mesaj.trim();
  const durum = (taslakYazildi ? TASLAK_GUVENDE_METIN : TASLAK_YAZILAMADI_METIN)[dil];
  if (!govde) return durum;
  // Noktalama iki kez yazılmasın: "…denenecek. Yazdıklarınız…"
  return `${govde}${/[.!?]$/.test(govde) ? "" : "."} ${durum}`;
}
