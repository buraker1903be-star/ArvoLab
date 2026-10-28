/*
  KAYNAK İÇE / DIŞA AKTARMA (27.10.2026, kurum sahibinin isteği).

  Öğrencilerin çoğu kaynaklarını Zotero, Mendeley ya da EndNote'ta
  topluyor; ArvoLab'a tek tek elle girmek zorundaydılar ve vazgeçip
  kaynakçayı Word'de elle yazıyorlardı. Bu modül iki standart biçimi
  okur ve yazar:
  - RIS (Zotero, Mendeley, EndNote, Web of Science, Scopus, ULAKBİM)
  - BibTeX (Zotero, Mendeley, Google Scholar, LaTeX)
  Ayrıca yapıştırılan metindeki DOI'leri ayıklar ve seçili atıf stilinde
  düz metin / HTML kaynakça üretir.

  Yazarlar ArvoLab'ın künye biçimine çevrilir: "Soyad, A. B., & Soyad, C."
  (Crossref'ten gelen künyeyle aynı; lib/doi.ts formatAuthors).
  Okunamayan alan uydurulmaz, boş kalır; başlığı olmayan kayıt atlanır.

  Saf modül; testi tests/unit/kaynak-aktarim.test.ts.
*/
import { formatAuthors } from "@/lib/doi";
import { formatReferenceParts, splitAuthors, surname, NUMERIC_STYLES, type CitableSource, type CitationStyle } from "@/lib/citation-format";

export type KaynakTuru = "article" | "book" | "chapter" | "thesis" | "report" | "website" | "other";

export interface KaynakTaslagi {
  title: string;
  authors: string | null;
  year: string | null;
  sourceType: KaynakTuru;
  doiOrUrl: string | null;
  containerTitle: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
}

export const ICE_AKTARMA_EN_COK = 1000;

const temiz = (deger: string | null | undefined, enCok = 500) => {
  const t = (deger ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, enCok) : null;
};

/*
  KURUM YAZAR (28.10.2026). "Milli Eğitim Bakanlığı" kişi adı gibi
  bölünüyor, "Bakanlığı, M. E." oluyordu; Zotero'nun {{World Health
  Organization}} yazımı da "Organization, W. H." Türkçe tezlerde kurum
  yazarı çok yaygın (MEB, TÜİK, YÖK, bakanlıklar) ve bozuk künye öğrencinin
  kaynakçasına doğrudan geçiyordu.

  RIS'te kişi ile kurumu ayıran bir işaret yok; kurum adının imzası olan
  sözcüklere ve tamamı büyük harf kısaltmalara bakılıyor. Üç sözcüklü bir
  kişi adı ("Ahmet Faruk Yılmaz") bu yüzden kişi olarak kalıyor.
*/
const KURUM_SOZCUGU =
  /* \b ASCII tabanlı: "bakanlığı"nın sonundaki "ı"dan sonra sınır oluşmuyor. */
  /(?<!\p{L})(bakanlığı|başkanlığı|müdürlüğü|üniversitesi|enstitüsü|kurumu|kurulu|derneği|vakfı|odası|merkezi|ministry|university|institute|organi[sz]ation|association|council|agency|department|office|commission|foundation|society|bank|bureau|committee|center|centre)(?!\p{L})/iu;

export function kurumYazariMi(ad: string): boolean {
  const t = ad.trim();
  if (!t || t.includes(",")) return false;
  if (/^[\p{Lu}\d&.-]{2,}$/u.test(t)) return true; // OECD, TÜİK, WHO
  return KURUM_SOZCUGU.test(t.toLocaleLowerCase("tr-TR"));
}

/* "Yılmaz, Ahmet" ya da "Ahmet Yılmaz" → { family, given }; kurum → { name } */
function kisiAyristir(ham: string): { family?: string; given?: string; name?: string } {
  const t = ham.replace(/\s+/g, " ").trim();
  if (!t) return {};
  if (kurumYazariMi(t)) return { name: t };
  if (t.includes(",")) {
    const [family, ...given] = t.split(",");
    return { family: family.trim(), given: given.join(" ").trim() || undefined };
  }
  const parcalar = t.split(" ");
  if (parcalar.length === 1) return { family: parcalar[0] };
  return { family: parcalar[parcalar.length - 1], given: parcalar.slice(0, -1).join(" ") };
}

const yazarlar = (liste: string[]) => (liste.length ? formatAuthors(liste.map(kisiAyristir).filter((k) => k.family || k.name)) : null);

function yilAyikla(deger: string | null | undefined) {
  const m = (deger ?? "").match(/\b(1[5-9]\d\d|20\d\d)\b/);
  return m ? m[1] : null;
}

const sayfalar = (bas: string | null, son: string | null) => {
  const b = temiz(bas, 20);
  const s = temiz(son, 20);
  return b && s ? `${b}-${s}` : b;
};

/* ---------- RIS ---------- */

const RIS_TUR: Record<string, KaynakTuru> = {
  JOUR: "article", JFULL: "article", MGZN: "article", NEWS: "article", CPAPER: "article", CONF: "article", EJOUR: "article",
  BOOK: "book", EBOOK: "book", EDBOOK: "book",
  CHAP: "chapter", ECHAP: "chapter",
  THES: "thesis",
  RPRT: "report", GOVDOC: "report",
  ELEC: "website", WEB: "website", BLOG: "website",
};

/** RIS metni → kaynak taslakları. Her kayıt "TY  - " ile başlar, "ER  - " ile biter. */
export function risOku(metin: string): KaynakTaslagi[] {
  const kayitlar: KaynakTaslagi[] = [];
  let alanlar: Record<string, string[]> | null = null;
  const bitir = () => {
    if (!alanlar) return;
    const a = (k: string) => alanlar![k]?.[0] ?? null;
    const ilk = (...k: string[]) => k.map(a).find((v) => v && v.trim()) ?? null;
    const baslik = temiz(ilk("TI", "T1", "CT", "BT"));
    const tur = RIS_TUR[(a("TY") ?? "").trim().toUpperCase()] ?? "other";
    if (baslik) {
      const doi = temiz(a("DO"), 300);
      kayitlar.push({
        title: baslik,
        authors: yazarlar([...(alanlar.AU ?? []), ...(alanlar.A1 ?? [])]),
        year: yilAyikla(ilk("PY", "Y1", "DA")),
        sourceType: tur,
        doiOrUrl: doi ? doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : temiz(a("UR"), 500),
        /* Kitap bölümünde T2 kitabın adı; makalede dergi adı. */
        containerTitle: temiz(ilk("T2", "JO", "JF", "JA", "J2")),
        volume: temiz(a("VL"), 40),
        issue: temiz(a("IS"), 40),
        pages: sayfalar(a("SP"), a("EP")),
        publisher: temiz(tur === "thesis" ? ilk("PB", "IN") : a("PB"), 300),
      });
    }
    alanlar = null;
  };
  for (const satir of metin.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = satir.match(/^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/);
    if (!m) continue;
    const [, etiket, deger] = m;
    if (etiket === "TY") {
      bitir();
      alanlar = { TY: [deger] };
    } else if (etiket === "ER") bitir();
    else if (alanlar) (alanlar[etiket] ??= []).push(deger);
  }
  bitir();
  return kayitlar;
}

/* ---------- BibTeX ---------- */

const BIB_TUR: Record<string, KaynakTuru> = {
  article: "article", inproceedings: "article", conference: "article",
  book: "book", booklet: "book", proceedings: "book",
  incollection: "chapter", inbook: "chapter",
  phdthesis: "thesis", mastersthesis: "thesis", thesis: "thesis",
  techreport: "report", report: "report",
  online: "website", misc: "other", unpublished: "other",
};

/* LaTeX aksanları (Türkçe ve yaygın Avrupa harfleri) ve süslü parantezler. */
const LATEX: [RegExp, string][] = [
  [/\{\\c\s*\{?s\}?\}|\\c\{s\}|\\c s/g, "ş"], [/\{\\c\s*\{?S\}?\}|\\c\{S\}|\\c S/g, "Ş"],
  [/\{\\c\s*\{?c\}?\}|\\c\{c\}|\\c c/g, "ç"], [/\{\\c\s*\{?C\}?\}|\\c\{C\}|\\c C/g, "Ç"],
  [/\{\\u\s*\{?g\}?\}|\\u\{g\}|\\u g/g, "ğ"], [/\{\\u\s*\{?G\}?\}|\\u\{G\}|\\u G/g, "Ğ"],
  [/\{\\i\}|\\i\b/g, "ı"], [/\{\\\.\s*\{?I\}?\}|\\\.\{I\}|\\\.I/g, "İ"],
  [/\{\\"\s*\{?o\}?\}|\\"\{o\}|\\"o/g, "ö"], [/\{\\"\s*\{?O\}?\}|\\"\{O\}|\\"O/g, "Ö"],
  [/\{\\"\s*\{?u\}?\}|\\"\{u\}|\\"u/g, "ü"], [/\{\\"\s*\{?U\}?\}|\\"\{U\}|\\"U/g, "Ü"],
  [/\{\\"\s*\{?a\}?\}|\\"\{a\}|\\"a/g, "ä"], [/\{\\'\s*\{?e\}?\}|\\'\{e\}|\\'e/g, "é"],
  [/\\&/g, "&"], [/--/g, "-"], [/~/g, " "],
];

function latexCoz(deger: string) {
  let t = deger;
  for (const [desen, harf] of LATEX) t = t.replace(desen, harf);
  return t.replace(/[{}]/g, "");
}

/*
  BibTeX yazar listesi: " and " yalnızca en dış düzeyde bölünür; tamamı
  süslü paranteze alınmış yazar ({World Health Organization}) kurumdur ve
  olduğu gibi kalır — BibTeX'in kendi kuralı bu.
*/
/** Metnin tamamı TEK bir {…} grubu mu (ilk "{" son karakterde kapanıyor mu)? */
function tekGrupMu(t: string): boolean {
  if (!t.startsWith("{")) return false;
  let derinlik = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "{") derinlik++;
    else if (t[i] === "}" && --derinlik === 0) return i === t.length - 1;
  }
  return false;
}

function bibYazarlari(ham: string): string | null {
  const parcalar: string[] = [];
  let derinlik = 0;
  let bas = 0;
  for (let i = 0; i < ham.length; i++) {
    if (ham[i] === "{") derinlik++;
    else if (ham[i] === "}") derinlik--;
    else if (derinlik === 0 && /^\s+and\s+/i.test(ham.slice(i)) && /\s/.test(ham[i])) {
      parcalar.push(ham.slice(bas, i));
      const eslesme = ham.slice(i).match(/^\s+and\s+/i)!;
      i += eslesme[0].length - 1;
      bas = i + 1;
    }
  }
  parcalar.push(ham.slice(bas));
  const kisiler = parcalar
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const tumuParantezli = tekGrupMu(p);
      const ad = latexCoz(p).replace(/\s+/g, " ").trim();
      return tumuParantezli ? { name: ad } : kisiAyristir(ad);
    })
    .filter((k) => k.family || k.name);
  return kisiler.length ? formatAuthors(kisiler) : null;
}

/* Bir alan değerini okur: {…} (iç içe), "…" ya da çıplak sözcük/sayı. Konum döner. */
function degerOku(metin: string, i: number): [string, number] {
  while (/\s/.test(metin[i] ?? "")) i += 1;
  const parca: string[] = [];
  for (;;) {
    while (/\s/.test(metin[i] ?? "")) i += 1;
    const c = metin[i];
    if (c === "{") {
      let derinlik = 0;
      const bas = i;
      for (; i < metin.length; i += 1) {
        if (metin[i] === "{") derinlik += 1;
        else if (metin[i] === "}" && --derinlik === 0) break;
      }
      parca.push(metin.slice(bas + 1, i));
      i += 1;
    } else if (c === '"') {
      let derinlik = 0;
      const bas = i + 1;
      for (i += 1; i < metin.length; i += 1) {
        if (metin[i] === "{") derinlik += 1;
        else if (metin[i] === "}") derinlik -= 1;
        else if (metin[i] === '"' && derinlik === 0) break;
      }
      parca.push(metin.slice(bas, i));
      i += 1;
    } else {
      const m = metin.slice(i).match(/^[^,}#\s]+/);
      parca.push(m ? m[0] : "");
      i += m ? m[0].length : 0;
    }
    while (/\s/.test(metin[i] ?? "")) i += 1;
    if (metin[i] === "#") {
      i += 1;
      continue;
    }
    return [parca.join(""), i];
  }
}

/** BibTeX metni → kaynak taslakları. @comment, @string, @preamble atlanır. */
export function bibtexOku(metin: string): KaynakTaslagi[] {
  const kayitlar: KaynakTaslagi[] = [];
  const desen = /@(\w+)\s*[{(]/g;
  let m: RegExpExecArray | null;
  while ((m = desen.exec(metin))) {
    const tur = m[1].toLowerCase();
    let i = desen.lastIndex;
    if (["comment", "string", "preamble"].includes(tur)) continue;
    /* Anahtar (ilk virgüle kadar) */
    const virgul = metin.indexOf(",", i);
    if (virgul < 0) break;
    i = virgul + 1;
    const alanlar: Record<string, string> = {};
    for (;;) {
      while (/[\s,]/.test(metin[i] ?? "")) i += 1;
      if (i >= metin.length || metin[i] === "}" || metin[i] === ")") break;
      const ad = metin.slice(i).match(/^([\w-]+)\s*=/);
      if (!ad) break;
      i += ad[0].length;
      const [deger, son] = degerOku(metin, i);
      alanlar[ad[1].toLowerCase()] = latexCoz(deger);
      /* Yazar alanı süslü parantezleriyle de saklanır: {Kurum Adı} BibTeX'te "bölme" demek. */
      if (ad[1].toLowerCase() === "author") alanlar.__yazarHam = deger;
      i = son;
    }
    desen.lastIndex = i;
    const baslik = temiz(alanlar.title);
    if (!baslik) continue;
    const kaynakTuru = BIB_TUR[tur] ?? "other";
    const doi = temiz(alanlar.doi, 300);
    kayitlar.push({
      title: baslik,
      authors: bibYazarlari(alanlar.__yazarHam ?? ""),
      year: yilAyikla(alanlar.year ?? alanlar.date),
      sourceType: kaynakTuru,
      doiOrUrl: doi ? doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : temiz(alanlar.url, 500),
      containerTitle: temiz(alanlar.journal ?? alanlar.journaltitle ?? alanlar.booktitle),
      volume: temiz(alanlar.volume, 40),
      issue: temiz(alanlar.number ?? alanlar.issue, 40),
      pages: temiz(alanlar.pages?.replace(/-+/g, "-"), 40),
      publisher: temiz(alanlar.publisher ?? alanlar.school ?? alanlar.institution, 300),
    });
  }
  return kayitlar;
}

/** Dosya adına ve içeriğe göre biçim seçer. */
export function kaynakDosyasiOku(ad: string, metin: string): { bicim: "ris" | "bibtex" | null; kayitlar: KaynakTaslagi[] } {
  const ris = /\.ris$/i.test(ad) || /^\s*TY {2}- /m.test(metin);
  const bib = /\.(bib|bibtex)$/i.test(ad) || /@\w+\s*[{(]/.test(metin);
  if (ris) return { bicim: "ris", kayitlar: risOku(metin) };
  if (bib) return { bicim: "bibtex", kayitlar: bibtexOku(metin) };
  return { bicim: null, kayitlar: [] };
}

/* ---------- Aynı kaynak ---------- */

/** Tekrar anahtarı: DOI varsa DOI, yoksa harf-sayıya indirgenmiş başlık + yıl. */
export function kaynakAnahtari(k: { title: string; year: string | null; doiOrUrl?: string | null; doi_or_url?: string | null }) {
  const doi = (k.doiOrUrl ?? k.doi_or_url ?? "").match(/10\.\d{4,9}\/\S+/);
  if (doi) return `doi:${doi[0].toLowerCase().replace(/[.,;]+$/, "")}`;
  const baslik = k.title.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, "");
  return `b:${baslik}:${k.year ?? ""}`;
}

/* ---------- DOI ayıklama ---------- */

export const DOI_TOPLU_EN_COK = 50;

/** Yapıştırılan metindeki DOI'ler (bağlantı, "doi:" ya da çıplak), benzersiz ve sırasıyla. */
export function doiAyikla(metin: string): string[] {
  const bulunan = metin.match(/10\.\d{4,9}\/[^\s"'<>]+/g) ?? [];
  const sonuc: string[] = [];
  for (const ham of bulunan) {
    const doi = ham.replace(/[.,;)\]]+$/, "");
    if (!sonuc.some((d) => d.toLowerCase() === doi.toLowerCase())) sonuc.push(doi);
  }
  return sonuc;
}

/* ---------- Dışa aktarma ---------- */

export interface AktarilacakKaynak extends CitableSource {
  title: string;
}

const RIS_TUR_YAZ: Record<string, string> = { article: "JOUR", book: "BOOK", chapter: "CHAP", thesis: "THES", report: "RPRT", website: "ELEC", other: "GEN" };

export function risYaz(kaynaklar: AktarilacakKaynak[]): string {
  return kaynaklar
    .map((k) => {
      const s: string[] = [`TY  - ${RIS_TUR_YAZ[k.source_type] ?? "GEN"}`];
      for (const a of splitAuthors(k.authors)) s.push(`AU  - ${a}`);
      s.push(`TI  - ${k.title}`);
      if (k.year) s.push(`PY  - ${k.year}`);
      if (k.container_title) s.push(`T2  - ${k.container_title}`);
      if (k.volume) s.push(`VL  - ${k.volume}`);
      if (k.issue) s.push(`IS  - ${k.issue}`);
      if (k.pages) {
        const [bas, son] = k.pages.split(/[-–]/);
        s.push(`SP  - ${bas.trim()}`);
        if (son) s.push(`EP  - ${son.trim()}`);
      }
      if (k.publisher) s.push(`PB  - ${k.publisher}`);
      const doi = k.doi_or_url?.match(/10\.\d{4,9}\/\S+/);
      if (doi) s.push(`DO  - ${doi[0]}`);
      else if (k.doi_or_url) s.push(`UR  - ${k.doi_or_url}`);
      s.push("ER  - ");
      return s.join("\r\n");
    })
    .join("\r\n\r\n");
}

const BIB_TUR_YAZ: Record<string, string> = { article: "article", book: "book", chapter: "incollection", thesis: "phdthesis", report: "techreport", website: "online", other: "misc" };
const bibKacis = (t: string) => t.replace(/([&%$#_])/g, "\\$1").replace(/[{}]/g, "");

export function bibtexYaz(kaynaklar: AktarilacakKaynak[]): string {
  const kullanilan = new Set<string>();
  return kaynaklar
    .map((k) => {
      /* Anahtar: soyad + yıl (+ harf), ASCII. */
      const temel =
        `${surname(splitAuthors(k.authors)[0] ?? "kaynak")}${k.year ?? ""}`
          .normalize("NFD")
          .replace(/ı/g, "i")
          .replace(/[^A-Za-z0-9]/g, "") || "kaynak";
      let anahtar = temel;
      for (let i = 0; kullanilan.has(anahtar); i += 1) anahtar = `${temel}${String.fromCharCode(97 + i)}`;
      kullanilan.add(anahtar);
      const alan: [string, string | null | undefined][] = [
        ["author", splitAuthors(k.authors).join(" and ") || null],
        ["title", k.title],
        ["year", k.year],
        [k.source_type === "article" ? "journal" : "booktitle", k.source_type === "article" || k.source_type === "chapter" ? k.container_title : null],
        ["volume", k.volume],
        ["number", k.issue],
        ["pages", k.pages?.replace(/[-–]/, "--")],
        [k.source_type === "thesis" ? "school" : "publisher", k.publisher],
        ["doi", k.doi_or_url?.match(/10\.\d{4,9}\/\S+/)?.[0]],
        ["url", k.doi_or_url && !/10\.\d{4,9}\//.test(k.doi_or_url) ? k.doi_or_url : null],
      ];
      const govde = alan.filter(([, v]) => v).map(([ad, v]) => `  ${ad} = {${bibKacis(String(v))}}`);
      return `@${BIB_TUR_YAZ[k.source_type] ?? "misc"}{${anahtar},\n${govde.join(",\n")}\n}`;
    })
    .join("\n\n");
}

/*
  KAYNAKÇA METNİ: seçili stilde, sıralanmış. Yazar-tarih stillerinde
  (APA, Chicago, MLA) ilk yazarın soyadına göre alfabetik (Türkçe
  sıralama), sonra yıl; sayısal stillerde (IEEE, Vancouver) verilen sıra
  korunur — numara metindeki ilk atıf sırasıdır ve o sıra editörde. HTML
  sürümü italikleri taşır: Word'e yapıştırınca dergi adları italik kalır.
*/
export function kaynakcaMetni(kaynaklar: AktarilacakKaynak[], stil: CitationStyle, secenek: { erisimTarihi?: string | null } = {}) {
  const sirali = NUMERIC_STYLES.includes(stil)
    ? [...kaynaklar]
    : [...kaynaklar].sort((a, b) => {
        /* Yazarsız kaynak başlığıyla sıralanır (APA 9.44). */
        const anahtar = (k: AktarilacakKaynak) => {
          const ilk = splitAuthors(k.authors)[0];
          return ilk ? surname(ilk) : k.title;
        };
        const sa = anahtar(a);
        const sb = anahtar(b);
        return sa.localeCompare(sb, "tr", { sensitivity: "base" }) || (a.year ?? "").localeCompare(b.year ?? "");
      });
  const parcalar = sirali.map((k, i) => formatReferenceParts(k, stil, i + 1, secenek));
  const kacis = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    /** Ekranda çizmek için parçalar (italik ayrımıyla); HTML'i sayfaya basmak gerekmesin. */
    satirlar: parcalar,
    metin: parcalar.map((p) => p.map((x) => x.text).join("")).join("\n"),
    html: parcalar.map((p) => `<p>${p.map((x) => (x.italic ? `<i>${kacis(x.text)}</i>` : kacis(x.text))).join("")}</p>`).join(""),
  };
}
