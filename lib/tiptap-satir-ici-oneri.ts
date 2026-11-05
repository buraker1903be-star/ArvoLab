import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ASISTAN_IZI } from "@/lib/tiptap-asistan-izi";

/*
  SATIR İÇİ ÖNERİ (03.11.2026, Jenni'nin imza özelliği). Yazım asistanının
  önerisi imlecin önünde GRİ gösterilir; belgeye girmez. Tab kabul eder
  (metin asistan iziyle girer, yazarlık raporu sayar), Esc ya da herhangi
  bir yazma/imleç hareketi öneriyi siler.

  "Asistan yalnızca SOHBETTE yazar" kuralının genişletilmiş hâli (kurum
  sahibinin kararı, 03.11.2026): öneri belgede GÖRÜNÜR ama belgenin
  parçası DEĞİLDİR — süsleme (decoration), düğüm değil. Kaydedilen JSON'a,
  yazdırmaya ve Word'e hiçbir koşulda girmez. Kabul kullanıcının tuşudur.

  Öneriyi isteyen ve getiren yer editör bileşeni (satir-ici-oneri.tsx);
  burası yalnızca gösterir, siler ve kabul eder. Durum geçişleri saf
  ProseMirror işlemleri: tests/editor/satir-ici-oneri.test.ts tarayıcısız
  sınar.
*/
export type Oneri = { konum: number; metin: string; kayit: string | null };
type Meta = { goster: Oneri } | { temizle: true } | { kabul: Oneri };

export const oneriAnahtari = new PluginKey<Oneri | null>("satirIciOneri");

export const etkinOneri = (state: EditorState): Oneri | null => oneriAnahtari.getState(state) ?? null;

/** Öneriyi gösteren işlem; konum imleç değilse (arada yazıldı) hiçbir şey yapmaz. */
export function oneriGoster(state: EditorState, oneri: Oneri): Transaction | null {
  const { selection } = state;
  if (!selection.empty || selection.head !== oneri.konum || !oneri.metin) return null;
  return state.tr.setMeta(oneriAnahtari, { goster: oneri } satisfies Meta);
}

/** Öneriyi asistan iziyle belgeye yazan işlem (Tab). */
export function oneriKabulEt(state: EditorState): Transaction | null {
  const oneri = etkinOneri(state);
  if (!oneri || state.selection.head !== oneri.konum) return null;
  const isaret = state.schema.marks[ASISTAN_IZI]?.create({ kayit: oneri.kayit });
  const tr = state.tr.insert(oneri.konum, state.schema.text(oneri.metin, isaret ? [isaret] : []));
  return tr.setMeta(oneriAnahtari, { kabul: oneri } satisfies Meta).scrollIntoView();
}

export const oneriTemizleIslem = (state: EditorState): Transaction => state.tr.setMeta(oneriAnahtari, { temizle: true } satisfies Meta);

/** Bir işlem öneriyi kabul ettiyse onu döndürür (çağıran kararı oturuma yazar; puan DEĞİL, 4.3). */
export const kabulEdilenOneri = (tr: Transaction): Oneri | null => {
  const meta = tr.getMeta(oneriAnahtari) as Meta | undefined;
  return meta && "kabul" in meta ? meta.kabul : null;
};

/** Eklentinin ProseMirror parçası; test aynı parçayı EditorState'e takar. */
export function oneriEklentisi() {
  return new Plugin<Oneri | null>({
    key: oneriAnahtari,
    state: {
      init: () => null,
      apply(tr, onceki) {
        const meta = tr.getMeta(oneriAnahtari) as Meta | undefined;
        if (meta) return "goster" in meta ? meta.goster : null;
        // Yazma, silme ya da imleç hareketi öneriyi geçersiz kılar: gösterildiği yer artık o yer değil.
        if (onceki && (tr.docChanged || tr.selectionSet)) return null;
        return onceki;
      },
    },
    props: {
      decorations(state) {
        const oneri = etkinOneri(state);
        if (!oneri) return null;
        return DecorationSet.create(state.doc, [
          Decoration.widget(
            oneri.konum,
            () => {
              const span = document.createElement("span");
              span.className = "satir-ici-oneri";
              span.textContent = oneri.metin;
              span.setAttribute("aria-hidden", "true");
              return span;
            },
            { side: 1, ignoreSelection: true, key: `oneri-${oneri.konum}-${oneri.metin.length}` },
          ),
        ]);
      },
    },
  });
}

export const SatirIciOneri = Extension.create({
  name: "satirIciOneri",
  // Tab, Word klavyesinin girinti kısayolundan ÖNCE yakalanmalı: öneri varken Tab kabul eder.
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      oneriEklentisi(),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const tr = oneriKabulEt(editor.state);
        if (!tr) return false;
        editor.view.dispatch(tr);
        return true;
      },
      Escape: ({ editor }) => {
        if (!etkinOneri(editor.state)) return false;
        editor.view.dispatch(oneriTemizleIslem(editor.state));
        return true;
      },
    };
  },
});
