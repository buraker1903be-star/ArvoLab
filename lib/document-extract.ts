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
  return (await belgeMetniOku(buffer, docType)).metin;
}

/**
 * Metin ve (yalnızca PDF'te) sayfa sayısı. Belge Kontrol sayfa sayısını
 * iki iş için istiyor: taranmış PDF'i ayırt etmek (sayfa başına metin) ve
 * kılavuzun sayfa sınırını göstermek (lib/belge-kontrol.ts). Word'ün sayfa
 * sayısı yazı tipine ve yazıcıya göre değiştiği için null.
 */
export async function belgeMetniOku(
  buffer: Buffer,
  docType: SupportedDocType
): Promise<{ metin: string; sayfa: number | null }> {
  if (docType === "docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return { metin: result.value, sayfa: null };
  }

  /*
    pdfjs (pdf-parse içinden) yüklenirken tarayıcıya özgü DOMMatrix,
    ImageData ve Path2D'yi arıyor; Node'da yoklar. Kendisi @napi-rs/canvas'ı
    çalışma anında bulmaya çalışıyor, ama o istek dosya izleyicisine
    görünmediği için paket her rotanın dağıtımına girmiyor. Eskiden bu
    tamamlama yalnızca kılavuz taramasındaydı (lib/guideline-scan.ts):
    27.10.2026'da Doçentlik sayfasında ÜAK PDF'i "DOMMatrix is not defined"
    ile okunamadı ve kullanıcı "taranmış PDF olabilir" uyarısı gördü —
    PDF'in metni sorunsuzdu. Açık import, paketi izleyiciye gösteriyor.
  */
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
    return { metin: result.text, sayfa: result.total || null };
  } finally {
    await parser.destroy();
  }
}

// Geriye dönük uyumluluk için yeniden dışa aktarım — yeni kodda
// doğrudan lib/text-split.ts kullanın.
export { splitBodyAndReferences } from "./text-split";
