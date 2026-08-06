import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Basitleştirilmiş Dipnot Uzantısı
 * ------------------------------------------------------------
 * Word'ün "kayan/otomatik numaralanan sayfa altı dipnotu" ile
 * birebir aynı değildir (web editörlerinde bunu tam olarak
 * yeniden üretmek pratik değildir). Bunun yerine: metin içine
 * numaralı bir üstsimge referans işareti eklenir; dipnot metninin
 * kendisi ayrı bir "Dipnotlar" düğümünde saklanır ve DOCX'e
 * aktarımda gerçek Word dipnotuna çevrilir.
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

  addAttributes() {
    return {
      id: { default: null },
      text: { default: "" },
      number: { default: 1 },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-id]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-id": node.attrs.id,
        class: "footnote-marker",
        title: node.attrs.text,
      }),
      String(node.attrs.number),
    ];
  },
});
