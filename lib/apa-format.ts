/**
 * İstatistik Sonuçlarını APA 7 Cümlesine Çevirme
 * ------------------------------------------------------------
 * Hesaplanmış (gerçek) istatistik değerlerini standart APA
 * raporlama biçimine çevirir. Yorum/sonuç ÜRETMEZ — yalnızca
 * anlamlılık eşiğini (p < .05) mekanik olarak işaretler.
 *
 * NaN KORUMASI. Bozuk değil, MATEMATİKSEL OLARAK TANIMSIZ girdiler
 * gerçek veride sık: bir grubun bütün değerleri aynıysa varyans sıfır,
 * t = 0/0 = NaN. Eskiden bu değer olduğu gibi biçimlendiriliyordu ve
 * öğrenci ekranda tam bir APA satırı görüyordu:
 *
 *     t(4) = NaN, p = NaN — istatistiksel olarak anlamlı değil
 *
 * İki ayrı yanlış vardı. Birincisi "NaN"ın tezе yapıştırılabilir bir
 * sonuç gibi görünmesi. İkincisi daha sinsi: isSignificant(NaN) false
 * döndüğü için ürün, HESAPLANAMAMIŞ bir testi "anlamlı değil" diye
 * RAPORLUYORDU — veri hakkında yanlış bir iddia.
 *
 * Saf modül; testi tests/unit/apa-format.test.ts.
 */

/** Sayı gerçekten raporlanabilir mi (NaN ve sonsuz değil). */
export const hesaplanabilir = (...degerler: number[]): boolean =>
  degerler.every((deger) => Number.isFinite(deger));

/** Hesaplanamayan değerin yerine yazılan işaret. */
export const HESAPLANAMADI = "—";

export function formatP(p: number): string {
  if (!Number.isFinite(p)) return HESAPLANAMADI;
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3).replace(/^0\./, ".")}`;
}

/** Yalnızca GERÇEKTEN hesaplanmış ve eşiğin altındaki p anlamlıdır. */
export function isSignificant(p: number): boolean {
  return Number.isFinite(p) && p < 0.05;
}

export function formatNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return HESAPLANAMADI;
  return n.toFixed(decimals);
}
