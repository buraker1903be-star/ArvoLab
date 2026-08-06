/**
 * MAXQDA Kod Kitabı Kalite Kontrolü
 * ------------------------------------------------------------
 * Kullanıcının MAXQDA'dan dışa aktardığı kod listesini analiz
 * eder. Yeni kod ÜRETMEZ, tema/kategori ÖNERMEZ; yalnızca liste
 * kalitesini (tekrar eden kod adları, tek kullanımlık kodlar,
 * frekans dağılımı) mekanik olarak kontrol eder.
 *
 * Beklenen giriş biçimi (satır satır):
 *   Kod adı: 12
 *   Başka bir kod: 3
 * veya sadece:
 *   Kod adı
 */

export interface CodeEntry {
  name: string;
  frequency: number | null;
}

export interface CodebookCheckResult {
  codes: CodeEntry[];
  totalCodes: number;
  totalFrequency: number;
  duplicates: string[];
  singleUseCodes: string[]; // frekansı 1 olan kodlar (birleştirme/gözden geçirme adayı)
  emptyFrequencyCodes: string[]; // frekans bilgisi verilmemiş kodlar
}

export function parseCodebook(rawText: string): CodebookCheckResult {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const codes: CodeEntry[] = lines.map((line) => {
    // "Kod adı: 12" veya "Kod adı - 12" veya "Kod adı (12)" biçimlerini tolere et
    const match = line.match(/^(.+?)[\s:\-–]*\(?(\d+)\)?\s*$/);
    if (match && match[2]) {
      return { name: match[1].trim().replace(/[:\-–]+$/, "").trim(), frequency: parseInt(match[2], 10) };
    }
    return { name: line.replace(/[:\-–]+$/, "").trim(), frequency: null };
  });

  const nameCounts = new Map<string, number>();
  codes.forEach((c) => {
    const key = c.name.toLocaleLowerCase("tr-TR");
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });

  const duplicates = [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  const singleUseCodes = codes.filter((c) => c.frequency === 1).map((c) => c.name);
  const emptyFrequencyCodes = codes.filter((c) => c.frequency === null).map((c) => c.name);
  const totalFrequency = codes.reduce((sum, c) => sum + (c.frequency ?? 0), 0);

  return {
    codes: [...codes].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0)),
    totalCodes: codes.length,
    totalFrequency,
    duplicates,
    singleUseCodes,
    emptyFrequencyCodes,
  };
}
