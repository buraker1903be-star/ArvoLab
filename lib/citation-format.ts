// Literatür kaynağından metin içi atıf ve kaynakça girdisi üretir (istemci + sunucu).
// Yazar alanı serbest metindir ("Yılmaz, A., & Demir, B." ya da "Ahmet Yılmaz; Ayşe Demir");
// soyadları sezgisel olarak çıkarılır. Türkçe APA kullanımı: "ve", "vd.", "t.y.".

export interface CitableSource {
  title: string;
  authors: string | null;
  year: string | null;
  source_type: string;
  doi_or_url: string | null;
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

/** Kaynakça girdisi (italik başlık ayrımıyla, Tiptap metin düğümlerine çevrilebilir) */
export function formatReferenceParts(source: CitableSource, style: CitationStyle, number: number): TextPart[] {
  const authors = (source.authors ?? "").trim();
  const title = source.title.trim().replace(/\.$/, "");
  const url = link(source);
  const italic = ITALIC_TITLE_TYPES.has(source.source_type);
  const parts: TextPart[] = [];

  switch (style) {
    case "ieee":
      parts.push({ text: `[${number}] ${authors ? `${authors}, ` : ""}` });
      parts.push(italic ? { text: title, italic: true } : { text: `"${title},"` });
      parts.push({ text: ` ${yearOf(source)}.${url ? ` ${url}` : ""}` });
      break;
    case "vancouver":
      parts.push({ text: `${number}. ${authors ? `${authors.replace(/\.$/, "")}. ` : ""}` });
      parts.push({ text: `${title}. ${yearOf(source)}.${url ? ` ${url}` : ""}` });
      break;
    case "chicago":
      parts.push({ text: `${authors ? `${authors.replace(/\.$/, "")}. ` : ""}${yearOf(source)}. ` });
      parts.push(italic ? { text: title, italic: true } : { text: `"${title}."` });
      if (url) parts.push({ text: ` ${url}` });
      break;
    default:
      parts.push({ text: `${authors ? `${authors} ` : ""}(${yearOf(source)}). ` });
      parts.push({ text: `${title}.`, italic });
      if (url) parts.push({ text: ` ${url}` });
  }
  return parts;
}
