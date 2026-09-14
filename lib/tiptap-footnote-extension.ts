import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Basitleştirilmiş Dipnot Uzantısı
 * ------------------------------------------------------------
 * Word'ün "kayan/otomatik numaralanan sayfa altı dipnotu" ile
 * birebir aynı değildir (web editörlerinde bunu tam olarak
 * yeniden üretmek pratik değildir). Bunun yerine: metin içine
 * üstsimge bir referans işareti eklenir, dipnot metni işaretin
 * kendisinde saklanır ve DOCX'e aktarımda gerçek Word dipnotuna
 * çevrilir.
 *
 * Numara saklanmaz: editörde CSS sayacıyla (workspace.css), Word'de
 * Word'ün kendi dipnot numarasıyla belge sırasına göre verilir. Böylece
 * araya dipnot eklenince/silinince numaralar kendiliğinden düzelir.
 * (Eski kayıtlardaki "number" özniteliği yalnızca uyumluluk için durur.)
 */
export interface FootnoteAttributes {
  id: string;
  text: string;
}

export const FootnoteReference = Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      text: { default: "" },
      number: { default: 1, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "sup[data-footnote-id]",
        getAttrs: (element) => ({
          id: element.getAttribute("data-footnote-id"),
          text: element.getAttribute("data-footnote-text") ?? element.getAttribute("title") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-id": node.attrs.id,
        "data-footnote-text": node.attrs.text,
        class: "footnote-marker",
        title: `Dipnot: ${node.attrs.text}`,
        role: "button",
        "aria-label": `Dipnot: ${node.attrs.text}`,
      }),
    ];
  },

  renderText() {
    return "";
  },
});
