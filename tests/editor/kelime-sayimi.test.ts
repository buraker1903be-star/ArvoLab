import assert from "node:assert/strict";
import test from "node:test";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import tez from "@/tests/fixtures/tez-enflasyon-issizlik.json";
import { editorExtensions } from "@/lib/tiptap-extensions";
import { countWords, type TiptapDoc } from "@/lib/tiptap-text";
import { editorSchema } from "./ortam";

/*
  B7 (Signature OS 4.3.5): editörün canlı sayısı ile kayıttaki sayı AYNI
  belge için AYNI olmalı. Editör tarafı, üretimde kullanılan eklenti
  listesindeki CharacterCount'un wordCounter'ıyla ve eklentinin kendi
  metin okumasıyla (textBetween(0, boyut, " ", " ")) hesaplanır: test
  kendi kopyasını değil, üretimin ayarını sınar.
*/
const ext = editorExtensions({ headingNumbering: true }).find((e) => e.name === "characterCount");
const wordCounter = (ext?.options as { wordCounter?: (t: string) => number } | undefined)?.wordCounter;
const editorSayisi = (doc: ProseMirrorNode) => wordCounter!(doc.textBetween(0, doc.content.size, " ", " "));

test("CharacterCount ortak sayacı kullanıyor", () => {
  assert.equal(typeof wordCounter, "function");
});

test("örnek tez: editör = kayıt (eskiden editör 6.354, kayıt 6.304)", () => {
  const doc = editorSchema.nodeFromJSON(tez);
  assert.equal(editorSayisi(doc), countWords(tez as TiptapDoc));
});

test("satır sonu, NBSP, sekme, dipnot, tablo, resim ve liste: editör = kayıt", () => {
  const json = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş Bölümü" }] },
      { type: "paragraph", content: [{ type: "text", text: "p < 0,05\tdüzeyinde" }, { type: "hardBreak" }, { type: "text", text: "anlamlı" }, { type: "footnoteReference", attrs: { text: "dipnot metni üç sözcük" } }, { type: "text", text: "bulundu." }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "madde bir" }] }] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "hücre" }] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "iki" }] }] }] }] },
      { type: "paragraph", content: [{ type: "text", text: "Şekil 1 —" }] },
    ],
  };
  const doc = editorSchema.nodeFromJSON(json);
  assert.equal(editorSayisi(doc), countWords(json as TiptapDoc));
  // Giriş Bölümü (2) · p < 0,05 düzeyinde (4) · anlamlı (1) · bulundu. (1) · madde bir (2) · hücre iki (2) · Şekil 1 — (3); dipnot metni sayılmaz.
  assert.equal(countWords(json as TiptapDoc), 15);
});
