import type { ParsedReference } from "@/lib/apa7";
import { dogrulamaAnahtari, doiKimligi, kunyeDoisi, soyadKimligi } from "@/lib/kaynak-anahtari";

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

/*
  "ulasilamadi" bir HÜKÜM DEĞİL (12.11.2026): dizinlerden en az birine
  ulaşılamadı ve cevap veren dizin de olumlu kanıt getirmedi. Eskiden bu
  durum "not_found" yazılıyordu: iki dizin de zaman aşımına uğradığında
  ya da 429 döndüğünde doğru yazılmış künye "Kayıt bulunamadı" diye
  kırmızı görünüyor, 7 gün önbellekte kalıyor ve PDF araması onu
  "künye kontrol edilmeli" diye işaretliyordu. "Doğrulanamadı" kalıcı
  bir hükümdür, geçici arızaya verilmez (lib/kanit/dizin.ts aynı kuralı
  kanıt matrisinde uyguluyor).
*/
export type DogrulamaDurumu = "verified" | "possible_match" | "not_found" | "insufficient_data" | "ulasilamadi";

export interface ReferenceVerification {
  reference: string;
  status: DogrulamaDurumu;
  googleScholarUrl: string;
  bestMatch: AcademicMatch | null;
  matches: AcademicMatch[];
  /** Künyede yazılı DOI (kimlik biçiminde); yoksa null. Önbelleğe girmez, künyeden yerelde üretilir. */
  istenenDoi?: string | null;
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

const soyad = soyadKimligi;

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

/*
  KİMLİK SORGUSU (RC06k). Künye DOI taşıyorsa eser o DOI'dir; başlık araması
  aynı başlıklı BAŞKA bir eseri de getirebilir. DOI doğrudan sorulur ve dönen
  kaydın DOI'si istenenle kimlik biçiminde karşılaştırılır; tutmuyorsa kayıt
  yok sayılır. 404 "dizinde yok" demektir (boş liste); başka her hata düşen
  dizin sayılır, sessizce "yok" sayılmaz.
*/
async function crossrefDoiSorgusu(reference: ParsedReference, istenen: string): Promise<AcademicMatch[]> {
  const url = `https://api.crossref.org/works/${istenen.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ArvoLab/1.0 (academic-reference-verification)" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const item = ((await response.json()) as { message?: Record<string, unknown> }).message;
  if (!item || doiKimligi(typeof item.DOI === "string" ? item.DOI : null) !== istenen) return [];
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
  return [{
    provider: "crossref",
    title,
    year,
    doi,
    authors,
    venue: Array.isArray(item["container-title"]) && typeof item["container-title"][0] === "string" ? item["container-title"][0] : null,
    url: `https://doi.org/${doi}`,
    citedByCount: typeof item["is-referenced-by-count"] === "number" ? item["is-referenced-by-count"] : null,
    confidence: scoreCandidate(reference, title, year),
  }];
}

const ayniEser = (match: AcademicMatch, istenen: string | null) => Boolean(istenen) && doiKimligi(match.doi) === istenen;

type EslesmeHukmu = "verified" | "possible_match" | "not_found";

/*
  BİR KÜNYE İLE BİR ESER ARASINDAKİ HÜKÜM, tek yerde. Hem dizinden yeni
  gelen sonuçta hem ÖNBELLEKTEN okunan kayıtta aynı fonksiyon çalışır
  (PR #105 incelemesi): önbellek "dizinde ne var" bilgisini taşır, "bu
  künye doğrulandı" hükmünü değil. Eskiden saklanan hüküm, aynı kutuya
  düşen başka bir künyeye (başka yazar, aynı DOI ama çelişkili başlık)
  olduğu gibi veriliyordu.

  - İstenen DOI'nin eseri dizinde VARSA hüküm "bulunamadı" olamaz; künye
    onunla çelişiyorsa (başlık/yazar) "olası eşleşme"dir. Böylece aynı DOI
    kutusuna yazılan kayıt, künyeden bağımsız bir dizin bilgisi kalır.
  - Yazar tutmuyorsa ya da eser başka DOI'nin ise "doğrulandı" denmez.
*/
/*
  DOI'SİZ EŞLEŞMEDE "DOĞRULANDI" İÇİN OLUMLU KANIT (RC06l, 17.11.2026).
  Gerçek dizin kabulünde iki farklı yazarın 2021 tarihli "Guest editorial"
  künyesi, Journal of Forestry'nin 1972 tarihli YAZARSIZ "Guest
  Editorial"ına doğrulandı: birebir aynı başlık tek başına 0,82 puan
  veriyor (eşik 0,78) ve yazar kapısı yazarsız adayı "bilinmiyor" sayıp
  geçiriyordu. Puan EKSİK yılı da yarım puanla ödüllendiriyor (0,5).
  Kimliği DOI kurmuyorsa başlık benzerliği yetmez; künyede yazılı olan
  her bilgi adayda da bulunmalı ve tutmalı:
    - künyede yıl varsa adayda da olmalı ve fark en çok 1 olmalı
      (baskı/çevrim içi yıl farkı);
    - künyede yazar varsa adayda yazar olmalı ve ilk yazarın soyadı
      geçmeli;
    - künyede ikisi de yoksa başlık tek başına doğrulamaz.
  Eksik bilgi olumlu kanıt sayılmaz; aday puanı yetiyorsa "olası eşleşme"
  olarak kalır (gösterilir, kesin sayılmaz, PDF satırına DOI geçmez).
*/
function doisizKanitVar(reference: ParsedReference, eser: AcademicMatch): boolean {
  const kunyeYili = Number.parseInt(reference.year?.match(/\d{4}/)?.[0] ?? "", 10);
  const yilYazili = Number.isFinite(kunyeYili);
  if (yilYazili && (eser.year === null || Math.abs(eser.year - kunyeYili) > 1)) return false;
  const ilk = reference.authors?.[0];
  const aranan = ilk ? soyad(ilk) : "";
  const yazarYazili = aranan.length >= 2;
  if (yazarYazili && !eser.authors.some((yazar) => soyad(yazar) === aranan)) return false;
  return yilYazili || yazarYazili;
}

function eslesmeHukmu(reference: ParsedReference, eser: AcademicMatch, istenenDoi: string | null): EslesmeHukmu {
  const kimlikTutmuyor = Boolean(istenenDoi) && !ayniEser(eser, istenenDoi);
  // DOI kimliği kurulduysa (künyenin DOI'sinin eseri) eski kural; değilse olumlu kanıt şart.
  const kanit = istenenDoi && !kimlikTutmuyor ? !yazarTutmuyor(reference, eser.authors) : doisizKanitVar(reference, eser);
  if (eser.confidence >= 0.78 && kanit && !kimlikTutmuyor) return "verified";
  if (istenenDoi && !kimlikTutmuyor) return "possible_match";
  return eser.confidence >= 0.55 ? "possible_match" : "not_found";
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

/*
  "kismi": dizinlerden biri cevap vermedi. Sonuç ekranda doğru (olumlu
  kanıt geçerli) ama önbelleğe olası eşleşme olarak 30 gün yazılmamalı:
  susan dizin daha güçlü, yazarı tutan bir kayıt getirebilirdi ve önbellek
  BÜTÜN kullanıcılar için ortak (bağımsız inceleme, 12.11.2026).
*/
type DizinSonucu = { sonuc: ReferenceVerification; kismi: boolean };

async function verifyReference(reference: ParsedReference): Promise<DizinSonucu> {
  const scholarQuery = [reference.title, reference.authors?.[0], reference.year].filter(Boolean).join(" ");
  const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery || reference.raw)}`;

  if (!reference.title && reference.raw.length < 20) {
    return { sonuc: { reference: reference.raw, status: "insufficient_data", googleScholarUrl, bestMatch: null, matches: [] }, kismi: false };
  }

  const istenenDoi = kunyeDoisi(reference.raw);
  const settled = await Promise.allSettled([
    searchCrossref(reference),
    searchOpenAlex(reference),
    ...(istenenDoi ? [crossrefDoiSorgusu(reference, istenenDoi)] : []),
  ]);
  /*
    Düşen dizin SAYILIYOR. Eskiden reddedilen istek sessizce boş liste
    sayılıyordu: "cevap vermedi" ile "cevap verdi, kayıt yok" ayırt
    edilmiyordu.
  */
  const dusenDizin = settled.filter((result) => result.status === "rejected").length;
  if (dusenDizin) {
    const nedenler = settled.flatMap((result) =>
      result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : [],
    );
    console.error("[dogrulama] dizine ulaşılamadı:", nedenler.join(" · "));
  }
  const matches = settled
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .sort((a, b) => b.confidence - a.confidence);

  const deduplicated = matches.filter((match, index) =>
    index === matches.findIndex((candidate) =>
      match.doi && candidate.doi
        ? doiKimligi(match.doi) === doiKimligi(candidate.doi)
        : match.provider === candidate.provider && match.title === candidate.title
    )
  );
  /*
    Künye DOI taşıyorsa en iyi eşleşme YALNIZCA o DOI'nin eseri olabilir.
    Eskiden en yüksek başlık puanlı aday seçiliyordu: aynı başlık/yıldaki
    başka bir eser (başka DOI) "doğrulandı" diye dönüyordu. O DOI dizinde
    yoksa başka DOI'li aday ancak "olası eşleşme" olabilir (aşağıda).
  */
  const kimlikEslesen = istenenDoi ? deduplicated.find((match) => ayniEser(match, istenenDoi)) ?? null : null;
  /*
    DOI'siz künyede güçlü adaylar arasında YAZARI TUTAN seçilir. Eskiden
    sıralamada ilk gelen (puan yalnızca başlık+yıl) seçiliyordu: aynı
    başlık/yıldaki iki eserden yanlış olanı "en iyi" olup yazar kapısına
    takılıyor, doğru eser hiç değerlendirilmiyordu.
  */
  // Doğrulanabilecek ilk aday (aynı kural: eslesmeHukmu); yoksa en yüksek puanlı aday "olası eşleşme" olur.
  const yazariTutan = deduplicated.find((match) => eslesmeHukmu(reference, match, null) === "verified") ?? null;
  const bestMatch = istenenDoi ? kimlikEslesen ?? deduplicated[0] ?? null : yazariTutan ?? deduplicated[0] ?? null;
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
  const eslesmeDurumu = bestMatch ? eslesmeHukmu(reference, bestMatch, istenenDoi) : "not_found";
  /*
    Olumlu kanıt, bir dizin düşmüş olsa da geçerli: cevap veren dizinin
    bulduğu kayıt gerçek. "Bulunamadı" ise ancak İKİ dizin de cevap
    verdiyse söylenebilir; biri sustuysa kaydın orada olup olmadığı
    bilinmiyor.
  */
  const status: DogrulamaDurumu = eslesmeDurumu === "not_found" && dusenDizin > 0 ? "ulasilamadi" : eslesmeDurumu;

  return {
    sonuc: {
      reference: reference.raw,
      status,
      googleScholarUrl,
      bestMatch: status === "not_found" || status === "ulasilamadi" ? null : bestMatch,
      // Hüküm yokken aday listesi de taşınmaz; bestMatch null iken liste dolu olmamalı.
      matches: status === "ulasilamadi" ? [] : deduplicated.filter((match) => match.confidence >= 0.5).slice(0, 4),
      istenenDoi,
    },
    kismi: dusenDizin > 0,
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
    istenenDoi: kunyeDoisi(reference.raw),
  };
}

/*
  Önbellek kaydı bu künyeye ait mi? DOI'li künyede kaydın en iyi eşleşmesi
  aynı DOI'yi taşımalı. Anahtar zaten DOI'den üretiliyor; bu ikinci kapı,
  anahtar biçimi bir gün yine değişirse ya da satır elle bozulursa yanlış
  eserin sessizce dönmesini engelliyor.
*/
function kayitKunyeyeAit(kayit: OnbellekKaydi, istenen: string | null): boolean {
  if (!istenen || !kayit.bestMatch) return true;
  return doiKimligi(kayit.bestMatch.doi) === istenen;
}

/*
  SICAK OKUMA (PR #105 incelemesi). Kayıttaki eser bu künyeye karşı yeniden
  puanlanır ve hüküm eslesmeHukmu'yle YENİDEN verilir; saklanan hüküm
  aynen taşınmaz. null = kayıt kullanılmaz, dizine yeniden sorulur:
    - DOI'li künyede kayıt başka DOI'nin eseri;
    - kayıt "doğrulandı" diyor ama bu künye için öyle değil. Burada
      "olası eşleşme"ye indirip göstermek yerine yeniden sormak bilinçli:
      aynı başlıktaki DOĞRU eser dizinde olabilir (başka yazar), yeni
      sorgu onu bulur.
  Kayıtta eser yoksa ("bulunamadı") hüküm künyeye bağlı değildir, aynen kalır.
*/
function sicakHukum(kayit: OnbellekKaydi, reference: ParsedReference): OnbellekKaydi | null {
  const istenen = kunyeDoisi(reference.raw);
  if (!kayitKunyeyeAit(kayit, istenen)) return null;
  if (!kayit.bestMatch) return kayit.status === "not_found" ? kayit : null;
  const eser = { ...kayit.bestMatch, confidence: scoreCandidate(reference, kayit.bestMatch.title, kayit.bestMatch.year) };
  const hukum = eslesmeHukmu(reference, eser, istenen);
  if (kayit.status === "verified" && hukum !== "verified") return null;
  return { status: hukum, bestMatch: hukum === "not_found" ? null : eser, matches: kayit.matches };
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
  const gecersizKayit = new Set<string>();

  for (const reference of references) {
    if (yetersiz(reference)) {
      sonuclar.push({ ...yerelAlanlar(reference), status: "insufficient_data", bestMatch: null, matches: [] });
      continue;
    }
    const anahtar = anahtarlar.get(reference) ?? null;
    const kayit = anahtar ? bilinen.get(anahtar) : undefined;
    const sicak = kayit ? sicakHukum(kayit, reference) : null;
    if (sicak) {
      sonuclar.push({ ...yerelAlanlar(reference), ...sicak });
      continue;
    }
    // Kayıt vardı ama bu künye için geçersiz (ör. eski kuralla yazılmış yanlış "verified"): yenisi üstüne yazılacak.
    if (anahtar && kayit) gecersizKayit.add(anahtar);
    // Sınır YALNIZCA bakılmamışlara harcanıyor.
    if (bakilacak.length < limit) bakilacak.push(reference);
  }

  /*
    ANAHTAR BAŞINA TEK KAYIT. İki künye aynı anahtara düşebiliyor: anahtar
    normalleştirilmiş "başlık kelimeleri|yıl" olduğu için aynı yazının iki
    kez yazılması ya da aynı sayıda ardışık sayfalara oturan iki yazı
    ("…12(3), 1-20." ve "…12(3), 21-40.") aynı kutuya girer.

    Önbellek yazımı tek bir "insert … on conflict" ifadesi; aynı anahtarın
    iki kez gelmesi Postgres'te 21000 (ON CONFLICT DO UPDATE command cannot
    affect row a second time) hatası verir. Hata yutuluyordu (yazma bir
    hızlandırma, akışı durdurmamalı), yani O ÇALIŞTIRMANIN TÜM önbellek
    yazımı sessizce kayboluyordu — hem de önbelleğin en çok işe yarayacağı
    durumda, yinelenen künyesi olan kaynakçada.

    Map ile son sonuç kazanıyor; ikisi de aynı dizinden geldiği için
    hangisinin kaldığı sonucu değiştirmiyor.
  */
  const yeni = new Map<string, OnbellekKaydi>();
  for (let index = 0; index < bakilacak.length; index += 4) {
    // Dilim elde tutuluyor: sonuç ile künyeyi ham metinden eşleştirmek
    // yinelenen künyede yanlış eşleşme demekti (aynı raw, iki ayrı kayıt).
    const dilim = bakilacak.slice(index, index + 4);
    const parti = await Promise.all(dilim.map(verifyReference));
    parti.forEach(({ sonuc, kismi }, sira) => {
      sonuclar.push(sonuc);
      const anahtar = anahtarlar.get(dilim[sira]) ?? null;
      /*
        "ulasilamadi" önbelleğe GİRMEZ: geçici bir arızayı saklamak, bir
        sonraki denetimde dizine hiç sorulmaması demekti. Tablo kısıtı da
        bu değeri kabul etmiyor (migration 20260924100021); süre tablosunda
        0 olması (lib/dogrulama-onbellegi.ts) ikinci bir güvence.
      */
      /* Kısmi cevapta yalnızca "verified" saklanır (yazarı da tutan güçlü
         eşleşme); olası eşleşme bir sonraki denetimde yeniden sorulur. */
      /* İstenen DOI'nin eseri değilse YAZILMAZ: ortak önbelleğe başka bir
         eserin kaydı DOI anahtarıyla girmesin (bir sonraki denetimde yine sorulur). */
      /* Sıcak okumada geçersiz bulunan kayıt (RC06l: eski kuralla yazılmış
         yanlış "verified") kısmi sonuçla da DEĞİŞTİRİLİR: aksi hâlde yanlış
         satır 90 gün kalır ve her denetim dizine yeniden gider. Yeni hüküm
         en çok "olası eşleşme" olabileceği için bu kesinlik iddiasını artırmaz. */
      const saklanir =
        sonuc.status !== "insufficient_data" &&
        sonuc.status !== "ulasilamadi" &&
        (!kismi || sonuc.status === "verified" || (anahtar !== null && gecersizKayit.has(anahtar))) &&
        kayitKunyeyeAit(sonuc, sonuc.istenenDoi ?? null);
      if (anahtar && saklanir) {
        yeni.set(anahtar, { status: sonuc.status, bestMatch: sonuc.bestMatch, matches: sonuc.matches });
      }
    });
  }

  if (onbellek && yeni.size) {
    try {
      await onbellek.yaz([...yeni].map(([anahtar, kayit]) => ({ anahtar, kayit })));
    } catch (sorun) {
      console.error("[dogrulama] önbellek yazılamadı", sorun instanceof Error ? sorun.message : sorun);
    }
  }

  // Kaynakça sırası korunuyor: ekran künyeleri sırayla listeliyor.
  const sira = new Map(references.map((reference, index) => [reference.raw, index]));
  return sonuclar.sort((a, b) => (sira.get(a.reference) ?? 0) - (sira.get(b.reference) ?? 0));
}

/*
  PDF satırına (ve kaynak eşleşmesine) yazılacak DOI. Eskiden en iyi eşleşmenin
  DOI'si koşulsuz yazılıyordu: künyenin DOI'si Y iken aynı başlıklı X'in DOI'si
  satıra geçiyor, "kesin eşleşme" yanlış esere kuruluyordu. Künye DOI taşıyorsa
  yalnızca o DOI'nin eseri bulunduğunda yazılır; DOI'siz künyede yalnızca
  "doğrulandı" hükmünde — olası eşleşme kesin eşleşme sayılmaz.
*/
export function pdfSatirinaDoi(sonuc: Pick<ReferenceVerification, "status" | "bestMatch" | "istenenDoi"> | null | undefined): string | null {
  if (!sonuc?.bestMatch?.doi) return null;
  const bulunan = doiKimligi(sonuc.bestMatch.doi);
  if (sonuc.istenenDoi) return bulunan === sonuc.istenenDoi ? sonuc.bestMatch.doi : null;
  return sonuc.status === "verified" ? sonuc.bestMatch.doi : null;
}
