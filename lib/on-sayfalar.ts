import type { Dil, Metin } from "@/lib/dil";
import { YEREL } from "@/lib/dil";
import { normalizeHeading } from "@/lib/section-match";
import { anaMetinBaslangici } from "@/lib/heading-numbering";

/*
  TEZİN ÖN SAYFALARI (02.11.2026). Türk tez kılavuzlarının ortak sırası
  (DEÜ SBE 2.1): iç kapak, tez onay sayfası, yemin metni, özet, İngilizce
  özet, içindekiler, kısaltmalar, tablo/şekil listeleri. İçindekiler ve
  listeler Word/PDF çıktısında kendiliğinden üretiliyor; burada olanlar
  öğrencinin belgesine YAZILAN sayfalar.

  Şablon YAPI kurar, içerik yazmaz ("Asistan denetler, yazmaz" ilkesinin
  şablondaki karşılığı): başlıklar, kapak bilgisinden doldurulabilen
  alanlar ve öğrencinin dolduracağı yerler "[ … ]" yer tutucusuyla.
  Kurumun resmî metni (yemin metni, onay formu) UYDURULMAZ: kılavuzun
  eklerinde yer alır ve kurumdan kuruma değişir; yanlış bir resmî metin
  boş bir yerden kötüdür. Yer tutucu doldurulmadan teslim kontrolü
  uyarır (lib/structure-check.ts, yerTutuculari).

  Saf modül; testi tests/unit/on-sayfalar.test.ts.
*/

export type OnSayfaKimligi = "ic-kapak" | "onay" | "yemin" | "ozet" | "abstract" | "kisaltmalar";

interface Dugum {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Dugum[];
  text?: string;
}

/** Kapak bilgisi (app/actions/manuscript.ts CoverPage ile aynı alanlar; saf kalsın diye burada). */
export interface KapakBilgisi {
  university?: string;
  institute?: string;
  department?: string;
  program?: string;
  degreeType?: string;
  title?: string;
  authorName?: string;
  advisorName?: string;
  city?: string;
  year?: string;
}

/** Kanonik sıra: yerleşim bu sıraya göre yapılır. */
export const ON_SAYFALAR: { id: OnSayfaKimligi; ad: Metin; baslik: Metin | null; aciklama: Metin }[] = [
  {
    id: "ic-kapak",
    ad: { tr: "İç kapak", en: "Inner title page" },
    baslik: null,
    aciklama: { tr: "Kapak bilgilerinizden doldurulur.", en: "Filled from your cover details." },
  },
  {
    id: "onay",
    ad: { tr: "Tez onay sayfası", en: "Thesis approval page" },
    baslik: { tr: "TEZ ONAY SAYFASI", en: "THESIS APPROVAL PAGE" },
    aciklama: { tr: "Jüri ve tarih alanları; resmî form enstitünüzden.", en: "Committee and date fields; the official form comes from your institute." },
  },
  {
    id: "yemin",
    ad: { tr: "Yemin metni", en: "Declaration" },
    baslik: { tr: "YEMİN METNİ", en: "DECLARATION" },
    aciklama: { tr: "Metni kılavuzunuzun ekindeki örnekten yazın.", en: "Copy the text from the example in your guideline's appendix." },
  },
  {
    id: "ozet",
    ad: { tr: "Özet", en: "Turkish abstract (Özet)" },
    baslik: { tr: "ÖZET", en: "ÖZET" },
    aciklama: { tr: "Özet ve anahtar kelimeler; kılavuzun sınırıyla.", en: "Abstract and keywords, with your guideline's limits." },
  },
  {
    id: "abstract",
    ad: { tr: "Abstract (İngilizce özet)", en: "Abstract" },
    baslik: { tr: "ABSTRACT", en: "ABSTRACT" },
    aciklama: { tr: "Özetin İngilizcesi ve keywords.", en: "Abstract and keywords." },
  },
  {
    id: "kisaltmalar",
    ad: { tr: "Kısaltmalar", en: "Abbreviations" },
    baslik: { tr: "KISALTMALAR", en: "ABBREVIATIONS" },
    aciklama: { tr: "Kısaltma ve açılımı, alfabetik.", en: "Abbreviation and its expansion, alphabetical." },
  },
];

const metin = (d: Dugum): string => d.text ?? (d.content ?? []).map(metin).join("");
const paragraf = (text: string, attrs?: Record<string, unknown>): Dugum => ({
  type: "paragraph",
  ...(attrs ? { attrs } : {}),
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const baslik = (text: string): Dugum => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });

/** Doldurulmamış alan: "[Üniversite adı]". */
const yt = (ad: string) => `[${ad}]`;

export interface OnSayfaVerisi {
  kapak: KapakBilgisi | null;
  /** Belgenin dili (lib/belge-dili.ts): başlıklar ve yer tutucular bu dilde. */
  dil: Dil;
  /** Kılavuzun özet sınırları (lib/guideline-editor-settings.ts abstract) */
  ozet?: { maxWords?: number; keywordsMin?: number; keywordsMax?: number };
  /*
    Kılavuzun bu sayfaya verdiği ad ("Bilimsel Etik Bildirimi"). Verilirse
    başlık o olur: kılavuz "Bilimsel Etik Bildirimi" isterken "YEMİN
    METNİ" yazmak, bölüm denetiminin onu eksik saymasına yol açardı.
  */
  basliklar?: Partial<Record<OnSayfaKimligi, string>>;
}

/** Bir ön sayfanın düğümleri (Tiptap JSON). */
export function onSayfaDugumleri(id: OnSayfaKimligi, veri: OnSayfaVerisi): Dugum[] {
  const en = veri.dil === "en";
  const k = veri.kapak ?? {};
  const buyuk = (s: string) => s.toLocaleUpperCase(YEREL[veri.dil]);
  const alan = (deger: string | undefined, tr: string, ing: string) => (deger?.trim() ? deger.trim() : yt(en ? ing : tr));
  const tanim = ON_SAYFALAR.find((s) => s.id === id)!;
  const ozelAd = veri.basliklar?.[id]?.trim();
  const sayfaBasligi = ozelAd ? buyuk(ozelAd) : (tanim.baslik?.[veri.dil] ?? "");
  const ortali = { textAlign: "center" };
  const anahtar = (ozet: OnSayfaVerisi["ozet"], ing: boolean) => {
    const a = ozet?.keywordsMin;
    const b = ozet?.keywordsMax;
    const aralik = a && b ? `${a}–${b}` : b ? (ing ? `at most ${b}` : `en fazla ${b}`) : a ? (ing ? `at least ${a}` : `en az ${a}`) : "";
    return ing ? yt(aralik ? `${aralik} keywords` : "keywords") : yt(aralik ? `${aralik} anahtar kelime` : "anahtar kelimeler");
  };

  switch (id) {
    case "ic-kapak": {
      // Dış kapakla aynı bilgiler (DEÜ SBE 2.1.2: "dış kapak formunda").
      const satirlar = [
        ...(en ? [] : ["T.C."]),
        buyuk(alan(k.university, "Üniversite adı", "University")),
        buyuk(alan(k.institute, "Enstitü adı", "Institute")),
        buyuk(alan(k.department, "Anabilim dalı", "Department")),
        alan(k.program, "Program", "Program"),
        buyuk(alan(k.degreeType, "Yüksek lisans / doktora tezi", "Master's / doctoral thesis")),
        "",
        buyuk(alan(k.title, "Tezin başlığı", "Thesis title")),
        "",
        alan(k.authorName, "Adınız Soyadınız", "Your name"),
        "",
        `${en ? "Advisor" : "Danışman"}: ${alan(k.advisorName, "Unvanı Adı Soyadı", "Title Name Surname")}`,
        "",
        [alan(k.city, "Şehir", "City"), alan(k.year, "Yıl", "Year")].join(" – "),
      ];
      return satirlar.map((s) => paragraf(s, ortali));
    }
    case "onay":
      return [
        baslik(sayfaBasligi),
        paragraf(
          yt(
            en
              ? "Your institute's approval form goes here; the signed form is added after the defence"
              : "Enstitünüzün tez onay formu buraya gelir; jüri imzalı form savunmadan sonra eklenir",
          ),
        ),
        paragraf(`${en ? "Student" : "Öğrenci"}: ${alan(k.authorName, "Adı Soyadı", "Name Surname")}`),
        paragraf(`${en ? "Thesis title" : "Tezin başlığı"}: ${alan(k.title, "Tezin başlığı", "Thesis title")}`),
        paragraf(en ? "Examining committee:" : "Jüri üyeleri:"),
        ...[1, 2, 3].map((n) => paragraf(`${n}. ${yt(en ? "Title Name Surname" : "Unvanı Adı Soyadı")} …………………… ${en ? "(Signature)" : "(İmza)"}`)),
        paragraf(`${en ? "Defence date" : "Savunma tarihi"}: ${yt(en ? "dd.mm.yyyy" : "gg.aa.yyyy")}`),
      ];
    case "yemin":
      return [
        baslik(sayfaBasligi),
        paragraf(
          yt(
            en
              ? "Write your institute's declaration text here, from the example in your guideline's appendix"
              : "Kurumunuzun yemin metnini kılavuzunuzun ekindeki örnekten buraya yazın",
          ),
        ),
        paragraf(""),
        paragraf(`${en ? "Date" : "Tarih"}: ${yt(en ? "dd.mm.yyyy" : "gg.aa.yyyy")}`),
        paragraf(`${en ? "Name Surname" : "Adı Soyadı"}: ${alan(k.authorName, "Adı Soyadı", "Name Surname")}`),
        paragraf(`${en ? "Signature" : "İmza"}:`),
      ];
    case "ozet":
    case "abstract": {
      const ing = id === "abstract";
      const sinir = veri.ozet?.maxWords;
      const icerik = ing
        ? `Research question, method and findings${sinir ? `; at most ${sinir} words` : ""}`
        : `Araştırma sorusu, yöntem ve bulgular${sinir ? `; en fazla ${sinir} kelime` : ""}`;
      return [
        baslik(sayfaBasligi),
        paragraf(yt(icerik)),
        paragraf(`${ing ? "Keywords" : "Anahtar Kelimeler"}: ${anahtar(veri.ozet, ing)}`),
      ];
    }
    case "kisaltmalar":
      return [baslik(sayfaBasligi), paragraf(`${yt(en ? "Abbr." : "Kısaltma")}  ${yt(en ? "Meaning" : "Açılımı")}`)];
  }
}

/** Başlığı ön sayfanın başlıklarından biri mi (iki dilde de). */
function baslikKimligi(text: string): OnSayfaKimligi | null {
  const n = normalizeHeading(text);
  const esler: Record<Exclude<OnSayfaKimligi, "ic-kapak">, string[]> = {
    onay: ["Tez Onay Sayfası", "Onay Sayfası", "Thesis Approval Page", "Approval Page"],
    yemin: ["Yemin Metni", "Bilimsel Etik Bildirimi", "Etik Beyan", "Beyan", "Declaration", "Statement of Originality"],
    ozet: ["Özet", "Öz"],
    abstract: ["Abstract"],
    kisaltmalar: ["Kısaltmalar", "Kısaltmalar Listesi", "Simgeler ve Kısaltmalar", "Abbreviations", "List of Abbreviations"],
  };
  for (const [id, adlar] of Object.entries(esler)) if (adlar.some((ad) => normalizeHeading(ad) === n)) return id as OnSayfaKimligi;
  return null;
}

/**
 * Hangi ön sayfalar belgede var. İç kapak başlıksız: belge bir başlıktan
 * ÖNCE metinle başlıyorsa ve o metinde çalışmanın başlığı geçiyorsa var
 * sayılır (başlık bilinmiyorsa baştaki her metin).
 */
export function mevcutOnSayfalar(doc: { content?: Dugum[] } | null | undefined, calismaBasligi?: string): Set<OnSayfaKimligi> {
  const dugumler = doc?.content ?? [];
  const var_ = new Set<OnSayfaKimligi>();
  const ilkBaslik = dugumler.findIndex((d) => d.type === "heading");
  const bas = (ilkBaslik < 0 ? dugumler : dugumler.slice(0, ilkBaslik)).map(metin).join(" ").trim();
  const aranan = calismaBasligi?.trim().toLocaleLowerCase("tr-TR");
  if (bas && (!aranan || bas.toLocaleLowerCase("tr-TR").includes(aranan))) var_.add("ic-kapak");
  /* Her düzeyde (03.11.2026): başlığı H1 olan bir yazı yapıştırılınca ön
     sayfalar H2 oluyor; yalnızca H1'e bakılırken belgede zaten olan
     Kısaltmalar ve Onay sayfaları "eksik" sayılıp ikinci kez ekleniyordu. */
  for (const d of dugumler) {
    if (d.type !== "heading") continue;
    const id = baslikKimligi(metin(d));
    if (id) var_.add(id);
  }
  return var_;
}

/**
 * Seçilen ön sayfaların belgedeki yeri: üst düzey düğüm sırası (o düğümün
 * ÖNÜNE eklenir). İç kapak en başa; ötekiler kanonik sırada kendisinden
 * SONRA gelen ilk mevcut ön sayfanın önüne, yoksa ana metnin başına
 * (Giriş). Aynı yere düşenler kanonik sırayla ardışık eklenir.
 */
export function onSayfaYerlesimi(
  doc: { content?: Dugum[] } | null | undefined,
  secilen: OnSayfaKimligi[],
  calismaBasligi?: string,
): { sira: number; idler: OnSayfaKimligi[] }[] {
  const dugumler = doc?.content ?? [];
  const mevcut = mevcutOnSayfalar(doc, calismaBasligi);
  const kanonik = ON_SAYFALAR.map((s) => s.id);
  const anaSira = Math.min(anaMetinBaslangici(doc as Parameters<typeof anaMetinBaslangici>[0]), dugumler.length);
  const mevcutSirasi = new Map<OnSayfaKimligi, number>();
  dugumler.forEach((d, i) => {
    if (d.type === "heading") {
      const id = baslikKimligi(metin(d));
      if (id && !mevcutSirasi.has(id)) mevcutSirasi.set(id, i);
    }
  });
  const gruplar = new Map<number, OnSayfaKimligi[]>();
  for (const id of kanonik) {
    if (!secilen.includes(id) || mevcut.has(id)) continue;
    let sira = id === "ic-kapak" ? 0 : anaSira;
    if (id !== "ic-kapak") {
      for (const sonraki of kanonik.slice(kanonik.indexOf(id) + 1)) {
        const yer = mevcutSirasi.get(sonraki);
        if (yer !== undefined) {
          sira = Math.min(sira, yer);
          break;
        }
      }
    }
    gruplar.set(sira, [...(gruplar.get(sira) ?? []), id]);
  }
  return [...gruplar.entries()].map(([sira, idler]) => ({ sira, idler })).sort((a, b) => a.sira - b.sira);
}

/*
  DOLDURULMAMIŞ YER TUTUCU.

  Köşeli parantezli yönerge: "[Üniversite adı]", "[gg.aa.yyyy]",
  "[.........]". Yer tutucu SAYILMAYANLAR (03.11.2026, örnek tezde yanlış
  alarm verdiler):
    - IEEE ve benzeri numaralı atıflar: "[1]", "[2, 5–7]";
    - APA 7'nin tür belirteçleri: "[Haber bülteni]", "[Yayımlanmamış
      yüksek lisans tezi]", "[Veri seti]"… — künyenin parçasıdır;
    - kod: "["LENF", "ISS"]" (tırnak ya da "=" içeren parantez).
  Köşeli parantezsiz boş alanlar da yer tutucudur: dört ve daha çok nokta
  ("İmza: ...................."), "..../..../2026" tarih kalıbı ve iki ya
  da daha çok üç nokta karakteri ("……"). Önünde "Etiket:" varsa birlikte
  döner ("Tarih: ..../..../2026"), öğrenci hangi alan olduğunu görsün.
*/
const YER_TUTUCU = /\[([^\]\n]{2,160})\]/gu;
const APA_BELIRTECLERI = new Set(
  [
    "Haber bülteni", "Yayımlanmamış yüksek lisans tezi", "Yayımlanmamış doktora tezi", "Yüksek lisans tezi", "Doktora tezi",
    "Veri seti", "Video", "Rapor", "Bildiri", "Çevrimiçi", "Poster", "Sunum", "Kitap", "E-kitap", "Ses kaydı", "Film", "Fotoğraf",
    "Harita", "Yazılım", "Bilgisayar yazılımı", "Blog yazısı", "Web sayfası", "Kitap incelemesi", "Editöre mektup", "Özet", "Ön baskı",
    "Press release", "Unpublished master's thesis", "Unpublished doctoral dissertation", "Master's thesis", "Doctoral dissertation",
    "Data set", "Dataset", "Report", "Conference presentation", "Paper presentation", "Online", "Poster session", "Audio podcast",
    "Computer software", "Software", "Blog post", "Book review", "Letter to the editor", "Abstract", "Preprint", "Fact sheet",
  ].map((b) => b.toLocaleLowerCase("tr-TR")),
);
const apaBelirteciMi = (ic: string) => {
  const sade = ic.trim().toLocaleLowerCase("tr-TR");
  // "Yüksek lisans tezi, Dokuz Eylül Üniversitesi" gibi uzantılar da belirteçtir.
  return APA_BELIRTECLERI.has(sade) || APA_BELIRTECLERI.has(sade.split(",")[0].trim());
};
// 1: "Etiket:" (isteğe bağlı), 2: boş alan
const BOS_NOKTA = /(?:([\p{L}][\p{L} .]{0,30}?:)\s*)?((?:\.{2,}\/){2}\d{2,4}|\.{4,}|…{2,}|_{4,})/gu;

export function yerTutuculari(text: string): string[] {
  const kosesi = [...text.matchAll(YER_TUTUCU)]
    .filter((e) => {
      const ic = e[1];
      if (/^\s*(?:\d|[a-z]\.)/u.test(ic) || /^(?:sic|…|\.\.\.)$/iu.test(ic)) return false;
      if (/["=]/u.test(ic) || ic.startsWith("[")) return false;
      if (apaBelirteciMi(ic)) return false;
      // Harf taşıyan yönerge ya da yalnızca nokta/alt çizgiden oluşan boş alan ("[.........]").
      return /\p{L}/u.test(ic) || /^[.\s…_]{3,}$/u.test(ic);
    })
    .map((e) => e[0]);
  const noktali = [...text.replaceAll(YER_TUTUCU, (m) => " ".repeat(m.length)).matchAll(BOS_NOKTA)].map((e) =>
    e[1] ? `${e[1].trim()} ${e[2]}` : e[2],
  );
  return [...kosesi, ...noktali];
}

/*
  ŞABLON ALANLARI (03.11.2026). ArvoLab'ın eklediği ön sayfa şablonlarının
  yer tutucuları ayrı raporlanır, hangi şablondan geldiği yazılarak:
  öğrencinin kendi metnindeki boşlukla karışınca kaynağı belirsizleşiyordu
  ("[Unvanı Adı Soyadı]" kurum sahibinin tezinde hiç yoktu).
*/
let sablonHaritasi: Map<string, OnSayfaKimligi> | null = null;
export function sablonAlaniKaynagi(yer: string): OnSayfaKimligi | null {
  if (!sablonHaritasi) {
    sablonHaritasi = new Map();
    const harita = sablonHaritasi;
    for (const d of ["tr", "en"] as const)
      for (const s of ON_SAYFALAR)
        for (const dugum of onSayfaDugumleri(s.id, { kapak: null, dil: d }))
          for (const y of yerTutuculari(metin(dugum))) if (!harita.has(y)) harita.set(y, s.id);
  }
  return sablonHaritasi.get(yer) ?? null;
}

/*
  KILAVUZUN İSTEDİĞİ ÖN SAYFALAR (03.11.2026, kurum sahibinin isteği:
  "kılavuzda özet, abstract, yemin gibi bölümler var ise onları da
  editörde otomatik olarak eklemeli").

  Kılavuzun zorunlu bölüm listesindeki adlar ön sayfa kimliklerine
  eşlenir; eşlenmeyen (Giriş, Sonuç, Kaynakça…) ana metin bölümüdür.
  Eskiden "Taslak oluştur" bunları da düz başlık olarak ekliyordu: Yemin
  Metni başlığının altı boştu, Özet'in anahtar kelime satırı yoktu.
*/
const IC_KAPAK_ADLARI = ["İç Kapak", "İç Kapak Sayfası", "Inner Title Page", "Title Page"];

export function onSayfaAdiKimligi(ad: string): OnSayfaKimligi | null {
  const n = normalizeHeading(ad);
  if (IC_KAPAK_ADLARI.some((a) => normalizeHeading(a) === n)) return "ic-kapak";
  return baslikKimligi(ad);
}

/** Kılavuzun ön sayfalara verdiği adlar (başlık olarak kullanılır). */
export function kilavuzOnSayfaAdlari(zorunluBolumler: readonly string[]): Partial<Record<OnSayfaKimligi, string>> {
  const adlar: Partial<Record<OnSayfaKimligi, string>> = {};
  for (const ad of zorunluBolumler) {
    const id = onSayfaAdiKimligi(ad);
    if (id && id !== "ic-kapak" && !adlar[id]) adlar[id] = ad;
  }
  return adlar;
}

/** Kılavuzun zorunlu bölümlerinden ön sayfa olanlar, kanonik sırada. */
export function kilavuzOnSayfalari(zorunluBolumler: readonly string[]): OnSayfaKimligi[] {
  const istenen = new Set(zorunluBolumler.map(onSayfaAdiKimligi).filter((id): id is OnSayfaKimligi => id !== null));
  return ON_SAYFALAR.map((s) => s.id).filter((id) => istenen.has(id));
}

/**
 * Boş belgeye kılavuzdan taslak: önce kılavuzun istediği ön sayfalar
 * (şablonlarıyla), sonra ana metin bölümleri kılavuz sırasıyla başlık +
 * boş satır olarak.
 */
export function taslakDugumleri(zorunluBolumler: readonly string[], veri: OnSayfaVerisi): Dugum[] {
  const onSayfalar = kilavuzOnSayfalari(zorunluBolumler);
  const govde = zorunluBolumler.filter((b) => onSayfaAdiKimligi(b) === null);
  return [
    ...onSayfalar.flatMap((id) => onSayfaDugumleri(id, { ...veri, basliklar: { ...kilavuzOnSayfaAdlari(zorunluBolumler), ...veri.basliklar } })),
    ...govde.flatMap((b) => [baslik(b), { type: "paragraph" } as Dugum]),
  ];
}
