import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { hasManualNumber, numberHeadings, stripManualNumber } from "@/lib/heading-numbering";
import { altBaslikGirintisi, anaBaslikHizasi, type AltBaslikGirintisi, type BolumHizasi } from "@/lib/kilavuz-bicim";

/**
 * Editörde otomatik başlık numaraları. Numara metne yazılmaz; başlığa
 * data-heading-number süslemesi eklenir ve CSS önüne gösterir (workspace.css).
 * Açık/kapalı durumu eklenti durumunda tutulur: setHeadingNumbering komutu
 * belgeyi değiştirmez (otomatik kayıt tetiklenmez).
 */
interface HeadingNumbersState {
  enabled: boolean;
  decorations: DecorationSet;
}

export const headingNumbersKey = new PluginKey<HeadingNumbersState>("headingNumbers");

function headingsOf(doc: ProseMirrorNode) {
  const found: { pos: number; size: number; level: number; text: string }[] = [];
  // Yalnızca blok düğümleri gezilir (paragraf metnine inilmez): 190 sayfalık tezde de ucuz.
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      found.push({ pos, size: node.nodeSize, level: Number(node.attrs.level) || 1, text: node.textContent });
      return false;
    }
    return !node.isTextblock;
  });
  return found;
}

/*
  Kılavuzun ana başlık kuralları (02.11.2026, lib/kilavuz-bicim.ts): ek
  numarasız başlıklar ("Giriş", "Sonuç") ve birinci düzey başlığın hizası.
  Hiza süsleme olarak veriliyor (data-kilavuz-hiza), belgeye yazılmıyor:
  kılavuz değişince metin değişmeden görünüm değişmeli. CSS'te (workspace.css)
  öğrencinin başlığa kendisi verdiği hiza (satır içi stil) her zaman kazanır.
*/
export interface BaslikKurallari {
  numarasiz?: string[];
  chapterAlign?: BolumHizasi;
  chapterLeftSections?: string[];
  /** Alt başlık girintisi: ölçü editörün değişkeninde (--kilavuz-alt-girinti), burada yalnızca işaret. */
  altGirinti?: AltBaslikGirintisi;
}

/** Dışa açık: tests/editor bu süslemeyi tarayıcısız sınıyor. */
export function buildDecorations(doc: ProseMirrorNode, numaralama: boolean, kurallar: BaslikKurallari) {
  const headings = headingsOf(doc);
  const numbers = numaralama ? numberHeadings(headings, kurallar.numarasiz) : [];
  const decorations: Decoration[] = [];
  headings.forEach((heading, index) => {
    const ozellik: Record<string, string> = {};
    const number = numbers[index];
    if (number) ozellik["data-heading-number"] = number;
    const hiza = heading.level === 1 ? anaBaslikHizasi(heading.text, kurallar) : null;
    if (hiza) ozellik["data-kilavuz-hiza"] = hiza;
    if (altBaslikGirintisi(heading.level, kurallar.altGirinti) !== null) ozellik["data-kilavuz-girinti"] = "true";
    if (Object.keys(ozellik).length) decorations.push(Decoration.node(heading.pos, heading.pos + heading.size, ozellik));
  });
  return DecorationSet.create(doc, decorations);
}

/** Elle numara yazılmış başlık var mı ("1.2. Amaç") — otomatik numarayla çift numara olur */
export function countManualHeadingNumbers(doc: ProseMirrorNode) {
  return headingsOf(doc).filter((heading) => hasManualNumber(heading.text)).length;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    headingNumbers: {
      setHeadingNumbering: (enabled: boolean) => ReturnType;
      /** Başlıkların başındaki elle yazılmış numaraları siler (tek geri alma adımı) */
      stripManualHeadingNumbers: () => ReturnType;
    };
  }
}

export const HeadingNumbers = Extension.create<{ enabled: boolean; kurallar: BaslikKurallari }>({
  name: "headingNumbers",

  addOptions() {
    return { enabled: false, kurallar: {} };
  },

  addCommands() {
    return {
      setHeadingNumbering:
        (enabled) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(headingNumbersKey, enabled);
          return true;
        },
      stripManualHeadingNumbers:
        () =>
        ({ tr, state, dispatch }) => {
          const targets = headingsOf(state.doc).filter((heading) => hasManualNumber(heading.text));
          if (targets.length === 0) return false;
          if (!dispatch) return true;
          for (const heading of targets) {
            const node = state.doc.nodeAt(heading.pos);
            const first = node?.firstChild;
            const removeLength = heading.text.length - stripManualNumber(heading.text).length;
            // Numara başlığın ilk metin parçasında olmalı (ör. kalın/normal karışık değilse)
            if (!first?.isText || (first.text ?? "").length < removeLength) continue;
            const from = tr.mapping.map(heading.pos + 1);
            tr.delete(from, from + removeLength);
          }
          return tr.docChanged;
        },
    };
  },

  addProseMirrorPlugins() {
    const initial = this.options.enabled;
    const kurallar = this.options.kurallar ?? {};
    /* Hiza ya da girinti kuralı varsa süsleme numaralandırma kapalıyken de gerekli. */
    const hizaVar = Boolean(kurallar.chapterAlign || kurallar.altGirinti);
    const kur = (doc: ProseMirrorNode, enabled: boolean) =>
      enabled || hizaVar ? buildDecorations(doc, enabled, kurallar) : DecorationSet.empty;
    return [
      new Plugin<HeadingNumbersState>({
        key: headingNumbersKey,
        state: {
          init: (_, state) => ({ enabled: initial, decorations: kur(state.doc, initial) }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(headingNumbersKey) as boolean | undefined;
            const enabled = meta ?? value.enabled;
            if (meta === undefined && !tr.docChanged) return value;
            if (!enabled && !hizaVar) return value.enabled ? { enabled, decorations: DecorationSet.empty } : value;
            return { enabled, decorations: kur(newState.doc, enabled) };
          },
        },
        props: {
          decorations: (state) => headingNumbersKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
