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

export type CitationStyle = "apa7" | "chicago" | "ieee" | "vancouver";

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

/** APA/Chicago metin içi atıf etiketi: "Yılmaz", "Yılmaz ve Demir", "Yılmaz vd." */
export function authorLabel(source: CitableSource): string {
  const names = splitAuthors(source.authors).map(surname);
  if (names.length === 0) return source.title.split(/\s+/).slice(0, 3).join(" ");
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ve ${names[1]}`;
  return `${names[0]} vd.`;
}

export function formatInTextCitation(source: CitableSource, style: CitationStyle, number: number): string {
  switch (style) {
    case "ieee":
      return `[${number}]`;
    case "vancouver":
      return `(${number})`;
    case "chicago":
      return `(${authorLabel(source)} ${yearOf(source)})`;
    default:
      return `(${authorLabel(source)}, ${yearOf(source)})`;
  }
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
export function formatReferenceParts(source: CitableSource, style: CitationStyle, number: number): TextPart[] {
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
      push(` ${yearOf(source)}.${url ? ` ${url}` : ""}`);
      break;
    }
    case "vancouver": {
      push(`${number}. ${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${title}. `);
      if (container) push(`${isChapter ? "In: " : ""}${container}. `);
      if (publisher && !container) push(`${publisher}; `);
      push(`${yearOf(source)}`);
      if (volume) push(`;${volume}${issue ? `(${issue})` : ""}`);
      if (pages) push(`:${pages}`);
      push(`.${url ? ` ${url}` : ""}`);
      break;
    }
    case "chicago": {
      push(`${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${yearOf(source)}. `);
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
  return parts;
}
