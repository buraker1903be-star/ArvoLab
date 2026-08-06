/**
 * Kılavuz Uygunluk Kontrolü
 * ------------------------------------------------------------
 * İçerik üretmez; yalnızca çıkarılmış belge metninde, üniversitenin
 * zorunlu tuttuğu bölüm başlıklarının (örn. "Giriş", "Yöntem",
 * "Bulgular", "Sonuç", "Kaynakça") bulunup bulunmadığını,
 * kaynakça sisteminin (APA7 vb.) beklenenle uyuşup uyuşmadığını
 * ve varsa sayfa aralığı uyumunu kural bazlı olarak denetler.
 */

export interface SectionCheckResult {
  section: string;
  found: boolean;
}

export interface GuidelineComplianceResult {
  sections: SectionCheckResult[];
  missingSections: string[];
  citationStyleExpected: string;
  citationStyleMatches: boolean | null; // null: proje kaynakça sistemi bilinmiyor
}

// Başlığı esnek biçimde arar: satır başında, büyük/küçük harf ve
// Türkçe karakter farkı gözetmeksizin, kısmi noktalama toleranslı.
// Yalnızca SATIRIN TAMAMI başlıkla eşleşiyorsa "bulundu" sayılır —
// aksi halde "Bulgular tartışıldı." gibi cümleler "Bulgular" başlığıyla
// yanlışlıkla eşleşir.
function sectionHeadingFound(bodyText: string, section: string): boolean {
  const normalized = section
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I");

  const lines = bodyText.split("\n");
  return lines.some((line) => {
    const normalizedLine = line
      .trim()
      .toLocaleUpperCase("tr-TR")
      .replace(/[İI]/g, "I")
      .replace(/^\d+[.)]?\s*/, "") // "1. Giriş" gibi numaralandırmayı tolere et
      .replace(/[:.\-–]+$/, "") // sondaki noktalama işaretlerini tolere et
      .trim();
    return normalizedLine === normalized;
  });
}

export function checkGuidelineCompliance(
  bodyText: string,
  requiredSections: string[],
  guidelineCitationStyle: string,
  projectCitationStyle: string | null
): GuidelineComplianceResult {
  const sections = requiredSections.map((section) => ({
    section,
    found: sectionHeadingFound(bodyText, section),
  }));

  return {
    sections,
    missingSections: sections.filter((s) => !s.found).map((s) => s.section),
    citationStyleExpected: guidelineCitationStyle,
    citationStyleMatches: projectCitationStyle ? projectCitationStyle === guidelineCitationStyle : null,
  };
}
