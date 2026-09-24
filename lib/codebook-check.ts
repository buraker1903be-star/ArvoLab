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

/*
  Frekans yalnızca AÇIK BİR AYRAÇTAN sonra okunur.

  Eskiden satır sonundaki her sayı frekans sayılıyordu ve ayraç isteğe
  bağlıydı. Sonuç, kod adının içindeki sayının frekansa dönüşmesiydi:

    "COVID-19"    → ad "COVID", frekans 19   (en sık kod olarak listelenirdi)
    "Tema 1"      → ad "Tema",  frekans 1    ("tek kullanımlık, birleştirme adayı")
    "Sanayi 4.0"  → ad "Sanayi 4.", frekans 0

  Altı kodluk bir örnekte bildirilen 43'lük toplamın 20'si uydurmaydı.
  Sayı girdide geçiyordu ama BAŞKA BİR ANLAMDA; bu, sayıyı hiç yoktan
  üretmekten daha sinsidir (AGENTS.md: üretilen her sayı girdide geçmek
  zorunda).

  Boşlukla ayrılmış sayı ("Kod adı 15") bilerek frekans SAYILMIYOR:
  "COVID-19"dan ayırt edilemez. Bu satırlar "frekansı verilmemiş"
  listesine düşer — eksik bilgiyi söylemek, uydurmaktan iyidir.
*/
const AYRACLI = /^(.*\S)[ \t]*(?::|;|,|\t|[ ][-–][ ])[ \t]*(\d+)[ \t]*$/;
const PARANTEZLI = /^(.*\S)[ \t]*\(\s*(\d+)\s*\)[ \t]*$/;

const adiTemizle = (ad: string) => ad.trim().replace(/[:;,\-–]+$/, "").trim();

function ayristir(line: string): CodeEntry {
  const eslesme = PARANTEZLI.exec(line) ?? AYRACLI.exec(line);
  if (eslesme) return { name: adiTemizle(eslesme[1]), frequency: parseInt(eslesme[2], 10) };
  return { name: adiTemizle(line), frequency: null };
}

export function parseCodebook(rawText: string): CodebookCheckResult {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const codes: CodeEntry[] = lines.map(ayristir);

  /* Yinelenenler KULLANICININ YAZDIĞI gibi gösterilir. Eskiden karşılaştırma
     anahtarı (küçük harfe indirilmiş hâli) gösteriliyordu ve kullanıcı kendi
     listesinde o satırı aradığında bulamıyordu. */
  const nameCounts = new Map<string, { count: number; original: string }>();
  codes.forEach((c) => {
    const key = c.name.toLocaleLowerCase("tr-TR");
    const kayit = nameCounts.get(key);
    if (kayit) kayit.count += 1;
    else nameCounts.set(key, { count: 1, original: c.name });
  });

  const duplicates = [...nameCounts.values()]
    .filter(({ count }) => count > 1)
    .map(({ original }) => original);

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
