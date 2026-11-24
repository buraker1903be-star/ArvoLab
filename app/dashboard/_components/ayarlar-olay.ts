"use client";

/*
  AYARLAR'I AÇMA OLAYI (24.11.2026).

  Ayarlar artık bir sayfa değil, uygulamanın her yerinden açılan bir
  pencere. Pencereyi panel düzeni bir kez çiziyor (layout.tsx); hesap
  menüsündeki bağlantı ona bu olayla sesleniyor. Durum bir bağlam
  (context) yerine olayla taşınıyor, çünkü menü SUNUCUDA çiziliyor ve
  sunucu bileşeni bir istemci bağlamına yazamaz.
*/
export const AYARLAR_AC_OLAYI = "arvolab:ayarlar-ac";

export type AyarlarAcDetay = { sekme?: string };

/** Ayarlar penceresini açar; pencere yoksa (henüz yüklenmediyse) sessiz kalır. */
export function ayarlariAc(sekme?: string): void {
  window.dispatchEvent(new CustomEvent<AyarlarAcDetay>(AYARLAR_AC_OLAYI, { detail: { sekme } }));
}
