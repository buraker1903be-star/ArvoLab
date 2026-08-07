/**
 * Kılavuz Tarama Yardımcısı
 * ------------------------------------------------------------
 * Bir üniversitenin tez yazım kılavuzu URL'sini (PDF veya HTML
 * sayfa) alır, düz metni çıkarır ve olası zorunlu bölüm
 * başlıklarını (Giriş, Yöntem, Bulgular vb.) heuristik olarak
 * önerir. SONUÇLARI OTOMATİK OLARAK UYGULAMAZ — yalnızca Akademik
 * Yönetici'ye bir ön inceleme sunar; kılavuzu aktifleştirmek
 * her zaman insan onayı gerektirir (proje dosyası Bölüm 6.3
 * "Kılavuz Güncelleme Akışı" ile uyumlu).
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
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (ArvoLab Kılavuz Tarayıcı)" },
  });

  if (!res.ok) {
    throw new Error(`Kaynak alınamadı (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  let text: string;

  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else {
    const html = await res.text();
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

  return {
    textPreview: text.slice(0, 4000),
    fullTextLength: text.length,
    suggestedSections,
    detectedCitationHint: citationHint,
  };
}
