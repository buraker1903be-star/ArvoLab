import { Extension } from "@tiptap/core";

/**
 * Paragraf Biçimlendirme Extension'ı — Satır Aralığı ve İlk Satır Girintisi
 * ------------------------------------------------------------
 * Türkiye'deki üniversitelerin tez/makale yazım kılavuzlarında sık
 * istenen iki biçim özelliğini (1.5 satır aralığı, ilk satır girintisi)
 * PARAGRAF seviyesinde uygular — Tiptap'ın hazır LineHeight'ı karakter
 * (mark) seviyesinde çalıştığı için satır aralığı gibi doğası gereği
 * paragraf-geneli bir özellik için uygun değildir. Bu extension,
 * TextAlign'in aynı deseniyle (node attribute + inline style) çalışır.
 */
export interface ParagraphFormattingOptions {
  types: string[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphFormatting: {
      setLineSpacing: (value: string | null) => ReturnType;
      setFirstLineIndent: (value: boolean) => ReturnType;
    };
  }
}

export const ParagraphFormatting = Extension.create<ParagraphFormattingOptions>({
  name: "paragraphFormatting",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineSpacing: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: { lineSpacing?: string | null }) => {
              if (!attributes.lineSpacing) return {};
              return { style: `line-height: ${attributes.lineSpacing}` };
            },
          },
          firstLineIndent: {
            default: false,
            parseHTML: (element: HTMLElement) => element.style.textIndent === "1.25cm",
            renderHTML: (attributes: { firstLineIndent?: boolean }) => {
              if (!attributes.firstLineIndent) return {};
              return { style: "text-indent: 1.25cm" };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing:
        (value: string | null) =>
        ({ commands }: { commands: { updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean } }) => {
          let ok = true;
          for (const type of this.options.types) {
            ok = commands.updateAttributes(type, { lineSpacing: value }) && ok;
          }
          return ok;
        },
      setFirstLineIndent:
        (value: boolean) =>
        ({ commands }: { commands: { updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean } }) => {
          let ok = true;
          for (const type of this.options.types) {
            ok = commands.updateAttributes(type, { firstLineIndent: value }) && ok;
          }
          return ok;
        },
    };
  },
});
