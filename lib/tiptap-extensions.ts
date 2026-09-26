import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TiptapImage from "@tiptap/extension-image";
import { Superscript } from "@tiptap/extension-superscript";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Caption } from "@/lib/tiptap-caption";
import { SearchHighlight } from "@/lib/tiptap-search";
import { HeadingNumbers } from "@/lib/tiptap-heading-numbers";
import { FootnoteReference } from "@/lib/tiptap-footnote-extension";
import { ParagraphFormatting } from "@/lib/tiptap-paragraph-formatting";

/*
  Editörün eklenti listesi.

  Liste editör bileşeninin İÇİNDE duruyordu, yani React'e dokunmadan
  çağrılamıyor ve sınanamıyordu. Belge ŞEMASI buradan doğuyor: hangi
  düğümler var, hangi öznitelikleri taşıyorlar, kaydedilen JSON neye
  benziyor. Uygulamanın geri kalanı bu şemayı varsayıyor —
  lib/tiptap-html.ts dipnot ve şekil başlığı özniteliklerini okuyor,
  lib/manuscript-readiness.ts başlık düzeylerini sayıyor,
  lib/format-loss.ts hangi düğümlerin öznitelik taşıdığını biliyor.

  Ayrılmasının sebebi testin bunu görebilmesi: @tiptap/core'un getSchema'sı
  bu listeden tarayıcı olmadan şema kuruyor (tests/editor/). Editörün
  kendisi ile testin AYNI listeyi kullanması şart, yoksa test üretimdeki
  şemayı değil kendi kopyasını doğrular.

  Bu dosya bilerek "use client" DEĞİL ve React'e dokunmuyor.
*/
export const EDITOR_PLACEHOLDER = "Çalışmanızı buraya yazmaya başlayın...";

export function editorExtensions(secenek: { headingNumbering: boolean }) {
  return [
    StarterKit.configure({
      link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    ParagraphFormatting,
    Placeholder.configure({ placeholder: EDITOR_PLACEHOLDER }),
    CharacterCount,
    Superscript,
    TiptapImage,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    FootnoteReference,
    Caption,
    SearchHighlight,
    HeadingNumbers.configure({ enabled: secenek.headingNumbering }),
  ];
}
