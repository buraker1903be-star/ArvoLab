// Literatür kaynağından metin içi atıf ve kaynakça girdisi üretir (istemci + sunucu).
// Yazar alanı serbest metindir ("Yılmaz, A., & Demir, B." ya da "Ahmet Yılmaz; Ayşe Demir");
// soyadları sezgisel olarak çıkarılır. Türkçe APA kullanımı: "ve", "vd.", "t.y.".
//
// İNGİLİZCE (28.10.2026): `dil` buradaki işlevlerde atıfın ve künyenin
// DİLİdir ("and"/"&", "et al.", "n.d.", "p./pp.", "Accessed"). Metin
// öğrencinin çalışmasına giriyor; çağıran arayüz dilini değil çalışmanın
// dilini vermeli — İngilizce arayüz kullanan öğrenci Türkçe tez yazabilir.

import type { Dil } from "@/lib/dil";

export interface CitableSource {
  title: string;
  authors: string | null;
  year: string | null;
  source_type: string;
  doi_or_url: string | null;
  /** Dergi / kitap (bölüm için) adı */
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
}

export type CitationStyle = "apa7" | "harvard" | "chicago" | "ieee" | "vancouver" | "mla";

export const NUMERIC_STYLES: CitationStyle[] = ["ieee", "vancouver"];

export function splitAuthors(authors: string | null): string[] {
  const raw = (authors ?? "").trim();
  if (!raw) return [];
  const parts = raw.includes(";")
    ? raw.split(";")
    : raw
        .split(/\s*(?:&|\bve\b|\band\b)\s*/i)
        // "Yılmaz, A., Demir, B." → "Yılmaz, A." | "Demir, B."
        .flatMap((part) => part.split(/,\s*(?=[\p{Lu}][\p{L}'’-]+,\s*[\p{Lu}]\.)/u));
  return parts.map((part) => part.trim().replace(/^,|,$/g, "").trim()).filter(Boolean);
}

export function surname(author: string): string {
  const value = author.trim();
  if (value.includes(",")) return value.split(",")[0].trim();
  const words = value.split(/\s+/);
  return words[words.length - 1] ?? value;
}

const yearOf = (source: CitableSource, dil: Dil = "tr") => source.year?.trim() || (dil === "en" ? "n.d." : "t.y.");
/** Ardından nokta gelen yerlerde yıl: "t.y." sonundaki nokta düşer ("t.y.." olmasın) */
const yearText = (source: CitableSource, dil: Dil = "tr") => yearOf(source, dil).replace(/\.$/, "");

/*
  İki yazar bağlacı: Türkçede her yerde "ve"; İngilizce APA'da parantez
  içinde "&", anlatıda ve öteki stillerde "and".
*/
function yazarEtiketi(source: CitableSource, dil: Dil, baglac: string): string {
  const names = splitAuthors(source.authors).map(surname);
  if (names.length === 0) return source.title.split(/\s+/).slice(0, 3).join(" ");
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ${baglac} ${names[1]}`;
  return `${names[0]} ${dil === "en" ? "et al." : "vd."}`;
}

/*
  Harvard (Cite Them Right) üç yazara kadar hepsini yazar: "Smith, Jones
  and Brown"; dört ve üstü "et al.". APA ve Chicago üçte kısaltıyor.
*/
function harvardEtiketi(source: CitableSource, dil: Dil): string {
  const names = splitAuthors(source.authors).map(surname);
  const baglac = dil === "en" ? "and" : "ve";
  if (names.length === 3) return `${names[0]}, ${names[1]} ${baglac} ${names[2]}`;
  return yazarEtiketi(source, dil, baglac);
}

/** APA/Chicago metin içi atıf etiketi: "Yılmaz", "Yılmaz ve Demir", "Yılmaz vd." */
export function authorLabel(source: CitableSource, dil: Dil = "tr"): string {
  return yazarEtiketi(source, dil, dil === "en" ? "and" : "ve");
}

/*
  Sayfa: öğrencinin atıf penceresine yazdığı. "14" → "s. 14", "14-16" →
  "ss. 14-16"; öğrenci "s." yazdıysa ikinci kez eklenmez. Sayfa
  numarasını yalnızca alıntıyı yapan bilir; boşsa atıfa hiç girmez —
  sayfa uydurmak, yanlış sayfa yazmaktır.
*/
export function sayfaEtiketi(sayfa: string | null | undefined, dil: Dil = "tr"): string | null {
  const temiz = (sayfa ?? "").trim().replace(/^s{1,2}\.\s*/i, "").replace(/^pp?\.\s*/i, "");
  if (!temiz) return null;
  const aralik = /[-–]/.test(temiz);
  if (dil === "en") return `${aralik ? "pp." : "p."} ${temiz}`;
  return `${aralik ? "ss." : "s."} ${temiz}`;
}

export type AtifSecenegi = { sayfa?: string | null };

/*
  METİN İÇİ ATIF — "HEPSİ OLSUN, GEREKSİZİ SİLİNSİN" (26.10.2026, kurum
  sahibinin geri bildirimi: "bazı danışmanlar atıfları virgülüne kadar
  önemsiyor; yıl hepsinde olması daha sağlıklı, eklemektense çıkarmak
  daha basit").

  Eskiden MLA atıfı yalnızca yazarı yazıyordu: "(Yılmaz)". MLA'nın kendi
  kuralı bu, ama Türk tez kılavuzlarının çoğu yazar–yıl istiyor ve
  öğrenci eksik yılı her atıfta elle ekliyordu. Artık yazar–tarih
  atıflarının hepsinde yıl var: "(Yılmaz 2020)"; kılavuzu istemiyorsa
  öğrenci siler.
*/
export function formatInTextCitation(
  source: CitableSource,
  style: CitationStyle,
  number: number,
  secenek: AtifSecenegi = {},
  dil: Dil = "tr",
): string {
  const sayfa = sayfaEtiketi(secenek.sayfa, dil);
  const yil = yearOf(source, dil);
  const etiket = authorLabel(source, dil);
  switch (style) {
    case "ieee":
      return sayfa ? `[${number}, ${sayfa}]` : `[${number}]`;
    case "vancouver":
      return sayfa ? `(${number}, ${sayfa})` : `(${number})`;
    case "chicago":
      return `(${etiket} ${yil}${sayfa ? `, ${sayfa}` : ""})`;
    case "mla":
      return `(${etiket} ${yil}${sayfa ? `, ${sayfa}` : ""})`;
    case "harvard":
      return `(${harvardEtiketi(source, dil)}, ${yil}${sayfa ? `, ${sayfa}` : ""})`;
    default: {
      const apaEtiketi = dil === "en" ? yazarEtiketi(source, dil, "&") : etiket;
      return `(${apaEtiketi}, ${yil}${sayfa ? `, ${sayfa}` : ""})`;
    }
  }
}

/*
  KÜNYEDE EKSİK BİLGİ: türüne göre beklenen alanlardan boş olanlar.
  Atıf penceresi bunları söylüyor ve kaynağı düzenlemeye götürüyor;
  eksik bilgiyi sistem uydurmaz. Eskiden boş alan künyeden sessizce
  düşüyordu ve öğrenci eksikliği ancak danışmanından öğreniyordu.
*/
/* Alan adları arayüzde gösteriliyor; burada `dil` arayüzün dili. */
const ALAN_ADI = {
  yazar: { tr: "yazar", en: "author" },
  yil: { tr: "yıl", en: "year" },
  dergi: { tr: "dergi adı", en: "journal name" },
  cilt: { tr: "cilt", en: "volume" },
  sayi: { tr: "sayı", en: "issue" },
  sayfa: { tr: "sayfa aralığı", en: "page range" },
  doi: { tr: "DOI", en: "DOI" },
  kitap: { tr: "kitap adı", en: "book title" },
  yayinevi: { tr: "yayınevi", en: "publisher" },
  universite: { tr: "üniversite", en: "university" },
  url: { tr: "adres (URL)", en: "address (URL)" },
} as const;

export function eksikAlanlar(source: CitableSource, dil: Dil = "tr"): string[] {
  const bos = (deger: string | null | undefined) => !deger?.trim();
  const eksik: string[] = [];
  const ekle = (alan: keyof typeof ALAN_ADI) => eksik.push(ALAN_ADI[alan][dil]);
  if (bos(source.authors)) ekle("yazar");
  if (bos(source.year)) ekle("yil");
  switch (source.source_type) {
    case "article":
      if (bos(source.container_title)) ekle("dergi");
      if (bos(source.volume)) ekle("cilt");
      if (bos(source.issue)) ekle("sayi");
      if (bos(source.pages)) ekle("sayfa");
      if (bos(source.doi_or_url)) ekle("doi");
      break;
    case "chapter":
      if (bos(source.container_title)) ekle("kitap");
      if (bos(source.pages)) ekle("sayfa");
      if (bos(source.publisher)) ekle("yayinevi");
      break;
    case "book":
    case "thesis":
    case "report":
      if (bos(source.publisher)) ekle(source.source_type === "thesis" ? "universite" : "yayinevi");
      break;
    case "website":
      if (bos(source.doi_or_url)) ekle("url");
      break;
  }
  return eksik;
}

function link(source: CitableSource): string | null {
  const value = source.doi_or_url?.trim();
  if (!value) return null;
  if (/^10\.\d{4,}\//.test(value)) return `https://doi.org/${value}`;
  return value;
}

const ITALIC_TITLE_TYPES = new Set(["book", "thesis", "report", "website"]);

interface TextPart {
  text: string;
  italic?: boolean;
}

const field = (value: string | null | undefined) => value?.trim() || null;

/** Kaynakça girdisi (italik ayrımıyla, Tiptap metin düğümlerine çevrilebilir) */
/*
  ERİŞİM TARİHİ: internet kaynağında künyenin sonuna. APA 7 yalnızca
  değişen sayfalarda istiyor, Türk tez kılavuzlarının çoğu her internet
  kaynağında istiyor; eklemek, sonradan aramaktan kolay (kurum sahibinin
  geri bildirimi). Tarih dışarıdan verilir: modül saf kalsın.
*/
export type KunyeSecenegi = { erisimTarihi?: string | null };

export function formatReferenceParts(
  source: CitableSource,
  style: CitationStyle,
  number: number,
  secenek: KunyeSecenegi = {},
  dil: Dil = "tr",
): TextPart[] {
  const en = dil === "en";
  const yil = () => yearOf(source, dil);
  const yilYazisi = () => yearText(source, dil);
  const authors = (source.authors ?? "").trim();
  const title = source.title.trim().replace(/\.$/, "");
  const url = link(source);
  const italic = ITALIC_TITLE_TYPES.has(source.source_type);
  const container = field(source.container_title);
  const volume = field(source.volume);
  const issue = field(source.issue);
  const pages = field(source.pages);
  const publisher = field(source.publisher);
  const isChapter = source.source_type === "chapter";
  const parts: TextPart[] = [];
  const push = (text: string, isItalic = false) => {
    if (text) parts.push(isItalic ? { text, italic: true } : { text });
  };

  switch (style) {
    case "ieee": {
      push(`[${number}] ${authors ? `${authors}, ` : ""}`);
      if (italic) push(title, true);
      else push(`"${title},"`);
      if (container) {
        push(isChapter ? " in " : " ");
        push(container, true);
        push(",");
      }
      if (volume) push(` vol. ${volume},`);
      if (issue) push(` no. ${issue},`);
      if (pages) push(` pp. ${pages},`);
      if (publisher && !container) push(` ${publisher},`);
      push(` ${yilYazisi()}.${url ? ` ${url}` : ""}`);
      break;
    }
    case "vancouver": {
      push(`${number}. ${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${title}. `);
      if (container) push(`${isChapter ? "In: " : ""}${container}. `);
      if (publisher && !container) push(`${publisher}; `);
      push(`${yil()}`);
      if (volume) push(`;${volume}${issue ? `(${issue})` : ""}`);
      if (pages) push(`:${pages}`);
      // "t.y." ile biterse ikinci nokta eklenmez
      push(`${!volume && !pages && yil().endsWith(".") ? "" : "."}${url ? ` ${url}` : ""}`);
      break;
    }
    case "chicago": {
      push(`${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${yilYazisi()}. `);
      if (italic && !container) push(title, true);
      else push(`"${title}."`);
      if (container) {
        push(isChapter ? " In " : " ");
        push(container, true);
        if (volume) push(` ${volume}`);
        if (issue) push(` (${issue})`);
        if (pages) push(`${isChapter ? ", " : ": "}${pages}`);
        push(".");
      }
      if (publisher && (isChapter || !container)) push(` ${publisher}.`);
      if (url) push(` ${url}`);
      break;
    }
    case "mla": {
      // MLA 9: Yazar. "Başlık." *Kapsayıcı*, cilt, sayı, yıl, ss. sayfalar. URL
      push(`${authors ? `${authors.replace(/\.$/, "")}. ` : ""}`);
      if (container) push(`“${title}.” `);
      else push(title, italic);
      if (container) {
        push(container, true);
        if (volume) push(`, ${en ? "vol." : "c."} ${volume}`);
        if (issue) push(`, ${en ? "no." : "sy."} ${issue}`);
        if (publisher && isChapter) push(`, ${publisher}`);
        push(`, ${yilYazisi()}`);
        if (pages) push(`, ${en ? "pp." : "ss."} ${pages}`);
        push(".");
      } else {
        push(".");
        if (publisher) push(` ${publisher},`);
        push(` ${yilYazisi()}.`);
      }
      if (url) push(` ${url}`);
      break;
    }
    case "harvard": {
      /*
        Harvard (Cite Them Right): Yazar (Yıl) 'Başlık', *Dergi*,
        cilt(sayı), ss. sayfalar. Erişim adresi: URL. Yıldan sonra nokta
        YOK; makale/bölüm başlığı tek tırnakta, kitap başlığı italik.
        Yazar listesindeki "&" Harvard'da "and"/"ve" (APA alışkanlığıyla
        girilmiş yazar alanı burada çevriliyor).
      */
      const yazarlar = authors.replace(/,?\s*&\s*/g, en ? " and " : " ve ");
      push(`${yazarlar ? `${yazarlar} ` : ""}(${yil()}) `);
      const sayfaOn = en ? "pp." : "ss.";
      if (container && !isChapter) {
        push(`‘${title}’, `);
        push(container, true);
        if (volume) push(`, ${volume}${issue ? `(${issue})` : ""}`);
        else if (issue) push(`, (${issue})`);
        if (pages) push(`, ${sayfaOn} ${pages}`);
        push(".");
      } else if (isChapter && container) {
        push(`‘${title}’, ${en ? "in" : "içinde"} `);
        push(container, true);
        push(".");
        if (publisher) push(` ${publisher}`);
        push(`${pages ? `, ${sayfaOn} ${pages}` : ""}.`);
      } else {
        push(title, italic);
        push(".");
        if (publisher) push(` ${publisher}.`);
      }
      if (url) push(en ? ` Available at: ${url}` : ` Erişim adresi: ${url}`);
      break;
    }
    default: {
      // APA 7: Yazar (Yıl). Başlık. *Dergi*, *Cilt*(Sayı), sayfalar. DOI
      push(`${authors ? `${authors} ` : ""}(${yil()}). `);
      if (container && !isChapter) {
        push(`${title}. `);
        push(container, true);
        if (volume) {
          push(", ");
          push(volume, true);
        }
        if (issue) push(`(${issue})`);
        if (pages) push(`, ${pages}`);
        push(".");
      } else if (isChapter && container) {
        push(`${title}. In `);
        push(container, true);
        push(`${pages ? ` (${en ? "pp." : "ss."} ${pages})` : ""}.`);
        if (publisher) push(` ${publisher}.`);
      } else {
        push(title, italic);
        push(".");
        if (publisher) push(` ${publisher}.`);
      }
      if (url) push(` ${url}`);
    }
  }
  if (source.source_type === "website" && url && secenek.erisimTarihi) {
    // Harvard'ın erişim notu iki noktalı: "(Accessed: 12 March 2026)".
    push(en ? ` (Accessed${style === "harvard" ? ":" : ""} ${secenek.erisimTarihi})` : ` (Erişim tarihi: ${secenek.erisimTarihi})`);
  }
  return parts;
}
