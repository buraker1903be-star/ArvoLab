import assert from "node:assert/strict";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { history } from "@tiptap/pm/history";
import { buildPrintSheet } from "@/lib/print-sheet";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { oneriEklentisi, oneriGoster, tabIleKabulEt, etkinOneri } from "@/lib/tiptap-satir-ici-oneri";
import { belge, paragraf } from "./ortam";

/*
  C2-7 (V4.3): SATIR İÇİ ÖNERİ KABULDEN ÖNCE HİÇBİR ÇIKTIYA GİRMEZ.
  Öneri bir süsleme; belge JSON'unda yok. Üç çıktı yolu belge JSON'undan
  çiziliyor: yazdırma/PDF ve danışman paylaşımı buildPrintSheet'ten
  (app/print/manuscript, app/share/[token]), Word buildDocxFromTiptap'ten.
  Testin doğru yere baktığının kanıtı (negatif kontrol): Tab ile kabulden
  SONRA aynı metin üç çıktıda da görünmeli, asistan izi hiçbirinde olmamalı.
*/
const ONERI = " uzun dönemde zayıflamaktadır";

function durum() {
  const doc = belge(paragraf("Enflasyon ile işsizlik arasındaki ilişki"));
  return EditorState.create({ doc, plugins: [history(), oneriEklentisi()], selection: TextSelection.create(doc, doc.content.size - 1) });
}
async function ciktilar(json: unknown) {
  const yazdirma = buildPrintSheet({}, null, json as never).html;
  const word = await buildDocxFromTiptap({ title: "T", doc: json as never, fetchImage: async () => null } as never);
  const xml = await (await JSZip.loadAsync(await Packer.toBuffer(word))).file("word/document.xml")!.async("string");
  return { yazdirma, xml };
}

test("C2-7 görünen satır içi öneri yazdırma, paylaşım ve Word çıktısına girmez", async () => {
  const v = { state: durum(), dispatch: (tr: Transaction) => (v.state = v.state.apply(tr)) };
  v.dispatch(oneriGoster(v.state, { konum: v.state.selection.head, metin: ONERI, kayit: "k1" })!);
  assert.equal(etkinOneri(v.state)?.metin, ONERI, "öneri görünür olmalı");
  const json = v.state.doc.toJSON();
  assert.ok(!JSON.stringify(json).includes("zayıflamaktadır"), "öneri belge JSON'unda");
  const { yazdirma, xml } = await ciktilar(json);
  assert.ok(!yazdirma.includes("zayıflamaktadır"), "öneri yazdırma/paylaşım çıktısında");
  assert.ok(!xml.includes("zayıflamaktadır"), "öneri Word çıktısında");
});

test("C2-7 negatif kontrol: Tab ile kabulden sonra metin üç çıktıda da var, asistan izi yok", async () => {
  const v = { state: durum(), dispatch: (tr: Transaction) => (v.state = v.state.apply(tr)) };
  v.dispatch(oneriGoster(v.state, { konum: v.state.selection.head, metin: ONERI, kayit: "k1" })!);
  assert.equal(tabIleKabulEt(v), true);
  const json = v.state.doc.toJSON();
  assert.match(JSON.stringify(json), /"asistanIzi"/, "kabul edilen metin izi belgede taşımalı");
  const { yazdirma, xml } = await ciktilar(json);
  assert.match(yazdirma, /zayıflamaktadır/);
  assert.match(xml, /zayıflamaktadır/);
  assert.ok(!/asistan-?izi|data-asistan|asistanIzi/i.test(yazdirma), "iz yazdırma/paylaşım çıktısına sızdı");
  assert.ok(!/asistanIzi/i.test(xml), "iz Word çıktısına sızdı");
});
