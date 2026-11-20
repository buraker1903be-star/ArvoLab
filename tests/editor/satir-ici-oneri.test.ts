import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { etkinOneri, kabulEdilenOneri, oneriEklentisi, oneriGoster, oneriKabulEt, oneriKabulGonder, oneriTemizleIslem } from "@/lib/tiptap-satir-ici-oneri";
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
  Tek geri alma adımı (20.11.2026). Eskiden kabul, hemen önce yazılan
  harflerle aynı geçmiş grubuna giriyordu (500 ms içinde): Ctrl+Z öneriyle
  birlikte öğrencinin son yazdığı sözcüğü de siliyordu. Kabulden sonra
  yazılan da aynı gruba girmemeli.
*/
test("kabul tek geri alma adımıdır: önce ve sonra yazılan korunur", () => {
  const doc = belge(paragraf("Enflasyon ile"));
  let s = EditorState.create({ doc, plugins: [history(), oneriEklentisi()], selection: TextSelection.create(doc, doc.content.size - 1) });
  const gorunum = { get state() { return s; }, dispatch: (tr: Parameters<EditorState["apply"]>[0]) => { s = s.apply(tr); } };
  // Aynı zaman damgasıyla: tarayıcıda 500 ms içinde yazılıp Tab'a basılmış gibi.
  const an = Date.now();
  gorunum.dispatch(s.tr.insertText(" işsizlik").setTime(an));
  gorunum.dispatch(oneriGoster(s, { konum: s.selection.head, metin: " arasındaki ilişki", kayit: null })!);
  assert.equal(oneriKabulGonder(gorunum), true);
  gorunum.dispatch(s.tr.insertText(" zayıftır.").setTime(an));
  assert.equal(s.doc.textContent, "Enflasyon ile işsizlik arasındaki ilişki zayıftır.");

  undo(s, gorunum.dispatch);
  assert.equal(s.doc.textContent, "Enflasyon ile işsizlik arasındaki ilişki", "kabulden sonra yazılan ayrı adım");
  undo(s, gorunum.dispatch);
  assert.equal(s.doc.textContent, "Enflasyon ile işsizlik", "tek Ctrl+Z yalnızca öneriyi geri alır");
  assert.equal(oneriKabulGonder(gorunum), false, "öneri yokken kabul hiçbir şey yapmaz (Tab tabloya/listeye kalır)");
});

test("seçim varken öneri gösterilmez; tablo hücresinde gösterilir ve kabul edilir", () => {
  const doc = belge(paragraf("Seçili bir metin"));
  const secili = EditorState.create({ doc, plugins: [oneriEklentisi()], selection: TextSelection.create(doc, 1, 6) });
  assert.equal(oneriGoster(secili, { konum: 6, metin: " x", kayit: null }), null);

  const tablo = belge({
    type: "table",
    content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraf("Hücre metni")] }, { type: "tableCell", content: [paragraf("İkinci")] }] }],
  });
  let hucre: number | null = null;
  tablo.descendants((n, pos) => {
    if (hucre === null && n.isTextblock && n.textContent === "Hücre metni") hucre = pos + 1 + n.content.size;
  });
  let s = EditorState.create({ doc: tablo, plugins: [oneriEklentisi()], selection: TextSelection.create(tablo, hucre!) });
  s = s.apply(oneriGoster(s, { konum: hucre!, metin: " devam eder", kayit: null })!);
  s = s.apply(oneriKabulEt(s)!);
  assert.match(s.doc.textBetween(0, s.doc.content.size, "|"), /Hücre metni devam eder\|İkinci/);
});

test("öneri kaydedilen belgeye, kelime sayısına ve metne girmez", () => {
  let s = durum();
  const once = JSON.stringify(s.doc.toJSON());
  s = s.apply(oneriGoster(s, { konum: s.selection.head, metin: " gizli öneri metni", kayit: null })!);
  assert.equal(JSON.stringify(s.doc.toJSON()), once);
  assert.equal(s.doc.textContent.includes("gizli"), false);
});
