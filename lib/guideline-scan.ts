import { DEFAULT_HANGING_CM, DEFAULT_INDENT_CM, validIndentCm } from "@/lib/paragraph-format";
import { SOZCUK_SONU } from "@/lib/sozcuk-siniri";
import { fetchOfficialSource, kaynagiOku, type Dogrulayicilar } from "@/lib/safe-official-fetch";
import { atifGecisleri, atifSistemiSec } from "@/lib/atif-sistemi";
import { sayiKuraliOner, type SayiOnerisi } from "@/lib/kilavuz-sayi-onerisi";
import { pdfMetniniOcrIleOku, taranmisBelgeMi } from "@/lib/ocr";
import { sayfaSiniriCikar, surumEtiketiCikar, yururlukTarihiCikar } from "@/lib/kilavuz-kunyesi";
import { govdeOlcusu } from "@/lib/kilavuz-olcusu";
import type { Dil } from "@/lib/dil";

/**
 * Kılavuz Tarama Yardımcısı
 * ------------------------------------------------------------
 * Bir üniversitenin tez yazım kılavuzu URL'sini (PDF veya HTML
 * sayfa) alır, düz metni çıkarır ve olası zorunlu bölüm
 * başlıklarını (Giriş, Yöntem, Bulgular vb.) heuristik olarak
 * önerir. Temel biçim kurallarının tamamı açıkça bulunursa yüksek
 * güvenli bir öneri üretir; eksik/çelişkili belgeler insan incelemesine kalır.
 */

const CANDIDATE_SECTIONS = [
  "Özet",
  "Abstract",
  "Giriş",
  "Problem Durumu",
  "Araştırmanın Amacı",
  "Araştırmanın Önemi",
  "Yöntem",
  "Gereç ve Yöntem",
  "Evren ve Örneklem",
  "Veri Toplama",
  "Bulgular",
  "Tartışma",
  "Sonuç",
  "Sonuç ve Öneriler",
  "Kaynakça",
  "Ekler",
  "Özgeçmiş",
];

/*
  Tarayıcı sürümü.

  Çıkarım kuralları düzeldiğinde eski kayıtların kendiliğinden düzelmesi
  gerekir. Cron yalnızca "dosya değişti ya da hiç kural yok" durumunda
  yeniden çıkarım yapıyordu; atıf sistemi seçimindeki hata düzeltildiğinde
  (sürüm 2) yanlış "Chicago" kayıtları dosyaları değişmediği için sonsuza
  kadar yanlış kalırdı.

  Sürüm artınca cron onay BEKLEYEN kayıtları yeniden çıkarır. Onaylı
  kayıtlara dokunulmaz: onaylı kurallar hiçbir zaman otomatik değişmez
  (müşterinin editörü bozulmasın), yalnızca yöneticiye yeni sürüm bildirilir.

  Sürüm geçmişi:
    1 — ilk çıkarım kümesi
    2 — atıf sistemi sayım/baskınlık ile seçiliyor (lib/atif-sistemi.ts)
    3 — taranmış PDF'ler OCR ile okunuyor (lib/ocr.ts); sürüm, yürürlük
        tarihi ve sayfa sınırı çıkarılıyor (lib/kilavuz-kunyesi.ts)
    7 — adres bir kılavuza işaret etmiyorsa yöneticiye söyleniyor
        (web sayfası, yönetmelik, form, örnek sayfa). Bekleyen 45 kaydın
        8'i böyleydi ve panelde "kötü yazılmış kılavuz" gibi görünüyordu.
    6 — gövde ayrımı olumsuzlamayı okuyor ("kapak sayfaları HARİÇ tüm
        yazılarda 12 punto") ve gövdeden açıkça söz eden eşleşmeyi
        işaretsize yeğliyor. Sürüm 5 bu ikisi olmadan onaylı üç kılavuzda
        gövdenin ölçüsünü başlığınkiyle değiştiriyordu.
    5 — yazı boyutu, satır aralığı ve paragraf girintisi gövde metninden
        alınıyor (lib/kilavuz-olcusu.ts). Adıyaman kılavuzunda gövde
        14 punto çıkmıştı (cümle başlıkların kuralını anlatıyordu) ve
        girinti 2 cm çıkmıştı (blok alıntının kuralı; gövdeninki 1 cm).
    4 — saçma kenar boşlukları yok sayılıyor. Canlıda Burdur Fen Bilimleri
        kılavuzu "üst 29,7 cm" ile onaylandı: A4'ün tam yüksekliği, sayfa
        ölçüsü anlatan cümleden kaçmıştı. Değer öğrencinin editörüne
        iniyordu, yani yanlış çıkarım doğrudan belgeye yazıyordu.
*/
export const TARAYICI_SURUMU = 7;

/*
  Adres kılavuza değil, başka bir şeye işaret ediyor olabilir.

  Canlıda bekleyen 45 kaydın 8'i böyleydi: iki üniversitede enstitünün ANA
  SAYFASI, birinde bir haber duyurusu, birinde form listesi sayfası,
  birinde İngilizce yönetmelik, birinde "tez yazımında sıklıkla yapılan
  hatalar" sunumu, birinde bir öğrencinin kapak ÖRNEĞİ, birinde danışman
  kontrol formu. Hiçbirinde tarayıcı hatası yok — belge yanlış.

  Panelde bunlar %0 güvenle ve "Yazı tipi açıkça bulunamadı", "Kaynakça
  sistemi açıkça bulunamadı" uyarılarıyla görünüyordu. Yönetici kılavuzun
  kötü yazıldığını sanıyor, oysa sorun adreste ve yapılacak iş bambaşka:
  kuralları elle girmek değil, doğru belgeyi bulmak. OCR uyarısı da tam bu
  yanılgı için eklenmişti.

  Asıl ölçüt GÜVENİN SIFIR olması: tek bir biçim kuralı bile bulunamamış
  demektir (yazı tipi, punto, satır aralığı, kenar boşluğu, atıf sistemi —
  hiçbiri). Gerçek bir kılavuzda bunlardan en az biri geçer.

  Bölüm sayısı ikincil: ilk ölçüt "hiç bölüm yok"tu ve iki yanlış belgeyi
  kıl payı kaçırıyordu — Bursa Teknik'in "sıklıkla yapılan hatalar"
  sunumu 3, İstanbul Yeni Yüzyıl'ın danışman kontrol formu 2 başlık
  üretiyor. Sınır, sistemin zaten kullandığı ölçüye bağlandı: onay
  kuyruğu da en az 4 zorunlu bölüm istiyor (20260924100007).

  OCR YOLUNA GİREN belgede hiç uyarı verilmez. Orada çıkarımın boş
  olmasının sebebi belli ve kendi uyarısı var; "bu kılavuz değil" demek,
  okunamamış GERÇEK bir kılavuzdan yöneticiyi boş yere şüphe ettirirdi.
  Ölçüt "OCR kullanıldı" değil "OCR yoluna girdi": OCR hiç
  ÇALIŞTIRILAMADIĞINDA da metin boş kalıyor ve kayıt aynı yanlış uyarıyı
  alıyordu — oysa orada yapılacak iş belgeyi değil sunucuyu düzeltmek
  (lib/ocr.ts).
*/
export function kilavuzDegilUyarisi(
  confidence: number,
  bolumSayisi: number,
  contentType: string,
  ocrYolu = false,
  dil: Dil = "tr",
): string | null {
  if (ocrYolu) return null;
  if (confidence > 0 || bolumSayisi >= 4) return null;
  const metin = contentType.toLowerCase().includes("html") ? KILAVUZ_DEGIL_HTML : KILAVUZ_DEGIL_BELGE;
  return dil === "en" ? (SABIT_UYARILAR_EN.get(metin) ?? metin) : metin;
}

const KILAVUZ_DEGIL_HTML =
  "Bu adres bir web sayfası ve içinden hiçbir biçim kuralı çıkarılamadı; büyük olasılıkla "
  + "kılavuzun kendisi değil, ona bağlanan sayfa. Sayfadaki PDF/DOCX bağlantısını kaydedin.";
const KILAVUZ_DEGIL_BELGE =
  "Bu belgeden hiçbir biçim kuralı çıkarılamadı; adres bir tez yazım kılavuzuna işaret etmiyor "
  + "olabilir (yönetmelik, form ya da örnek sayfa olabilir).";

/*
  TARAMA UYARILARININ İNGİLİZCESİ (28.10.2026).

  Uyarılar taramada üretilip kılavuz kaydına TÜRKÇE yazılıyor: tarama
  çoğu zaman gece turunda, bir kullanıcı olmadan koşuyor ve kayıt iki
  dilde de okunuyor. Kaydı dile göre üretmek, kaydın dilini o an
  tarayanın diline bağlardı. Bu yüzden çeviri GÖSTERİRKEN yapılıyor:
  bilinen sabit metinler birebir, sayı taşıyanlar kalıpla. Tanınmayan
  bir uyarı (ör. lib/ocr.ts'in ya da lib/atif-sistemi.ts'in metni)
  olduğu gibi döner — yanlış çeviri, Türkçe bir cümleden kötüdür.
  Buradaki Türkçe metinler üretildikleri yerle BİREBİR aynı olmalı;
  testi tests/unit/guideline-scan.test.ts sınıyor.
*/
const SABIT_UYARILAR_EN = new Map<string, string>([
  [
    KILAVUZ_DEGIL_HTML,
    "This address is a web page and no formatting rules could be extracted from it; it is most likely "
      + "the page linking to the guideline rather than the guideline itself. Save the PDF/DOCX link on that page.",
  ],
  [
    KILAVUZ_DEGIL_BELGE,
    "No formatting rules could be extracted from this document; the address may not point to a thesis "
      + "writing guideline (it may be a regulation, a form or a sample page).",
  ],
  ["Paragraf girintisi ölçüsü bulunamadı; 1,25 cm varsayıldı.", "No paragraph indent measurement was found; 1.25 cm was assumed."],
  ["Tüm kenar boşlukları açıkça bulunamadı.", "Not all margins were stated explicitly."],
  ["Yazı tipi açıkça bulunamadı.", "The font was not stated explicitly."],
  ["Gövde metninin yazı boyutu açıkça bulunamadı.", "The font size of the body text was not stated explicitly."],
  ["Gövde metninin satır aralığı açıkça bulunamadı.", "The line spacing of the body text was not stated explicitly."],
  ["Yeterli sayıda zorunlu bölüm tespit edilemedi.", "Not enough required sections could be identified."],
  ["Kaynakça sistemi açıkça bulunamadı.", "The citation style was not stated explicitly."],
  [
    "Metinde istatistik örneği bulunamadı; sayı biçimi kılavuzdan çıkarılamıyor.",
    "No statistical examples were found in the text; the number format cannot be derived from the guideline.",
  ],
  [
    "Metinde hem sıfırlı hem sıfırsız yazım geçiyor; kılavuzu açıp doğrulayın.",
    "The text uses both leading-zero and no-leading-zero forms; open the guideline and verify.",
  ],
]);

const KALIP_UYARILAR_EN: [RegExp, (e: RegExpExecArray) => string][] = [
  [
    /^Makul olmayan kenar boşluğu değeri yok sayıldı \((.*)\); sayfa ölçüsüyle karışmış olabilir\.$/u,
    (e) => `Implausible margin values were ignored (${e[1]}); they may have been confused with the page size.`,
  ],
  [
    /^Belge taranmış görüntüden oluşuyor; metin OCR ile okundu \((\d+) sayfa, tanıma güveni %(\d+)\)\. Kurallar eksik ya da hatalı çıkmış olabilir\.$/u,
    (e) => `The document consists of scanned images; the text was read with OCR (${e[1]} pages, recognition confidence ${e[2]}%). Rules may be missing or incorrect.`,
  ],
  [
    /^Metinde iki ondalık ayırıcı da geçiyor \((.*)\); örnek ya da karşılaştırma olabilir\.$/u,
    (e) => `Both decimal separators appear in the text (${e[1].replace(/virgül/g, "comma").replace(/nokta/g, "period")}); this may be an example or a comparison.`,
  ],
];

/** Kılavuz kaydındaki (Türkçe) bir tarama uyarısının istenen dildeki hâli. */
export function taramaUyarisiCevir(uyari: string, dil: Dil = "tr"): string {
  if (dil === "tr") return uyari;
  const sabit = SABIT_UYARILAR_EN.get(uyari);
  if (sabit) return sabit;
  for (const [kalip, yaz] of KALIP_UYARILAR_EN) {
    const eslesme = kalip.exec(uyari);
    if (eslesme) return yaz(eslesme);
  }
  return uyari;
}

/*
  Toplu taramada sıra.

  Eskiden tek ölçüt "kanıtı (citationMentions) hiç olmayanlar önce"ydi:
  sıradaki kararı asıl onlar bekletiyordu. Çıkarım sürümü eskiyen kayıt da
  aynı şeyi bekletir — ölçüsü bilinen bir hatayla çıkarılmıştır — ama
  kanıtı olduğu için kuyruğun SONUNA düşüyordu. İki günde üç sürüm
  artışından sonra bu, düzeltmeyi en çok gereken kayıtları en geriye
  koymak demekti.
*/
export function taramaOnceligi(aiAnalysis: unknown): number {
  const analiz = (aiAnalysis ?? {}) as { citationMentions?: unknown; scannerVersion?: unknown };
  if (analiz.citationMentions === undefined) return 0;
  return Number(analiz.scannerVersion ?? 0) < TARAYICI_SURUMU ? 1 : 2;
}

/**
 * Künye alanlarından YALNIZCA bulunanları içeren güncelleme yaması.
 *
 * Bulunamayan alan yazılmaz: yönetici sayfa sınırını elle girmişse,
 * kılavuzda sınır yazmadığı için null dönen bir çıkarım onun girdisini
 * silmemeli. Çıkarım bildiğini ekler, bilmediğini bozmaz.
 */
export function kunyeYamasi(scan: GuidelineScanResult): Record<string, unknown> {
  return {
    ...(scan.versionLabel ? { version_label: scan.versionLabel } : {}),
    ...(scan.effectiveFrom ? { effective_from: scan.effectiveFrom } : {}),
    ...(scan.minPages !== null ? { min_pages: scan.minPages } : {}),
    ...(scan.maxPages !== null ? { max_pages: scan.maxPages } : {}),
  };
}

export interface GuidelineScanResult {
  textPreview: string;
  fullTextLength: number;
  suggestedSections: string[];
  detectedCitationHint: string | null;
  /* Karar verilemese de hangi adın kaç kez geçtiği; yönetici seçerken
     belgeyi açmak zorunda kalmasın. */
  citationMentions?: { sistem: string; etiket: string; sayim: number }[];
  /*
    SAYININ YAZILIŞI (lib/kilavuz-sayi-onerisi). Kılavuzun istatistik
    örneklerinden çıkarılan ÖNERİ; hiçbir şey kendiliğinden
    uygulanmaz. Net kazanan yoksa alanlar null döner ve sayımlar
    yöneticiye gösterilir — "bulunamadı" ile "ikisi de var" aynı
    görünmemeli.
  */
  sayiBicimiOnerisi?: SayiOnerisi;
  sourceChecksum: string;
  sourceContentType: string;
  /* Koşullu istek için saklanır; sunucudan geldiği gibi geri gönderilir. */
  sourceEtag: string | null;
  sourceLastModified: string | null;
  /* Metin OCR ile okundu: gürültülü olabilir, tek adım onaya girmez. */
  ocrKullanildi: boolean;
  /* Künye alanları; bulunamazsa null (lib/kilavuz-kunyesi.ts). */
  versionLabel: string | null;
  effectiveFrom: string | null;
  minPages: number | null;
  maxPages: number | null;
  suggestedRules: Record<string, unknown>;
  confidence: number;
  warnings: string[];
}

// "ondalık sistem/numaralandırma", "başlıklar … numaralandırılır", ya da örnek "1.1.1." numarası.
// Aradaki "1.1" gibi rakamlar arası nokta cümle sonu sayılmaz; "numaralandırılmaz" kural değildir.
// "Her ana bölüm yeni bir sayfadan başlar" — "başlamaz" kural değildir.
export const CHAPTER_NEW_PAGE =
  /bölüm(?:ler(?:i|in)?)?(?:\s+başl[ıi]klar[ıi])?[^.;]{0,50}yeni\s+(?:bir\s+)?sayfa(?:dan|da|ya)?\s+(?:başla(?!maz|mamal)|geç)|her\s+(?:ana\s+)?bölüm[^.;]{0,30}yeni\s+(?:bir\s+)?sayfa/iu;

// "Birinci düzey / ana bölüm başlıkları büyük harfle yazılır" — "yazılmaz" kural değildir.
export const CHAPTER_UPPERCASE =
  /(?:birinci\s+düzey|ana\s+bölüm|bölüm)\s+başl[ıi]k(?:lar[ıi]?)?[^.;]{0,50}büyük\s+harf(?!\p{L}*\s+yaz[ıi]lmaz)/iu;

// Özet/Abstract kelime sınırları ve anahtar kelime sayısı ("Özet 150-250 kelime", "300 kelimeyi
// geçmemelidir", "Anahtar kelimeler 3-5"). "Özgün" gibi kelimeler "öz" sayılmaz.
const ABSTRACT_WORD = "(?<![\\p{L}])(?:özet|öz|abstract)(?![\\p{L}])";
const WORD_UNIT = "(?:kelime|sözcük|words?)";
const ABSTRACT_RANGE = new RegExp(`${ABSTRACT_WORD}[^.;]{0,80}?(\\d{2,4})\\s*(?:-|–|ile|ila)\\s*(\\d{2,4})\\s*${WORD_UNIT}`, "iu");
const ABSTRACT_MAX = new RegExp(
  `${ABSTRACT_WORD}[^.;]{0,80}?(?:(?:en\\s+fazla|en\\s+çok|azami|maksimum)\\s*(\\d{2,4})\\s*${WORD_UNIT}|(\\d{2,4})\\s*${WORD_UNIT}\\p{L}*\\s+(?:geçmemeli|aşmamalı|geçemez|aşamaz))`,
  "iu"
);
const ABSTRACT_MIN = new RegExp(`${ABSTRACT_WORD}[^.;]{0,80}?en\\s+az\\s*(\\d{2,4})\\s*${WORD_UNIT}`, "iu");
const KEYWORDS_RANGE =
  /anahtar\s+(?:kelime|sözcük)\p{L}*[^.;]{0,60}?(\d{1,2})\s*(?:-|–|ile|ila)\s*(\d{1,2})|(\d{1,2})\s*(?:-|–|ile|ila)\s*(\d{1,2})\s*(?:adet\s+)?anahtar\s+(?:kelime|sözcük)|anahtar\s+(?:kelime|sözcük)\p{L}*[^.;]{0,40}?en\s+az\s*(\d{1,2})[^.;]{0,20}?en\s+(?:fazla|çok)\s*(\d{1,2})/iu;

export function detectAbstractRules(compact: string): Record<string, number> {
  const words = (value?: string) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 20 && n <= 2000 ? n : undefined;
  };
  const count = (value?: string) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 20 ? n : undefined;
  };
  const range = ABSTRACT_RANGE.exec(compact);
  const max = ABSTRACT_MAX.exec(compact);
  const min = ABSTRACT_MIN.exec(compact);
  const keywords = KEYWORDS_RANGE.exec(compact);
  const minWords = words(range?.[1]) ?? words(min?.[1]);
  const maxWords = words(range?.[2]) ?? words(max?.[1] ?? max?.[2]);
  const keywordsMin = count(keywords?.[1] ?? keywords?.[3] ?? keywords?.[5]);
  const keywordsMax = count(keywords?.[2] ?? keywords?.[4] ?? keywords?.[6]);
  return {
    ...(minWords && (!maxWords || minWords <= maxWords) ? { abstract_min_words: minWords } : {}),
    ...(maxWords ? { abstract_max_words: maxWords } : {}),
    ...(keywordsMin && (!keywordsMax || keywordsMin <= keywordsMax) ? { keywords_min: keywordsMin } : {}),
    ...(keywordsMax ? { keywords_max: keywordsMax } : {}),
  };
}

// "Paragraf başlarında 1,25 cm girinti", "ilk satır girintisi 1.25 cm", "paragraflar
// 1,25 cm içeriden başlar". Ölçü yazmayan kılavuzlar için yaygın 1,25 cm varsayılır.
// "İlk" büyük İ ile yazıldığında /i bayrağı eşleştirmez (Türkçe noktalı İ), açıkça yazılır.
const PARAGRAPH_SUBJECT = "(?:paragraf\\p{L}*|[i\u0130]lk\\s+sat[\u0131i]r\\p{L}*)";
export const PARAGRAPH_INDENT_CM = new RegExp(
  `${PARAGRAPH_SUBJECT}[^.;]{0,60}?girinti\\p{L}*[^.;]{0,25}?(\\d(?:[,.]\\d+)?)\\s*cm|${PARAGRAPH_SUBJECT}[^.;]{0,60}?(\\d(?:[,.]\\d+)?)\\s*cm[^.;]{0,25}?(?:girinti|i\u00e7eriden)`,
  "iu"
);
export const PARAGRAPH_INDENT = new RegExp(
  `${PARAGRAPH_SUBJECT}[^.;]{0,60}?girinti(?!\\p{L}*\\s+(?:\\p{L}*(?:maz|mamal)\\p{L}*|yoktur))`,
  "iu"
);
// "Metin iki yana yaslanmalıdır", "iki yana yaslı (justified)"
export const JUSTIFY = /iki\s+yana\s+(?:yasl|hizal)(?!\p{L}*(?:maz|mamal))/iu;

/*
  Kaynakça asılı girintisi. Kılavuzlarda üç biçimde geçer: "asılı
  girinti", "asılı paragraf", "hanging indent". Bazıları ölçü de verir
  ("1,27 cm asılı girinti"); vermeyenlerde APA'nın standardı olan
  1,27 cm varsayılır.

  Ölçü, "asılı" sözcüğünün iki yanında da aranıyor: kılavuzlar hem
  "asılı girinti 1,27 cm" hem "1,27 cm asılı girinti" yazıyor.
*/
const HANGING_SUBJECT = "(?:as[\u0131i]l[\u0131i]\\s+(?:girinti|paragraf)\\p{L}*|hanging\\s+indent)";
export const HANGING_INDENT = new RegExp(HANGING_SUBJECT, "iu");
export const HANGING_INDENT_CM = new RegExp(
  `${HANGING_SUBJECT}[^.;]{0,25}?(\\d(?:[,.]\\d+)?)\\s*cm|(\\d(?:[,.]\\d+)?)\\s*cm[^.;]{0,25}?${HANGING_SUBJECT}`,
  "iu"
);

export const HEADING_NUMBERING =
  /ondal[ıi]k(?:l[ıi])?\s+(?:sistem|numara)|başl[ıi]k(?:lar[ıi]?n?)?(?:[^.;]|(?<=\d)\.(?=\d)){0,60}numaraland[ıi]r(?![ıi]lmaz|[ıi]lmamal|may)|(?:^|\s)1\.1\.1\.?\s/iu;

function detectedNumber(text: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(text);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function extractFormattingRules(text: string, sectionCount: number, hasCitation: boolean) {
  const compact = text.replace(/\s+/g, " ");
  /*
    Kenar boşluğu MAKUL ARALIKTA olmalı.

    Canlıda Burdur Fen Bilimleri kılavuzundan "üst boşluk: 29,7 cm" çıktı ve
    ONAYLANDI: A4'ün tam yüksekliği. Tarif metninde sayfa boyutu geçiyor
    ("A4 · 21 × 29,7 cm") ve desen, etiketle sayı arasına 55 karaktere izin
    verdiği için oraya uzanabiliyor. Uygulansaydı öğrencinin sayfasında
    yazılacak alan kalmaz, teslim kontrolü de "Üst boşluk 29,7 cm olmalı"
    derdi.

    Aralık geniş tutuldu: Türkçe tez kılavuzlarında üst/sol 3–4 cm,
    alt/sağ 2–2,5 cm tipik. 8 cm bol bir tavan; asıl iş sayfa ölçüsünü ve
    başka birimden kaçak değerleri elemek.

    Eleme SESSİZ DEĞİL: değer bulunup reddedildiyse uyarı yazılıyor, yoksa
    yönetici "boşluk bulunamadı" ile "saçma boşluk bulundu"yu ayırt edemez.
  */
  const EN_AZ_BOSLUK = 0.5;
  const EN_COK_BOSLUK = 8;
  const elenenBoslular: string[] = [];
  const margin = (label: string) => {
    const deger = detectedNumber(
      compact,
      new RegExp(`(?:${label})(?:\\s+kenar(?:ından|ı)?|\\s+boşlu(?:ğu|k))?[^.;]{0,55}?(\\d{1,2}(?:[,.]\\d+)?)\\s*(?:cm|santimetre)`, "iu")
    );
    if (deger === undefined) return undefined;
    if (deger < EN_AZ_BOSLUK || deger > EN_COK_BOSLUK) {
      elenenBoslular.push(`${label.split("|")[0]}: ${deger} cm`);
      return undefined;
    }
    return deger;
  };
  const margins = {
    top: margin("üst|üstten"), bottom: margin("alt|alttan"),
    left: margin("sol|soldan"), right: margin("sağ|sağdan"),
  };
  const fontFamily = /times\s+new\s+roman/i.test(compact) ? "Times New Roman"
    : /\barial\b/i.test(compact) ? "Arial"
    : /\bcalibri\b/i.test(compact) ? "Calibri"
    : /\bcambria\b/i.test(compact) ? "Cambria" : undefined;
  /*
    İlk eşleşme değil, GÖVDEDEN söz eden ilk eşleşme (lib/kilavuz-olcusu.ts).
    Eskiden ilk eşleşme alınıyordu ve Adıyaman kılavuzunun "Ana bölüm
    başlıkları … 14 punto, … metin kısmı 12 punto" cümlesinden gövde boyutu
    14 çıkıyordu.
  */
  const gecerliPunto = (deger: number) => deger >= 8 && deger <= 24;
  const gecerliAralik = (deger: number) => deger >= 1 && deger <= 3;
  const validFontSize = govdeOlcusu(compact, /(\d{1,2}(?:[,.]\d+)?)\s*(?:punto|pt)\b/iu, gecerliPunto);
  const validLineSpacing = govdeOlcusu(compact, /(\d(?:[,.]\d+)?)\s*(?:satır\s+aralığı|satır\s+aralıklı)/iu, gecerliAralik);
  /*
    Paragraf girintisi: önce gövdenin ölçüsü aranır, yoksa kural varlığına
    bakılır. Eskiden ilk eşleşme alınıyordu ve Adıyaman kılavuzunda BLOK
    ALINTI kuralı ("doğrudan alıntılar … soldan 2 cm içeriden") gövdenin
    girintisi sanılıyordu; gerçek kural iki cümle sonra: "Her paragraf,
    soldan 1 cm içeriden başlar".
  */
  const indentCm = validIndentCm(govdeOlcusu(compact, PARAGRAPH_INDENT_CM, (deger) => validIndentCm(deger) !== undefined));
  const wantsIndent = PARAGRAPH_INDENT.test(compact);
  const paragraphIndentRule = indentCm
    ? { paragraph_indent_cm: indentCm }
    : wantsIndent
      ? { paragraph_indent_cm: DEFAULT_INDENT_CM }
      : {};

  const warnings: string[] = [];
  if (!indentCm && wantsIndent) warnings.push("Paragraf girintisi ölçüsü bulunamadı; 1,25 cm varsayıldı.");
  if (elenenBoslular.length) {
    warnings.push(`Makul olmayan kenar boşluğu değeri yok sayıldı (${elenenBoslular.join(", ")}); sayfa ölçüsüyle karışmış olabilir.`);
  }
  if (Object.values(margins).some((value) => value === undefined)) warnings.push("Tüm kenar boşlukları açıkça bulunamadı.");
  if (!fontFamily) warnings.push("Yazı tipi açıkça bulunamadı.");
  if (!validFontSize) warnings.push("Gövde metninin yazı boyutu açıkça bulunamadı.");
  if (!validLineSpacing) warnings.push("Gövde metninin satır aralığı açıkça bulunamadı.");
  if (sectionCount < 4) warnings.push("Yeterli sayıda zorunlu bölüm tespit edilemedi.");
  if (!hasCitation) warnings.push("Kaynakça sistemi açıkça bulunamadı.");

  const score = [
    Object.values(margins).every((value) => value !== undefined) ? 0.35 : 0,
    fontFamily ? 0.15 : 0, validFontSize ? 0.15 : 0, validLineSpacing ? 0.15 : 0,
    sectionCount >= 4 ? 0.1 : 0, hasCitation ? 0.1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return {
    suggestedRules: {
      ...(Object.values(margins).every((value) => value !== undefined) ? { margins_cm: margins } : {}),
      ...(fontFamily ? { font_family: fontFamily } : {}),
      ...(validFontSize ? { font_size_pt: validFontSize } : {}),
      ...(validLineSpacing ? { line_spacing: validLineSpacing } : {}),
      show_page_numbers: /sayfa\s+numara(?:sı|ları|landırma)/iu.test(compact),
      // Ondalık başlık numaralandırması ("1.1.1.") yalnızca açıkça geçiyorsa önerilir;
      // bulunamazsa kural hiç yazılmaz (kapalı sayılmaz, yönetici karar verir).
      ...(HEADING_NUMBERING.test(compact) ? { heading_numbering: true } : {}),
      ...(CHAPTER_UPPERCASE.test(compact) ? { chapter_uppercase: true } : {}),
      ...(CHAPTER_NEW_PAGE.test(compact) ? { chapter_new_page: true } : {}),
      ...paragraphIndentRule,
      ...(JUSTIFY.test(compact) ? { justify: true } : {}),
      /* Ölçü yazılmamışsa APA'nın standardı (1,27 cm) varsayılıyor;
         kural hiç geçmiyorsa yazılmıyor — "bilmiyorum" ile "istemiyor"
         aynı şey değil. */
      ...(HANGING_INDENT.test(compact)
        ? { reference_hanging_indent_cm: detectedNumber(compact, HANGING_INDENT_CM) ?? DEFAULT_HANGING_CM }
        : {}),
      ...detectAbstractRules(compact),
    },
    confidence: Math.round(score * 100) / 100,
    warnings,
  };
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Kaynağı koşullu olarak tarar.
 *
 * Doğrulayıcılar verilirse sunucuya If-None-Match / If-Modified-Since
 * gönderilir; dosya değişmemişse sunucu gövdesiz 304 döner ve hiçbir şey
 * indirilmez. Eskiden her gece her dosya BAŞTAN iniyor, sonra SHA-256
 * özeti karşılaştırılıp "değişmemiş" deniyordu — Gazi'nin kılavuzu 8 MB.
 *
 * 304 bir hata değil, en iyi sonuçtur: iş yapılmadan doğru cevap alındı.
 */
export async function kosulluTara(
  url: string,
  dogrulayicilar?: Dogrulayicilar,
): Promise<{ degismedi: true } | { degismedi: false; sonuc: GuidelineScanResult }> {
  const res = await fetchOfficialSource(url, { dogrulayicilar });
  if (res.status === 304) return { degismedi: true };
  return { degismedi: false, sonuc: await taramayiTamamla(url, res) };
}

export async function scanGuidelineUrl(url: string): Promise<GuidelineScanResult> {
  return taramayiTamamla(url, await fetchOfficialSource(url));
}

/*
  YÜKLENEN DOSYADAN TARAMA (26.10.2026).

  Öğrenci kendi kılavuz PDF'ini yükleyebiliyor. Dosya depoda duruyor ve
  sunucu onu doğrudan okuyor; imzalı bir adres üretip kendimize HTTP
  isteği atmıyoruz. Ağ turu bir yana, fetchOfficialSource'un adres
  denetimleri (genel ağ adresi, yönlendirme sınırı) kendi depomuz için
  anlamsız ve o yolu kendi adreslerimize açmak, SSRF korumasını
  gereksiz yere gevşetmek olurdu.

  `etiketAdres` yalnızca kayda yazılan ad; istek atılmıyor.
*/
export async function scanGuidelineBytes(
  bytes: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
  etiketAdres: string,
): Promise<GuidelineScanResult> {
  const yanit = new Response(bytes as BodyInit, { status: 200, headers: { "content-type": contentType } });
  return taramayiTamamla(etiketAdres, yanit);
}

async function taramayiTamamla(url: string, res: Response): Promise<GuidelineScanResult> {
  if (!res.ok) {
    throw new Error(`Kaynak alınamadı (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  let ocrKullanildi = false;
  let ocrSayfa = 0;
  let ocrGuven = 0;
  /** OCR hiç koşamadıysa sebebi; uyarı olarak kayda yazılır (lib/ocr.ts). */
  let ocrHatasi: string | null = null;
  // Sınırsız okuma yok: bkz. lib/safe-official-fetch.ts
  const sourceBytes = await kaynagiOku(res);
  let text: string;

  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(sourceBytes);
    const canvas = await import("@napi-rs/canvas");
    Object.assign(globalThis, {
      DOMMatrix: globalThis.DOMMatrix ?? canvas.DOMMatrix,
      ImageData: globalThis.ImageData ?? canvas.ImageData,
      Path2D: globalThis.Path2D ?? canvas.Path2D,
    });
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    let sayfaSayisi = 0;
    try {
      const result = await parser.getText();
      text = result.text;
      sayfaSayisi = result.total ?? result.pages?.length ?? 0;
    } finally {
      await parser.destroy();
    }

    /*
      Taranmış (görüntü) PDF: pdf-parse boş metin döndürüyor ve hata
      vermiyordu. Kural çıkarımı hiçbir şey bulamıyor, güven 0 çıkıyor ve
      kayıt sessizce "inceleme gerekli"de kalıyordu — kimse belgenin
      OKUNAMADIĞINI bilmiyordu, kılavuz kötü yazılmış gibi görünüyordu.
    */
    if (taranmisBelgeMi(text, sayfaSayisi)) {
      const ocr = await pdfMetniniOcrIleOku(buffer, sayfaSayisi);
      ocrHatasi = ocr.hata ?? null;
      if (ocr.metin.trim().length > text.trim().length) {
        text = ocr.metin;
        ocrKullanildi = true;
        ocrSayfa = ocr.sayfa;
        ocrGuven = ocr.guven;
      }
    }
  } else if (contentType.includes("wordprocessingml") || url.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(sourceBytes) });
    text = result.value;
  } else {
    const html = new TextDecoder().decode(sourceBytes);
    text = stripHtml(html);
  }

  const suggestedSections = CANDIDATE_SECTIONS.filter((section) => {
    // \b, Türkçe karakterlerde (ş, ı, ğ vb.) güvenilir çalışmadığı için
    // sınır lib/sozcuk-siniri.ts'ten gelir (tek tanım).
    const re = new RegExp(`(^|\\n)\\s*\\d*[.)]?\\s*${section}${SOZCUK_SONU}`, "iu");
    return re.test(text);
  });

  /*
    Atıf sistemi sayıma ve baskınlığa göre seçilir (lib/atif-sistemi.ts).
    Eskiden metinde geçen İLK ad kazanıyordu: baştan sona APA anlatan bir
    kılavuzda geçen tek bir "Chicago" sistemi Chicago yapıyordu.
  */
  const atifSecimi = atifSistemiSec(text);
  const citationHint = atifSecimi?.etiket ?? null;
  const citationMentions = atifGecisleri(text);
  const sayiBicimiOnerisi = sayiKuraliOner(text);
  const formatting = extractFormattingRules(text, suggestedSections.length, Boolean(citationHint));
  const sayfaSiniri = sayfaSiniriCikar(text);
  const kilavuzDegil = kilavuzDegilUyarisi(
    formatting.confidence,
    suggestedSections.length,
    contentType,
    ocrKullanildi || ocrHatasi !== null,
  );

  return {
    textPreview: text.slice(0, 4000),
    fullTextLength: text.length,
    suggestedSections,
    detectedCitationHint: citationHint,
    citationMentions,
    sayiBicimiOnerisi,
    sourceChecksum: await sha256(sourceBytes),
    sourceContentType: contentType || "application/octet-stream",
    sourceEtag: res.headers.get("etag"),
    sourceLastModified: res.headers.get("last-modified"),
    ocrKullanildi,
    versionLabel: surumEtiketiCikar(text),
    effectiveFrom: yururlukTarihiCikar(text),
    minPages: sayfaSiniri.enAz,
    maxPages: sayfaSiniri.enFazla,
    ...formatting,
    /*
      formatting'den SONRA gelmeli: yayma onu ezerdi. Atıf seçiminin ne
      kadar net olduğu yöneticiye söylenir; sessiz bir tahmin bırakılmaz.
    */
    warnings: [
      /*
        En başta: diğer bütün uyarıların SEBEBİ bu. "Yazı tipi
        bulunamadı"yı okuyan yönetici belgeyi düzeltmeye çalışır, oysa
        yapılacak iş doğru belgeyi bulmak.
      */
      ...(kilavuzDegil ? [kilavuzDegil] : []),
      ...formatting.warnings,
      ...(atifSecimi?.uyarilar ?? []),
      /*
        OCR metni gürültülüdür ("ÜNİVERSİTESİ" bir yerde "ONİVER"
        çıkabiliyor). Kullanıcıya söylenmezse, çıkarımın neden eksik
        olduğu anlaşılmaz.
      */
      ...(ocrKullanildi
        ? [
            `Belge taranmış görüntüden oluşuyor; metin OCR ile okundu (${ocrSayfa} sayfa, tanıma güveni %${Math.round(ocrGuven * 100)}). Kurallar eksik ya da hatalı çıkmış olabilir.`,
          ]
        : []),
      /*
        OCR'ın hiç KOŞMADIĞI durum ayrı: kayıt eskiden "%0 güven, kural
        çıkmadı" diye duruyor, belgenin okunamadığı yalnızca sunucu
        günlüğünde kalıyordu. 05.10–25.10.2026 arasında gece turu bu yüzden
        her gece düştü ve kimse 20 gün fark etmedi.
      */
      ...(ocrHatasi ? [ocrHatasi] : []),
    ],
  };
}
