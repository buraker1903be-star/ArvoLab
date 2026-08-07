/**
 * İstatistik Sonuçlarını APA 7 Cümlesine Çevirme
 * ------------------------------------------------------------
 * Hesaplanmış (gerçek) istatistik değerlerini standart APA
 * raporlama biçimine çevirir. Yorum/sonuç ÜRETMEZ — yalnızca
 * anlamlılık eşiğini (p < .05) mekanik olarak işaretler.
 */
export function formatP(p: number): string {
  if (p < 0.001) return "p < .001";
  return `p = ${p.toFixed(3).replace(/^0\./, ".")}`;
}

export function isSignificant(p: number): boolean {
  return p < 0.05;
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}
