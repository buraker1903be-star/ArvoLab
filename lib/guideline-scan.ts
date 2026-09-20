import { DEFAULT_INDENT_CM, validIndentCm } from "@/lib/paragraph-format";
import { fetchOfficialSource, kaynagiOku, type Dogrulayicilar } from "@/lib/safe-official-fetch";
import { atifSistemiSec } from "@/lib/atif-sistemi";

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
*/
export const TARAYICI_SURUMU = 2;

export interface GuidelineScanResult {
  textPreview: string;
  fullTextLength: number;
  suggestedSections: string[];
  detectedCitationHint: string | null;
  sourceChecksum: string;
  sourceContentType: string;
  /* Koşullu istek için saklanır; sunucudan geldiği gibi geri gönderilir. */
  sourceEtag: string | null;
  sourceLastModified: string | null;
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
  const margin = (label: string) => detectedNumber(
    compact,
    new RegExp(`(?:${label})(?:\\s+kenar(?:ından|ı)?|\\s+boşlu(?:ğu|k))?[^.;]{0,55}?(\\d{1,2}(?:[,.]\\d+)?)\\s*(?:cm|santimetre)`, "iu")
  );
  const margins = {
    top: margin("üst|üstten"), bottom: margin("alt|alttan"),
    left: margin("sol|soldan"), right: margin("sağ|sağdan"),
  };
  const fontFamily = /times\s+new\s+roman/i.test(compact) ? "Times New Roman"
    : /\barial\b/i.test(compact) ? "Arial"
    : /\bcalibri\b/i.test(compact) ? "Calibri"
    : /\bcambria\b/i.test(compact) ? "Cambria" : undefined;
  const fontSizePt = detectedNumber(compact, /(\d{1,2}(?:[,.]\d+)?)\s*(?:punto|pt)\b/iu);
  const lineSpacing = detectedNumber(compact, /(\d(?:[,.]\d+)?)\s*(?:satır\s+aralığı|satır\s+aralıklı)/iu);
  const validFontSize = fontSizePt && fontSizePt >= 8 && fontSizePt <= 24 ? fontSizePt : undefined;
  const validLineSpacing = lineSpacing && lineSpacing >= 1 && lineSpacing <= 3 ? lineSpacing : undefined;
  // Paragraf girintisi: önce ölçü aranır, yoksa kural varlığına bakılır.
  const indentMatch = PARAGRAPH_INDENT_CM.exec(compact);
  const indentCm = validIndentCm(indentMatch?.[1] ?? indentMatch?.[2]);
  const wantsIndent = PARAGRAPH_INDENT.test(compact);
  const paragraphIndentRule = indentCm
    ? { paragraph_indent_cm: indentCm }
    : wantsIndent
      ? { paragraph_indent_cm: DEFAULT_INDENT_CM }
      : {};

  const warnings: string[] = [];
  if (!indentCm && wantsIndent) warnings.push("Paragraf girintisi ölçüsü bulunamadı; 1,25 cm varsayıldı.");
  if (Object.values(margins).some((value) => value === undefined)) warnings.push("Tüm kenar boşlukları açıkça bulunamadı.");
  if (!fontFamily) warnings.push("Yazı tipi açıkça bulunamadı.");
  if (!validFontSize) warnings.push("Geçerli yazı boyutu açıkça bulunamadı.");
  if (!validLineSpacing) warnings.push("Geçerli satır aralığı açıkça bulunamadı.");
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

async function taramayiTamamla(url: string, res: Response): Promise<GuidelineScanResult> {
  if (!res.ok) {
    throw new Error(`Kaynak alınamadı (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
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
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
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
    // Unicode harf/rakam olmayan bir karakterle sınır kontrolü yapılır.
    const re = new RegExp(`(^|\\n)\\s*\\d*[.)]?\\s*${section}(?![\\p{L}\\p{N}])`, "iu");
    return re.test(text);
  });

  /*
    Atıf sistemi sayıma ve baskınlığa göre seçilir (lib/atif-sistemi.ts).
    Eskiden metinde geçen İLK ad kazanıyordu: baştan sona APA anlatan bir
    kılavuzda geçen tek bir "Chicago" sistemi Chicago yapıyordu.
  */
  const atifSecimi = atifSistemiSec(text);
  const citationHint = atifSecimi?.etiket ?? null;
  const formatting = extractFormattingRules(text, suggestedSections.length, Boolean(citationHint));

  return {
    textPreview: text.slice(0, 4000),
    fullTextLength: text.length,
    suggestedSections,
    detectedCitationHint: citationHint,
    sourceChecksum: await sha256(sourceBytes),
    sourceContentType: contentType || "application/octet-stream",
    sourceEtag: res.headers.get("etag"),
    sourceLastModified: res.headers.get("last-modified"),
    ...formatting,
    /*
      formatting'den SONRA gelmeli: yayma onu ezerdi. Atıf seçiminin ne
      kadar net olduğu yöneticiye söylenir; sessiz bir tahmin bırakılmaz.
    */
    warnings: [...formatting.warnings, ...(atifSecimi?.uyarilar ?? [])],
  };
}
