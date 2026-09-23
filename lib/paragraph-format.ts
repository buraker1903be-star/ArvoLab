// Paragraf düzeni: kılavuzların neredeyse tamamının istediği iki kural —
// ilk satır girintisi (yaygın olarak 1,25 cm) ve iki yana yaslama.
// Girinti eski kayıtlarda boolean (true = 1,25 cm), yeni kayıtlarda cm değeridir.

/** Türk tez kılavuzlarında yaygın girinti */
export const DEFAULT_INDENT_CM = 1.25;
const MIN_INDENT_CM = 0.3;
const MAX_INDENT_CM = 3;

interface FormatNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: FormatNode[];
}

export interface ParagraphFormatRules {
  /** Kılavuzun istediği ilk satır girintisi (cm); kural yoksa undefined */
  indentCm?: number;
  /** Kılavuz gövde paragraflarının iki yana yaslanmasını istiyor */
  justify?: boolean;
}

/*
  Asılı girinti (hanging indent): ilk satır kenarda, sonraki satırlar
  içeride. APA ve Chicago kaynakçada bunu zorunlu tutar, Türk tez
  kılavuzlarının çoğu da ister. Editörde ve Word çıktısında karşılığı
  yoktu: öğrenci kaynakçayı doğru yazsa bile biçim yanlış çıkıyordu.

  İlk satır girintisinin tersi olduğu için ayrı bir öznitelik: bir
  paragraf ikisini birden taşıyamaz.
*/
export const DEFAULT_HANGING_CM = 1.27;
const MIN_HANGING_CM = 0.3;
const MAX_HANGING_CM = 3;

/** Paragrafın asılı girintisi (cm); yoksa null. */
export function hangingIndentCmOf(attrs: Record<string, unknown> | null | undefined): number | null {
  const value = attrs?.hangingIndent;
  if (value === true) return DEFAULT_HANGING_CM;
  if (typeof value === "number" && value > 0) return value;
  return null;
}

/** Kılavuzdan okunan asılı girinti ölçüsü geçerli mi. */
export function validHangingCm(value: unknown): number | undefined {
  const cm = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(cm) || cm < MIN_HANGING_CM || cm > MAX_HANGING_CM) return undefined;
  return Math.round(cm * 100) / 100;
}

/**
 * style="text-indent: -1.27cm" → 1.27 (ProseMirror parseHTML için).
 * Asılı girinti NEGATİF ilk satır girintisi olarak yazılır; olumlu
 * değer normal girintidir ve buraya düşmemeli.
 */
export function parseHangingStyle(textIndent: string | null | undefined): number | false {
  if (!textIndent) return false;
  const match = /^-(\d+(?:\.\d+)?)\s*cm$/i.exec(textIndent.trim());
  if (!match) return false;
  return validHangingCm(Number(match[1])) ?? false;
}

/** Paragrafın girintisi (cm). Girinti yoksa null. */
export function indentCmOf(attrs: Record<string, unknown> | null | undefined): number | null {
  const value = attrs?.firstLineIndent;
  if (value === true) return DEFAULT_INDENT_CM;
  if (typeof value === "number" && value > 0) return value;
  return null;
}

/** Geçerli bir girinti ölçüsü mü (kılavuzdan okunan değer için) */
export function validIndentCm(value: unknown): number | undefined {
  const cm = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(cm) || cm < MIN_INDENT_CM || cm > MAX_INDENT_CM) return undefined;
  return Math.round(cm * 100) / 100;
}

/** style="text-indent: 1.25cm" → 1.25 (ProseMirror parseHTML için) */
export function parseIndentStyle(textIndent: string | null | undefined): number | false {
  if (!textIndent) return false;
  const match = /^(\d+(?:\.\d+)?)\s*cm$/i.exec(textIndent.trim());
  if (!match) return false;
  return validIndentCm(Number(match[1])) ?? false;
}

/** "1,25 cm girinti · iki yana yaslı" */
export function describeParagraphFormat(rules: ParagraphFormatRules): string {
  return [
    rules.indentCm ? `${String(rules.indentCm).replace(".", ",")} cm ilk satır girintisi` : "",
    rules.justify ? "iki yana yaslı" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Kuralın uygulanacağı gövde paragrafları: belgenin doğrudan çocuğu olan dolu paragraflar.
 * Liste maddeleri, tablo hücreleri, şekil/tablo yazıları ve blok alıntılar kılavuzun gövde
 * paragrafı kuralının dışındadır (blok alıntı APA'da zaten girintisiz yazılır).
 */
export interface BodyParagraph {
  attrs: Record<string, unknown> | null | undefined;
  text: string;
}

export function bodyParagraphs(doc: { content?: FormatNode[] } | null | undefined): BodyParagraph[] {
  const out: BodyParagraph[] = [];
  for (const node of doc?.content ?? []) {
    if (node.type !== "paragraph") continue;
    const text = textContent(node).trim();
    if (text) out.push({ attrs: node.attrs, text });
  }
  return out;
}

const textContent = (node: FormatNode): string =>
  node.type === "text" ? (node.text ?? "") : (node.content ?? []).map(textContent).join("");

export interface ParagraphFormatReport {
  /** Kuralın kapsadığı gövde paragrafı sayısı */
  total: number;
  /** Girintisi eksik ya da kılavuzdan farklı olan paragraflar */
  wrongIndent: number;
  /** İki yana yaslı olmayan paragraflar */
  notJustified: number;
  /** İlk uyumsuz paragrafın metni (editörde bulup göstermek için) */
  firstTarget?: string;
}

/** Gövde paragraflarının kılavuzun paragraf düzenine uyup uymadığı */
export function checkParagraphFormat(
  doc: { content?: FormatNode[] } | null | undefined,
  rules: ParagraphFormatRules
): ParagraphFormatReport | null {
  if (!rules.indentCm && !rules.justify) return null;
  const paragraphs = bodyParagraphs(doc);
  if (paragraphs.length === 0) return null;

  let wrongIndent = 0;
  let notJustified = 0;
  let firstTarget: string | undefined;
  for (const paragraph of paragraphs) {
    const indent = indentCmOf(paragraph.attrs);
    const badIndent = rules.indentCm ? indent === null || Math.abs(indent - rules.indentCm) >= 0.01 : false;
    const badAlign = rules.justify ? paragraph.attrs?.textAlign !== "justify" : false;
    if (badIndent) wrongIndent++;
    if (badAlign) notJustified++;
    if ((badIndent || badAlign) && !firstTarget) firstTarget = paragraph.text.slice(0, 60);
  }
  return { total: paragraphs.length, wrongIndent, notJustified, firstTarget };
}
