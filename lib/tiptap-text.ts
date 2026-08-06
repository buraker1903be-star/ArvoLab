/**
 * Tiptap/ProseMirror JSON İçeriğinden Düz Metin Çıkarma
 * ------------------------------------------------------------
 * Editörde yazılan içeriği, mevcut APA7 ve kılavuz kontrol
 * motorlarının (lib/apa7.ts, lib/guideline-check.ts) beklediği
 * düz metin biçimine çevirir. Başlıklar ayrı satırlarda kalır ki
 * "GİRİŞ", "KAYNAKÇA" gibi başlık tespiti çalışabilsin.
 */

// Gevşek tipleme: Tiptap JSON düğümleri iç içe ve çeşitli tiptedir.
interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

function nodeToText(node: TiptapNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  if (node.type === "footnoteReference") {
    return ""; // dipnot referansı gövde metnini bozmasın
  }

  const childText = (node.content ?? []).map(nodeToText).join("");

  switch (node.type) {
    case "heading":
      return `\n${childText}\n`;
    case "paragraph":
      return `${childText}\n`;
    case "tableCell":
    case "tableHeader":
      return `${childText} `;
    case "tableRow":
      return `${childText}\n`;
    case "bulletList":
    case "orderedList":
      return `${childText}\n`;
    case "listItem":
      return `${childText}\n`;
    default:
      return childText;
  }
}

export function extractPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc || !doc.content) return "";
  return doc.content.map(nodeToText).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface HeadingInfo {
  level: number;
  text: string;
}

export function extractHeadings(doc: TiptapDoc | null | undefined): HeadingInfo[] {
  if (!doc || !doc.content) return [];
  const headings: HeadingInfo[] = [];

  function walk(node: TiptapNode) {
    if (node.type === "heading") {
      const text = (node.content ?? []).map(nodeToText).join("").trim();
      headings.push({ level: (node.attrs?.level as number) ?? 1, text });
    }
    (node.content ?? []).forEach(walk);
  }

  doc.content.forEach(walk);
  return headings;
}

export function countWords(doc: TiptapDoc | null | undefined): number {
  const text = extractPlainText(doc);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
