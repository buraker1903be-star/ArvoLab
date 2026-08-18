import type { ParsedReference } from "@/lib/apa7";

export type AcademicProvider = "crossref" | "openalex";

export interface AcademicMatch {
  provider: AcademicProvider;
  title: string;
  year: number | null;
  doi: string | null;
  authors: string[];
  venue: string | null;
  url: string;
  citedByCount: number | null;
  confidence: number;
}

export interface ReferenceVerification {
  reference: string;
  status: "verified" | "possible_match" | "not_found" | "insufficient_data";
  googleScholarUrl: string;
  bestMatch: AcademicMatch | null;
  matches: AcademicMatch[];
}

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "in", "on", "for", "to", "ve", "ile",
  "bir", "bu", "da", "de", "için", "üzerine",
]);

function normalizeDoi(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
}

function normalizeText(value: string): string[] {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function titleSimilarity(left: string, right: string): number {
  const a = new Set(normalizeText(left));
  const b = new Set(normalizeText(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

function scoreCandidate(reference: ParsedReference, title: string, year: number | null): number {
  const titleScore = reference.title ? titleSimilarity(reference.title, title) : 0;
  const referenceYear = reference.year ? Number.parseInt(reference.year, 10) : null;
  const yearScore = referenceYear && year
    ? referenceYear === year ? 1 : Math.abs(referenceYear - year) === 1 ? 0.4 : 0
    : 0.5;
  return Math.round((titleScore * 0.82 + yearScore * 0.18) * 100) / 100;
}

function getYear(value: unknown): number | null {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return null;
  const year = Number(value[0][0]);
  return Number.isFinite(year) ? year : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ArvoLab/1.0 (academic-reference-verification)",
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function searchCrossref(reference: ParsedReference): Promise<AcademicMatch[]> {
  const query = reference.title || reference.raw;
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("rows", "3");
  url.searchParams.set("select", "DOI,title,author,issued,published-print,published-online,container-title,URL,is-referenced-by-count");

  const payload = await fetchJson(url.toString()) as {
    message?: { items?: Array<Record<string, unknown>> };
  };

  return (payload.message?.items ?? []).flatMap((item) => {
    const title = Array.isArray(item.title) && typeof item.title[0] === "string" ? item.title[0] : "";
    if (!title) return [];
    const authors = Array.isArray(item.author)
      ? item.author.flatMap((author) => {
          if (!author || typeof author !== "object") return [];
          const value = author as Record<string, unknown>;
          const name = [value.given, value.family].filter((part) => typeof part === "string").join(" ");
          return name ? [name] : [];
        })
      : [];
    const year = getYear((item.issued as { "date-parts"?: unknown })?.["date-parts"])
      ?? getYear((item["published-print"] as { "date-parts"?: unknown })?.["date-parts"])
      ?? getYear((item["published-online"] as { "date-parts"?: unknown })?.["date-parts"]);
    const doi = normalizeDoi(item.DOI);
    const venue = Array.isArray(item["container-title"]) && typeof item["container-title"][0] === "string"
      ? item["container-title"][0]
      : null;
    return [{
      provider: "crossref" as const,
      title,
      year,
      doi,
      authors,
      venue,
      url: doi ? `https://doi.org/${doi}` : String(item.URL || ""),
      citedByCount: typeof item["is-referenced-by-count"] === "number" ? item["is-referenced-by-count"] : null,
      confidence: scoreCandidate(reference, title, year),
    }];
  });
}

async function searchOpenAlex(reference: ParsedReference): Promise<AcademicMatch[]> {
  const query = reference.title || reference.raw;
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", "3");

  const payload = await fetchJson(url.toString()) as {
    results?: Array<Record<string, unknown>>;
  };

  return (payload.results ?? []).flatMap((item) => {
    const title = typeof item.title === "string" ? item.title : "";
    if (!title) return [];
    const authors = Array.isArray(item.authorships)
      ? item.authorships.flatMap((authorship) => {
          if (!authorship || typeof authorship !== "object") return [];
          const author = (authorship as { author?: { display_name?: unknown } }).author;
          return typeof author?.display_name === "string" ? [author.display_name] : [];
        })
      : [];
    const primaryLocation = item.primary_location && typeof item.primary_location === "object"
      ? item.primary_location as { landing_page_url?: unknown; source?: { display_name?: unknown } }
      : null;
    const year = typeof item.publication_year === "number" ? item.publication_year : null;
    const doi = normalizeDoi(item.doi);
    const openAlexId = typeof item.id === "string" ? item.id : "";
    return [{
      provider: "openalex" as const,
      title,
      year,
      doi,
      authors,
      venue: typeof primaryLocation?.source?.display_name === "string" ? primaryLocation.source.display_name : null,
      url: doi
        ? `https://doi.org/${doi}`
        : typeof primaryLocation?.landing_page_url === "string"
        ? primaryLocation.landing_page_url
        : openAlexId,
      citedByCount: typeof item.cited_by_count === "number" ? item.cited_by_count : null,
      confidence: scoreCandidate(reference, title, year),
    }];
  });
}

async function verifyReference(reference: ParsedReference): Promise<ReferenceVerification> {
  const scholarQuery = [reference.title, reference.authors?.[0], reference.year].filter(Boolean).join(" ");
  const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery || reference.raw)}`;

  if (!reference.title && reference.raw.length < 20) {
    return { reference: reference.raw, status: "insufficient_data", googleScholarUrl, bestMatch: null, matches: [] };
  }

  const settled = await Promise.allSettled([
    searchCrossref(reference),
    searchOpenAlex(reference),
  ]);
  const matches = settled
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .sort((a, b) => b.confidence - a.confidence);

  const deduplicated = matches.filter((match, index) =>
    index === matches.findIndex((candidate) =>
      match.doi && candidate.doi
        ? match.doi.toLowerCase() === candidate.doi.toLowerCase()
        : match.provider === candidate.provider && match.title === candidate.title
    )
  );
  const bestMatch = deduplicated[0] ?? null;
  const status = !bestMatch
    ? "not_found"
    : bestMatch.confidence >= 0.78
    ? "verified"
    : bestMatch.confidence >= 0.55
    ? "possible_match"
    : "not_found";

  return {
    reference: reference.raw,
    status,
    googleScholarUrl,
    bestMatch: status === "not_found" ? null : bestMatch,
    matches: deduplicated.filter((match) => match.confidence >= 0.5).slice(0, 4),
  };
}

export async function verifyAcademicReferences(
  references: ParsedReference[],
  limit = 25
): Promise<ReferenceVerification[]> {
  const selected = references.slice(0, limit);
  const results: ReferenceVerification[] = [];
  for (let index = 0; index < selected.length; index += 4) {
    results.push(...await Promise.all(selected.slice(index, index + 4).map(verifyReference)));
  }
  return results;
}
