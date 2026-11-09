import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { history, redo, redoDepth, undo, undoDepth } from "@tiptap/pm/history";
import { etkinOneri, kabulEdilenOneri, oneriEklentisi, oneriGoster, oneriKabulEt, oneriTemizleIslem, tabIleKabulEt } from "@/lib/tiptap-satir-ici-oneri";
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

/*
  C2-4 (V4.3): TAB İLE KABUL KENDİ GERİ ALMA ADIMI. Eskiden kabul işlemi
  geçmişi kapatmıyordu: öneriden hemen önce (yarım saniye içinde) yazılan
  harflerle ve hemen sonra yazılanlarla aynı geçmiş olayına düşüyordu;
  Ctrl+Z öneriyle birlikte öğrencinin kendi yazdığını da siliyordu.
  Sınanan yol, Tab tuşunun ÜRETİMDEKİ işleyicisi (tabIleKabulEt).
*/
function gecmisliDurum() {
  const doc = belge(paragraf("Enflasyon"));
  return EditorState.create({ doc, plugins: [history(), oneriEklentisi()], selection: TextSelection.create(doc, doc.content.size - 1) });
}
function gorunum(s: EditorState) {
  const v = { state: s, dispatch: (tr: Transaction) => (v.state = v.state.apply(tr)) };
  return v;
}
const geriAl = (v: { state: EditorState }) => {
  let sonuc = false;
  undo(v.state, (tr) => ((v.state = v.state.apply(tr)), (sonuc = true)));
  return sonuc;
};
const yaz = (v: ReturnType<typeof gorunum>, metin: string) => v.dispatch(v.state.tr.insertText(metin));
const oneriGosterV = (v: ReturnType<typeof gorunum>, metin: string) => v.dispatch(oneriGoster(v.state, { konum: v.state.selection.head, metin, kayit: "k" })!);

test("C2-4 negatif: öneriden ÖNCE yazılan metin Ctrl+Z ile öneriyle birlikte silinmez", () => {
  const v = gorunum(gecmisliDurum());
  yaz(v, " ve");
  oneriGosterV(v, " işsizlik");
  assert.equal(tabIleKabulEt(v), true);
  assert.equal(v.state.doc.textContent, "Enflasyon ve işsizlik");
  assert.equal(geriAl(v), true);
  assert.equal(v.state.doc.textContent, "Enflasyon ve", "Ctrl+Z yalnızca öneriyi geri almalı");
  assert.equal(geriAl(v), true);
  assert.equal(v.state.doc.textContent, "Enflasyon");
});

test("C2-4 negatif: öneriden SONRA yazılan metin öneri adımına eklenmez", () => {
  const v = gorunum(gecmisliDurum());
  oneriGosterV(v, " ve işsizlik");
  tabIleKabulEt(v);
  yaz(v, " arasında");
  assert.equal(geriAl(v), true);
  assert.equal(v.state.doc.textContent, "Enflasyon ve işsizlik", "Ctrl+Z önce sonraki yazımı geri almalı");
  assert.equal(geriAl(v), true);
  assert.equal(v.state.doc.textContent, "Enflasyon");
});

test("C2-4 geçmişte boş ya da çift adım yok; yineleme öneriyi asistan iziyle geri getirir", () => {
  const v = gorunum(gecmisliDurum());
  yaz(v, " ve");
  const once = undoDepth(v.state);
  oneriGosterV(v, " işsizlik");
  assert.equal(undoDepth(v.state), once, "öneriyi göstermek geçmişe adım eklemez");
  tabIleKabulEt(v);
  assert.equal(undoDepth(v.state), once + 1, "kabul tam BİR adım");
  geriAl(v);
  assert.equal(redoDepth(v.state), 1);
  redo(v.state, (tr) => (v.state = v.state.apply(tr)));
  assert.equal(v.state.doc.textContent, "Enflasyon ve işsizlik");
  assert.equal(v.state.doc.firstChild!.lastChild!.marks[0]?.type.name, "asistanIzi");
  assert.equal(undoDepth(v.state), once + 1);
});

test("C2-4 öneri yokken Tab hiçbir şey göndermez (girinti ve odak eskisi gibi)", () => {
  const v = gorunum(gecmisliDurum());
  const once = v.state;
  assert.equal(tabIleKabulEt(v), false);
  assert.equal(v.state, once);
});
