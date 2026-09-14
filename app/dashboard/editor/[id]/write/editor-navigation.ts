import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { headingMatchesSection } from "@/lib/section-match";

export interface OutlineHeading {
  pos: number;
  level: number;
  text: string;
}

export interface SectionStatus {
  section: string;
  heading: OutlineHeading | null;
}

export function collectHeadings(doc: ProseMirrorNode): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ pos, level: Number(node.attrs.level) || 1, text: node.textContent.trim() });
      return false;
    }
    return true;
  });
  return headings;
}

/** Kılavuzun zorunlu bölümleri ve belgede karşılık gelen başlık */
export function sectionStatuses(headings: OutlineHeading[], requiredSections: string[]): SectionStatus[] {
  return requiredSections.map((section) => ({
    section,
    heading: headings.find((heading) => headingMatchesSection(heading.text, section)) ?? null,
  }));
}

function scrollToPos(editor: Editor, pos: number) {
  const dom = editor.view.nodeDOM(pos);
  const element = dom instanceof HTMLElement ? dom : editor.view.domAtPos(pos).node.parentElement;
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Başlığa git: imleç başlığın sonuna konur ve başlık ekranın ortasına kaydırılır */
export function jumpToHeading(editor: Editor, heading: OutlineHeading) {
  const node = editor.state.doc.nodeAt(heading.pos);
  const end = node ? heading.pos + node.nodeSize - 1 : heading.pos + 1;
  editor.chain().focus().setTextSelection(end).run();
  scrollToPos(editor, heading.pos);
}

/** Metin parçasını bul ve seç (kontrol sonuçlarından atıfa gitmek için) */
export function selectText(editor: Editor, needle: string): boolean {
  const target = needle.trim();
  if (!target) return false;
  let found: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText || !node.text) return true;
    const index = node.text.indexOf(target);
    if (index >= 0) found = { from: pos + index, to: pos + index + target.length };
    return !found;
  });
  if (!found) return false;
  const { from, to } = found;
  editor.chain().focus().setTextSelection({ from, to }).run();
  scrollToPos(editor, from);
  return true;
}

const sectionNodes = (section: string) => [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: section }] },
  { type: "paragraph" },
];

/**
 * Eksik bölümleri kılavuzdaki sıraya göre doğru yere ekler: her bölüm, kılavuzda
 * kendisinden sonra gelen ve belgede bulunan ilk bölümün hemen önüne; yoksa
 * belgenin sonuna. Ardından imleç ilk eklenen bölümün altındaki boş satıra gelir.
 */
export function insertSections(editor: Editor, requiredSections: string[], sections: string[]) {
  const ordered = requiredSections.filter((section) => sections.includes(section));
  if (ordered.length === 0) return;

  const chain = editor.chain();
  for (const section of ordered) {
    chain.command(({ tr }) => {
      const headings = collectHeadings(tr.doc);
      if (headings.some((heading) => headingMatchesSection(heading.text, section))) return true;
      let insertAt = tr.doc.content.size;
      for (const later of requiredSections.slice(requiredSections.indexOf(section) + 1)) {
        const heading = headings.find((item) => headingMatchesSection(item.text, later));
        if (heading) {
          insertAt = heading.pos;
          break;
        }
      }
      const nodes = sectionNodes(section).map((json) => editor.schema.nodeFromJSON(json));
      tr.insert(insertAt, nodes);
      return true;
    });
  }
  chain.run();

  const first = collectHeadings(editor.state.doc).find((heading) => headingMatchesSection(heading.text, ordered[0]));
  if (first) {
    const node = editor.state.doc.nodeAt(first.pos);
    const paragraphStart = first.pos + (node?.nodeSize ?? 0) + 1;
    editor.chain().focus().setTextSelection(Math.min(paragraphStart, editor.state.doc.content.size)).run();
    scrollToPos(editor, first.pos);
  }
}

/** Boş belgeye kılavuzun bölümlerinden oluşan taslak iskelet; imleç ilk bölümün altındaki boş satıra gelir */
export function applyTemplate(editor: Editor, requiredSections: string[]) {
  editor.commands.setContent({ type: "doc", content: requiredSections.flatMap(sectionNodes) });
  const first = collectHeadings(editor.state.doc)[0];
  if (!first) return;
  const node = editor.state.doc.nodeAt(first.pos);
  const paragraphStart = first.pos + (node?.nodeSize ?? 0) + 1;
  editor.chain().focus().setTextSelection(Math.min(paragraphStart, editor.state.doc.content.size)).run();
  scrollToPos(editor, first.pos);
}

/** Belge boş mu (yalnızca boş paragraflar) */
export function isDocumentEmpty(doc: ProseMirrorNode): boolean {
  return doc.textContent.trim().length === 0 && doc.childCount <= 1;
}
