import { Mark, mergeAttributes } from "@tiptap/core";

/*
  ASİSTAN İZİ (03.11.2026, yazarlık raporu). Yazım asistanının metni
  ("Paragrafın altına ekle" / "Seçilenin yerine koy") belgeye bu işaretle girer;
  rapor (lib/yazarlik-raporu.ts) belgede hâlâ duran işaretli metni sayar.

  GÖRÜNMEZ: editörde yalnızca rapor penceresinde "Vurgula" açıkken
  renklenir; yazdırma, danışman paylaşımı ve Word çıktısı işareti hiç
  tanımıyor (lib/tiptap-html.ts, lib/tiptap-docx.ts bilinmeyen işareti
  atlayıp metni yazıyor — tests/editor/asistan-izi.test.ts sabitliyor).

  inclusive: false — işaretli parçanın SONUNA yazılan metin işareti
  devralmaz; öğrencinin eklediği cümle asistanınki sayılmasın. Parçanın
  ORTASINA yazılan metin ise ProseMirror'un kuralıyla işareti devralır:
  rapor o durumda asistan payını FAZLA gösterir, eksik değil. Bilerek
  böyle: akademik dürüstlük raporunda hata yapılacaksa güvenli yön bu.

  `kayit`: metni üreten ai_assistant_runs kaydı; aynı eklemenin parçaları
  tek ekleme sayılsın diye.
*/
export const ASISTAN_IZI = "asistanIzi";

export const AsistanIzi = Mark.create({
  name: ASISTAN_IZI,
  inclusive: false,
  addAttributes() {
    return {
      kayit: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-asistan") || null,
        renderHTML: (attrs: { kayit?: string | null }) => ({ "data-asistan": attrs.kayit ?? "" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-asistan]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "asistan-izi" }), 0];
  },
});
