/*
  PDF GÖRÜNTÜLEYİCİ VE YAN PANEL SINIRLARI (16.11.2026, Yazım Stüdyosu).
  Saf modül; testi tests/unit/pdf-goruntu.test.ts.

  Yakınlaştırma %50–%300: altı okunmaz, üstü tek sayfayı yüzlerce
  megapiksellik kanvasa çevirip telefonda belleği tüketir (görüntüleyici
  ayrıca kanvas alanını da sınırlıyor).

*/

export const OLCEK_EN_AZ = 0.5;
export const OLCEK_EN_COK = 3;
export const OLCEK_ADIM = 0.25;

export function olcekSinirla(olcek: number): number {
  if (!Number.isFinite(olcek)) return 1;
  return Math.round(Math.min(OLCEK_EN_COK, Math.max(OLCEK_EN_AZ, olcek)) * 100) / 100;
}

/*
  Yan panel genişliği 19.11.2026'dan beri lib/calisma-alani-yerlesimi.ts'te
  (SAG_PANEL_SINIRI): Arvo AI ve PDF aynı yuvayı paylaşıyor ve genişlik
  belgenin okunabilirlik sınırıyla birlikte karar veriliyor. Eskiden burada
  yalnızca PDF için 360–960 px ve "editör en az 420 px" kuralı vardı;
  editörün akarak 420 px'e inmesi, kurum sahibinin incelemesinde görülen
  sıkışmanın kendisiydi.
*/
