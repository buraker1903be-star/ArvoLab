/**
 * ArvoLab APA7 Doğrulama Motoru
 * ------------------------------------------------------------
 * Bu modül İÇERİK ÜRETMEZ. Yalnızca:
 *  1) Kaynakça listesindeki her girdinin APA7 formatına uygunluğunu
 *     kural bazlı olarak kontrol eder,
 *  2) Metin içi atıflar ile kaynakça listesi arasındaki tutarlılığı
 *     (her atfın kaynakçada karşılığı var mı / tersi) denetler.
 *
 * Sonuçlar "hata/uyarı" listesi olarak döner; nihai düzeltmeyi
 * kullanıcı/editör yapar. Bu, orijinal yazarlığı koruyan bir
 * denetim aracıdır, otomatik metin üretici değildir.
 */

export interface ReferenceIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParsedReference {
  raw: string;
  authors: string[] | null;
  year: string | null;
  title: string | null;
  issues: ReferenceIssue[];
}

export interface InTextCitation {
  raw: string;
  authorKey: string;
  year: string | null;
  position: number;
}

export interface CrossCheckResult {
  citationsWithoutReference: InTextCitation[];
  referencesWithoutCitation: ParsedReference[];
}

// --- Kaynakça girdisi ayrıştırma -------------------------------------------

const YEAR_RE = /\((\d{4}[a-z]?|n\.d\.)\)/;

export function parseReferenceEntry(raw: string): ParsedReference {
  const issues: ReferenceIssue[] = [];
  const trimmed = raw.trim();

  const yearMatch = trimmed.match(YEAR_RE);
  if (!yearMatch) {
    issues.push({
      field: "year",
      message: "Yıl parantez içinde bulunamadı, örn: (2023).",
      severity: "error",
    });
  }
  const year = yearMatch ? yearMatch[1] : null;

  // Yazar kısmı: yıl parantezinden önceki bölüm
  const authorSegment = yearMatch
    ? trimmed.slice(0, yearMatch.index).trim().replace(/\.$/, "")
    : null;

  let authors: string[] | null = null;
  if (authorSegment) {
    // "Soyad, A. B., & Soyad, C." biçimini kaba şekilde ayrıştır
    authors = authorSegment
      .split(/,\s*&\s*|,\s*(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]+,)/)
      .map((a) => a.trim())
      .filter(Boolean);

    authors.forEach((a) => {
      if (!/^[A-ZÇĞİÖŞÜ][\p{L}'\-]+,\s*[A-ZÇĞİÖŞÜ]\.(\s?[A-ZÇĞİÖŞÜ]\.)?$/u.test(a)) {
        issues.push({
          field: "author_format",
          message: `Yazar formatı APA7'ye uymuyor olabilir: "${a}" (beklenen: "Soyad, A.")`,
          severity: "warning",
        });
      }
    });
  } else {
    issues.push({
      field: "author",
      message: "Yazar adı ayrıştırılamadı.",
      severity: "error",
    });
  }

  // Başlık: yıldan sonraki ilk cümle
  let title: string | null = null;
  if (yearMatch) {
    const afterYear = trimmed.slice((yearMatch.index ?? 0) + yearMatch[0].length).trim();
    const titleMatch = afterYear.match(/^\.?\s*([^.]+)\./);
    title = titleMatch ? titleMatch[1].trim() : null;
    if (!title) {
      issues.push({
        field: "title",
        message: "Başlık bulunamadı ya da noktalama hatalı.",
        severity: "warning",
      });
    }
  }

  // DOI/URL kontrolü (varsa format kontrolü)
  const doiMatch = trimmed.match(/https?:\/\/doi\.org\/\S+|doi:\s*\S+/i);
  if (!doiMatch && /journal|dergi/i.test(trimmed)) {
    issues.push({
      field: "doi",
      message: "Dergi makalesi için DOI/URL bulunamadı (varsa eklenmeli).",
      severity: "warning",
    });
  }

  return { raw: trimmed, authors, year, title, issues };
}

export function parseReferenceList(rawList: string): ParsedReference[] {
  // Boş satırlarla ayrılmış veya her satır bir kaynak kabul edilir
  const entries = rawList
    .split(/\n{1,2}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  return entries.map(parseReferenceEntry);
}

// --- Metin içi atıf tespiti -------------------------------------------------

// (Yazar, 2020) veya (Yazar & Yazar2, 2020) veya Yazar (2020) formatlarını yakalar
const INTEXT_PAREN_RE = /\(([\p{L}şığüöçİĞÜŞÖÇ.,&\s]+?),\s*(\d{4}[a-z]?|n\.d\.)\)/gu;
const INTEXT_NARRATIVE_RE = /([A-ZÇĞİÖŞÜ][\p{L}]+(?:\s*(?:&|ve)\s*[A-ZÇĞİÖŞÜ][\p{L}]+)?)\s*\((\d{4}[a-z]?|n\.d\.)\)/gu;

export function extractInTextCitations(bodyText: string): InTextCitation[] {
  const results: InTextCitation[] = [];
  let match: RegExpExecArray | null;

  const paren = new RegExp(INTEXT_PAREN_RE);
  while ((match = paren.exec(bodyText)) !== null) {
    results.push({
      raw: match[0],
      authorKey: normalizeAuthorKey(match[1]),
      year: match[2],
      position: match.index,
    });
  }

  const narrative = new RegExp(INTEXT_NARRATIVE_RE);
  while ((match = narrative.exec(bodyText)) !== null) {
    results.push({
      raw: match[0],
      authorKey: normalizeAuthorKey(match[1]),
      year: match[2],
      position: match.index,
    });
  }

  return results;
}

function normalizeAuthorKey(s: string): string {
  return s
    .replace(/\bve\b|&/gi, "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(/\s+/)[0]; // ilk soyadı anahtar olarak al
}

// --- Çapraz kontrol: metin içi atıf <-> kaynakça listesi -------------------

export function crossCheck(
  citations: InTextCitation[],
  references: ParsedReference[]
): CrossCheckResult {
  const refKeys = references.map((r) => ({
    ref: r,
    key: r.authors && r.authors[0] ? r.authors[0].split(",")[0].trim().toLowerCase() : "",
    year: r.year,
  }));

  const citationsWithoutReference = citations.filter(
    (c) => !refKeys.some((rk) => rk.key === c.authorKey && rk.year === c.year)
  );

  const referencesWithoutCitation = references.filter((r) => {
    const key = r.authors && r.authors[0] ? r.authors[0].split(",")[0].trim().toLowerCase() : "";
    return !citations.some((c) => c.authorKey === key && c.year === r.year);
  });

  return { citationsWithoutReference, referencesWithoutCitation };
}

// --- Genel uyum skoru --------------------------------------------------------

export function computeComplianceScore(
  references: ParsedReference[],
  crossCheckResult: CrossCheckResult
): number {
  if (references.length === 0) return 0;
  const errorCount = references.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0
  );
  const mismatchCount =
    crossCheckResult.citationsWithoutReference.length +
    crossCheckResult.referencesWithoutCitation.length;

  const penalty = errorCount * 5 + mismatchCount * 3;
  return Math.max(0, Math.round(100 - penalty));
}
