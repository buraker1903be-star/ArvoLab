import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { hasManualNumber, numberHeadings, onSayfaBasligiMi, stripManualNumber } from "@/lib/heading-numbering";
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
  /* Ön sayfa ve ana metnin başı her zaman yeni sayfadan (lib/chapter-rules.ts onSayfaKirilimlari): editörde ayraç. */
  const anaBas = headings.findIndex((h) => h.level === 1 && !onSayfaBasligiMi(h.text));
  const onSayfaVar = headings.some((h, i) => h.level === 1 && (anaBas < 0 || i < anaBas));
  headings.forEach((heading, index) => {
    const ozellik: Record<string, string> = {};
    if (heading.level === 1 && heading.pos > 0 && (onSayfaBasligiMi(heading.text) || (index === anaBas && onSayfaVar))) {
      ozellik["data-yeni-sayfa"] = "true";
    }
    const number = numbers[index];
    if (number) ozellik["data-heading-number"] = number;
    const hiza = heading.level === 1 ? anaBaslikHizasi(heading.text, kurallar) : null;
    if (hiza) ozellik["data-kilavuz-hiza"] = hiza;
    if (altBaslikGirintisi(heading.level, kurallar.altGirinti) !== null) ozellik["data-kilavuz-girinti"] = "true";
    if (Object.keys(ozellik).length) decorations.push(Decoration.node(heading.pos, heading.pos + heading.size, ozellik));
  });
  return DecorationSet.create(doc, decorations);
}

/*
  İŞLEM BAŞLIKLARA DOKUNUYOR MU? (Phase 2, 04.11.2026)

  Süsleme her belge değişikliğinde BAŞTAN kuruluyordu. Belgeyi gezmek ucuz
  (~160 bin sözcükte 1,4 ms) ama ProseMirror'ın DecorationSet.create'i
  üst düzey düğüm süslemelerini her üst düzey blokla karşılaştırıyor:
  ölçüm (tests/fixtures tezi çoğaltılarak, Node) ~51 bin sözcük / 400
  başlıkta tuş başına 10,9 ms, ~160 bin sözcük / 1.250 başlıkta 77 ms.

  Numara, hiza, girinti ve sayfa ayracı YALNIZCA başlıklardan (sıra, düzey,
  metin) türüyor. İşlem hiçbir başlığa dokunmuyorsa (paragrafa yazmak,
  paragraf silmek, biçim) mevcut süsleme yeni konumlara EŞLENİR — aynı
  sonuç, tuş başına 3,1 ms / 28 ms. Emin olunamayan her adım (sarmalama,
  öznitelik, düğüm türü değişimi) "dokunuyor" sayılır ve baştan kurulur.
  tests/editor/baslik-numaralari.test.ts eşlenen sonucun baştan kurulanla
  birebir aynı olduğunu rastgele düzenlemelerle sınar.
*/
export function basliklaraDokunurMu(tr: Transaction): boolean {
  for (let i = 0; i < tr.steps.length; i++) {
    const adim = tr.steps[i];
    // Biçim (kalın, italik…) başlığın metnini ve düzeyini değiştirmez.
    if (adim instanceof AddMarkStep || adim instanceof RemoveMarkStep) continue;
    if (!(adim instanceof ReplaceStep)) return true;
    const once = tr.docs[i];
    const { from, to } = adim as unknown as { from: number; to: number };
    for (const konum of [from, to]) {
      const $k = once.resolve(konum);
      for (let d = $k.depth; d > 0; d--) if ($k.node(d).type.name === "heading") return true;
    }
    let dokundu = false;
    once.nodesBetween(from, to, (dugum) => {
      if (dokundu) return false;
      if (dugum.type.name === "heading") dokundu = true;
      return !dugum.isTextblock;
    });
    if (dokundu) return true;
    adim.slice.content.descendants((dugum) => {
      if (dugum.type.name === "heading") dokundu = true;
      return !dokundu;
    });
    if (dokundu) return true;
  }
  return false;
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
    /* Süsleme numaralandırma kapalıyken de kuruluyor: ön sayfa ayracı, hiza ve girinti her belgede (02.11.2026). */
    const kur = (doc: ProseMirrorNode, enabled: boolean) => buildDecorations(doc, enabled, kurallar);
    return [
      new Plugin<HeadingNumbersState>({
        key: headingNumbersKey,
        state: {
          init: (_, state) => ({ enabled: initial, decorations: kur(state.doc, initial) }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(headingNumbersKey) as boolean | undefined;
            const enabled = meta ?? value.enabled;
            if (meta === undefined && !tr.docChanged) return value;
            // Başlığa dokunmayan değişiklik: süsleme yeni konumlara eşlenir (basliklaraDokunurMu).
            if (meta === undefined && !basliklaraDokunurMu(tr)) {
              return { enabled, decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
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
