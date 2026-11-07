// DOI → kaynak bilgileri (Crossref yanıtını literatür kaynağına çevirir; saf, test edilebilir).

export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

// HTTP başlıkları yalnızca Latin-1 kabul eder; Türkçe karakter (ğ, ş…) fetch'i istek
// gitmeden düşürür. Bu yüzden yalnızca ASCII.
export const CROSSREF_USER_AGENT = "ArvoLab/1.0 (academic reference lookup)";

/** Doğrulanmış DOI için Crossref adresi (eğik çizgiler korunur, diğer parçalar kodlanır) */
export const crossrefWorkUrl = (doi: string) =>
  `https://api.crossref.org/works/${doi.split("/").map(encodeURIComponent).join("/")}`;

/*
  TEK DOI KURALI (A1, 07.11.2026). DOI'yi okuyan her yol buradan geçer:
  editörde DOI ile arama (lookupDoi), DOI listesi (doiIleEkle), içe aktarma
  ve tekrar anahtarı (lib/kaynak-aktarim.ts), arama sonucundan ekleme,
  künye karşılaştırması (lib/kanit/kunye-karsilastirma.ts).

  Eskiden üç ayrı kural vardı ve aynı DOI'yi farklı okuyordu (önce/sonra
  dökümü A1 raporunda):
    • "(doi: 10.1/abc)", "[10.1/abc]", "<10.1/abc>", tırnaklı ya da
      sonu ":" ile biten yazım tekrar anahtarında kapanışı taşıyordu
      ("doi:10.1/abc)") — aynı eser ikinci kez eklenebiliyordu;
    • şemasız "doi.org/…" ve "www.doi.org/…" adresi reddediliyordu;
    • metinden ayıklayıcı "10.1/abc(1)"i "10.1/abc(1" diye KESİYORDU
      (sondaki ")" koşulsuz atılıyordu) ve "%2F" kodlu adresi hiç
      bulamıyordu.
  Kural: önek ve sarmalayıcı (parantez, köşeli parantez, açılı parantez,
  tırnak) atılır; yüzde kodu çözülür; sondaki noktalama (. , ; :) ve
  sondaki eğik çizgi atılır; sondaki ")", "]", ">" YALNIZCA açılışı yoksa
  atılır — eski Wiley SICI DOI'leri "(SICI)…<693::AID-ASI4>…" ve
  "…(77)90194-3" gibi DOI'ler parantezli ve bozulmamalı.
  Büyük/küçük harf KORUNUR (Crossref'e ve ekrana giden değer); DOI büyük/küçük
  harfe duyarsız olduğu için karşılaştırma doiAnahtari ile yapılır.
*/
const DOI_ONEKI = /^(?:https?:\/\/)?(?:www\.|dx\.)?doi\.org\//i;
const SARMALAYICI_BAS = /^["'“”‘’(\[<]+/;
const ACILIS: Record<string, string> = { ")": "(", "]": "[", ">": "<" };

function dengesizKapanisAt(deger: string): string {
  let v = deger;
  for (;;) {
    const onceki = v;
    v = v.replace(/[.,;:]+$/, "").replace(/["'“”‘’]+$/, "").replace(/\/+$/, "");
    const son = v.at(-1);
    if (son && ACILIS[son]) {
      const acilan = v.split(ACILIS[son]).length - 1;
      const kapanan = v.split(son).length - 1;
      if (kapanan > acilan) v = v.slice(0, -1);
    }
    if (v === onceki) return v;
  }
}

/** "https://doi.org/10.1/abc", "doi: 10.1/abc", "(doi: 10.1/abc)", "10.1/abc." → "10.1/abc" (geçersizse null) */
export function normalizeDoi(input: string): string | null {
  let value = String(input ?? "").trim().replace(SARMALAYICI_BAS, "").trim();
  value = value.replace(DOI_ONEKI, "").replace(/^doi:\s*/i, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    // geçersiz kodlama: olduğu gibi denenir
  }
  value = dengesizKapanisAt(value.trim());
  return DOI_PATTERN.test(value) ? value : null;
}

/** Karşılaştırma anahtarı: DOI büyük/küçük harfe duyarsızdır. Geçersizse null. */
export function doiAnahtari(input: string | null | undefined): string | null {
  return input ? (normalizeDoi(input)?.toLowerCase() ?? null) : null;
}

/*
  Serbest metindeki DOI'ler (künye, yapıştırılan liste, doi_or_url alanı),
  sırasıyla ve büyük/küçük harfe duyarsız benzersiz. Yüzde kodlu adres
  ("https://doi.org/10.1000%2Fxyz") önce çözülür; her aday normalizeDoi'den
  geçer, yani metindeki DOI ile tek DOI girişi AYNI kuralla okunur.
*/
const METINDE_DOI = /10\.\d{4,9}\/(?:[^\s"'<>]|<[^\s"'<>]*>)+/g;
export function metindekiDoiler(metin: string | null | undefined): string[] {
  let kaynak = String(metin ?? "");
  kaynak = kaynak.replace(/10\.\d{4,9}%2F/gi, (m) => m.replace(/%2F/i, "/"));
  const sonuc: string[] = [];
  const gorulen = new Set<string>();
  for (const ham of kaynak.match(METINDE_DOI) ?? []) {
    const doi = normalizeDoi(ham);
    if (doi && !gorulen.has(doi.toLowerCase())) {
      gorulen.add(doi.toLowerCase());
      sonuc.push(doi);
    }
  }
  return sonuc;
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
    publicationPlace: clean(work["publisher-location"], 200),
  };
}
