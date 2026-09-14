// Yazım ilerlemesi (0–100): kılavuzun zorunlu bölümlerinden kaçının yazıldığı ve
// kılavuzun sayfa alt sınırına ne kadar yaklaşıldığı, eşit ağırlıkla. Kılavuzda ne
// bölüm listesi ne sayfa sınırı varsa hesaplanamaz (null) ve elle girilen değer korunur.
export interface WritingProgressInput {
  sectionsFound: number;
  sectionsRequired: number;
  pages: number;
  minPages: number | null;
  maxPages: number | null;
}

export function writingProgress({ sectionsFound, sectionsRequired, pages, minPages, maxPages }: WritingProgressInput): number | null {
  const parts: number[] = [];
  if (sectionsRequired > 0) parts.push(Math.min(1, Math.max(0, sectionsFound) / sectionsRequired));
  // Hedef alt sınırdır: en az sayfa sayısına ulaşan metin uzunluk bakımından tamamdır.
  const target = minPages ?? maxPages;
  if (target && target > 0) parts.push(Math.min(1, Math.max(0, pages) / target));
  if (parts.length === 0) return null;
  return Math.round((100 * parts.reduce((sum, part) => sum + part, 0)) / parts.length);
}
