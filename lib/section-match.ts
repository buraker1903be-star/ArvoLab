// Başlık ↔ kılavuz bölümü eşleştirmesi (sunucudaki kontrol ve editördeki
// bölüm listesi aynı kuralı kullanır). Büyük/küçük harf ve Türkçe I/İ farkı,
// baştaki numaralandırma ("1.", "1.1.", "I.", "BİRİNCİ BÖLÜM:", "BÖLÜM 2 –")
// ve sondaki noktalama gözetilmez. Tüm başlık eşleşmelidir: "Bulgular
// tartışıldı." gibi bir cümle "Bulgular" bölümü sayılmaz.

const ORDINAL_CHAPTER = /^(BIRINCI|IKINCI|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞINCI|ALTINCI|YEDINCI|SEKIZINCI|DOKUZUNCU|ONUNCU)\s+BÖLÜM\s*/;

export function normalizeHeading(text: string): string {
  return text
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I")
    .replace(/\s+/g, " ")
    .replace(ORDINAL_CHAPTER, "")
    .replace(/^BÖLÜM\s*\d+\s*/, "")
    .replace(/^[:.\-–]\s*/, "")
    .replace(/^(\d+(\.\d+)*[.)]?|[IVX]+[.)])\s+/, "")
    .replace(/[:.\-–]+$/, "")
    .trim();
}

export function headingMatchesSection(heading: string, section: string): boolean {
  const normalizedSection = normalizeHeading(section);
  return normalizedSection.length > 0 && normalizeHeading(heading) === normalizedSection;
}
