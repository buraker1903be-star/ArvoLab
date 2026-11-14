import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { belgeyiKirletirMi } from "@/lib/editor-kirlenme";
import { headingNumbersKey } from "@/lib/tiptap-heading-numbers";
import { belge, paragraf } from "./ortam";

/*
  Hangi "update" olayı kaydı tetikler? 14.11.2026'ya kadar yazım editörü
  her açılışta, hiçbir etkileşim olmadan bir kez kaydediyordu: Tiptap'ın
  setEditable'ı belge aynıyken boş bir işlemle (`state.tr`) "update"
  yayıyor, onUpdate da koşulsuz kirletiyordu. Sonuç: yalnızca açılan
  belgenin updated_at'i değişiyor, ikinci sekme yanlış çakışmaya düşüyordu.

  İşlemler gerçek ProseMirror durumu üzerinde, editörün kendi şemasıyla
  üretiliyor; olayın kendisi Tiptap'ın yaydığı biçimde kuruluyor.
*/
test("belgeyi kirleten işlem", async (t) => {
  const durum = () => EditorState.create({ doc: belge(paragraf("Giriş metni.")) });

  await t.test("setEditable'ın yaydığı boş işlem kirletmiyor", () => {
    // Tiptap: emit("update", { transaction: this.state.tr, appendedTransactions: [] })
    assert.equal(belgeyiKirletirMi({ transaction: durum().tr, appendedTransactions: [] }), false);
  });

  await t.test("yalnızca meta taşıyan işlem (başlık numarası, öneri süslemesi) kirletmiyor", () => {
    const tr = durum().tr.setMeta(headingNumbersKey, true);
    assert.equal(belgeyiKirletirMi({ transaction: tr, appendedTransactions: [] }), false);
  });

  await t.test("seçim değişikliği kirletmiyor", () => {
    const s = durum();
    const tr = s.tr.setSelection(TextSelection.create(s.doc, 3));
    assert.equal(belgeyiKirletirMi({ transaction: tr }), false);
  });

  await t.test("metin yazmak kirletiyor", () => {
    const tr = durum().tr.insertText("x", 1);
    assert.equal(belgeyiKirletirMi({ transaction: tr, appendedTransactions: [] }), true);
  });

  await t.test("geri alma geçmişine girmeyen değişiklik de kirletiyor (şablon, ön sayfa)", () => {
    const tr = durum().tr.insertText("x", 1).setMeta("addToHistory", false);
    assert.equal(belgeyiKirletirMi({ transaction: tr }), true);
  });

  await t.test("kök işlem boş ama eklenen işlem belgeyi değiştirdiyse kirletiyor", () => {
    const s = durum();
    assert.equal(belgeyiKirletirMi({ transaction: s.tr, appendedTransactions: [s.tr.insertText("x", 1)] }), true);
  });
});
