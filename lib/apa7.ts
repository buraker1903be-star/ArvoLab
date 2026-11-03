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

import type { Dil } from "@/lib/dil";
import { splitAuthors } from "@/lib/citation-format";

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
  /** "Engle–Granger (1987)": yazarlar tireyle bağlanmış (APA: "ve"/"&"); iki ad */
  tire?: [string, string];
  /** Anlatı atfında listedeki öteki adlar: ilk sözcük cümle başıysa gerçek yazar kaçmasın */
  digerAdaylar?: string[];
}

export interface CrossCheckResult {
  citationsWithoutReference: InTextCitation[];
  referencesWithoutCitation: ParsedReference[];
  /** Eşleşti ama yazarlar tireyle bağlanmış: "Engle–Granger (1987)" (03.11.2026) */
  tireliAtiflar?: { atif: InTextCitation; kaynak: ParsedReference }[];
  /** Metinde yazarlarıyla anılmış ama yılsız: "Granger ve Newbold'un …" (03.11.2026) */
  yilsizAnilanlar?: { ifade: string; kaynak: ParsedReference }[];
}

// --- Kaynakça girdisi ayrıştırma -------------------------------------------

// Tarihsiz kaynak: APA'da "n.d.", Türkçe kaynaklarda "t.y."
const YEAR_RE = /\((\d{4}[a-z]?|n\.d\.|t\.y\.)\)/;

export function parseReferenceEntry(raw: string, dil: Dil = "tr"): ParsedReference {
  const en = dil === "en";
  const issues: ReferenceIssue[] = [];
  const trimmed = raw.trim();

  const yearMatch = trimmed.match(YEAR_RE);
  if (!yearMatch) {
    issues.push({
      field: "year",
      message: en ? "Year in parentheses not found, e.g., (2023)." : "Yıl parantez içinde bulunamadı, örn: (2023).",
      severity: "error",
    });
  }
  const year = yearMatch ? yearMatch[1] : null;

  /*
    Yazar kısmı: yıl parantezinden önceki bölüm. Sondaki NOKTA SİLİNMEZ.
    Eskiden siliniyordu, ama doğrulama regex'i o noktanın bulunmasını şart
    koşuyordu: "Bandura, A. (1977)" gibi kusursuz künyeler dahil listedeki
    HER kayıt "yazar formatı APA7'ye uymuyor" uyarısı alıyordu (20.09.2026).
    Böyle bir uyarı kullanıcıya hiçbir şey öğretmez, yalnızca bütün
    uyarıları görmezden gelmeyi öğretir.
  */
  const authorSegment = yearMatch ? trimmed.slice(0, yearMatch.index).trim() : null;

  let authors: string[] | null = null;
  if (authorSegment) {
    // "Soyad, A. B., & Soyad, C." biçimini kaba şekilde ayrıştır
    // Türkçe kaynakçada ayırıcı "&" değil "ve"dir; eskiden ayrılmadığı için
    // "Kaya, M. ve Öz, S." tek yazar sanılıp biçim hatası sayılıyordu.
    // İngilizce "and" (APA "&" ister ama yaygın bir yazım) yalnızca bir baş
    // harf noktasından sonra ayırır: "Department of Health and Human
    // Services" gibi kurum adları bölünüp biçim hatası almasın (28.10.2026).
    authors = authorSegment
      .split(/,\s*&\s*|\s+ve\s+(?=[A-ZÇĞİÖŞÜ])|(?<=\.),?\s+and\s+(?=[A-ZÇĞİÖŞÜ])|,\s*(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]+,)/)
      .map((a) => a.trim())
      .filter(Boolean);

    authors.forEach((a) => {
      // Üç baş harf de olabilir (ör. "Deci, E. L. M."); her birinin ardından
      // nokta aranır — eksik nokta gerçek bir APA hatasıdır.
      if (!/^[A-ZÇĞİÖŞÜ][\p{L}'\-]+,(\s*[A-ZÇĞİÖŞÜ]\.){1,3}$/u.test(a)) {
        issues.push({
          field: "author_format",
          message: en
            ? `Author format may not follow APA 7: "${a}" (expected: "Surname, A.")`
            : `Yazar formatı APA7'ye uymuyor olabilir: "${a}" (beklenen: "Soyad, A.")`,
          severity: "warning",
        });
      }
    });
  } else {
    issues.push({
      field: "author",
      message: en ? "Author name could not be parsed." : "Yazar adı ayrıştırılamadı.",
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
        message: en ? "Title not found or punctuation is incorrect." : "Başlık bulunamadı ya da noktalama hatalı.",
        severity: "warning",
      });
    }
  }

  // DOI/URL kontrolü (varsa format kontrolü)
  const doiMatch = trimmed.match(/https?:\/\/doi\.org\/\S+|doi:\s*\S+/i);
  if (!doiMatch && /journal|dergi/i.test(trimmed)) {
    issues.push({
      field: "doi",
      message: en
        ? "No DOI/URL found for the journal article (add one if available)."
        : "Dergi makalesi için DOI/URL bulunamadı (varsa eklenmeli).",
      severity: "warning",
    });
  }

  return { raw: trimmed, authors, year, title, issues };
}

export function parseReferenceList(rawList: string, dil: Dil = "tr"): ParsedReference[] {
  // Boş satırlarla ayrılmış veya her satır bir kaynak kabul edilir
  const entries = rawList
    .split(/\n{1,2}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  return entries.map((girdi) => parseReferenceEntry(girdi, dil));
}

// Chicago yazar-tarih kaynakçası: "Yılmaz, A. 2020. "Başlık." Dergi 12 (3): 1-20." — yıl parantezsiz,
// yazardan sonra gelir. Yalnızca atıf eşleştirmesi için yazar ve yıl ayrıştırılır.
// "t.y." / "n.d." noktayı kendi içinde taşır: ardından ikinci nokta gelmeyebilir.
const CHICAGO_REFERENCE_RE = /^(.+?)\.\s+(\d{4}[a-z]?|n\.d\.|t\.y\.)\.?(?=\s|$)/u;

export function parseChicagoReference(raw: string): ParsedReference {
  const trimmed = raw.trim();
  const match = CHICAGO_REFERENCE_RE.exec(trimmed);
  const authors = match ? splitAuthors(match[1]) : [];
  return { raw: trimmed, authors: authors.length ? authors : null, year: match ? match[2] : null, title: null, issues: [] };
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
// Büyük/küçük harf duyarsız bayrak kullanılmaz: /i ile \p{Lu} küçük harfle başlayan ifadeleri de
// ("(ortalama, 2020)") yazar sayardı. Önekler her iki yazımla ayrıca verilir.
const PREFIX = "(?:(?:[Bb]kz\\.|[Bb]k\\.|[Öö]rn\\.|[Öö]rneğin|[Aa]yrıca|[Ss]ee|e\\.g\\.,?|cf\\.)\\s+)?";
const CITATION_PART_RE = new RegExp(`^${PREFIX}(\\p{Lu}.*?),\\s*(${YEARS})${PAGE}$`, "u");
// Chicago yazar-tarih: "(Yılmaz 2020)", "(Yılmaz ve Demir 2019, 15)" — virgül isteğe bağlı.
const CHICAGO_PART_RE = new RegExp(
  `^${PREFIX}(\\p{Lu}.*?),?\\s+(${YEARS})(?:\\s*,\\s*(?:(?:s|ss|sf|p|pp)\\.?\\s*)?[\\d–-]+)?$`,
  "u"
);
/*
  MLA: "(Yılmaz 45)", "(Yılmaz ve Demir 45-47)" — YIL YOK, sayfa var.
  Yazar bölümü serbest bırakılmadı (`.*?` değil, ad deseni): MLA'da her
  parantezin sonunda sayı olabilir ("(Şekil 3)", "(Grup 2)") ve serbest
  desen bunların hepsini atıf sayardı. Ad deseni + aşağıdaki liste,
  yanlış alarmı makul düzeyde tutuyor.
*/
const MLA_PART_RE = new RegExp(
  `^${PREFIX}(${NAME}(?:\\s+${NAME}){0,3}?(?:\\s+(?:ve|&|and)\\s+${NAME}|\\s+${ET_AL})?),?\\s+(\\d{1,4}(?:\\s*[–-]\\s*\\d{1,4})?)$`,
  "u"
);
const MLA_NARRATIVE_RE = new RegExp(
  `(${NAME}(?:\\s+${NAME}){0,4}?(?:\\s+(?:ve|&|and)\\s+${NAME}|\\s+${ET_AL})?)\\s*\\((\\d{1,4}(?:\\s*[–-]\\s*\\d{1,4})?)\\)`,
  "gu"
);
// "(Haziran 2020)", "(Bahar, 2021)" gibi tarih ifadeleri atıf değildir.
const NOT_AUTHORS = new Set([
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "ilkbahar", "bahar", "yaz", "sonbahar", "güz", "kış", "spring", "summer", "fall", "autumn", "winter",
]);
/*
  MLA'da atıfta yıl olmadığı için "ad + sayı" kalıbı çok yaygın başka
  ifadelere de uyuyor. Bunlar atıf değildir; yazılmazsa öğrenci her
  "(Tablo 3)" için "kaynakçada yok" uyarısı alır ve uyarılara güvenmeyi
  bırakır.
*/
const MLA_NOT_AUTHORS = new Set([
  "tablo", "şekil", "şema", "grafik", "resim", "ek", "bölüm", "madde", "sayfa", "satır", "adım", "grup", "soru",
  "table", "figure", "fig", "chart", "chapter", "section", "page", "line", "step", "group", "item", "no", "vol", "cilt", "sayı",
]);
/*
  ANLATI ATFI (03.11.2026'da genişletildi). Eskiden "ve"den sonra TEK ad
  kabul ediliyordu ve virgüllü yazar listesi hiç tanınmıyordu:
  "Buyrukoğlu ve Altunakar Mercan (2022)" yalnızca "Altunakar Mercan",
  "Staiger, Stock ve Watson (1997)" yalnızca "Stock ve Watson" olarak
  yakalanıyor, ilk yazar kaçtığı için kaynak "metinde anılmıyor"
  sayılıyordu. Şimdi her yazar en çok üç sözcük, aralarında virgül ve
  son bağlaç ("ve", "ile", "&", "and"); tireyle bağlı ad çifti
  ("Engle–Granger") ayrıca ele alınır (aşağıda).
*/
const AD_GRUBU = `${NAME}(?:\\s+${NAME}){0,2}`;
/* Dışlama listeleri anahtarla AYNI sadeleştirmeden geçer ("şekil" → "sekil"); yoksa aksan atılınca eşleşmezdi. */
const sade = (liste: Set<string>) => new Set([...liste].map((ad) => ad.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}+/gu, "")));
const NOT_AUTHORS_SADE = sade(NOT_AUTHORS);
const MLA_NOT_AUTHORS_SADE = sade(MLA_NOT_AUTHORS);
const NARRATIVE_RE = new RegExp(
  `(${AD_GRUBU}(?:\\s*,\\s*${AD_GRUBU})*(?:\\s*,?\\s+(?:ve|ile|&|and)\\s+${AD_GRUBU}|\\s+${ET_AL})?)\\s*\\((${YEARS})${PAGE}\\)`,
  "gu"
);
/* Tireyle bağlı iki yazar: "Engle–Granger (1987)", "Zivot-Andrews (1992)". */
const TIRELI_RE = new RegExp(`(?<![\\p{L}])(\\p{Lu}[\\p{L}'’]+)\\s*[–—-]\\s*(\\p{Lu}[\\p{L}'’]+)\\s*\\((${YEARS})${PAGE}\\)`, "gu");

/*
  Aksanlar eşleşmede yok sayılır (03.11.2026): kaynakçada "Galí", metinde
  "Gali" yazılabiliyor. Türkçe harfler de aynı yoldan sadeleşir (ş → s);
  iki taraf aynı işlemden geçtiği için ayrım kaybı eşleşmeyi bozmaz.
*/
const normalizeName = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[.,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
/*
  Kesme işaretinden sonraki Türkçe ek atılır: "Kuştepeli'nin (2005)",
  "Solow'un (1960)", "Önder'in". Yalnızca bilinen ekler: "O'Brien" gibi
  adlar bozulmasın.
*/
const IYELIK_EKI = /['’](?:n?[ıiuü]n|y?[ıiuü]|y?[ea]|[dt][ea](?:n|ki)?|y?l[ea]|l[ea]r)$/iu;
const ekiAt = (ad: string) => ad.replace(IYELIK_EKI, "");
const normalizeYear = (year: string | null) => (year ? year.toLowerCase().replace("n.d.", "t.y.") : null);

/*
  Yazar anahtarı önbelleği.

  normalizeName Türkçe küçük harfe çeviriyor (toLocaleLowerCase("tr-TR"))
  ve bu çağrı pahalı: 200 sayfalık bir tezdeki 12.800 atıf için tek
  başına 62 ms sürüyordu — canlı denetimin en büyük tek kalemi. Oysa bir
  tezde yüz kadar farklı yazar adı yüzlerce kez geçiyor; aynı dizge her
  seferinde yeniden çevriliyordu.

  Saf fonksiyon olduğu için önbelleklenebilir. Sınır, uzun oturumlarda
  belleğin sessizce büyümemesi için: aşılınca önbellek boşaltılıyor,
  doğruluk değişmiyor.
*/
const ET_AL_SONU = new RegExp(`\\s+${ET_AL}\\s*$`, "iu");
// Virgül de ayırır: "(Staiger, Stock ve Watson, 1997)"un ilk yazarı "Staiger".
const AYIRICI = /\s*,\s*|\s+(?:ve|ile|and)\s+|\s*&\s*/u;
const ANAHTAR_SINIRI = 5000;
const anahtarOnbellegi = new Map<string, string>();

/** "Demir & Kaya" → "demir", "Arslan vd." → "arslan", "Türkiye İstatistik Kurumu" → aynen */
function authorKey(author: string): string {
  const onbellekli = anahtarOnbellegi.get(author);
  if (onbellekli !== undefined) return onbellekli;
  const first = author.replace(ET_AL_SONU, "").split(AYIRICI)[0];
  const anahtar = normalizeName(ekiAt(first.trim()));
  if (anahtarOnbellegi.size >= ANAHTAR_SINIRI) anahtarOnbellegi.clear();
  anahtarOnbellegi.set(author, anahtar);
  return anahtar;
}

export function extractInTextCitations(
  bodyText: string,
  options: { style?: "apa7" | "chicago" | "mla" } = {}
): InTextCitation[] {
  const results: InTextCitation[] = [];
  /*
    MLA'da ikinci grup YIL değil SAYFA'dır. Sayfayı yıl gibi kaydetmek
    çapraz kontrolü bozardı (kaynağın yılı 2020, atıfta 45 yazar, hiçbiri
    eşleşmez); bu yüzden MLA'da yıl null bırakılıyor ve eşleştirme yalnızca
    yazara bakıyor — crossCheck({ yilaBak: false }).
  */
  const mla = options.style === "mla";
  const partRe = mla ? MLA_PART_RE : options.style === "chicago" ? CHICAGO_PART_RE : CITATION_PART_RE;
  const narrativeRe = mla ? MLA_NARRATIVE_RE : NARRATIVE_RE;
  const atifDisi = (key: string) => NOT_AUTHORS_SADE.has(key) || (mla && MLA_NOT_AUTHORS_SADE.has(key));

  for (const group of bodyText.matchAll(PAREN_GROUP_RE)) {
    for (const part of group[1].split(";")) {
      const match = partRe.exec(part.trim());
      // İçinde rakam geçen "yazar" (Tablo 3, COVID-19) atıf sayılmaz
      if (!match || /\d/.test(match[1])) continue;
      const key = authorKey(match[1]);
      if (!key || atifDisi(key)) continue;
      if (mla) {
        results.push({ raw: group[0], authorKey: key, year: null, position: group.index ?? 0, kind: "parenthetical" });
        continue;
      }
      for (const year of match[2].split(",")) {
        results.push({ raw: group[0], authorKey: key, year: year.trim(), position: group.index ?? 0, kind: "parenthetical" });
      }
    }
  }

  for (const match of bodyText.matchAll(narrativeRe)) {
    const key = authorKey(match[1]);
    if (!key || atifDisi(key)) continue;
    if (mla) {
      results.push({ raw: match[0], authorKey: key, year: null, position: match.index ?? 0, kind: "narrative" });
      continue;
    }
    /*
      Anlatı atfı yalnızca kaynağı "anılmış" yapar, karşılıksız diye
      raporlanmaz; bu yüzden listedeki öteki adlar da aday olarak
      taşınır (digerAdaylar). Cümle başındaki sözcük ilk yazar sanılsa bile ("Türkiye,
      Phillips (1958)") gerçek yazar kaçmaz.
    */
    const digerAdaylar = [...new Set(match[1].replace(ET_AL_SONU, "").split(AYIRICI).map((ad) => normalizeName(ekiAt(ad.trim()))))].filter(
      (aday) => aday && aday !== key && !atifDisi(aday),
    );
    for (const year of match[2].split(",")) {
      results.push({
        raw: match[0],
        authorKey: key,
        year: year.trim(),
        position: match.index ?? 0,
        kind: "narrative",
        ...(digerAdaylar.length ? { digerAdaylar } : {}),
      });
    }
  }

  if (!mla) {
    for (const match of bodyText.matchAll(TIRELI_RE)) {
      const [ilk, ikinci] = [ekiAt(match[1]), ekiAt(match[2])];
      for (const year of match[3].split(",")) {
        results.push({
          raw: match[0],
          authorKey: normalizeName(ilk),
          year: year.trim(),
          position: match.index ?? 0,
          kind: "narrative",
          tire: [ilk, ikinci],
        });
      }
    }
  }

  return results;
}

// --- Çapraz kontrol: metin içi atıf <-> kaynakça listesi -------------------

const referenceKey = (reference: ParsedReference) =>
  reference.authors?.[0] ? normalizeName(reference.authors[0].split(",")[0]) : "";
const yazarSoyadi = (reference: ParsedReference, sira: number) =>
  reference.authors?.[sira] ? reference.authors[sira].split(",")[0].replace(/^&\s*/, "").trim() : "";

// Anlatı atfının önünde cümle başı kelimesi olabilir ("Ayrıca Yılmaz (2020)"); kurum adında
// "ve" geçebilir ("Milli Eğitim ve Kültür Bakanlığı"); kaynakçada ad önce yazılmış olabilir
// ("Ahmet Yılmaz"): kelime sınırında önek/sonek de eşleşir.
const keysMatch = (citation: string, reference: string) =>
  citation === reference ||
  citation.startsWith(`${reference} `) ||
  reference.startsWith(`${citation} `) ||
  citation.endsWith(` ${reference}`) ||
  reference.endsWith(` ${citation}`);

export function crossCheck(
  citations: InTextCitation[],
  references: ParsedReference[],
  /*
    MLA'da atıfta yıl yoktur ("Yılmaz 45"), künyede vardır. Yılı şart
    koşmak bütün eşleşmeleri düşürür ve öğrenci doğru yazdığı her kaynak
    için "metinde atıf yok" uyarısı alırdı. yilaBak=false, eşleştirmeyi
    yalnızca yazara bırakır.
  */
  options: {
    yilaBak?: boolean;
    /** Gövde metni verilirse çok yazarlı kaynakların yılsız anılması aranır. */
    govde?: string;
  } = {}
): CrossCheckResult {
  const yilaBak = options.yilaBak !== false;
  const refKeys = references.map((ref) => ({ ref, key: referenceKey(ref), year: normalizeYear(ref.year) }));

  /*
    YILA GÖRE DİZİN. Eskiden her atıf için kaynakçanın TAMAMI taranıyor,
    sonra her kaynak için atıfların tamamı yeniden taranıyordu: iki ayrı
    karesel döngü. 200 sayfalık bir tezde (12.800 atıf, 120 kaynak) bu
    1,5 milyon karşılaştırma demekti ve canlı denetim yazarken ana iş
    parçacığını 136 ms kilitliyordu — kaynak sayısı arttıkça büyüyen bir
    donma.

    Eşleşmenin ön koşulu yılın aynı olması; yıla göre gruplayınca bir
    atıf yalnızca kendi yılındaki birkaç kaynağa bakıyor. Çıktı aynı,
    tek fark hız.
  */
  const yilaGore = new Map<string, typeof refKeys>();
  for (const rk of refKeys) {
    const anahtar = yilaBak ? rk.year ?? "" : "";
    const liste = yilaGore.get(anahtar);
    if (liste) liste.push(rk);
    else yilaGore.set(anahtar, [rk]);
  }
  const eslesenler = (citation: InTextCitation, yil: string | null) =>
    (yilaGore.get(yilaBak ? yil ?? "" : "") ?? []).filter(
      (rk) =>
        Boolean(rk.key) &&
        (keysMatch(citation.authorKey, rk.key) || (citation.digerAdaylar ?? []).some((aday) => keysMatch(aday, rk.key))),
    );

  // Karşılıksız atıf yalnızca parantez içi atıflarda raporlanır: "Türkiye (2020)" gibi
  // anlatı biçimine benzeyen her ifade atıf değildir (yanlış alarm olmasın).
  const seen = new Set<string>();
  const anilanKaynaklar = new Set<ParsedReference>();
  const citationsWithoutReference: InTextCitation[] = [];
  for (const citation of citations) {
    const yil = normalizeYear(citation.year);
    const eslesen = eslesenler(citation, yil);
    // Anlatı atfı da kaynağı "anılmış" yapar; yalnızca raporlanmaz.
    for (const rk of eslesen) anilanKaynaklar.add(rk.ref);
    if (citation.kind !== "parenthetical" || eslesen.length > 0) continue;
    const id = `${citation.authorKey}|${yilaBak ? yil : ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    citationsWithoutReference.push(citation);
  }

  /*
    Tireli atıf ("Engle–Granger (1987)") kaynağı anılmış yapar ama biçim
    hatasıdır; yalnızca ikinci ad gerçekten kaynağın ikinci yazarıysa
    (tireli soyadlarla karışmasın: "Altunakar-Mercan").
  */
  const tireliAtiflar: { atif: InTextCitation; kaynak: ParsedReference }[] = [];
  const tireliGorulen = new Set<ParsedReference>();
  for (const citation of citations) {
    if (!citation.tire) continue;
    const kaynak = eslesenler(citation, normalizeYear(citation.year)).find(
      (rk) => normalizeName(yazarSoyadi(rk.ref, 1)) === normalizeName(citation.tire![1]),
    )?.ref;
    if (!kaynak || tireliGorulen.has(kaynak)) continue;
    tireliGorulen.add(kaynak);
    tireliAtiflar.push({ atif: citation, kaynak });
  }

  /*
    YILSIZ ANMA: çok yazarlı kaynağın yazarları metinde yan yana geçiyor
    ama yıl yok ("Granger ve Newbold'un …", "Newey–West (HAC)"). Bu
    kaynak "anılmıyor" değil, "yılsız anılmış"; öğrenciye doğru şeyi
    söylemek için ayrılır. Tek yazarlı kaynakta aranmaz: "Phillips eğrisi",
    "Granger nedenselliği" kavram adıdır, atıf değil.
  */
  const yilsizAnilanlar: { ifade: string; kaynak: ParsedReference }[] = [];
  const kalan = refKeys.filter((rk) => !anilanKaynaklar.has(rk.ref));
  if (options.govde) {
    const kac = (metin: string) => metin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const rk of kalan) {
      const [a, b] = [yazarSoyadi(rk.ref, 0), yazarSoyadi(rk.ref, 1)];
      if (!a || !b) continue;
      const desen = new RegExp(`(?<![\\p{L}])${kac(a)}\\s*(?:ve|and|&|ile|[–—-])\\s*${kac(b)}(?:['’]\\p{L}+)?(?![\\p{L}])`, "iu");
      const bulunan = desen.exec(options.govde);
      if (bulunan) yilsizAnilanlar.push({ ifade: bulunan[0], kaynak: rk.ref });
    }
  }
  const yilsizSet = new Set(yilsizAnilanlar.map((y) => y.kaynak));
  const referencesWithoutCitation = kalan.filter((rk) => !yilsizSet.has(rk.ref)).map((rk) => rk.ref);

  return { citationsWithoutReference, referencesWithoutCitation, tireliAtiflar, yilsizAnilanlar };
}

/*
  YIL UYUŞMAZLIĞI: karşılıksız kalan atıfın yazarı kaynakçada VAR ama yılı
  farklı ("(Yılmaz, 2020)" ↔ "Yılmaz, A. (2021)"). Çapraz kontrol bunu iki
  ayrı sorun olarak gösteriyordu (metinde atıf var/kaynakçada yok ve
  tersi); oysa tek bir yıl hatası. Ayrı söylenince öğrenci neyi
  düzelteceğini hemen görüyor (kurum sahibinin geri bildirimi: "virgülüne
  kadar").
*/
export function yilUyusmazliklari(
  citationsWithoutReference: InTextCitation[],
  references: ParsedReference[],
): { atif: string; atifYili: string; kunye: string; kunyeYili: string }[] {
  const sonuc: { atif: string; atifYili: string; kunye: string; kunyeYili: string }[] = [];
  for (const atif of citationsWithoutReference) {
    if (!atif.year) continue;
    const kunye = references.find(
      (ref) => referenceKey(ref) && keysMatch(atif.authorKey, referenceKey(ref)) && normalizeYear(ref.year) !== normalizeYear(atif.year),
    );
    if (kunye?.year) sonuc.push({ atif: atif.raw, atifYili: atif.year, kunye: kunye.raw, kunyeYili: kunye.year });
  }
  return sonuc;
}

// --- Genel uyum skoru --------------------------------------------------------

/*
  UYUM PUANI (03.11.2026'da yeniden yazıldı).

  Eskiden: 100 − 5 × (künye hatası) − 3 × (eşleşmeyen atıf/künye), en az 0.
  Ceza MUTLAKTI, kaynak sayısına bölünmüyordu: 35 künyeli bir tezde
  8 anılmayan kaynak tek başına −24 ediyordu, her "yıl yok" hatası −5.
  Kaynakça büyüdükçe puan sıfıra yapışıyordu; örnek tezde 0/100 çıktı.
  Sıfır puan, öğrenciye "her şey yanlış" der ve hiçbir şey öğretmez.

  Şimdi üç ORAN, ağırlıklı ortalama:
    • %50  anılan kaynak oranı      = metinde anılan künye / künye
    • %25  karşılığı olan atıf oranı = 1 − karşılıksız atıf / künye
           (en az 0; karşılıksız atıf sayısı künye sayısıyla ölçeklenir)
    • %25  biçim                    = hata ("error") içermeyen künye / künye
  Uyarılar ("warning") puanı düşürmez: DOI önerisi gibi tavsiyelerdir.
  Künye yoksa 0 (çağıran "kaynakça bulunamadı"yı ayrıca söyler).

  Örnek: 35 künye, 27'si anılıyor, karşılıksız atıf yok, hepsi biçimce
  doğru → 100 × (0,5 × 27/35 + 0,25 + 0,25) ≈ 89.
*/
export function computeComplianceScore(
  references: ParsedReference[],
  crossCheckResult: CrossCheckResult
): number {
  const n = references.length;
  if (n === 0) return 0;
  const anilan = 1 - Math.min(n, crossCheckResult.referencesWithoutCitation.length) / n;
  const karsilikli = 1 - Math.min(1, crossCheckResult.citationsWithoutReference.length / n);
  const bicim = references.filter((r) => !r.issues.some((i) => i.severity === "error")).length / n;
  return Math.round(100 * (0.5 * anilan + 0.25 * karsilikli + 0.25 * bicim));
}
