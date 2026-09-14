import { Extension, getAttributes } from "@tiptap/core";

/**
 * Şekil ve tablo başlıkları
 * ------------------------------------------------------------
 * Bir paragraf "şekil" ya da "tablo" başlığı olarak işaretlenir; numara
 * saklanmaz, belge sırasına göre otomatik verilir (editörde CSS sayacı,
 * Word'de SEQ alanı, yazdırmada sunucu). Böylece araya şekil eklenince
 * numaralar ve Word'deki şekil/tablo listeleri kendiliğinden düzelir.
 */
export type CaptionKind = "figure" | "table";

export const CAPTION_LABELS: Record<CaptionKind, string> = { figure: "Şekil", table: "Tablo" };

export const isCaptionKind = (value: unknown): value is CaptionKind => value === "figure" || value === "table";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    caption: {
      /** Bulunulan paragrafı şekil/tablo başlığı yapar; aynı türdeyse normal paragrafa döndürür */
      toggleCaption: (kind: CaptionKind) => ReturnType;
    };
  }
}

export const Caption = Extension.create({
  name: "caption",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          caption: {
            default: null,
            // Başlık satırında Enter'a basınca yeni paragraf normal metin olsun
            keepOnSplit: false,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute("data-caption");
              return isCaptionKind(value) ? value : null;
            },
            renderHTML: (attributes: { caption?: string | null }) =>
              isCaptionKind(attributes.caption) ? { "data-caption": attributes.caption } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleCaption:
        (kind: CaptionKind) =>
        ({ state, commands }) => {
          // Zincirdeki işlemin güncel seçimine bakılır (editor.state önceki seçimi gösterebilir).
          const current = getAttributes(state, "paragraph").caption;
          return commands.updateAttributes("paragraph", { caption: current === kind ? null : kind });
        },
    };
  },
});
