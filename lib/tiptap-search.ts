import { katla } from "@/lib/arama-katlama";
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

// İngilizce I/i de eşleşsin (lib/arama-katlama.ts).
const fold = katla;

/** Tek bir metin düğümündeki eşleşmeler (findMatches ve artımlı tarama aynı kuralı kullanır). */
function metinDugumundeAra(text: string, pos: number, query: string, foldedQuery: string, matches: TextMatch[], limit: number) {
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
}

/** Metin düğümleri içindeki eşleşmeler (biçim sınırını aşan eşleşmeler aranmaz) */
export function findMatches(doc: ProseMirrorNode, query: string, limit = MAX_MATCHES): TextMatch[] {
  if (!query) return [];
  const foldedQuery = fold(query);
  const matches: TextMatch[] = [];
  doc.descendants((node, pos) => {
    if (matches.length >= limit) return false;
    if (!node.isText || !node.text) return true;
    metinDugumundeAra(node.text, pos, query, foldedQuery, matches, limit);
    return true;
  });
  return matches;
}

/*
  ARTIMLI GÜNCELLEME (Phase 2, 04.11.2026). Arama kutusu açıkken metne
  yazılan her harfte bütün belge yeniden taranıyordu: ~51 bin sözcükte tuş
  başına ~30 ms, ~160 bin sözcükte ~55 ms (Node ölçümü). Artık eski
  eşleşmeler yeni konumlarına eşleniyor ve YALNIZCA değişen metin
  blokları yeniden taranıyor. Sonuç tam taramayla birebir aynı olmalı
  (tests/editor/arama.test.ts rastgele düzenlemelerle sınar); emin
  olunamayan durumda (eşleşme sınırına ulaşılmışsa) null döner ve çağıran
  tam tarama yapar.
*/
export function eslesmeleriGuncelle(onceki: TextMatch[], query: string, tr: Transaction, limit = MAX_MATCHES): TextMatch[] | null {
  if (!query || onceki.length >= limit) return null;
  const doc = tr.doc;
  // Değişen aralıklar, SON belgenin konumlarıyla.
  const araliklar: [number, number][] = [];
  tr.mapping.maps.forEach((harita, i) => {
    const sonra = tr.mapping.slice(i + 1);
    harita.forEach((_eskiBas, _eskiSon, yeniBas, yeniSon) => {
      araliklar.push([sonra.map(yeniBas, -1), sonra.map(yeniSon, 1)]);
    });
    /*
      Biçim adımları (kalın, italik…) konum haritasında görünmez ama metin
      düğümünü böler: biçim sınırını aşan eşleşme artık eşleşme değil.
      Adımın kendi aralığı da taranır.
    */
    const adim = tr.steps[i] as unknown as { from?: number; to?: number };
    if (typeof adim.from === "number" && typeof adim.to === "number") {
      const kalan = tr.mapping.slice(i);
      araliklar.push([kalan.map(adim.from, -1), kalan.map(adim.to, 1)]);
    }
  });
  // Değişen aralığa değen metin blokları yeniden taranacak.
  const bloklar = new Map<number, ProseMirrorNode>();
  const blokEkle = (konum: number) => {
    const $k = doc.resolve(Math.max(0, Math.min(konum, doc.content.size)));
    for (let d = $k.depth; d >= 0; d--) {
      if ($k.node(d).isTextblock) {
        bloklar.set($k.before(d), $k.node(d));
        return;
      }
    }
  };
  for (const [bas, son] of araliklar) {
    blokEkle(bas);
    blokEkle(son);
    doc.nodesBetween(bas, son, (dugum, konum) => {
      if (dugum.isTextblock) {
        bloklar.set(konum, dugum);
        return false;
      }
      return true;
    });
  }
  const taranan = [...bloklar].map(([konum, dugum]) => [konum, konum + dugum.nodeSize] as const);
  const taranandaMi = (m: TextMatch) => taranan.some(([a, b]) => m.from >= a && m.to <= b);
  const sonuc: TextMatch[] = [];
  for (const m of onceki) {
    const from = tr.mapping.mapResult(m.from, 1);
    const to = tr.mapping.mapResult(m.to, -1);
    if (from.deleted || to.deleted || to.pos - from.pos !== query.length) continue;
    const yeni = { from: from.pos, to: to.pos };
    if (!taranandaMi(yeni)) sonuc.push(yeni);
  }
  const foldedQuery = fold(query);
  for (const [konum, dugum] of bloklar) {
    dugum.descendants((alt, altKonum) => {
      if (alt.isText && alt.text) metinDugumundeAra(alt.text, konum + 1 + altKonum, query, foldedQuery, sonuc, Number.POSITIVE_INFINITY);
      return true;
    });
  }
  sonuc.sort((a, b) => a.from - b.from);
  // Sınır aşıldıysa tam tarama ile aynı kesimi vermek için ilk "limit" eşleşme.
  return sonuc.length > limit ? sonuc.slice(0, limit) : sonuc;
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

function buildState(doc: ProseMirrorNode, query: string, current: number, hazir?: TextMatch[]): SearchState {
  const matches = hazir ?? (query ? findMatches(doc, query) : []);
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
            // Yalnızca metin değiştiyse (sorgu aynı): artımlı güncelleme; olmazsa tam tarama.
            const artimli = meta ? null : eslesmeleriGuncelle(previous.matches, previous.query, tr);
            return buildState(newState.doc, meta?.query ?? previous.query, meta?.current ?? previous.current, artimli ?? undefined);
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
  /* Vurgulama 2000 eşleşmede kesiliyor (MAX_MATCHES); değiştirme kesilmemeli.
     Eskiden yalnızca ilk 2000 yer değişiyor, bildirim "2000 yer değiştirildi"
     diyerek hepsinin değiştiğini ima ediyordu. */
  const hepsi = findMatches(editor.state.doc, state.query, Number.POSITIVE_INFINITY);
  const count = replaceMatches(tr, hepsi, replacement);
  tr.setMeta(searchKey, { query: state.query, current: 0 });
  editor.view.dispatch(tr);
  return count;
}
