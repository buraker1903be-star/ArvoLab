/**
 * Kılavuz Uygunluk Kontrolü
 * ------------------------------------------------------------
 * İçerik üretmez; yalnızca çıkarılmış belge metninde, üniversitenin
 * zorunlu tuttuğu bölüm başlıklarının (örn. "Giriş", "Yöntem",
 * "Bulgular", "Sonuç", "Kaynakça") bulunup bulunmadığını,
 * kaynakça sisteminin (APA7 vb.) beklenenle uyuşup uyuşmadığını
 * ve varsa sayfa aralığı uyumunu kural bazlı olarak denetler.
 */

import { headingMatchesSection } from "@/lib/section-match";

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

// Başlığı esnek biçimde arar (bkz. lib/section-match.ts): büyük/küçük harf,
// Türkçe I/İ farkı, numaralandırma ve sondaki noktalama gözetilmez.
// Yalnızca SATIRIN TAMAMI başlıkla eşleşiyorsa "bulundu" sayılır —
// aksi halde "Bulgular tartışıldı." gibi cümleler "Bulgular" başlığıyla
// yanlışlıkla eşleşir.
function sectionHeadingFound(text: string, section: string): boolean {
  return text.split("\n").some((line) => headingMatchesSection(line, section));
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
