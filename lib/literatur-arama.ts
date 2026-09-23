/*
  Literatür arama: gerçek dizinlerde (OpenAlex + Crossref) kaynak bulma.

  Neden asistan değil de dizin: ArvoLab'ın değişmez kuralı asistanın kaynak
  ÖNERMEMESİ (lib/ai/literatur-taramasi.ts, kunyeIzi). Dil modeli künye
  uydurur ve uydurma künye, hiç kaynak bulamamaktan kötüdür — öğrenci
  kaynağı arar, bulamaz, zamanını yakar. Bu yüzden arama gerçek dizinlerde
  yapılıyor: her kayıt bir DOI'ye ya da yayıncı adresine dayanıyor.

  Asistan yine de işin içinde: araştırma sorusundan ARAMA DİZESİ kuruyor,
  o dize burada çalıştırılıyor. Strateji modelin, kaynaklar dizinin.

  Ağ katmanı dışarıdan verilebiliyor (`getir`), böylece eşleme ve birleştirme
  mantığı ağ olmadan sınanabiliyor. Testi tests/unit/literatur-arama.test.ts.
*/

export type AramaSaglayici = "openalex" | "crossref";

export interface AramaKaydi {
  /** Tekilleştirme anahtarı: DOI varsa o, yoksa adres. */
  kimlik: string;
  baslik: string;
  yazarlar: string[];
  yil: number | null;
  /** literature_sources.source_type karşılığı */
  tur: string;
  dergi: string | null;
  doi: string | null;
  url: string;
  atifSayisi: number | null;
  acikErisim: boolean;
  /** Açık erişimli tam metnin adresi (varsa) */
  acikErisimUrl: string | null;
  saglayici: AramaSaglayici;
}

export interface AramaFiltresi {
  sorgu: string;
  yilDan?: number | null;
  yilaKadar?: number | null;
  yalnizcaAcikErisim?: boolean;
}

export const EN_FAZLA_SONUC = 20;
const SAYFA_BOYU = 15;

/* Dizinlerin tür adları ile bizim listemizin türleri. Eşleşmeyen her şey
   "other": uydurma bir tür seçmek, kullanıcının künyesini bozar. */
const TURLER: Record<string, string> = {
  "journal-article": "article",
  article: "article",
  "posted-content": "article",
  preprint: "article",
  book: "book",
  monograph: "book",
  "reference-book": "book",
  "book-chapter": "chapter",
  "book-part": "chapter",
  "book-section": "chapter",
  dissertation: "thesis",
  thesis: "thesis",
  report: "report",
  "report-component": "report",
  dataset: "other",
};

export const turEslestir = (deger: unknown): string =>
  (typeof deger === "string" && TURLER[deger.toLowerCase()]) || "other";

const doiDuzelt = (deger: unknown): string | null => {
  if (typeof deger !== "string" || !deger.trim()) return null;
  return deger.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
};

const yilSinirla = (deger: number | null | undefined): number | null => {
  if (typeof deger !== "number" || !Number.isFinite(deger)) return null;
  const yil = Math.trunc(deger);
  // Gelecek yıl baskıda olan kaynaklar var; çok uzağı kabul etmek anlamsız.
  return yil >= 1800 && yil <= new Date().getFullYear() + 2 ? yil : null;
};

// ---------- OpenAlex ----------

export function openAlexAdresi(filtre: AramaFiltresi): string {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", filtre.sorgu);
  url.searchParams.set("per-page", String(SAYFA_BOYU));
  const suzgecler: string[] = [];
  const dan = yilSinirla(filtre.yilDan);
  const kadar = yilSinirla(filtre.yilaKadar);
  if (dan) suzgecler.push(`from_publication_date:${dan}-01-01`);
  if (kadar) suzgecler.push(`to_publication_date:${kadar}-12-31`);
  if (filtre.yalnizcaAcikErisim) suzgecler.push("is_oa:true");
  if (suzgecler.length) url.searchParams.set("filter", suzgecler.join(","));
  return url.toString();
}

export function openAlexKayitlari(govde: unknown): AramaKaydi[] {
  const sonuclar = (govde as { results?: unknown })?.results;
  if (!Array.isArray(sonuclar)) return [];
  return sonuclar.flatMap((ham) => {
    if (!ham || typeof ham !== "object") return [];
    const kayit = ham as Record<string, unknown>;
    const baslik = typeof kayit.title === "string" ? kayit.title.trim() : "";
    if (!baslik) return [];
    const yazarlar = Array.isArray(kayit.authorships)
      ? kayit.authorships.flatMap((katki) => {
          const ad = (katki as { author?: { display_name?: unknown } })?.author?.display_name;
          return typeof ad === "string" && ad.trim() ? [ad.trim()] : [];
        })
      : [];
    const konum = (kayit.primary_location ?? null) as
      | { landing_page_url?: unknown; pdf_url?: unknown; source?: { display_name?: unknown } }
      | null;
    const acikErisim = (kayit.open_access ?? null) as { is_oa?: unknown; oa_url?: unknown } | null;
    const doi = doiDuzelt(kayit.doi);
    const url =
      (doi && `https://doi.org/${doi}`) ||
      (typeof konum?.landing_page_url === "string" ? konum.landing_page_url : "") ||
      (typeof kayit.id === "string" ? kayit.id : "");
    if (!url) return [];
    return [
      {
        kimlik: doi ?? url,
        baslik,
        yazarlar,
        yil: yilSinirla(typeof kayit.publication_year === "number" ? kayit.publication_year : null),
        tur: turEslestir(kayit.type),
        dergi: typeof konum?.source?.display_name === "string" ? konum.source.display_name : null,
        doi,
        url,
        atifSayisi: typeof kayit.cited_by_count === "number" ? kayit.cited_by_count : null,
        acikErisim: acikErisim?.is_oa === true,
        acikErisimUrl:
          typeof acikErisim?.oa_url === "string"
            ? acikErisim.oa_url
            : typeof konum?.pdf_url === "string"
            ? konum.pdf_url
            : null,
        saglayici: "openalex" as const,
      },
    ];
  });
}

// ---------- Crossref ----------

export function crossrefAdresi(filtre: AramaFiltresi): string {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", filtre.sorgu);
  url.searchParams.set("rows", String(SAYFA_BOYU));
  url.searchParams.set(
    "select",
    "DOI,title,author,issued,published-print,published-online,container-title,URL,type,is-referenced-by-count",
  );
  const suzgecler: string[] = [];
  const dan = yilSinirla(filtre.yilDan);
  const kadar = yilSinirla(filtre.yilaKadar);
  if (dan) suzgecler.push(`from-pub-date:${dan}-01-01`);
  if (kadar) suzgecler.push(`until-pub-date:${kadar}-12-31`);
  if (suzgecler.length) url.searchParams.set("filter", suzgecler.join(","));
  return url.toString();
}

const crossrefYil = (deger: unknown): number | null => {
  const parcalar = (deger as { "date-parts"?: unknown })?.["date-parts"];
  if (!Array.isArray(parcalar) || !Array.isArray(parcalar[0])) return null;
  return yilSinirla(Number(parcalar[0][0]));
};

export function crossrefKayitlari(govde: unknown): AramaKaydi[] {
  const ogeler = (govde as { message?: { items?: unknown } })?.message?.items;
  if (!Array.isArray(ogeler)) return [];
  return ogeler.flatMap((ham) => {
    if (!ham || typeof ham !== "object") return [];
    const kayit = ham as Record<string, unknown>;
    const baslik = Array.isArray(kayit.title) && typeof kayit.title[0] === "string" ? kayit.title[0].trim() : "";
    if (!baslik) return [];
    const yazarlar = Array.isArray(kayit.author)
      ? kayit.author.flatMap((yazar) => {
          const deger = (yazar ?? {}) as Record<string, unknown>;
          const ad = [deger.given, deger.family].filter((parca) => typeof parca === "string").join(" ").trim();
          return ad ? [ad] : [];
        })
      : [];
    const doi = doiDuzelt(kayit.DOI);
    const url = (doi && `https://doi.org/${doi}`) || (typeof kayit.URL === "string" ? kayit.URL : "");
    if (!url) return [];
    return [
      {
        kimlik: doi ?? url,
        baslik,
        yazarlar,
        yil: crossrefYil(kayit.issued) ?? crossrefYil(kayit["published-print"]) ?? crossrefYil(kayit["published-online"]),
        tur: turEslestir(kayit.type),
        dergi:
          Array.isArray(kayit["container-title"]) && typeof kayit["container-title"][0] === "string"
            ? kayit["container-title"][0]
            : null,
        doi,
        url,
        atifSayisi: typeof kayit["is-referenced-by-count"] === "number" ? kayit["is-referenced-by-count"] : null,
        // Crossref açık erişimi güvenilir biçimde söylemiyor; "hayır" demek
        // yanlış olurdu, bu yüzden yalnızca OpenAlex'in bildiği kayıtlarda işaretleniyor.
        acikErisim: false,
        acikErisimUrl: null,
        saglayici: "crossref" as const,
      },
    ];
  });
}

// ---------- Birleştirme ----------

const basligiSadelestir = (baslik: string) =>
  baslik.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * İki dizinin sonuçlarını sırayla harmanlar ve tekilleştirir.
 *
 * Harmanlama (bir OpenAlex, bir Crossref) bilerek: listeyi arka arkaya
 * eklemek, ikinci dizinin sonuçlarını sayfanın dibine gömerdi. İki dizin
 * de kendi alanında güçlü — Crossref yayıncı verisinde, OpenAlex açık
 * erişim ve atıf sayısında.
 *
 * Aynı kaynak iki dizinde de çıkarsa alanlar birleştirilir: OpenAlex
 * açık erişim bilgisini, Crossref dergi adını daha sık doldurur.
 */
export function kayitlariBirlestir(listeler: AramaKaydi[][], sinir = EN_FAZLA_SONUC): AramaKaydi[] {
  const sirali: AramaKaydi[] = [];
  const enUzun = Math.max(0, ...listeler.map((liste) => liste.length));
  for (let i = 0; i < enUzun; i++) for (const liste of listeler) if (liste[i]) sirali.push(liste[i]);

  const gorulen = new Map<string, AramaKaydi>();
  const sonuc: AramaKaydi[] = [];
  for (const kayit of sirali) {
    const anahtar = kayit.doi ?? `${basligiSadelestir(kayit.baslik)}|${kayit.yil ?? ""}`;
    const onceki = gorulen.get(anahtar);
    if (onceki) {
      onceki.dergi = onceki.dergi ?? kayit.dergi;
      onceki.doi = onceki.doi ?? kayit.doi;
      onceki.atifSayisi = onceki.atifSayisi ?? kayit.atifSayisi;
      if (!onceki.acikErisim && kayit.acikErisim) {
        onceki.acikErisim = true;
        onceki.acikErisimUrl = kayit.acikErisimUrl;
      }
      if (onceki.yazarlar.length === 0) onceki.yazarlar = kayit.yazarlar;
      continue;
    }
    const kopya = { ...kayit, yazarlar: [...kayit.yazarlar] };
    gorulen.set(anahtar, kopya);
    sonuc.push(kopya);
    if (sonuc.length >= sinir) break;
  }
  return sonuc;
}

// ---------- Ağ ----------

type Getirici = (adres: string) => Promise<unknown>;

const varsayilanGetirici: Getirici = async (adres) => {
  const cevap = await fetch(adres, {
    headers: {
      Accept: "application/json",
      // Dizinler kendilerini tanıtan istemcilere daha yüksek kota veriyor.
      "User-Agent": "ArvoLab/1.0 (https://lab.arvo-os.com; literatur-arama)",
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!cevap.ok) throw new Error(`HTTP ${cevap.status}`);
  return cevap.json();
};

export interface AramaSonucu {
  kayitlar: AramaKaydi[];
  /** Cevap vermeyen dizinler; kullanıcıya "eksik arama" olduğu söylenir. */
  ulasilamayan: AramaSaglayici[];
}

/**
 * Aramayı iki dizinde birden çalıştırır.
 *
 * Biri düşerse arama tamamen başarısız SAYILMAZ: öbürünün sonuçları
 * gösterilir ve hangisine ulaşılamadığı söylenir. Sessizce yarım liste
 * göstermek, öğrenciye "literatürde bu kadar var" dedirtir.
 */
export async function literaturAra(filtre: AramaFiltresi, getir: Getirici = varsayilanGetirici): Promise<AramaSonucu> {
  const istekler: { saglayici: AramaSaglayici; is: Promise<AramaKaydi[]> }[] = [
    { saglayici: "openalex", is: getir(openAlexAdresi(filtre)).then(openAlexKayitlari) },
    { saglayici: "crossref", is: getir(crossrefAdresi(filtre)).then(crossrefKayitlari) },
  ];
  const sonuclar = await Promise.allSettled(istekler.map((istek) => istek.is));

  const listeler: AramaKaydi[][] = [];
  const ulasilamayan: AramaSaglayici[] = [];
  sonuclar.forEach((sonuc, sira) => {
    if (sonuc.status === "fulfilled") listeler.push(sonuc.value);
    else {
      console.error(`[literatur-arama] ${istekler[sira].saglayici}:`, sonuc.reason);
      ulasilamayan.push(istekler[sira].saglayici);
    }
  });

  let kayitlar = kayitlariBirlestir(listeler);
  /* Açık erişim süzgeci yalnızca OpenAlex'te var; Crossref sonuçları
     süzülmeden gelirse kullanıcı "açık erişim" dediği halde kapalı
     kaynak görür. */
  if (filtre.yalnizcaAcikErisim) kayitlar = kayitlar.filter((kayit) => kayit.acikErisim);
  return { kayitlar, ulasilamayan };
}
