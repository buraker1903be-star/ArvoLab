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

import { formatAuthors } from "./doi";
import { htmlVarliklariniCoz } from "./html-varlik";

export type AramaSaglayici = "openalex" | "crossref";

export interface AramaKaydi {
  /** Tekilleştirme anahtarı: DOI varsa o, yoksa adres. */
  kimlik: string;
  baslik: string;
  /** Ekranda gösterilen adlar ("Ad Soyad"). Künyeye bu dizi YAZILMAZ. */
  yazarlar: string[];
  /**
   * Künyeye yazılacak yazar dizesi ("Soyad, A. B., & Soyad, C."), yalnızca
   * sağlayıcı adı given/family olarak ayrı verdiyse. OpenAlex yalnızca
   * "display_name" veriyor; orada null: soyadı "son sözcük" diye tahmin
   * etmek "van der Berg", "Ortega y Gasset" ya da kurum adlarını bozar.
   */
  kunyeYazarlari: string | null;
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
  /**
   * Birleştirmeden ÖNCE her dizinin kendi verdiği künye (20.11.2026,
   * lib/arama-kunye-kontrolu.ts). Birleştirme alanları karıştırıyor (yıl
   * OpenAlex'ten, dergi Crossref'ten): birleşik kaydı bir dizinle
   * "doğrulamak" o dizinin kendi verisini kendisiyle karşılaştırmak olurdu.
   * Kayıt iki dizinde birden çıktıysa iki ham künye birbirine karşı sınanır.
   */
  ham?: Partial<Record<AramaSaglayici, HamKunye>>;
}

/** Bir dizinin tek başına verdiği künye alanları (birleştirmeden önce). */
export interface HamKunye {
  baslik: string;
  /** Yapılandırılmış yazar dizesi varsa o, yoksa "Ad Soyad; Ad Soyad". */
  yazarlar: string;
  yil: number | null;
  dergi: string | null;
  doi: string | null;
}

const hamKunye = (k: AramaKaydi): HamKunye => ({
  baslik: k.baslik,
  yazarlar: k.kunyeYazarlari ?? k.yazarlar.join("; "),
  yil: k.yil,
  dergi: k.dergi,
  doi: k.doi,
});

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

/*
  Object.hasOwn ile: düz nesne araması "constructor" gibi bir tür adında
  prototipten FONKSİYON döndürür. Böyle bir tür bugün hiçbir dizinde yok
  ama kayıt doğrudan istemciye gidiyor; serileştirilemeyen bir değer
  yanıtın tamamını düşürür, "other"a düşmek ise zararsız.
*/
export const turEslestir = (deger: unknown): string =>
  (typeof deger === "string" && Object.hasOwn(TURLER, deger.toLowerCase()) && TURLER[deger.toLowerCase()]) || "other";

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
    const baslik = typeof kayit.title === "string" ? htmlVarliklariniCoz(kayit.title) : "";
    if (!baslik) return [];
    const yazarlar = Array.isArray(kayit.authorships)
      ? kayit.authorships.flatMap((katki) => {
          const ad = (katki as { author?: { display_name?: unknown } })?.author?.display_name;
          const temiz = typeof ad === "string" ? htmlVarliklariniCoz(ad) : "";
          return temiz ? [temiz] : [];
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
        kunyeYazarlari: null,
        tur: turEslestir(kayit.type),
        dergi: typeof konum?.source?.display_name === "string" ? htmlVarliklariniCoz(konum.source.display_name) || null : null,
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
    const baslik = Array.isArray(kayit.title) && typeof kayit.title[0] === "string" ? htmlVarliklariniCoz(kayit.title[0]) : "";
    if (!baslik) return [];
    /*
      YAPILANDIRILMIŞ AD KORUNUR (20.11.2026). Eskiden given + family
      "Edward W. Fisher" diye birleştiriliyor, kaydedilirken ", " ile
      dizilerek "Edward W. Fisher, Jane Other" oluyordu. Atıf bunu tek
      yazar sanıp "(Edward W. Fisher, 2023)" yazıyordu. Künye dizesi artık
      DOI yolundaki biçimle aynı (formatAuthors: "Fisher, E. W., & Other, J.").
    */
    const kisiler = Array.isArray(kayit.author)
      ? kayit.author.flatMap((yazar) => {
          const d = (yazar ?? {}) as Record<string, unknown>;
          const parca = (v: unknown) => (typeof v === "string" ? htmlVarliklariniCoz(v) || undefined : undefined);
          const kisi = { given: parca(d.given), family: parca(d.family), name: parca(d.name) };
          return kisi.given || kisi.family || kisi.name ? [kisi] : [];
        })
      : [];
    /*
      Kurumsal yazarı Crossref {"name": "..."} olarak veriyor; given/family
      yok. Yalnızca ikisine bakmak WHO, OECD, TÜİK gibi kaynakları "Yazar
      bilgisi yok" yapıyor ve kullanıcının kaynakçasına yazarsız
      kaydediyordu. Ekranda gösterilen ad "Ad Soyad" (künyeye bu YAZILMAZ).
    */
    const yazarlar = kisiler.map((k) => [k.given, k.family].filter(Boolean).join(" ") || k.name || "").filter(Boolean);
    const doi = doiDuzelt(kayit.DOI);
    const url = (doi && `https://doi.org/${doi}`) || (typeof kayit.URL === "string" ? kayit.URL : "");
    if (!url) return [];
    return [
      {
        kimlik: doi ?? url,
        baslik,
        yazarlar,
        kunyeYazarlari: formatAuthors(kisiler),
        yil: crossrefYil(kayit.issued) ?? crossrefYil(kayit["published-print"]) ?? crossrefYil(kayit["published-online"]),
        tur: turEslestir(kayit.type),
        dergi:
          Array.isArray(kayit["container-title"]) && typeof kayit["container-title"][0] === "string"
            ? htmlVarliklariniCoz(kayit["container-title"][0]) || null
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

/*
  Başlık+yıl anahtarı yalnızca AYIRT EDİCİ başlıklarda kullanılıyor.
  "Editöryal", "Önsöz", "Giriş" gibi tek kelimelik başlıklar her sayıda
  tekrar eder; onları anahtar saymak iki AYRI yayını tek satırda
  birleştirir ve birinin başlığı diğerinin dergisiyle eşleşirdi.

  Eşik dar tutuldu (iki kelime ve sekiz harf): "Örgütsel Bağlılık" gibi
  kısa ama ayırt edici başlıklar elenmemeli — eleme, aynı yayının iki kez
  listelenmesi demek.
*/
function baslikAnahtar(kayit: { baslik: string; yil: number | null }): string | null {
  const sade = basligiSadelestir(kayit.baslik);
  if (sade.split(" ").filter(Boolean).length < 2 || sade.length < 8) return null;
  return `${sade}|${kayit.yil ?? ""}`;
}

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

  const doiIle = new Map<string, AramaKaydi>();
  const baslikIle = new Map<string, AramaKaydi>();
  const sonuc: AramaKaydi[] = [];

  for (const kayit of sirali) {
    const baslikAnahtari = baslikAnahtar(kayit);
    /*
      Eşleşme ÖNCE DOI, sonra başlık+yıl. Eskiden anahtar "DOI varsa DOI,
      yoksa başlık" idi: aynı yayının DOI'li ve DOI'siz kopyası hiç
      karşılaşmıyordu. OpenAlex tez ve rapor kayıtlarında DOI'yi sık sık
      boş bırakıyor, Crossref aynı yayını DOI'yle veriyordu — sonuç
      listede AYNI KAYNAK İKİ KEZ, ve "Listenizde" işareti yalnızca
      birine düştüğü için kullanıcı ikisini de ekleyebiliyordu.
    */
    const onceki =
      (kayit.doi ? doiIle.get(kayit.doi) : undefined)
      ?? (baslikAnahtari ? baslikIle.get(baslikAnahtari) : undefined);

    if (onceki) {
      onceki.ham = { ...onceki.ham, [kayit.saglayici]: onceki.ham?.[kayit.saglayici] ?? hamKunye(kayit) };
      onceki.dergi = onceki.dergi ?? kayit.dergi;
      onceki.doi = onceki.doi ?? kayit.doi;
      onceki.atifSayisi = onceki.atifSayisi ?? kayit.atifSayisi;
      if (!onceki.acikErisim && kayit.acikErisim) {
        onceki.acikErisim = true;
        onceki.acikErisimUrl = kayit.acikErisimUrl;
      }
      if (onceki.yazarlar.length === 0) onceki.yazarlar = kayit.yazarlar;
      // Yapılandırılmış ad yalnızca Crossref'te var; OpenAlex kopyası önce geldiyse oradan alınır.
      onceki.kunyeYazarlari = onceki.kunyeYazarlari ?? kayit.kunyeYazarlari;
      /*
        YIL UZLAŞTIRILIYOR. Eskiden birleştirmede yıla hiç dokunulmuyordu
        ve hangi kopya önce geldiyse onun yılı kalıyordu. Crossref'in
        `issued` alanı çevrim içi ilk yayım tarihini verir, OpenAlex'in
        `publication_year` alanı ise sayının yılını: aynı yayın için
        2019 ve 2020 görülebiliyor. Kullanıcı "2020 ve sonrası" süzüp
        listede "2019" görüyor, üstüne o yılı kaynakçasına kaydediyordu.

        Künyede kullanılan yıl sayının yılıdır; OpenAlex'inki tercih
        ediliyor. Boşsa diğerinden dolduruluyor.
      */
      if (kayit.saglayici === "openalex" && kayit.yil) onceki.yil = kayit.yil;
      else onceki.yil = onceki.yil ?? kayit.yil;
      // Yeni anahtarlar da aynı kayda bağlanıyor: sonraki kopya bulunsun.
      if (onceki.doi) doiIle.set(onceki.doi, onceki);
      if (baslikAnahtari) baslikIle.set(baslikAnahtari, onceki);
      continue;
    }

    const kopya = { ...kayit, yazarlar: [...kayit.yazarlar], ham: { [kayit.saglayici]: hamKunye(kayit) } };
    if (kopya.doi) doiIle.set(kopya.doi, kopya);
    if (baslikAnahtari) baslikIle.set(baslikAnahtari, kopya);
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

  /*
    Açık erişim süzgeci BİRLEŞTİRMEDEN ÖNCE uygulanıyor.

    Eskiden sonradan süzülüyordu ve bu sessizce sonuç kaybettiriyordu:
    birleştirme iki dizini harmanlayıp 20'de kesiyor, Crossref kayıtları
    ise açık erişimi bilmediği için hep `false`. Yani 20 satırın yarısı
    süzgeçte silinecek kayıtlarla doluyor, kullanıcı elde 15 açık erişim
    sonucu varken 10 tanesini görüyordu. Tuhaf sonucu şuydu: Crossref
    ÇALIŞMADIĞINDA aynı arama daha çok sonuç veriyordu.
  */
  const suzulmus = filtre.yalnizcaAcikErisim
    ? listeler.map((liste) => liste.filter((kayit) => kayit.acikErisim))
    : listeler;

  let kayitlar = kayitlariBirlestir(suzulmus);

  /*
    Yıl süzgeci de sonuçta doğrulanıyor. Dizinler tarih alanlarını farklı
    dolduruyor ve birleştirmeden sonra gösterilen yıl kullanıcının
    istediği aralığın dışına düşebiliyordu — üstüne o yıl kaynakçaya
    kaydediliyordu. Aralığın dışındaki satırı göstermek, süzgeci
    anlamsızlaştırır.
  */
  // Dizinlere gönderilen sınırların aynısı (yilSinirla) kullanılıyor;
  // ham değeri süzmek, dizinin uygulamadığı bir kuralı uygulamak olurdu.
  const danSinir = yilSinirla(filtre.yilDan);
  const kadarSinir = yilSinirla(filtre.yilaKadar);
  if (danSinir != null) kayitlar = kayitlar.filter((kayit) => kayit.yil == null || kayit.yil >= danSinir);
  if (kadarSinir != null) kayitlar = kayitlar.filter((kayit) => kayit.yil == null || kayit.yil <= kadarSinir);

  return { kayitlar, ulasilamayan };
}

/**
 * Kaynağa yazılacak yazar dizesi (20.11.2026'dan beri iki ekleme yolu için
 * TEK yer: "Listeme ekle" ve "PDF'yi oku"). Sıra: (1) DOI'nin Crossref
 * künyesi, (2) sağlayıcının yapılandırılmış adı ("Soyad, A."), (3) ikisi de
 * yoksa ekrandaki adlar "; " ile, TERS ÇEVRİLMEDEN (soyadı tahmini "van der
 * Berg"i ve kurum adlarını bozar).
 *
 * Eskiden "PDF'yi oku" yolu (okumayaAl) adları ", " ile birleştiriyordu:
 * "Markus Knauff, Jelica Nejasmic" atıfta TEK yazar sayılıyor ve Preview'da
 * "(Markus Knauff, 2014)" çıkıyordu (21.11.2026). "Listeme ekle" bu hatayı
 * M1'de almıştı; iki yol ayrı kod olduğu için öbürü geride kalmıştı.
 */
export function kaynakYazarDizesi(girdi: { doiYazarlari?: string | null; kunyeYazarlari?: string | null; yazarlar?: string[] | null }): string | null {
  const temiz = (s: string | null | undefined) => htmlVarliklariniCoz(s ?? "").trim();
  return (
    temiz(girdi.doiYazarlari) ||
    temiz(girdi.kunyeYazarlari) ||
    (girdi.yazarlar ?? []).map((y) => temiz(y)).filter(Boolean).join("; ")
  ).slice(0, 500) || null;
}

