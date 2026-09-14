import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { hasManualNumber, numberHeadings, stripManualNumber } from "@/lib/heading-numbering";

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

function buildDecorations(doc: ProseMirrorNode) {
  const headings = headingsOf(doc);
  const numbers = numberHeadings(headings);
  const decorations: Decoration[] = [];
  headings.forEach((heading, index) => {
    const number = numbers[index];
    if (number) decorations.push(Decoration.node(heading.pos, heading.pos + heading.size, { "data-heading-number": number }));
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

export const HeadingNumbers = Extension.create<{ enabled: boolean }>({
  name: "headingNumbers",

  addOptions() {
    return { enabled: false };
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
    return [
      new Plugin<HeadingNumbersState>({
        key: headingNumbersKey,
        state: {
          init: (_, state) => ({ enabled: initial, decorations: initial ? buildDecorations(state.doc) : DecorationSet.empty }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(headingNumbersKey) as boolean | undefined;
            const enabled = meta ?? value.enabled;
            if (!enabled) return value.enabled ? { enabled, decorations: DecorationSet.empty } : value;
            if (meta === undefined && !tr.docChanged) return value;
            return { enabled, decorations: buildDecorations(newState.doc) };
          },
        },
        props: {
          decorations: (state) => headingNumbersKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
