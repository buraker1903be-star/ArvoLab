// Literatür kaynağından metin içi atıf ve kaynakça girdisi üretir (istemci + sunucu).
// Yazar alanı serbest metindir ("Yılmaz, A., & Demir, B." ya da "Ahmet Yılmaz; Ayşe Demir");
// soyadları sezgisel olarak çıkarılır. Türkçe APA kullanımı: "ve", "vd.", "t.y.".

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

export type CitationStyle = "apa7" | "chicago" | "ieee" | "vancouver" | "mla";

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

const yearOf = (source: CitableSource) => source.year?.trim() || "t.y.";
/** Ardından nokta gelen yerlerde yıl: "t.y." sonundaki nokta düşer ("t.y.." olmasın) */
const yearText = (source: CitableSource) => yearOf(source).replace(/\.$/, "");

/** APA/Chicago metin içi atıf etiketi: "Yılmaz", "Yılmaz ve Demir", "Yılmaz vd." */
export function authorLabel(source: CitableSource): string {
  const names = splitAuthors(source.authors).map(surname);
  if (names.length === 0) return source.title.split(/\s+/).slice(0, 3).join(" ");
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ve ${names[1]}`;
  return `${names[0]} vd.`;
}

/*
  Sayfa: öğrencinin atıf penceresine yazdığı. "14" → "s. 14", "14-16" →
  "ss. 14-16"; öğrenci "s." yazdıysa ikinci kez eklenmez. Sayfa
  numarasını yalnızca alıntıyı yapan bilir; boşsa atıfa hiç girmez —
  sayfa uydurmak, yanlış sayfa yazmaktır.
*/
export function sayfaEtiketi(sayfa: string | null | undefined): string | null {
  const temiz = (sayfa ?? "").trim().replace(/^s{1,2}\.\s*/i, "").replace(/^pp?\.\s*/i, "");
  if (!temiz) return null;
  return `${/[-–]/.test(temiz) ? "ss." : "s."} ${temiz}`;
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
): string {
  const sayfa = sayfaEtiketi(secenek.sayfa);
  switch (style) {
    case "ieee":
      return sayfa ? `[${number}, ${sayfa}]` : `[${number}]`;
    case "vancouver":
      return sayfa ? `(${number}, ${sayfa})` : `(${number})`;
    case "chicago":
      return `(${authorLabel(source)} ${yearOf(source)}${sayfa ? `, ${sayfa}` : ""})`;
    case "mla":
      return `(${authorLabel(source)} ${yearOf(source)}${sayfa ? `, ${sayfa}` : ""})`;
    default:
      return `(${authorLabel(source)}, ${yearOf(source)}${sayfa ? `, ${sayfa}` : ""})`;
  }
}

/*
  KÜNYEDE EKSİK BİLGİ: türüne göre beklenen alanlardan boş olanlar.
  Atıf penceresi bunları söylüyor ve kaynağı düzenlemeye götürüyor;
  eksik bilgiyi sistem uydurmaz. Eskiden boş alan künyeden sessizce
  düşüyordu ve öğrenci eksikliği ancak danışmanından öğreniyordu.
*/
export function eksikAlanlar(source: CitableSource): string[] {
  const bos = (deger: string | null | undefined) => !deger?.trim();
  const eksik: string[] = [];
  if (bos(source.authors)) eksik.push("yazar");
  if (bos(source.year)) eksik.push("yıl");
  switch (source.source_type) {
    case "article":
      if (bos(source.container_title)) eksik.push("dergi adı");
      if (bos(source.volume)) eksik.push("cilt");
      if (bos(source.issue)) eksik.push("sayı");
      if (bos(source.pages)) eksik.push("sayfa aralığı");
      if (bos(source.doi_or_url)) eksik.push("DOI");
      break;
    case "chapter":
      if (bos(source.container_title)) eksik.push("kitap adı");
      if (bos(source.pages)) eksik.push("sayfa aralığı");
      if (bos(source.publisher)) eksik.push("yayınevi");
      break;
    case "book":
    case "thesis":
    case "report":
      if (bos(source.publisher)) eksik.push(source.source_type === "thesis" ? "üniversite" : "yayınevi");
      break;
    case "website":
      if (bos(source.doi_or_url)) eksik.push("adres (URL)");
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
): TextPart[] {
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
      push(` ${yearText(source)}.${url ? ` ${url}` : ""}`);
      break;
    }
    case "vancouver": {
      push(`${number}. ${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${title}. `);
      if (container) push(`${isChapter ? "In: " : ""}${container}. `);
      if (publisher && !container) push(`${publisher}; `);
      push(`${yearOf(source)}`);
      if (volume) push(`;${volume}${issue ? `(${issue})` : ""}`);
      if (pages) push(`:${pages}`);
      // "t.y." ile biterse ikinci nokta eklenmez
      push(`${!volume && !pages && yearOf(source).endsWith(".") ? "" : "."}${url ? ` ${url}` : ""}`);
      break;
    }
    case "chicago": {
      push(`${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${yearText(source)}. `);
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
        if (volume) push(`, c. ${volume}`);
        if (issue) push(`, sy. ${issue}`);
        if (publisher && isChapter) push(`, ${publisher}`);
        push(`, ${yearText(source)}`);
        if (pages) push(`, ss. ${pages}`);
        push(".");
      } else {
        push(".");
        if (publisher) push(` ${publisher},`);
        push(` ${yearText(source)}.`);
      }
      if (url) push(` ${url}`);
      break;
    }
    default: {
      // APA 7: Yazar (Yıl). Başlık. *Dergi*, *Cilt*(Sayı), sayfalar. DOI
      push(`${authors ? `${authors} ` : ""}(${yearOf(source)}). `);
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
        push(`${pages ? ` (ss. ${pages})` : ""}.`);
        if (publisher) push(` ${publisher}.`);
      } else {
        push(title, italic);
        push(".");
        if (publisher) push(` ${publisher}.`);
      }
      if (url) push(` ${url}`);
    }
  }
  if (source.source_type === "website" && url && secenek.erisimTarihi) push(` (Erişim tarihi: ${secenek.erisimTarihi})`);
  return parts;
}
