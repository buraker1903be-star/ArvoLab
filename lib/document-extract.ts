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
 *
 * ÖNEMLİ: mammoth ve pdf-parse KASITLI OLARAK dinamik import()
 * ile yükleniyor (statik import DEĞİL). pdf-parse, tarayıcıya özgü
 * DOMMatrix/Path2D gibi API'leri modül yüklenir yüklenmez polyfill
 * etmeye çalışıyor; bu satırlar üst seviyede statik import edilirse,
 * bu dosyayı hiç kullanmayan sayfalar bile (ör. Panelde Yazma)
 * paylaşılan bir derleme parçası (chunk) üzerinden bu kodu
 * yükleyip "DOMMatrix is not defined" hatasıyla çökebiliyor.
 * Dinamik import, kütüphanenin yalnızca bu fonksiyon GERÇEKTEN
 * çağrıldığında belleğe alınmasını garanti eder.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  docType: SupportedDocType
): Promise<string> {
  if (docType === "docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // pdf
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// Geriye dönük uyumluluk için yeniden dışa aktarım — yeni kodda
// doğrudan lib/text-split.ts kullanın.
export { splitBodyAndReferences } from "./text-split";
