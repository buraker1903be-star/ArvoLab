// DOI → kaynak bilgileri (Crossref yanıtını literatür kaynağına çevirir; saf, test edilebilir).

export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

// HTTP başlıkları yalnızca Latin-1 kabul eder; Türkçe karakter (ğ, ş…) fetch'i istek
// gitmeden düşürür. Bu yüzden yalnızca ASCII.
export const CROSSREF_USER_AGENT = "ArvoLab/1.0 (academic reference lookup)";

/** Doğrulanmış DOI için Crossref adresi (eğik çizgiler korunur, diğer parçalar kodlanır) */
export const crossrefWorkUrl = (doi: string) =>
  `https://api.crossref.org/works/${doi.split("/").map(encodeURIComponent).join("/")}`;

/** "https://doi.org/10.1/abc", "doi: 10.1/abc", "10.1/abc." → "10.1/abc" (geçersizse null) */
export function normalizeDoi(input: string): string | null {
  let value = input.trim();
  value = value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    // geçersiz kodlama: olduğu gibi denenir
  }
  value = value.replace(/[.,;]+$/, "");
  return DOI_PATTERN.test(value) ? value : null;
}

export interface DoiMetadata {
  doi: string;
  title: string;
  /** APA biçiminde: "Yılmaz, A., Demir, B. C., & Kaya, D." */
  authors: string | null;
  year: string | null;
  sourceType: "article" | "book" | "chapter" | "thesis" | "report" | "website" | "other";
  containerTitle: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefDate {
  "date-parts"?: (number | null)[][];
}

interface CrossrefWork {
  title?: string[];
  author?: CrossrefAuthor[];
  editor?: CrossrefAuthor[];
  type?: string;
  issued?: CrossrefDate;
  "published-print"?: CrossrefDate;
  "published-online"?: CrossrefDate;
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
}

const TYPE_MAP: Record<string, DoiMetadata["sourceType"]> = {
  "journal-article": "article",
  "proceedings-article": "article",
  book: "book",
  monograph: "book",
  "edited-book": "book",
  "reference-book": "book",
  "book-chapter": "chapter",
  "book-section": "chapter",
  "book-part": "chapter",
  dissertation: "thesis",
  report: "report",
  "report-component": "report",
};

const clean = (value: string | undefined | null, max: number) => {
  const text = (value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, max) : null;
};

const initials = (given: string) =>
  given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((piece) => `${piece[0]?.toLocaleUpperCase("tr-TR") ?? ""}.`)
        .join("-")
    )
    .join(" ");

function formatAuthors(people: CrossrefAuthor[] | undefined): string | null {
  const names = (people ?? [])
    .map((person) => {
      if (person.family) return `${person.family.trim()}${person.given ? `, ${initials(person.given)}` : ""}`;
      return person.name?.trim() ?? "";
    })
    .filter(Boolean)
    .slice(0, 20);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

const yearOf = (...dates: (CrossrefDate | undefined)[]) => {
  for (const date of dates) {
    const year = date?.["date-parts"]?.[0]?.[0];
    if (typeof year === "number" && year > 0) return String(year);
  }
  return null;
};

export function parseCrossrefWork(work: CrossrefWork | null | undefined, doi: string): DoiMetadata | null {
  const title = clean(work?.title?.[0], 500);
  if (!work || !title) return null;
  return {
    doi,
    title,
    authors: formatAuthors(work.author?.length ? work.author : work.editor),
    year: yearOf(work.issued, work["published-print"], work["published-online"]),
    sourceType: TYPE_MAP[work.type ?? ""] ?? "other",
    containerTitle: clean(work["container-title"]?.[0], 500),
    volume: clean(work.volume, 40),
    issue: clean(work.issue, 40),
    pages: clean(work.page?.replace(/-/g, "–"), 40),
    publisher: clean(work.publisher, 300),
  };
}
