import { getSchema } from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { editorExtensions } from "@/lib/tiptap-extensions";

/*
  Editör testlerinin ortamı: TARAYICI YOK.

  Tiptap'ın Editor'ü DOM istiyor ve onu taklit etmek (jsdom vb.) hem ağır
  bir bağımlılık hem de yanıltıcı: taklit DOM'un davranışı tarayıcıyla
  birebir değil, yani yeşil bir test yanlış güven verir. Oysa sınanmak
  istenen şeylerin çoğu DOM'a hiç dokunmuyor — belge ŞEMASI, metin arama,
  başlık sayımı, işlem (transaction) üretimi. @tiptap/core'un getSchema'sı
  eklenti listesinden şemayı başsız kuruyor; ProseMirror'ın Node ve
  EditorState'i de tarayıcı istemiyor.

  Şema editörün KENDİ listesinden (lib/tiptap-extensions.ts) kuruluyor.
  Test kendi eklenti listesini yazsaydı üretimdeki şemayı değil kendi
  kopyasını doğrulardı — ve liste değiştiğinde testler yeşil kalırdı.

  Kapsam dışı: düğümlerin HTML'e nasıl çizildiği (renderHTML), kopyala
  yapıştır ayrıştırması (parseHTML), imleç ve seçim davranışı, tuş
  kısayolları. Bunlar gerçek bir tarayıcı gerektiriyor.
*/
export const editorSchema: Schema = getSchema(editorExtensions({ headingNumbering: true }));

export type JsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** Tiptap JSON'dan gerçek ProseMirror belgesi (şema doğrulamasından geçer). */
export function belge(...content: JsonNode[]): ProseMirrorNode {
  return editorSchema.nodeFromJSON({ type: "doc", content });
}

export const paragraf = (text: string): JsonNode =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

export const baslik = (level: number, text: string): JsonNode => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});

/** Belgeden işlem üretir: replaceMatches gibi işlem alan işlevler için. */
export function islem(doc: ProseMirrorNode): Transaction {
  return EditorState.create({ doc }).tr;
}

/** İşlem uygulandıktan sonraki düz metin. */
export const islemSonrasiMetin = (tr: Transaction) => tr.doc.textBetween(0, tr.doc.content.size, "\n");
