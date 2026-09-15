// Kelime sayısından yaklaşık A4 sayfa sayısı. Şekil, tablo ve kapak dahil
// değildir; kılavuzdaki sayfa aralığına ne kadar yaklaşıldığını göstermek için
// kaba bir tahmindir. Referans: 12 pt, tek satır aralığı, 2,5 cm boşluklarda
// sayfa başına ~500 kelime.
export interface PageEstimateSettings {
  fontSizePt?: number;
  lineSpacing?: number;
  margins?: { top: number; bottom: number; left: number; right: number };
}

const REFERENCE_AREA = (21 - 5) * (29.7 - 5);

/** Sayfa başına yaklaşık kelime (yazı boyutu, satır aralığı ve kenar boşluklarına göre) */
export function wordsPerPage(settings: PageEstimateSettings = {}): number {
  const fontSize = settings.fontSizePt && settings.fontSizePt > 0 ? settings.fontSizePt : 12;
  const spacing = settings.lineSpacing && settings.lineSpacing > 0 ? settings.lineSpacing : 1.5;
  const m = settings.margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };
  const area = Math.max((21 - m.left - m.right) * (29.7 - m.top - m.bottom), 60) / REFERENCE_AREA;
  return (500 / spacing) * (12 / fontSize) ** 2 * area;
}

export function estimatePages(words: number, settings: PageEstimateSettings = {}): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / wordsPerPage(settings)));
}

export type PageRangeTone = "neutral" | "warning" | "success" | "danger";

export function pageRangeTone(pages: number, minPages: number | null, maxPages: number | null): PageRangeTone {
  if (!minPages && !maxPages) return "neutral";
  if (maxPages && pages > maxPages) return "danger";
  if (minPages && pages < minPages) return "warning";
  return "success";
}
