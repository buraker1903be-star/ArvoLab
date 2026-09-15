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
  /** İlk yazarın soyadı ya da kurum adı (Türkçe küçük harf) */
  authorKey: string;
  year: string | null;
  position: number;
  /** "(Yılmaz, 2020)" parantez içi; "Yılmaz (2020)" anlatı biçimi */
  kind: "parenthetical" | "narrative";
}

export interface CrossCheckResult {
  citationsWithoutReference: InTextCitation[];
  referencesWithoutCitation: ParsedReference[];
}

// --- Kaynakça girdisi ayrıştırma -------------------------------------------

// Tarihsiz kaynak: APA'da "n.d.", Türkçe kaynaklarda "t.y."
const YEAR_RE = /\((\d{4}[a-z]?|n\.d\.|t\.y\.)\)/;

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
//
// Parantez içi: "(Yılmaz, 2020)", "(Yılmaz, 2020; Demir & Kaya, 2019)", "(Yılmaz, 2020, s. 15)",
//   "(Yılmaz, 2020: 15)", "(bkz. Yılmaz, 2019, 2020a)", "(Türkiye İstatistik Kurumu, 2021)"
// Anlatı: "Yılmaz (2020)", "Demir ve Kaya (2019)", "Arslan vd. (2018)", "Kurum Adı (2021, s. 3)"

const YEAR = "(?:\\d{4}[a-z]?|n\\.d\\.|t\\.y\\.)";
const YEARS = `${YEAR}(?:\\s*,\\s*${YEAR})*`;
const PAGE = "(?:\\s*(?:,\\s*(?:s|ss|sf|p|pp)\\.?|:)\\s*[\\d–-]+)?";
const NAME = "\\p{Lu}[\\p{L}'’-]+";
const ET_AL = "(?:vd\\.|ve\\s+ark\\.|ve\\s+diğerleri|et\\s+al\\.)";

const PAREN_GROUP_RE = /\(([^()]{3,300}?)\)/g;
const CITATION_PART_RE = new RegExp(
  `^(?:(?:bkz\\.|bk\\.|örn\\.|örneğin|ayrıca|see|e\\.g\\.,?|cf\\.)\\s+)?(\\p{Lu}.*?),\\s*(${YEARS})${PAGE}$`,
  "iu"
);
const NARRATIVE_RE = new RegExp(
  `(${NAME}(?:\\s+${NAME}){0,4}?(?:\\s+(?:ve|&|and)\\s+${NAME}|\\s+${ET_AL})?)\\s*\\((${YEARS})${PAGE}\\)`,
  "gu"
);

const normalizeName = (value: string) =>
  value.toLocaleLowerCase("tr-TR").replace(/[.,;:]+$/, "").replace(/\s+/g, " ").trim();
const normalizeYear = (year: string | null) => (year ? year.toLowerCase().replace("n.d.", "t.y.") : null);

/** "Demir & Kaya" → "demir", "Arslan vd." → "arslan", "Türkiye İstatistik Kurumu" → aynen */
function authorKey(author: string): string {
  const first = author
    .replace(new RegExp(`\\s+${ET_AL}\\s*$`, "iu"), "")
    .split(/\s+(?:ve|and)\s+|\s*&\s*/u)[0];
  return normalizeName(first);
}

export function extractInTextCitations(bodyText: string): InTextCitation[] {
  const results: InTextCitation[] = [];

  for (const group of bodyText.matchAll(PAREN_GROUP_RE)) {
    for (const part of group[1].split(";")) {
      const match = CITATION_PART_RE.exec(part.trim());
      if (!match) continue;
      const key = authorKey(match[1]);
      if (!key) continue;
      for (const year of match[2].split(",")) {
        results.push({ raw: group[0], authorKey: key, year: year.trim(), position: group.index ?? 0, kind: "parenthetical" });
      }
    }
  }

  for (const match of bodyText.matchAll(NARRATIVE_RE)) {
    const key = authorKey(match[1]);
    if (!key) continue;
    for (const year of match[2].split(",")) {
      results.push({ raw: match[0], authorKey: key, year: year.trim(), position: match.index ?? 0, kind: "narrative" });
    }
  }

  return results;
}

// --- Çapraz kontrol: metin içi atıf <-> kaynakça listesi -------------------

const referenceKey = (reference: ParsedReference) =>
  reference.authors?.[0] ? normalizeName(reference.authors[0].split(",")[0]) : "";

// Anlatı atfının önünde cümle başı kelimesi olabilir ("Ayrıca Yılmaz (2020)"); kurum adında
// "ve" geçebilir ("Milli Eğitim ve Kültür Bakanlığı"): kelime sınırında önek/sonek de eşleşir.
const keysMatch = (citation: string, reference: string) =>
  citation === reference ||
  citation.startsWith(`${reference} `) ||
  reference.startsWith(`${citation} `) ||
  citation.endsWith(` ${reference}`);

export function crossCheck(
  citations: InTextCitation[],
  references: ParsedReference[]
): CrossCheckResult {
  const refKeys = references.map((ref) => ({ ref, key: referenceKey(ref), year: normalizeYear(ref.year) }));
  const cites = (citation: InTextCitation, rk: (typeof refKeys)[number]) =>
    Boolean(rk.key) && rk.year === normalizeYear(citation.year) && keysMatch(citation.authorKey, rk.key);

  // Karşılıksız atıf yalnızca parantez içi atıflarda raporlanır: "Türkiye (2020)" gibi
  // anlatı biçimine benzeyen her ifade atıf değildir (yanlış alarm olmasın).
  const seen = new Set<string>();
  const citationsWithoutReference = citations.filter((citation) => {
    if (citation.kind !== "parenthetical" || refKeys.some((rk) => cites(citation, rk))) return false;
    const id = `${citation.authorKey}|${normalizeYear(citation.year)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const referencesWithoutCitation = refKeys
    .filter((rk) => !citations.some((citation) => cites(citation, rk)))
    .map((rk) => rk.ref);

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
