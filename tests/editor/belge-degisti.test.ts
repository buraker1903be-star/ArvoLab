import assert from "node:assert/strict";
import test from "node:test";
import { TextSelection } from "@tiptap/pm/state";
import { belgeGercektenDegisti } from "@/lib/tiptap-belge-degisti";
import { belge, islem, paragraf } from "./ortam";

/*
  HAYALET KAYIT (05.11.2026). Editör her açılışta setEditable çağırıyordu;
  Tiptap bu çağrıda belgeye dokunmadan, boş bir işlemle "update" yayınlıyor
  ve onUpdate kaydı tetikliyordu. Süzgeç (lib/tiptap-belge-degisti.ts)
  GERÇEK ProseMirror işlemleriyle sınanıyor: yalnızca alan adlarını taklit
  eden nesnelerle yazılmış bir test, ProseMirror'un docChanged'i nasıl
  hesapladığını görmezdi.
*/
test("belgeGercektenDegisti", async (t) => {
  const doc = belge(paragraf("Enflasyon ile işsizlik"), paragraf("ikinci paragraf"));

  await t.test("setEditable'ın yayınladığı boş işlem: kayıt YOK", () => {
    assert.equal(belgeGercektenDegisti({ transaction: islem(doc), appendedTransactions: [] }), false);
  });

  await t.test("yalnızca seçim değişikliği: kayıt YOK", () => {
    const tr = islem(doc);
    tr.setSelection(TextSelection.create(tr.doc, 3));
    assert.equal(tr.selectionSet, true);
    assert.equal(belgeGercektenDegisti({ transaction: tr, appendedTransactions: [] }), false);
  });

  await t.test("metin yazma: kayıt VAR", () => {
    const tr = islem(doc).insertText("x", 1);
    assert.equal(belgeGercektenDegisti({ transaction: tr, appendedTransactions: [] }), true);
  });

  await t.test("silme ve öznitelik değişikliği: kayıt VAR", () => {
    assert.equal(belgeGercektenDegisti({ transaction: islem(doc).delete(1, 4) }), true);
    const tr = islem(doc);
    tr.setNodeMarkup(0, undefined, { ...tr.doc.firstChild!.attrs, textAlign: "center" });
    assert.equal(belgeGercektenDegisti({ transaction: tr }), true);
  });

  await t.test("ana işlem yalnızca seçim, eklentinin EKLEDİĞİ işlem belgeyi değiştiriyor: kayıt VAR (engellenmemeli)", () => {
    const ana = islem(doc);
    ana.setSelection(TextSelection.create(ana.doc, 3));
    const eklenen = islem(doc).insertText("!", 1);
    assert.equal(belgeGercektenDegisti({ transaction: ana, appendedTransactions: [eklenen] }), true);
    assert.equal(belgeGercektenDegisti({ transaction: ana, appendedTransactions: [islem(doc), eklenen] }), true);
  });

  await t.test("eksik alanlar güvenli tarafa düşer (kayıt YOK, hata YOK)", () => {
    assert.equal(belgeGercektenDegisti({}), false);
    assert.equal(belgeGercektenDegisti({ transaction: null, appendedTransactions: null }), false);
    assert.equal(belgeGercektenDegisti({ transaction: undefined, appendedTransactions: [null, undefined] }), false);
  });
});
