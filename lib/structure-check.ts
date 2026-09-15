// Tezin iç tutarlılığı (istemcide, editör içeriği üzerinde anında): jürilerin sık
// yakaladığı ve kılavuz bölüm kontrolünün görmediği hatalar.
//   - boş bölüm başlıkları
//   - başlık düzeyi atlama (H1 → H3)
//   - metinde anılan ama olmayan şekil/tablo; hiç anılmayan şekil/tablo
//   - numaralı atıf stillerinde (IEEE, Vancouver) kaynakçayla uyuşmayan numaralar
//   - metni boş dipnotlar
// Her sorun, metinde bulunup seçilebilecek bir "hedef" metin taşır.

import { headingMatchesSection } from "@/lib/section-match";
import type { AbstractRules } from "@/lib/guideline-editor-settings";
import { crossCheck, extractInTextCitations, parseChicagoReference, parseReferenceEntry } from "@/lib/apa7";
import { hasReferencePunctuationIssue } from "@/lib/reference-punctuation";

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

export type StructureIssueTone = "warning" | "danger";

export interface StructureIssue {
  tone: StructureIssueTone;
  message: string;
  /** Metinde aranıp seçilecek ifade (başlık, şekil başlığı, atıf) */
  target?: string;
  /** Editörün tek tıkla yapabileceği düzeltme */
  action?: "sort-references" | "fix-reference-punctuation";
}

const MAX_ISSUES = 60;
/** Atıf–kaynakça uyuşmazlıklarından her türde en fazla bu kadarı tek tek listelenir */
const CITATION_ISSUE_LIMIT = 10;
const REFERENCE_SECTIONS = ["Kaynakça", "Kaynaklar", "References", "Bibliography", "Bibliyografya"];
const CAPTION_LABEL = { figure: "Şekil", table: "Tablo" } as const;
const ABSTRACT_SECTIONS = ["Özet", "Öz", "Abstract"];
// "Anahtar Kelimeler: a, b, c" / "Keywords: a; b"
const KEYWORDS_LINE = /^(?:anahtar\s+(?:kelime|sözcük)\p{L}*|keywords?|key\s+words)\s*[:：]\s*(.*)$/iu;
const countWords = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const textOf = (node: DocNode): string =>
  node.type === "text" ? (node.text ?? "") : (node.content ?? []).map(textOf).join("");

const hasContent = (node: DocNode): boolean =>
  node.type === "image" || node.type === "table" || node.type === "horizontalRule" || textOf(node).trim().length > 0;

/** "[1, 3–5]" / "(2-4)" içindeki numaralar */
function expandNumbers(list: string): number[] {
  const numbers: number[] = [];
  for (const part of list.split(",")) {
    const [start, end] = part.split(/[–-]/).map((value) => Number.parseInt(value.trim(), 10));
    if (!Number.isFinite(start)) continue;
    if (Number.isFinite(end) && end >= start && end - start < 200) for (let n = start; n <= end; n++) numbers.push(n);
    else numbers.push(start);
  }
  return numbers;
}

const quote = (text: string) => `“${text.length > 60 ? `${text.slice(0, 57)}…` : text}”`;

export function checkStructure(
  doc: { content?: DocNode[] } | null | undefined,
  options: { citationStyle?: string; abstract?: AbstractRules } = {}
): StructureIssue[] {
  const issues: StructureIssue[] = [];
  const add = (issue: StructureIssue) => {
    if (issues.length < MAX_ISSUES) issues.push(issue);
  };
  const blocks = doc?.content ?? [];

  // ---------- Başlıklar: boş bölüm ve düzey atlama ----------
  let previousLevel = 0;
  let referencesIndex = -1;
  blocks.forEach((block, index) => {
    if (block.type !== "heading") return;
    const level = Number(block.attrs?.level) || 1;
    const text = textOf(block).trim();
    if (referencesIndex < 0 && REFERENCE_SECTIONS.some((name) => headingMatchesSection(text, name))) referencesIndex = index;

    if (!text) {
      add({ tone: "warning", message: "Metni olmayan bir başlık var." });
    } else if (previousLevel && level > previousLevel + 1) {
      add({
        tone: "warning",
        message: `${quote(text)} başlığı H${level}; üstünde H${level - 1} yok (H${previousLevel}'den H${level}'e atlanmış).`,
        target: text,
      });
    }
    previousLevel = level;

    // Sonraki aynı ya da üst düzey başlığa (ya da belge sonuna) kadar içerik var mı?
    let filled = false;
    for (let next = index + 1; next < blocks.length; next++) {
      const candidate = blocks[next];
      if (candidate.type === "heading" && (Number(candidate.attrs?.level) || 1) <= level) break;
      if (candidate.type !== "heading" && hasContent(candidate)) {
        filled = true;
        break;
      }
      if (candidate.type === "heading") filled = true; // alt bölümler var; boşlukları kendi başlıklarında raporlanır
      if (filled) break;
    }
    if (text && !filled) add({ tone: "warning", message: `${quote(text)} bölümü henüz boş.`, target: text });
  });

  // Kaynakça bölümü: başlığından sonraki, aynı ya da üst düzey ilk başlığa (ör. "EKLER") kadar.
  // Sonrasındaki ekler yine gövde metnidir: eklerde anılan şekil/tablo "anılmıyor" sayılmaz.
  let referencesEnd = blocks.length;
  if (referencesIndex >= 0) {
    const referencesLevel = Number(blocks[referencesIndex].attrs?.level) || 1;
    for (let next = referencesIndex + 1; next < blocks.length; next++) {
      const block = blocks[next];
      if (block.type === "heading" && (Number(block.attrs?.level) || 1) <= referencesLevel) {
        referencesEnd = next;
        break;
      }
    }
  }
  const inReferences = (index: number) => referencesIndex >= 0 && index > referencesIndex && index < referencesEnd;

  // ---------- Şekil/tablo başlıkları ve metindeki anılmaları ----------
  const captions = { figure: [] as string[], table: [] as string[] };
  const bodyTexts: string[] = [];
  const footnoteProblems: number[] = [];
  let footnoteIndex = 0;
  const walk = (nodes: DocNode[] | undefined, inReferences: boolean) => {
    for (const node of nodes ?? []) {
      if (node.type === "footnoteReference") {
        footnoteIndex += 1;
        if (!String(node.attrs?.text ?? "").trim()) footnoteProblems.push(footnoteIndex);
        continue;
      }
      if (node.type === "paragraph" && (node.attrs?.caption === "figure" || node.attrs?.caption === "table")) {
        captions[node.attrs.caption].push(textOf(node).trim());
        continue;
      }
      if (node.type === "paragraph" || node.type === "heading") {
        if (!inReferences) bodyTexts.push(textOf(node));
        walk(node.content, inReferences);
        continue;
      }
      walk(node.content, inReferences);
    }
  };
  blocks.forEach((block, index) => walk([block], inReferences(index)));
  const body = bodyTexts.join("\n");

  for (const kind of ["table", "figure"] as const) {
    const label = CAPTION_LABEL[kind];
    const count = captions[kind].length;
    const mentioned = new Set<number>();
    // \b ASCII dışı harfleri (Ş) tanımaz; Unicode harf/rakam önbakışıyla kelime başı aranır.
    for (const match of body.matchAll(new RegExp(`(?<![\\p{L}\\d])${label}\\s+(\\d+)`, "gu"))) mentioned.add(Number(match[1]));
    for (const number of [...mentioned].sort((a, b) => a - b)) {
      if (number > count) {
        add({
          tone: "danger",
          message: `Metinde “${label} ${number}” geçiyor ama belgede ${count ? `${count} ${label.toLocaleLowerCase("tr-TR")} başlığı` : `hiç ${label.toLocaleLowerCase("tr-TR")} başlığı`} var.`,
          target: `${label} ${number}`,
        });
      }
    }
    captions[kind].forEach((caption, index) => {
      if (!mentioned.has(index + 1)) {
        add({
          tone: "warning",
          message: `${label} ${index + 1}${caption ? ` (${quote(caption)})` : ""} metinde anılmıyor; kılavuzlar genellikle her ${kind === "figure" ? "şeklin" : "tablonun"} metinde anılmasını ister.`,
          target: caption || undefined,
        });
      }
    });
  }

  // Kaynakça girdileri: Kaynakça bölümündeki dolu paragraflar (gövde metniyle aynı sınır).
  const referenceEntries: string[] = [];
  blocks.forEach((block, index) => {
    if (inReferences(index) && block.type === "paragraph" && textOf(block).trim()) referenceEntries.push(textOf(block).trim());
  });

  // ---------- Kaynakça noktalaması: çift nokta, noktalamadan önce boşluk (tüm stiller) ----------
  const punctuationProblems = referenceEntries.filter(hasReferencePunctuationIssue);
  if (punctuationProblems.length > 0) {
    add({
      tone: "warning",
      message: `Kaynakçada ${punctuationProblems.length} girdide noktalama hatası var (çift nokta ya da noktalama işaretinden önce boşluk).`,
      target: punctuationProblems[0].slice(0, 40),
      action: "fix-reference-punctuation",
    });
  }

  // ---------- Yazar-tarih stilleri: kaynakça alfabetik mi ----------
  const style = options.citationStyle;
  if ((style === "apa7" || style === "chicago") && referenceEntries.length > 1) {
    const unsorted = referenceEntries.some(
      (entry, index) => index > 0 && referenceEntries[index - 1].localeCompare(entry, "tr", { sensitivity: "base" }) > 0
    );
    if (unsorted) {
      add({
        tone: "warning",
        message: "Kaynakça yazar soyadına göre alfabetik sırada değil.",
        action: "sort-references",
      });
    }
  }

  // ---------- Yazar-tarih (APA 7, Chicago): metin içi atıf ↔ kaynakça (lib/apa7.ts ile aynı eşleştirme) ----------
  if ((style === "apa7" || style === "chicago") && referenceEntries.length > 0) {
    // Yazarı ve yılı ayrıştırılamayan girdiler eşleştirilmez (biçim hatası "Kontrol Et"te raporlanır)
    const parse = style === "chicago" ? parseChicagoReference : parseReferenceEntry;
    const references = referenceEntries.map(parse).filter((reference) => reference.year && reference.authors?.length);
    if (references.length > 0) {
      const { citationsWithoutReference, referencesWithoutCitation } = crossCheck(extractInTextCitations(body, { style }), references);
      citationsWithoutReference.slice(0, CITATION_ISSUE_LIMIT).forEach((citation) =>
        add({ tone: "danger", message: `Metindeki ${quote(citation.raw)} atfının kaynakçada karşılığı yok.`, target: citation.raw })
      );
      if (citationsWithoutReference.length > CITATION_ISSUE_LIMIT) {
        add({ tone: "danger", message: `…ve kaynakçada karşılığı olmayan ${citationsWithoutReference.length - CITATION_ISSUE_LIMIT} atıf daha.` });
      }
      referencesWithoutCitation.slice(0, CITATION_ISSUE_LIMIT).forEach((reference) =>
        add({ tone: "warning", message: `Kaynakçadaki ${quote(reference.raw)} metinde anılmıyor.`, target: reference.raw.slice(0, 40) })
      );
      if (referencesWithoutCitation.length > CITATION_ISSUE_LIMIT) {
        add({ tone: "warning", message: `…ve metinde anılmayan ${referencesWithoutCitation.length - CITATION_ISSUE_LIMIT} kaynak daha.` });
      }
    }
  }

  // ---------- Numaralı atıf stilleri: metin ↔ kaynakça ----------
  if (style === "ieee" || style === "vancouver") {
    const references = referenceEntries.length;
    const pattern = style === "ieee" ? /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g : /\((\d+(?:\s*[,–-]\s*\d+)*)\)/g;
    const cited = new Set<number>();
    for (const match of body.matchAll(pattern)) for (const number of expandNumbers(match[1])) cited.add(number);
    const citeLabel = (n: number) => (style === "ieee" ? `[${n}]` : `(${n})`);
    for (const number of [...cited].sort((a, b) => a - b)) {
      if (number > references) {
        add({
          tone: "danger",
          message: `Metinde ${citeLabel(number)} atfı var ama kaynakçada ${references} kaynak var.`,
          target: citeLabel(number),
        });
      }
    }
    for (let n = 1; n <= references; n++) {
      if (!cited.has(n)) add({ tone: "warning", message: `Kaynakçadaki ${n}. kaynağa metinde atıf yapılmamış.` });
    }
  }

  // ---------- Özet / Abstract: kılavuzun kelime ve anahtar kelime sınırları ----------
  const abstract = options.abstract;
  if (abstract && (abstract.minWords || abstract.maxWords || abstract.keywordsMin || abstract.keywordsMax)) {
    const keywordRange =
      abstract.keywordsMin && abstract.keywordsMax
        ? `${abstract.keywordsMin}–${abstract.keywordsMax}`
        : abstract.keywordsMin
          ? `en az ${abstract.keywordsMin}`
          : `en fazla ${abstract.keywordsMax}`;
    blocks.forEach((block, index) => {
      if (block.type !== "heading") return;
      const title = textOf(block).trim();
      if (!ABSTRACT_SECTIONS.some((name) => headingMatchesSection(title, name))) return;
      const level = Number(block.attrs?.level) || 1;
      let words = 0;
      let keywords: string[] | null = null;
      for (let next = index + 1; next < blocks.length; next++) {
        const candidate = blocks[next];
        if (candidate.type === "heading" && (Number(candidate.attrs?.level) || 1) <= level) break;
        const text = textOf(candidate).trim();
        const keywordLine = KEYWORDS_LINE.exec(text);
        if (keywordLine) {
          keywords = keywordLine[1]
            .split(/[,;]/)
            .map((keyword) => keyword.replace(/[.\s]+$/, "").trim())
            .filter(Boolean);
          continue;
        }
        words += countWords(text);
      }
      if (words === 0) return; // boş bölüm yukarıda raporlanır
      if (abstract.maxWords && words > abstract.maxWords) {
        add({ tone: "danger", message: `${quote(title)} ${words} kelime; kılavuz en fazla ${abstract.maxWords} kelime istiyor.`, target: title });
      } else if (abstract.minWords && words < abstract.minWords) {
        add({ tone: "warning", message: `${quote(title)} ${words} kelime; kılavuz en az ${abstract.minWords} kelime istiyor.`, target: title });
      }
      if (abstract.keywordsMin || abstract.keywordsMax) {
        if (!keywords) {
          add({
            tone: "warning",
            message: `${quote(title)} bölümünde anahtar kelime satırı yok (“Anahtar Kelimeler: …”); kılavuz ${keywordRange} anahtar kelime istiyor.`,
            target: title,
          });
        } else if (
          (abstract.keywordsMin && keywords.length < abstract.keywordsMin) ||
          (abstract.keywordsMax && keywords.length > abstract.keywordsMax)
        ) {
          add({
            tone: "warning",
            message: `${quote(title)} bölümünde ${keywords.length} anahtar kelime var; kılavuz ${keywordRange} istiyor.`,
            target: title,
          });
        }
      }
    });
  }

  // ---------- Dipnotlar ----------
  for (const number of footnoteProblems) {
    add({ tone: "warning", message: `${number}. dipnotun metni boş; dipnot işaretine tıklayıp metnini yazın.` });
  }

  return issues;
}
