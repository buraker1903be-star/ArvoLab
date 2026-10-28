import { Extension, getAttributes } from "@tiptap/core";
import type { Dil, Metin } from "@/lib/dil";

/**
 * Şekil ve tablo başlıkları
 * ------------------------------------------------------------
 * Bir paragraf "şekil" ya da "tablo" başlığı olarak işaretlenir; numara
 * saklanmaz, belge sırasına göre otomatik verilir (editörde CSS sayacı,
 * Word'de SEQ alanı, yazdırmada sunucu). Böylece araya şekil eklenince
 * numaralar ve Word'deki şekil/tablo listeleri kendiliğinden düzelir.
 */
export type CaptionKind = "figure" | "table";

/*
  Etiket BELGENİN parçası: Word'deki SEQ alanının adı ve şekil/tablo
  listesinin süzgeci bu metin. İngilizce yazılan bir tezde "Şekil 1"
  çıkması yanlış olurdu; çıktıyı üreten çağıran dili verir
  (28.10.2026). Verilmezse Türkçe — eski çıktılar birebir aynı kalır.
*/
export const CAPTION_LABELS_METIN: Record<CaptionKind, Metin> = {
  figure: { tr: "Şekil", en: "Figure" },
  table: { tr: "Tablo", en: "Table" },
};

export const CAPTION_LABELS: Record<CaptionKind, string> = { figure: CAPTION_LABELS_METIN.figure.tr, table: CAPTION_LABELS_METIN.table.tr };

export const captionLabel = (kind: CaptionKind, dil: Dil = "tr"): string => CAPTION_LABELS_METIN[kind][dil];

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
