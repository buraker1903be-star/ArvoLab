/**
 * ArvoLab Orijinallik Ön-Kontrolü — Benzerlik Motoru
 * ------------------------------------------------------------
 * Turnitin'in yerini tutmaz; yalnızca ArvoLab'a yüklenmiş, erişim
 * yetkisi olan belge havuzuyla metin örtüşmesini hesaplar
 * (kelime dizisi tabanlı Jaccard benzerliği — "shingling").
 * İçerik üretmez, sadece iki metin arasındaki kelime dizisi
 * örtüşmesini ölçer.
 */

const SHINGLE_SIZE = 6; // ardışık kaç kelimenin bir "parmak izi" oluşturacağı

function normalizeWords(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function buildShingles(text: string, size: number = SHINGLE_SIZE): Map<string, string> {
  const words = normalizeWords(text);
  const shingles = new Map<string, string>(); // normalized shingle -> original words joined (örnek göstermek için)
  for (let i = 0; i + size <= words.length; i++) {
    const slice = words.slice(i, i + size);
    const key = slice.join(" ");
    if (!shingles.has(key)) {
      shingles.set(key, key);
    }
  }
  return shingles;
}

export interface SimilarityResult {
  score: number; // 0-100
  sampleOverlap: string | null; // örnek örtüşen kelime dizisi
}

export function computeSimilarity(shinglesA: Map<string, string>, shinglesB: Map<string, string>): SimilarityResult {
  if (shinglesA.size === 0 || shinglesB.size === 0) {
    return { score: 0, sampleOverlap: null };
  }

  let intersectionCount = 0;
  let sample: string | null = null;
  for (const key of shinglesA.keys()) {
    if (shinglesB.has(key)) {
      intersectionCount++;
      if (!sample) sample = key;
    }
  }

  const unionSize = shinglesA.size + shinglesB.size - intersectionCount;
  const jaccard = unionSize === 0 ? 0 : intersectionCount / unionSize;

  // Kısa belgelerde tek bir ortak cümle bile yüksek Jaccard verebilir;
  // bunun yerine "örtüşen parça oranı" (daha küçük belgeye göre) de
  // hesaba katılır, daha sezgisel bir yüzde elde etmek için ikisinin
  // ortalaması alınır.
  const overlapRatio = intersectionCount / Math.min(shinglesA.size, shinglesB.size);
  const score = Math.round(((jaccard + overlapRatio) / 2) * 100);

  return { score: Math.min(100, score), sampleOverlap: sample };
}
