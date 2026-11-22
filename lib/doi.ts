// DOI → kaynak bilgileri (Crossref yanıtını literatür kaynağına çevirir; saf, test edilebilir).
import { htmlVarliklariniCoz } from "./html-varlik";
import { splitAuthors } from "./citation-format";

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
  /** Crossref "publisher-location"; çoğu kayıtta yok, varsa kitap künyesine girer. */
  publicationPlace: string | null;
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
  "publisher-location"?: string;
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

/* Varlık çözme tek yerde (lib/html-varlik.ts). Eskiden burada yalnızca
   &amp; &lt; &gt; tek kez çözülüyordu: "&amp;amp;" künyeye "&amp;" diye giriyordu. */
const clean = (value: string | undefined | null, max: number) => {
  const text = htmlVarliklariniCoz(value);
  return text ? text.slice(0, max) : null;
};

export const initials = (given: string) =>
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

export function formatAuthors(people: { given?: string; family?: string; name?: string }[] | undefined): string | null {
  const names = (people ?? [])
    .map((person) => {
      const family = htmlVarliklariniCoz(person.family);
      const given = htmlVarliklariniCoz(person.given);
      if (family) return `${family}${given ? `, ${initials(given)}` : ""}`;
      /* Kurum ({name}) ya da yalnızca given'ı olan tek adlı yazar: olduğu gibi,
         ters çevrilmeden. Eskiden yalnızca given'ı olan kişi düşüyordu. */
      return htmlVarliklariniCoz(person.name) || given;
    })
    .filter(Boolean)
    .slice(0, 20);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  /*
    APA dizisi ("A, B., C, & D") yalnızca geri bölünebiliyorsa (20.11.2026).
    Ortada kurum ya da tek adlı yazar varsa ("van der Berg, J., World Health
    Organization, Plato, & Madonna") virgül sınırı tanınmıyor, ad öncekiyle
    birleşip "given" alanına düşüyordu. O durumda ayırıcı "; ": her biçimde
    tek anlamlı bölünür, APA çıktısı stilYazarlari'nda yeniden dizi olur.
  */
  const apa = `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return splitAuthors(apa).length === names.length ? apa : names.join("; ");
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
    publicationPlace: clean(work["publisher-location"], 200),
  };
}
