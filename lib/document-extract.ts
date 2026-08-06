import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type SupportedDocType = "docx" | "pdf";

export function detectDocType(fileName: string, mimeType: string): SupportedDocType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) return "docx";
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  return null;
}

/**
 * DOCX veya PDF dosyasından düz metin çıkarır.
 * Sadece metin çıkarımı yapar; ArvoLab bu metni ÜRETMEZ, yalnızca
 * kullanıcının kendi yüklediği dosyayı okunabilir hale getirir.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  docType: SupportedDocType
): Promise<string> {
  if (docType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // pdf
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// Kaynakça/References başlığını arayarak metni gövde ve kaynakça olarak ikiye böler.
const REFERENCE_HEADING_RE =
  /\n\s*(KAYNAKÇA|KAYNAKLAR|REFERENCES|BIBLIOGRAPHY|BİBLİYOGRAFYA)\s*\n/i;

export function splitBodyAndReferences(fullText: string): {
  bodyText: string;
  referenceText: string;
} {
  const match = fullText.match(REFERENCE_HEADING_RE);
  if (!match || match.index === undefined) {
    // Başlık bulunamadıysa: tamamını gövde metni olarak kabul et,
    // kaynakça boş kalır (kullanıcı isterse elle ekleyebilir).
    return { bodyText: fullText, referenceText: "" };
  }

  const splitAt = match.index + match[0].length;
  return {
    bodyText: fullText.slice(0, match.index),
    referenceText: fullText.slice(splitAt),
  };
}
