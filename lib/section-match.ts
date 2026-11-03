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

/*
  "Ekler" bölümünü numaralı ek başlıkları da karşılar (03.11.2026): örnek
  tezde "Ekler" başlığı yoktu, ekler doğrudan "Ek 1. Veri Seti", "Ek 2. …"
  diye başlıyordu ve kılavuz uygunluğu "Ekler eksik" (6/7) diyordu.
  Numaradan sonra ayraç ya da satır sonu şart: "Ek 1'de verilmiştir" bir
  cümledir, başlık değil.
*/
const EKLER = new Set(["EKLER", "APPENDICES", "APPENDIX"]);
const NUMARALI_EK = /^(?:EK|APPENDIX)\s*[-–]?\s*(?:\d+|[A-Z])\s*(?:[.:–-]|$)/u;

export function headingMatchesSection(heading: string, section: string): boolean {
  const normalizedSection = normalizeHeading(section);
  if (normalizedSection.length === 0) return false;
  const normalizedHeading = normalizeHeading(heading);
  if (normalizedHeading === normalizedSection) return true;
  return EKLER.has(normalizedSection) && NUMARALI_EK.test(heading.trim().toLocaleUpperCase("tr-TR").replace(/[İI]/g, "I"));
}

/*
  BELGENİN BÖLÜM DÜZEYİ (03.11.2026). "Eksik bölümü ekle" yeni bölümü hep
  H1 açıyordu. Bölümleri H2 olan bir belgede (başlığı H1 olan bir yazı
  yapıştırılınca böyle oluyor) eklenen "Giriş" H1, altındaki "1.1" H3
  kalıyor ve denetim "H1'den H3'e atlanmış" diyordu. Düzey belgeden
  okunur: kılavuzun bölümlerinden biri belgede varsa onun düzeyi; yoksa
  alt başlığı olan başlıkların en sık düzeyi; hiçbiri yoksa 1.
*/
export function bolumDuzeyi(basliklar: { level: number; text: string }[], zorunluBolumler: readonly string[]): number {
  const eslesen = basliklar.find((b) => zorunluBolumler.some((bolum) => headingMatchesSection(b.text, bolum)));
  if (eslesen) return eslesen.level;
  const sayac = new Map<number, number>();
  basliklar.forEach((b, i) => {
    if (basliklar[i + 1]?.level === b.level + 1) sayac.set(b.level, (sayac.get(b.level) ?? 0) + 1);
  });
  return [...sayac.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1;
}
