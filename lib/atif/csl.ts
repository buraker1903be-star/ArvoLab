import CSL from "citeproc";
import { splitAuthors, type CitableSource } from "@/lib/citation-format";
import type { Dil } from "@/lib/dil";
import { ustSimge, type CslKodu } from "./csl-kimlik";

/*
  CSL BİÇİMLEME (03.11.2026). Atıfı ve künyeyi citeproc-js yazar — Zotero
  ve Mendeley'in kullandığı motor (CPAL-1.0; değiştirilmeden kullanılıyor,
  atıf satırı stil seçicide). ArvoLab'ın kendi biçimleyicisi
  (lib/citation-format.ts) yedi yerleşik stilde kalıyor: onların Türkçe
  kuralları (ve, vd., t.y., DEÜ dipnot yöntemi) orada elle yazılmış ve
  kılavuzlarla sınanmış.

  Bu modül saf (ağ yok): stil XML'i ve yerel ayar dosyası parametre.
  İndirme lib/atif/csl-indir.ts'te. Testi tests/unit/csl.test.ts, depoya
  konmuş gerçek stil dosyalarıyla.
*/

export type Parca = { text: string; italic?: boolean };

const TUR: Record<string, string> = {
  article: "article-journal",
  book: "book",
  chapter: "chapter",
  thesis: "thesis",
  report: "report",
  website: "webpage",
  other: "document",
};

/*
  Yazar adı CSL'in istediği ad/soyad ikilisine çevrilir. Virgülsüz ad
  ("Türkiye İstatistik Kurumu", "Ahmet Yılmaz") parçalanmaz, olduğu gibi
  yazılır: kurum adını "Kurumu, T. İ." diye basmak, gerçek kişinin adını
  ters çevirmemekten kötü (lib/citation-format.ts'teki kuralın aynısı).
*/
export function cslYazarlari(authors: string | null) {
  return splitAuthors(authors).map((yazar) => {
    const virgul = yazar.indexOf(",");
    if (virgul < 0) return { literal: yazar.replace(/\.$/, "") };
    return { family: yazar.slice(0, virgul).trim(), given: yazar.slice(virgul + 1).trim() };
  });
}

const DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i;

export function cslOgesi(kaynak: CitableSource & { erisimTarihi?: Date | null }, id = "k"): Record<string, unknown> {
  const yil = /\d{4}/.exec(kaynak.year ?? "")?.[0];
  const baglanti = kaynak.doi_or_url?.trim() ?? "";
  const doi = DOI.exec(baglanti)?.[1];
  const oge: Record<string, unknown> = {
    id,
    type: TUR[kaynak.source_type] ?? "document",
    title: kaynak.title,
    author: cslYazarlari(kaynak.authors),
    ...(yil ? { issued: { "date-parts": [[Number(yil)]] } } : {}),
    ...(kaynak.container_title ? { "container-title": kaynak.container_title } : {}),
    ...(kaynak.volume ? { volume: kaynak.volume } : {}),
    ...(kaynak.issue ? { issue: kaynak.issue } : {}),
    ...(kaynak.pages ? { page: kaynak.pages } : {}),
    ...(kaynak.publisher ? { publisher: kaynak.publisher } : {}),
    ...(kaynak.publication_place ? { "publisher-place": kaynak.publication_place } : {}),
    ...(doi ? { DOI: doi } : baglanti ? { URL: baglanti } : {}),
  };
  if (kaynak.source_type === "website" && kaynak.erisimTarihi) {
    const t = kaynak.erisimTarihi;
    oge.accessed = { "date-parts": [[t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]] };
  }
  return oge;
}

const VARLIK: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const cozVarlik = (metin: string) =>
  metin
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (tum, ad) => VARLIK[ad] ?? tum);

/*
  citeproc'un HTML çıktısı editörün düğümlerine çevrilir: italik (dergi
  adı, kitap adı) korunur, üst simge Unicode üst simge rakama döner
  (denetçi düz metinde ¹ arıyor — lib/atif/stiller.ts), geri kalan
  etiketler (div, span, b, küçük büyük harf) düşer. Kalın ve küçük büyük
  harf az sayıda stilde var; editöre taşımak her biri için ayrı bir işaret
  demek, kaybı ise yalnızca görünüş.
*/
export function htmldenParcalar(html: string): Parca[] {
  const parcalar: Parca[] = [];
  let italik = 0;
  let ust = 0;
  const yigin: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi)) {
    if (m[4] !== undefined) {
      let metin = cozVarlik(m[4]);
      if (ust) metin = ustSimge(metin);
      const son = parcalar.at(-1);
      const it = italik > 0;
      if (son && Boolean(son.italic) === it) son.text += metin;
      else parcalar.push(it ? { text: metin, italic: true } : { text: metin });
      continue;
    }
    const [, kapanis, etiket, oz] = m;
    const ad = etiket.toLowerCase();
    if (ad === "br") continue;
    const tur = ad === "i" || ad === "em" || /font-style:\s*italic/.test(oz) ? "i" : ad === "sup" || /vertical-align:\s*sup/.test(oz) ? "s" : "-";
    if (kapanis) {
      const acilan = yigin.pop();
      if (acilan === "i") italik--;
      if (acilan === "s") ust--;
    } else {
      yigin.push(tur);
      if (tur === "i") italik++;
      if (tur === "s") ust++;
      // Künyenin sol kenar numarası ile gövdesi arasında boşluk kalsın.
      if (ad === "div" && /csl-right-inline|csl-block/.test(oz) && parcalar.length) parcalar.at(-1)!.text += " ";
    }
  }
  const temiz = parcalar.map((p) => ({ ...p, text: p.text.replace(/\s+/g, " ") }));
  if (temiz.length) {
    temiz[0].text = temiz[0].text.trimStart();
    temiz[temiz.length - 1].text = temiz.at(-1)!.text.trimEnd();
  }
  return temiz.filter((p) => p.text);
}

/*
  Numaralı stillerde numara EDİTÖRÜN sayacıdır (kaynakçadaki sıra,
  editor-navigation.ts): citeproc tek kaynakla çalıştığı için her şeye
  "1" der. İlk "1" istenen numarayla değiştirilir — atıfta ve künyede
  numara hep sayfa numarasından ÖNCE geldiği için ilk "1" numaradır.
*/
export function numarayiYaz(parcalar: Parca[], numara: number, ustSimgeli: boolean): Parca[] {
  const bir = ustSimgeli ? /(?<![\d¹⁰²³⁴⁵⁶⁷⁸⁹])¹(?![\d¹⁰²³⁴⁵⁶⁷⁸⁹])/ : /(?<!\d)1(?!\d)/;
  const yeni = ustSimgeli ? ustSimge(String(numara)) : String(numara);
  let yazildi = false;
  return parcalar.map((p) => {
    if (yazildi || !bir.test(p.text)) return p;
    yazildi = true;
    return { ...p, text: p.text.replace(bir, yeni) };
  });
}

export type CslGirdi = {
  stilXml: string;
  /** Yerel ayar dosyası (locales-xx-XX.xml); yoksa false — citeproc en-US'e düşer. */
  yerel: (dil: string) => string | false;
  kod: CslKodu;
  kaynak: CitableSource & { erisimTarihi?: Date | null };
  numara: number;
  sayfa?: string | null;
  /** Dipnot stilinde aynı kaynağa ikinci atıf: kısa biçim. */
  kisa?: boolean;
  dil: Dil;
};

export function cslBicimle(g: CslGirdi): { atif: Parca[]; kunye: Parca[] } {
  const oge = cslOgesi(g.kaynak);
  const motor = new CSL.Engine(
    { retrieveLocale: (dil) => g.yerel(dil), retrieveItem: () => oge },
    g.stilXml,
    g.dil === "en" ? "en-US" : "tr-TR",
  );
  motor.setOutputFormat("html");
  motor.updateItems([String(oge.id)]);
  const sayfa = g.sayfa?.trim();
  const atifHtml = motor.makeCitationCluster([
    { id: String(oge.id), ...(sayfa ? { locator: sayfa, label: "page" } : {}), ...(g.kisa ? { position: 1 } : {}) },
  ]);
  const kaynakca = motor.makeBibliography();
  const kunyeHtml = kaynakca ? kaynakca[1].join("") : "";
  const numarali = g.kod === "k" || g.kod === "p" || g.kod === "s";
  let atif = htmldenParcalar(atifHtml);
  let kunye = htmldenParcalar(kunyeHtml);
  if (numarali) {
    atif = numarayiYaz(atif, g.numara, g.kod === "s");
    kunye = numarayiYaz(kunye, g.numara, false);
  }
  /* Üst simge stilinde de denetçi rakamı sözcüğe yapışık arıyor; citeproc'un koyduğu boşluk atılır. */
  if (g.kod === "s" && atif[0]) atif[0] = { ...atif[0], text: atif[0].text.trimStart() };
  return { atif, kunye };
}

/** Stil XML'inin varsayılan dili (ör. "de-DE"); yerel ayar önceden indirilsin diye. */
export const stilVarsayilanDili = (xml: string) => /default-locale="([a-zA-Z-]+)"/.exec(xml)?.[1] ?? null;

/** Bağımlı stilin ebeveyni (depodaki ad). */
export const ebeveynStil = (xml: string) =>
  /<link[^>]*rel="independent-parent"[^>]*>/.exec(xml)?.[0].match(/href="https?:\/\/www\.zotero\.org\/styles\/([a-z0-9-]+)"/)?.[1] ?? null;

/**
 * Bütün kaynakça (Literatür → "Kaynakçayı kopyala"). Sıra stilin kendi
 * kuralı: yazar-tarih stilinde alfabetik, numaralıda verilen sıra
 * (citeproc numarayı kayıt sırasına göre verir).
 */
export function cslKaynakcaBicimle(g: {
  stilXml: string;
  yerel: (dil: string) => string | false;
  kaynaklar: (CitableSource & { erisimTarihi?: Date | null })[];
  dil: Dil;
}): Parca[][] {
  const ogeler = new Map(g.kaynaklar.map((k, i) => [`k${i}`, cslOgesi(k, `k${i}`)]));
  const motor = new CSL.Engine(
    { retrieveLocale: (dil) => g.yerel(dil), retrieveItem: (id) => ogeler.get(id) ?? {} },
    g.stilXml,
    g.dil === "en" ? "en-US" : "tr-TR",
  );
  motor.setOutputFormat("html");
  motor.updateItems([...ogeler.keys()]);
  const kaynakca = motor.makeBibliography();
  return kaynakca ? kaynakca[1].map(htmldenParcalar).filter((p) => p.length) : [];
}
