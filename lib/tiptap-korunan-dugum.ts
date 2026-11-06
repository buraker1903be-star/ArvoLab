import { Mark, Node, mergeAttributes } from "@tiptap/core";
import type { Dil, Metin } from "@/lib/dil";
import { KORUNAN_BLOK, KORUNAN_ISARET, KORUNAN_SATIR_ICI, korunanOnizleme } from "@/lib/tiptap-korunan-icerik";

/*
  Korunan öğe düğümleri (S1.3). Ayrıntı ve gerekçe: lib/tiptap-korunan-icerik.ts.

  Editörün tanımadığı içerik, özgün JSON'u `json` özniteliğinde saklanarak
  bu düğümlerle gösterilir; bölünmez (atom) ve düzenlenemez. Kullanıcı
  çevresindeki metni düzenleyebilir, kutuyu seçip silebilir (bu kendi
  kararıdır ve geri alınabilir), ama içini değiştiremez.

  Bu düğümler YALNIZCA editörde yaşar: kayıt (istemci) ve saveManuscript
  (sunucu) onları özgün düğüme geri sarar, veritabanına yazılmazlar. Bu
  yüzden yazdırma, paylaşım ve Word çıktısının (tests/editor/cikti-yollari)
  bunları tanıması gerekmiyor.

  Kopyala-yapıştır: öznitelikler data-* olarak çizilip geri okunuyor; kutu
  belge içinde taşındığında içeriği kaybolmaz. Başka bir uygulamaya
  yapıştırıldığında yalnızca etiket metni gider.
*/

export const KORUNAN_ETIKET_METIN: Metin = { tr: "Desteklenmeyen öğe (korunuyor)", en: "Unsupported item (preserved)" };

const korunanOznitelikler = () => ({
  tur: {
    default: "?",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-korunan-tur") ?? "?",
    renderHTML: (a: Record<string, unknown>) => ({ "data-korunan-tur": String(a.tur ?? "?") }),
  },
  json: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-korunan-json") ?? "",
    renderHTML: (a: Record<string, unknown>) => ({ "data-korunan-json": String(a.json ?? "") }),
  },
});

const etiket = (dil: Dil, tur: unknown, json: unknown) => {
  const onizleme = korunanOnizleme(json);
  return `${KORUNAN_ETIKET_METIN[dil]} · ${String(tur ?? "?")}${onizleme ? ` — ${onizleme}` : ""}`;
};

export const KorunanBlok = Node.create<{ dil: Dil }>({
  name: KORUNAN_BLOK,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addOptions: () => ({ dil: "tr" as Dil }),
  addAttributes: korunanOznitelikler,
  parseHTML: () => [{ tag: "div[data-korunan-json]" }],
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "korunan-oge", contenteditable: "false" }),
      etiket(this.options.dil, node.attrs.tur, node.attrs.json),
    ];
  },
  renderText: () => "",
});

export const KorunanSatirIci = Node.create<{ dil: Dil }>({
  name: KORUNAN_SATIR_ICI,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ dil: "tr" as Dil }),
  addAttributes: korunanOznitelikler,
  parseHTML: () => [{ tag: "span[data-korunan-json]", priority: 100 }],
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "korunan-oge korunan-oge-satir", contenteditable: "false" }),
      etiket(this.options.dil, node.attrs.tur, node.attrs.json),
    ];
  },
  renderText: () => "",
});

/*
  Tanınmayan işaret: metin düzenlenebilir kalır, işaret özgün JSON'uyla
  taşınır. excludes "" — aynı metinde birden çok tanınmayan işaret olabilir.
  inclusive false — işaretin sınırında yazılan yeni metin onu devralmaz
  (özgün işaretin ne anlama geldiğini bilmiyoruz).
*/
export const KorunanIsaret = Mark.create({
  name: KORUNAN_ISARET,
  excludes: "",
  inclusive: false,
  addAttributes: korunanOznitelikler,
  parseHTML: () => [{ tag: "span[data-korunan-isaret]" }],
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-korunan-isaret": "", class: "korunan-isaret" }), 0];
  },
});
