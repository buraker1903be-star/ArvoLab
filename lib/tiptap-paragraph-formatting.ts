import { Extension } from "@tiptap/core";
import { hangingIndentCmOf, indentCmOf, parseHangingStyle, parseIndentStyle } from "@/lib/paragraph-format";

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
      setFirstLineIndent: (value: boolean | number) => ReturnType;
      setHangingIndent: (value: boolean | number) => ReturnType;
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
          // true = 1,25 cm (eski kayıtlar), sayı = kılavuzun istediği cm
          firstLineIndent: {
            default: false,
            parseHTML: (element: HTMLElement) => parseIndentStyle(element.style.textIndent),
            renderHTML: (attributes: { firstLineIndent?: boolean | number }) => {
              const cm = indentCmOf(attributes as Record<string, unknown>);
              if (!cm) return {};
              return { style: `text-indent: ${cm}cm` };
            },
          },
          /*
            Asılı girinti: ilk satır kenarda, sonrakiler içeride. APA ve
            Chicago kaynakçada zorunlu tutar. İlk satır girintisinin
            tersi olduğu için ayrı öznitelik — bir paragraf ikisini
            birden taşıyamaz.

            CSS'te negatif text-indent + eşit padding ile kurulur;
            parseHTML yalnızca NEGATİF değeri asılı girinti sayar.
          */
          hangingIndent: {
            default: false,
            parseHTML: (element: HTMLElement) => parseHangingStyle(element.style.textIndent),
            renderHTML: (attributes: { hangingIndent?: boolean | number }) => {
              const cm = hangingIndentCmOf(attributes as Record<string, unknown>);
              if (!cm) return {};
              return { style: `text-indent: -${cm}cm; padding-left: ${cm}cm` };
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
        (value: boolean | number) =>
        ({ commands }: { commands: { updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean } }) => {
          let ok = true;
          for (const type of this.options.types) {
            // Asılı girinti ilk satır girintisinin tersi; biri açılınca öbürü kapanır.
            ok = commands.updateAttributes(type, { firstLineIndent: value, ...(value ? { hangingIndent: false } : {}) }) && ok;
          }
          return ok;
        },
      setHangingIndent:
        (value: boolean | number) =>
        ({ commands }: { commands: { updateAttributes: (type: string, attrs: Record<string, unknown>) => boolean } }) => {
          let ok = true;
          for (const type of this.options.types) {
            ok = commands.updateAttributes(type, { hangingIndent: value, ...(value ? { firstLineIndent: false } : {}) }) && ok;
          }
          return ok;
        },
    };
  },
});
