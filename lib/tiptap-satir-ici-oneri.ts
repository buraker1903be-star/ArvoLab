import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
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

/**
 * Öneriyi asistan iziyle belgeye yazan işlem (Tab). closeHistory: kabul,
 * hemen önce yazılan harflerle aynı geri alma grubuna girmesin. Eskiden
 * öğrenci yazıp 500 ms içinde Tab'a basınca Ctrl+Z öneriyle birlikte son
 * yazdığı sözcüğü de siliyordu.
 */
export function oneriKabulEt(state: EditorState): Transaction | null {
  const oneri = etkinOneri(state);
  if (!oneri || state.selection.head !== oneri.konum) return null;
  const isaret = state.schema.marks[ASISTAN_IZI]?.create({ kayit: oneri.kayit });
  const tr = state.tr.insert(oneri.konum, state.schema.text(oneri.metin, isaret ? [isaret] : []));
  return closeHistory(tr.setMeta(oneriAnahtari, { kabul: oneri } satisfies Meta).scrollIntoView());
}

/**
 * Kabulü gönderir ve ardından geçmişi kapatır: kabulden sonra yazılan da
 * öneriyle aynı gruba girmesin, tek Ctrl+Z yalnızca öneriyi geri alsın.
 * Tab ve dokunmatik "Ekle" düğmesi aynı yolu kullanır.
 */
export function oneriKabulGonder(view: Pick<EditorView, "state" | "dispatch">): boolean {
  const tr = oneriKabulEt(view.state);
  if (!tr) return false;
  view.dispatch(tr);
  view.dispatch(closeHistory(view.state.tr));
  return true;
}

/*
  Dokunmatik ekranda Tab yok (20.11.2026): öneriyle birlikte küçük bir
  "Ekle" düğmesi çizilir, yalnızca kaba işaretçide görünür (workspace.css).
  Metni dil özniteliğinden seçer: eklenti listesi ortak ve durağan
  (lib/tiptap-extensions.ts), çeviri kancası buraya ulaşmıyor.
*/
const ingilizceMi = () => typeof document !== "undefined" && document.documentElement.lang.startsWith("en");

export const oneriTemizleIslem = (state: EditorState): Transaction => state.tr.setMeta(oneriAnahtari, { temizle: true } satisfies Meta);

/** Bir işlem öneriyi kabul ettiyse onu döndürür (çağıran "faydalı" puanı yazar). */
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
            (view) => {
              const kap = document.createElement("span");
              kap.className = "satir-ici-oneri-kap";
              kap.contentEditable = "false";
              const span = document.createElement("span");
              span.className = "satir-ici-oneri";
              span.textContent = oneri.metin;
              span.setAttribute("aria-hidden", "true");
              const dugme = document.createElement("button");
              dugme.type = "button";
              dugme.className = "satir-ici-oneri-ekle";
              dugme.textContent = ingilizceMi() ? "Add" : "Ekle";
              dugme.setAttribute("aria-label", ingilizceMi() ? "Accept suggestion" : "Öneriyi ekle");
              // Dokunuş odağı editörden almasın: imleç yerinde kalmalı, yoksa öneri düşer.
              dugme.addEventListener("mousedown", (olay) => olay.preventDefault());
              dugme.addEventListener("pointerdown", (olay) => olay.preventDefault());
              dugme.addEventListener("click", (olay) => {
                olay.preventDefault();
                oneriKabulGonder(view);
                view.focus();
              });
              kap.append(span, dugme);
              return kap;
            },
            {
              side: 1,
              ignoreSelection: true,
              key: `oneri-${oneri.konum}-${oneri.metin.length}`,
              /*
                Düğmeye gelen dokunuşu ProseMirror işlemesin: işlerse imleci
                dokunulan yere taşıyor, öneri "imleç hareketi" sayılıp tıklama
                gelmeden siliniyordu (telefonda "Ekle" hiçbir şey yapmıyordu).
              */
              stopEvent: (olay: Event) => olay.target instanceof Element && Boolean(olay.target.closest(".satir-ici-oneri-ekle")),
            },
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
      // Öneri yokken false: Tab tabloda hücre değiştirir, listede girinti yapar.
      Tab: ({ editor }) => oneriKabulGonder(editor.view),
      Escape: ({ editor }) => {
        if (!etkinOneri(editor.state)) return false;
        editor.view.dispatch(oneriTemizleIslem(editor.state));
        return true;
      },
    };
  },
});
