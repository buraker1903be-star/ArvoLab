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

export const TASLAK_GUVENDE = "Yazdıklarınız bu tarayıcıda saklanıyor.";

export const TASLAK_YAZILAMADI =
  "DİKKAT: yazdıklarınız bu tarayıcıya da kaydedilemedi (depolama dolu ya da kapalı) — sayfayı kapatmayın, metni kopyalayıp güvenli bir yere alın.";

/**
 * Hata metnine taslağın gerçek durumunu ekler.
 * `taslakYazildi` false ise güvence cümlesi KURULMAZ.
 */
export function kayitHatasiMetni(mesaj: string, taslakYazildi: boolean): string {
  const govde = mesaj.trim();
  const durum = taslakYazildi ? TASLAK_GUVENDE : TASLAK_YAZILAMADI;
  if (!govde) return durum;
  // Noktalama iki kez yazılmasın: "…denenecek. Yazdıklarınız…"
  return `${govde}${/[.!?]$/.test(govde) ? "" : "."} ${durum}`;
}
