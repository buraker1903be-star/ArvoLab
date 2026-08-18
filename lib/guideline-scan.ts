import { fetchOfficialSource } from "@/lib/safe-official-fetch";

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

export interface GuidelineScanResult {
  textPreview: string;
  fullTextLength: number;
  suggestedSections: string[];
  detectedCitationHint: string | null;
  sourceChecksum: string;
  sourceContentType: string;
  suggestedRules: Record<string, unknown>;
  confidence: number;
  warnings: string[];
}

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
  const warnings: string[] = [];
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

export async function scanGuidelineUrl(url: string): Promise<GuidelineScanResult> {
  const res = await fetchOfficialSource(url);

  if (!res.ok) {
    throw new Error(`Kaynak alınamadı (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const sourceBytes = await res.arrayBuffer();
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

  const citationHint = /apa\s*7|apa7/i.test(text)
    ? "APA 7"
    : /vancouver/i.test(text)
    ? "Vancouver"
    : /chicago/i.test(text)
    ? "Chicago"
    : /ieee/i.test(text)
    ? "IEEE"
    : null;
  const formatting = extractFormattingRules(text, suggestedSections.length, Boolean(citationHint));

  return {
    textPreview: text.slice(0, 4000),
    fullTextLength: text.length,
    suggestedSections,
    detectedCitationHint: citationHint,
    sourceChecksum: await sha256(sourceBytes),
    sourceContentType: contentType || "application/octet-stream",
    ...formatting,
  };
}
