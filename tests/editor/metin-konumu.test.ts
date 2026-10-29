import assert from "node:assert/strict";
import test from "node:test";
import { metinKonumu } from "@/app/dashboard/editor/[id]/write/editor-navigation";
import { editorSchema } from "./ortam";

/*
  Yorumun alıntısına tıklayınca metne gitme. 29.10.2026'ya kadar arama tek
  metin düğümündeydi: içinde kalın bir sözcük olan alıntı bulunamıyordu.
*/
const belge = editorSchema.nodeFromJSON({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Bu veri " }, { type: "text", text: "seti", marks: [{ type: "bold" }] }, { type: "text", text: " temizlendi." }] },
    { type: "paragraph", content: [{ type: "text", text: "İkinci paragraf." }] },
  ],
});

test("biçim sınırını ve paragraf sonunu aşan alıntı bulunur", () => {
  const konum = metinKonumu(belge, "veri seti");
  assert.ok(konum);
  assert.equal(belge.textBetween(konum.from, konum.to, " "), "veri seti");
  const iki = metinKonumu(belge, "temizlendi. İkinci");
  assert.ok(iki);
  assert.equal(belge.textBetween(iki.from, iki.to, " "), "temizlendi. İkinci");
  assert.equal(metinKonumu(belge, "yok böyle"), null);
});
