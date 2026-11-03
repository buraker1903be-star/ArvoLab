import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { etkinOneri, kabulEdilenOneri, oneriEklentisi, oneriGoster, oneriKabulEt, oneriTemizleIslem } from "@/lib/tiptap-satir-ici-oneri";
import { belge, paragraf } from "./ortam";

/*
  Satır içi öneri (03.11.2026). Öneri SÜSLEMEDİR: gösterilmesi belgeyi
  değiştirmez; yazma ya da imleç hareketi onu siler; Tab ile kabul edilen
  metin asistan izi taşır. Durum geçişleri tarayıcısız sınanıyor.
*/
function durum() {
  const doc = belge(paragraf("Enflasyon ile işsizlik arasındaki ilişki"));
  const son = doc.content.size - 1;
  return EditorState.create({ doc, plugins: [oneriEklentisi()], selection: TextSelection.create(doc, son) });
}

test("göstermek belgeyi değiştirmez; kabul asistan iziyle yazar", () => {
  let s = durum();
  const konum = s.selection.head;
  s = s.apply(oneriGoster(s, { konum, metin: " zayıflamıştır.", kayit: "k1" })!);
  assert.equal(etkinOneri(s)?.metin, " zayıflamıştır.");
  assert.equal(s.doc.textContent, "Enflasyon ile işsizlik arasındaki ilişki");

  const kabul = oneriKabulEt(s)!;
  assert.deepEqual(kabulEdilenOneri(kabul), { konum, metin: " zayıflamıştır.", kayit: "k1" });
  s = s.apply(kabul);
  assert.equal(s.doc.textContent, "Enflasyon ile işsizlik arasındaki ilişki zayıflamıştır.");
  assert.equal(etkinOneri(s), null);
  const eklenen = s.doc.firstChild!.lastChild!;
  assert.equal(eklenen.text, " zayıflamıştır.");
  assert.equal(eklenen.marks[0]?.type.name, "asistanIzi");
  assert.equal(eklenen.marks[0]?.attrs.kayit, "k1");
});

test("yazma, imleç hareketi ve Esc öneriyi siler", () => {
  const goster = (s: EditorState) => s.apply(oneriGoster(s, { konum: s.selection.head, metin: " devam", kayit: null })!);
  let s = goster(durum());
  s = s.apply(s.tr.insertText("x"));
  assert.equal(etkinOneri(s), null);

  s = goster(durum());
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 2)));
  assert.equal(etkinOneri(s), null);

  s = goster(durum());
  s = s.apply(oneriTemizleIslem(s));
  assert.equal(etkinOneri(s), null);
  assert.equal(oneriKabulEt(s), null, "öneri yokken Tab başka işe yarar");
});

test("imleç istekten sonra yer değiştirdiyse öneri gösterilmez", () => {
  const s = durum();
  assert.equal(oneriGoster(s, { konum: 2, metin: " x", kayit: null }), null);
  assert.equal(oneriGoster(s, { konum: s.selection.head, metin: "", kayit: null }), null);
});
