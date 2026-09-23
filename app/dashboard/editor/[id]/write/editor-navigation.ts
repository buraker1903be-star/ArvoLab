import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { headingMatchesSection } from "@/lib/section-match";
import { formatInTextCitation, formatReferenceParts, type CitableSource, type CitationStyle } from "@/lib/citation-format";
import { fixReferencePunctuation } from "@/lib/reference-punctuation";
import { indentCmOf, type ParagraphFormatRules, hangingIndentCmOf } from "@/lib/paragraph-format";

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

const REFERENCE_SECTIONS = ["Kaynakça", "Kaynaklar", "References", "Bibliography", "Bibliyografya"];

interface ReferencesSection {
  /** Kaynakça başlığından sonraki ilk konum */
  start: number;
  end: number;
  paragraphs: { pos: number; node: ProseMirrorNode }[];
}

function findReferencesSection(doc: ProseMirrorNode): ReferencesSection | null {
  const headings = collectHeadings(doc);
  const index = headings.findIndex((heading) => REFERENCE_SECTIONS.some((name) => headingMatchesSection(heading.text, name)));
  if (index < 0) return null;
  const heading = headings[index];
  const next = headings.slice(index + 1).find((item) => item.level <= heading.level);
  const start = heading.pos + (doc.nodeAt(heading.pos)?.nodeSize ?? 0);
  const end = next ? next.pos : doc.content.size;
  const paragraphs: ReferencesSection["paragraphs"] = [];
  doc.nodesBetween(start, end, (node, pos) => {
    if (node.type.name === "paragraph") {
      if (pos >= start) paragraphs.push({ pos, node });
      return false;
    }
    return true;
  });
  return { start, end, paragraphs };
}

/**
 * Literatür kaynağından atıf: metin içi atıf imlecin olduğu yere eklenir; kaynak
 * Kaynakça bölümünde yoksa (başlığa göre) bölümün sonuna biçimlenmiş girdi olarak
 * eklenir, bölüm hiç yoksa belgenin sonunda oluşturulur. Numaralı stillerde
 * (IEEE, Vancouver) numara kaynakçadaki sıradır; aynı kaynağa ikinci atıf aynı numarayı alır.
 */
export function insertCitation(
  editor: Editor,
  source: CitableSource,
  style: CitationStyle
): { citation: string; addedReference: boolean } {
  const section = findReferencesSection(editor.state.doc);
  const entries = section?.paragraphs.filter((item) => item.node.textContent.trim()) ?? [];
  const titleKey = source.title.trim().toLocaleLowerCase("tr-TR").slice(0, 60);
  const existingIndex = titleKey
    ? entries.findIndex((item) => item.node.textContent.toLocaleLowerCase("tr-TR").includes(titleKey))
    : -1;
  const number = existingIndex >= 0 ? existingIndex + 1 : entries.length + 1;
  const citation = formatInTextCitation(source, style, number);

  const { from, to } = editor.state.selection;
  const before = editor.state.doc.textBetween(Math.max(0, from - 1), from);
  const text = `${before && !/[\s(\[]/.test(before) ? " " : ""}${citation}`;
  editor.chain().focus().insertContentAt({ from: to, to }, { type: "text", text }).run();

  if (existingIndex >= 0) return { citation, addedReference: false };

  const parts = formatReferenceParts(source, style, number);
  const paragraph = editor.schema.nodeFromJSON({
    type: "paragraph",
    content: parts
      .filter((part) => part.text)
      .map((part) => ({ type: "text", text: part.text, ...(part.italic ? { marks: [{ type: "italic" }] } : {}) })),
  });
  editor
    .chain()
    .command(({ tr }) => {
      const current = findReferencesSection(tr.doc);
      if (!current) {
        const heading = editor.schema.nodeFromJSON({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kaynakça" }] });
        tr.insert(tr.doc.content.size, [heading, paragraph]);
        return true;
      }
      const last = current.paragraphs[current.paragraphs.length - 1];
      if (last && last.node.childCount === 0) tr.replaceWith(last.pos, last.pos + last.node.nodeSize, paragraph);
      else tr.insert(current.end, paragraph);
      return true;
    })
    .run();
  return { citation, addedReference: true };
}

/**
 * Kaynakçayı yazar soyadına göre Türkçe alfabetik sıralar (APA/Chicago). Girdiler ardışık
 * paragraflar değilse (liste, tablo) dokunmaz ve -1 döner; sıralanan girdi sayısını döndürür.
 */
export function sortReferences(editor: Editor): number {
  const section = findReferencesSection(editor.state.doc);
  if (!section || section.paragraphs.length < 2) return 0;
  const first = section.paragraphs[0];
  const last = section.paragraphs[section.paragraphs.length - 1];
  const from = first.pos;
  const to = last.pos + last.node.nodeSize;
  const contiguous = section.paragraphs.reduce((size, item) => size + item.node.nodeSize, 0) === to - from;
  if (!contiguous) return -1;
  const entries = section.paragraphs.filter((item) => item.node.textContent.trim());
  const sorted = [...entries].sort((a, b) => a.node.textContent.localeCompare(b.node.textContent, "tr", { sensitivity: "base" }));
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(from, to, sorted.map((item) => item.node));
      return true;
    })
    .run();
  return sorted.length;
}

/**
 * Kaynakça girdilerindeki çift nokta ve noktalamadan önceki boşlukları düzeltir (tek geri alma
 * adımı). Metin parçaları tek tek düzeltilir; hata iki farklı biçimlendirilmiş parçanın arasına
 * düşüyorsa (ör. italik başlık + düz nokta) dokunulmaz. Değişen girdi sayısını döndürür.
 */
export function fixReferencePunctuationInEditor(editor: Pick<Editor, "state" | "schema" | "view">): number {
  const section = findReferencesSection(editor.state.doc);
  if (!section) return 0;
  const { tr } = editor.state;
  let changedEntries = 0;
  for (const { pos, node } of section.paragraphs) {
    let changed = false;
    node.descendants((child, offset) => {
      if (!child.isText || !child.text) return;
      const fixed = fixReferencePunctuation(child.text);
      if (fixed === child.text) return;
      // Paragraf içeriği pos + 1'de başlar; önceki düzeltmelerin kaydırması eşlenir.
      const from = tr.mapping.map(pos + 1 + offset);
      const to = tr.mapping.map(pos + 1 + offset + child.text.length);
      tr.replaceWith(from, to, editor.schema.text(fixed, child.marks));
      changed = true;
    });
    if (changed) changedEntries += 1;
  }
  if (changedEntries) editor.view.dispatch(tr.scrollIntoView());
  return changedEntries;
}

/**
 * Kaynakçadaki madde işaretli/numaralı listeleri ayrı paragraflara çevirir (APA ve Chicago'da
 * kaynaklar liste işareti taşımaz). İç içe maddeler de sırayla paragraf olur; biçimlendirme
 * korunur, tek geri alma adımıdır. Paragrafa çevrilen girdi sayısını döndürür.
 */
export function convertReferenceListsToParagraphs(editor: Pick<Editor, "state" | "view">): number {
  const section = findReferencesSection(editor.state.doc);
  if (!section) return 0;
  const lists: { pos: number; node: ProseMirrorNode }[] = [];
  editor.state.doc.forEach((node, pos) => {
    if (pos >= section.start && pos < section.end && (node.type.name === "bulletList" || node.type.name === "orderedList")) {
      lists.push({ pos, node });
    }
  });
  if (lists.length === 0) return 0;
  const { tr } = editor.state;
  let converted = 0;
  // Sondan başa: öndeki listelerin konumları değişmez.
  for (const { pos, node } of [...lists].reverse()) {
    const paragraphs: ProseMirrorNode[] = [];
    node.descendants((child) => {
      if (child.type.name !== "paragraph") return true;
      if (child.textContent.trim()) paragraphs.push(child);
      return false;
    });
    converted += paragraphs.length;
    tr.replaceWith(pos, pos + node.nodeSize, paragraphs);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return converted;
}

/**
 * Kılavuzun paragraf düzenini (ilk satır girintisi, iki yana yaslama) gövde paragraflarına
 * uygular: liste maddeleri, tablo hücreleri, şekil/tablo yazıları, blok alıntılar ve boş
 * paragraflar dışarıda kalır. Tek geri alma adımıdır; değişen paragraf sayısını döndürür.
 */
export function applyParagraphFormat(
  editor: Pick<Editor, "state" | "view">,
  rules: ParagraphFormatRules
): number {
  if (!rules.indentCm && !rules.justify) return 0;
  const { tr } = editor.state;
  let changed = 0;
  // Yalnızca belgenin doğrudan çocuğu olan dolu paragraflar (lib/paragraph-format.ts ile aynı kapsam).
  const visit = (node: ProseMirrorNode, contentStart: number) => {
    node.forEach((child, childOffset) => {
      const start = contentStart + childOffset;
      if (child.type.name === "paragraph") {
        if (!child.textContent.trim()) return;
        const next: Record<string, unknown> = {};
        if (rules.indentCm && indentCmOf(child.attrs) !== rules.indentCm) next.firstLineIndent = rules.indentCm;
        if (rules.justify && child.attrs.textAlign !== "justify") next.textAlign = "justify";
        if (Object.keys(next).length === 0) return;
        tr.setNodeMarkup(start, undefined, { ...child.attrs, ...next });
        changed += 1;
        return;
      }
    });
  };
  visit(editor.state.doc, 0);
  if (changed) editor.view.dispatch(tr.scrollIntoView());
  return changed;
}

/** Seçili metin (yoruma alıntı olarak eklenir) */
export function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return from === to ? "" : editor.state.doc.textBetween(from, to, " ").trim().slice(0, 500);
}

/** Belge boş mu (yalnızca boş paragraflar) */
export function isDocumentEmpty(doc: ProseMirrorNode): boolean {
  return doc.textContent.trim().length === 0 && doc.childCount <= 1;
}

/**
 * Kaynakça girdilerine asılı girinti uygular (tek geri alma adımı).
 *
 * APA ve Chicago kaynakçada bunu zorunlu tutar ama editörde uygulamanın
 * yolu yoktu: öğrenci kaynakçayı doğru yazsa bile biçim yanlış
 * çıkıyordu. Değişen girdi sayısını döndürür.
 *
 * İlk satır girintisi aynı anda kapatılıyor — ikisi birbirinin tersi ve
 * gövde biçimi kaynakçaya sızmış olabilir.
 */
export function applyHangingIndent(editor: Pick<Editor, "state" | "view">, cm: number): number {
  const section = findReferencesSection(editor.state.doc);
  if (!section) return 0;
  const { tr } = editor.state;
  let changed = 0;
  for (const { pos, node } of section.paragraphs) {
    if (!node.textContent.trim() || hangingIndentCmOf(node.attrs) === cm) continue;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, hangingIndent: cm, firstLineIndent: false });
    changed += 1;
  }
  if (changed > 0) editor.view.dispatch(tr);
  return changed;
}

/**
 * Metne ELLE verilmiş yazı tipi, punto ve satır aralığını temizler.
 *
 * Değer kaldırılınca metin belgenin varsayılanına, yani kılavuzun
 * değerine döner (editörün gövde stili ve Word çıktısı ikisi de oradan
 * beslenir). Kılavuzun değerini tek tek paragraflara YAZMAK yerine
 * temizlemek bilinçli: kılavuz sürümü değişirse yazılmış değerler eski
 * kılavuzda kalırdı, temizlenmiş metin kendiliğinden yeniye uyar.
 *
 * Renk ve vurgu gibi diğer metin biçimlerine dokunulmaz.
 * Değişen paragraf/metin sayısını döndürür.
 */
export function clearManualTextFormat(editor: Pick<Editor, "state" | "view">): number {
  const { tr } = editor.state;
  let changed = 0;

  const textStyle = editor.state.schema.marks.textStyle;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && textStyle) {
      const mark = node.marks.find((item) => item.type === textStyle);
      const attrs = mark?.attrs as Record<string, unknown> | undefined;
      if (mark && (attrs?.fontFamily || attrs?.fontSize)) {
        const kalan = { ...attrs, fontFamily: null, fontSize: null };
        const doluMu = Object.values(kalan).some((value) => value !== null && value !== undefined);
        tr.removeMark(pos, pos + node.nodeSize, textStyle);
        // Renk/vurgu gibi başka bir değer varsa mark geri konur; yoksa hiç konmaz.
        if (doluMu) tr.addMark(pos, pos + node.nodeSize, textStyle.create(kalan));
        changed += 1;
      }
      return true;
    }
    if (node.type.name === "paragraph" && node.attrs?.lineSpacing) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineSpacing: null });
      changed += 1;
    }
    return true;
  });

  if (changed > 0) editor.view.dispatch(tr);
  return changed;
}
