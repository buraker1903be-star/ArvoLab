import type { ParsedReference } from "@/lib/apa7";
import { dogrulamaAnahtari } from "@/lib/kaynak-anahtari";

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

/** Benzerlik "kapsama" sayılsın diye kısa tarafta en az bu kadar ortak kelime aranır. */
const EN_AZ_ORTAK = 3;

function titleSimilarity(left: string, right: string): number {
  const a = new Set(normalizeText(left));
  const b = new Set(normalizeText(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;

  /*
    Payda KISA tarafa göre: künyede alt başlık yazılmamışsa eşleşme
    cezalandırılmamalı. Eskiden payda uzun taraftı ve DOĞRU yazılmış
    künyeler düşüyordu — Deci & Ryan (2000) tam bu yüzden "kayıt
    bulunamadı" çıkıyordu: dizindeki kayıt "…: Human Needs and the
    Self-Determination of Behavior" alt başlığını taşıyor, öğrencinin
    yazdığı kısa başlık 9 kelimeye bölününce 0,44'te kalıyordu.

    Kısa başlıkta tesadüf yüksek olduğu için kapsama yalnızca yeterince
    ortak kelime varken uygulanıyor; "İş Doyumu" gibi iki kelimelik bir
    başlık, içinde o kelimeler geçen her yayına tam puan almamalı.
  */
  const kucuk = Math.min(a.size, b.size);
  const payda = intersection >= EN_AZ_ORTAK ? kucuk : Math.max(a.size, b.size);
  return intersection / payda;
}

/** "Yılmaz, A." → "yılmaz" · "Ali Taş" → "taş" */
function soyad(ad: string): string {
  const temiz = ad.trim();
  const parca = temiz.includes(",") ? temiz.split(",")[0] : temiz.split(/\s+/).at(-1) ?? "";
  return parca.toLocaleLowerCase("tr-TR").replace(/[^\p{L}]/gu, "");
}

/**
 * Künyedeki ilk yazar, adaydaki yazarların hiçbirinde geçmiyor mu?
 *
 * İKİ TARAFTA DA yazar varsa karar verilir; biri boşsa "bilinmiyor"dur
 * ve uyuşmazlık sayılmaz.
 */
function yazarTutmuyor(reference: ParsedReference, adayYazarlar: string[]): boolean {
  const ilk = reference.authors?.[0];
  if (!ilk || !adayYazarlar.length) return false;
  const aranan = soyad(ilk);
  if (aranan.length < 2) return false;
  return !adayYazarlar.some((yazar) => soyad(yazar) === aranan);
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
  /*
    YAZAR BİR KAPI, ağırlık değil.

    Puanlama yalnızca başlık ve yıla bakıyordu; yazarlar hiç okunmuyordu.
    Sonuç, akademik denetim aracında olabilecek en kötü çıktıydı:
    "Yılmaz, A. (2020). Örgütsel bağlılık ve iş doyumu" künyesi, Ali Taş'ın
    2017 tarihli "İş doyumu ve örgütsel bağlılık" çalışmasıyla %82
    eşleşiyor (aynı kelimeler, ters sırada) ve ekranda DOĞRULANDI yazıyordu.
    Öğrenciye yanlış künyesinin teyit edildiği söyleniyordu.

    Ağırlık olarak eklemek eşiği oynatır ve doğru eşleşmeleri de düşürürdü.
    Kapı olarak: yazar tutmuyorsa "doğrulandı" denmiyor, "olası eşleşme"
    deniyor — bulduğumuz şey duruyor, kesinlik iddiası kalkıyor.
  */
  const yazarSupheli = bestMatch ? yazarTutmuyor(reference, bestMatch.authors) : false;
  const status = !bestMatch
    ? "not_found"
    : bestMatch.confidence >= 0.78 && !yazarSupheli
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

/** Önbelleğe konan/oradan okunan kısım; ham künye ve Scholar bağlantısı yerelde üretiliyor. */
export type OnbellekKaydi = Pick<ReferenceVerification, "status" | "bestMatch" | "matches">;

export interface DogrulamaOnbellegi {
  oku(anahtarlar: string[]): Promise<Map<string, OnbellekKaydi>>;
  yaz(girisler: { anahtar: string; kayit: OnbellekKaydi }[]): Promise<void>;
}

/** Künyeden, ağa gitmeden üretilebilen alanlar. */
function yerelAlanlar(reference: ParsedReference) {
  const scholarQuery = [reference.title, reference.authors?.[0], reference.year].filter(Boolean).join(" ");
  return {
    reference: reference.raw,
    googleScholarUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery || reference.raw)}`,
  };
}

/**
 * Kaynakçayı doğrular.
 *
 * `limit` AĞA GİDEN künye sayısını sınırlıyor, kaynakça uzunluğunu değil.
 * Önbellekten karşılanan künyeler sınırdan düşmüyor: eskiden ilk 25'in
 * ötesine hiç bakılamıyordu, artık her çalıştırma bakılmamış 25 künye
 * daha kapatıyor ve uzun kaynakça birkaç turda tamamlanıyor.
 *
 * Dönen dizi kaynakça SIRASINDA ve yalnızca bakılabilenleri içeriyor;
 * ekran "kalan N kaynağa bakılmadı" diye yazabilsin diye sayı çağıranda
 * hesaplanıyor (references.length ile farkı).
 */
export async function verifyAcademicReferences(
  references: ParsedReference[],
  limit = 25,
  onbellek?: DogrulamaOnbellegi,
): Promise<ReferenceVerification[]> {
  /*
    Yetersiz veri AĞA GİTMEDEN belli oluyor ve önbelleğe de girmiyor:
    yerel bir karar, saklamanın getirisi yok.
  */
  const yetersiz = (reference: ParsedReference) => !reference.title && reference.raw.length < 20;

  const anahtarlar = new Map<ParsedReference, string | null>(
    references.map((reference) => [reference, yetersiz(reference) ? null : dogrulamaAnahtari(reference)]),
  );

  let bilinen = new Map<string, OnbellekKaydi>();
  if (onbellek) {
    const aranacak = [...new Set([...anahtarlar.values()].filter((anahtar): anahtar is string => Boolean(anahtar)))];
    if (aranacak.length) {
      try {
        bilinen = await onbellek.oku(aranacak);
      } catch (sorun) {
        // Önbellek bir hızlandırma; okunamaması denetimi durdurmamalı.
        console.error("[dogrulama] önbellek okunamadı", sorun instanceof Error ? sorun.message : sorun);
      }
    }
  }

  const sonuclar: ReferenceVerification[] = [];
  const bakilacak: ParsedReference[] = [];

  for (const reference of references) {
    if (yetersiz(reference)) {
      sonuclar.push({ ...yerelAlanlar(reference), status: "insufficient_data", bestMatch: null, matches: [] });
      continue;
    }
    const anahtar = anahtarlar.get(reference) ?? null;
    const kayit = anahtar ? bilinen.get(anahtar) : undefined;
    if (kayit) {
      sonuclar.push({ ...yerelAlanlar(reference), ...kayit });
      continue;
    }
    // Sınır YALNIZCA bakılmamışlara harcanıyor.
    if (bakilacak.length < limit) bakilacak.push(reference);
  }

  const yeni: { anahtar: string; kayit: OnbellekKaydi }[] = [];
  for (let index = 0; index < bakilacak.length; index += 4) {
    const parti = await Promise.all(bakilacak.slice(index, index + 4).map(verifyReference));
    for (const sonuc of parti) {
      sonuclar.push(sonuc);
      const reference = bakilacak.find((aday) => aday.raw === sonuc.reference);
      const anahtar = reference ? anahtarlar.get(reference) ?? null : null;
      if (anahtar && sonuc.status !== "insufficient_data") {
        yeni.push({ anahtar, kayit: { status: sonuc.status, bestMatch: sonuc.bestMatch, matches: sonuc.matches } });
      }
    }
  }

  if (onbellek && yeni.length) {
    try {
      await onbellek.yaz(yeni);
    } catch (sorun) {
      console.error("[dogrulama] önbellek yazılamadı", sorun instanceof Error ? sorun.message : sorun);
    }
  }

  // Kaynakça sırası korunuyor: ekran künyeleri sırayla listeliyor.
  const sira = new Map(references.map((reference, index) => [reference.raw, index]));
  return sonuclar.sort((a, b) => (sira.get(a.reference) ?? 0) - (sira.get(b.reference) ?? 0));
}
