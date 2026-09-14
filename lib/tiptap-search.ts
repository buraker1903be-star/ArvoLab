import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Bul ve değiştir
 * ------------------------------------------------------------
 * Eşleşmeler ProseMirror süslemesiyle (decoration) vurgulanır; odak arama
 * kutusunda kalırken metinde nerede olduğunuz görünür. Arama Türkçe
 * büyük/küçük harf duyarsızdır (İ/i, I/ı). Metin değiştikçe eşleşmeler
 * kendiliğinden yeniden hesaplanır.
 */
export interface TextMatch {
  from: number;
  to: number;
}

export interface SearchState {
  query: string;
  current: number;
  matches: TextMatch[];
  decorations: DecorationSet;
}

export const MAX_MATCHES = 2000;

const fold = (value: string) => value.toLocaleLowerCase("tr-TR");

/** Metin düğümleri içindeki eşleşmeler (biçim sınırını aşan eşleşmeler aranmaz) */
export function findMatches(doc: ProseMirrorNode, query: string, limit = MAX_MATCHES): TextMatch[] {
  if (!query) return [];
  const foldedQuery = fold(query);
  const matches: TextMatch[] = [];
  doc.descendants((node, pos) => {
    if (matches.length >= limit) return false;
    if (!node.isText || !node.text) return true;
    const text = node.text;
    const folded = fold(text);
    // Küçük harfe çevirme uzunluğu değiştirirse konumlar kayar; o durumda birebir arama yapılır.
    const aligned = folded.length === text.length && foldedQuery.length === query.length;
    const haystack = aligned ? folded : text;
    const needle = aligned ? foldedQuery : query;
    let index = haystack.indexOf(needle);
    while (index >= 0 && matches.length < limit) {
      matches.push({ from: pos + index, to: pos + index + query.length });
      index = haystack.indexOf(needle, index + needle.length);
    }
    return true;
  });
  return matches;
}

/** Eşleşmeleri sondan başa değiştirir (konumlar kaymaz); değiştirilen sayısını döndürür */
export function replaceMatches(tr: Transaction, matches: TextMatch[], replacement: string): number {
  for (const match of [...matches].sort((a, b) => b.from - a.from)) {
    if (replacement) tr.insertText(replacement, match.from, match.to);
    else tr.delete(match.from, match.to);
  }
  return matches.length;
}

export const searchKey = new PluginKey<SearchState>("arvolabSearch");

function buildState(doc: ProseMirrorNode, query: string, current: number): SearchState {
  const matches = query ? findMatches(doc, query) : [];
  const index = matches.length === 0 ? 0 : Math.min(Math.max(current, 0), matches.length - 1);
  const decorations = DecorationSet.create(
    doc,
    matches.map((match, i) =>
      Decoration.inline(match.from, match.to, { class: i === index ? "search-match is-current" : "search-match" })
    )
  );
  return { query, current: index, matches, decorations };
}

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", current: 0, matches: [], decorations: DecorationSet.empty }),
          apply(tr, previous, _oldState, newState) {
            const meta = tr.getMeta(searchKey) as { query?: string; current?: number } | undefined;
            if (!meta && (!tr.docChanged || !previous.query)) return previous;
            return buildState(newState.doc, meta?.query ?? previous.query, meta?.current ?? previous.current);
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.decorations;
          },
        },
      }),
    ];
  },
});

export function getSearchState(editor: Editor): SearchState | undefined {
  return searchKey.getState(editor.state);
}

/** Aramayı ayarlar ve geçerli eşleşmeyi ekranın ortasına kaydırır (odak arama kutusunda kalır) */
export function setSearch(editor: Editor, query: string, current = 0) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, current }));
  const state = getSearchState(editor);
  const match = state?.matches[state.current];
  if (!match) return;
  const { node } = editor.view.domAtPos(match.from);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function replaceCurrent(editor: Editor, replacement: string): boolean {
  const state = getSearchState(editor);
  const match = state?.matches[state.current];
  if (!state || !match) return false;
  const tr = editor.state.tr;
  replaceMatches(tr, [match], replacement);
  tr.setMeta(searchKey, { query: state.query, current: state.current });
  editor.view.dispatch(tr);
  return true;
}

export function replaceAll(editor: Editor, replacement: string): number {
  const state = getSearchState(editor);
  if (!state || state.matches.length === 0) return 0;
  const tr = editor.state.tr;
  const count = replaceMatches(tr, state.matches, replacement);
  tr.setMeta(searchKey, { query: state.query, current: 0 });
  editor.view.dispatch(tr);
  return count;
}
