import assert from "node:assert/strict";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { belge } from "./ortam";

/*
  Asistan izi (yazarlık raporu, 03.11.2026) şemada var ama ÇIKTIDA YOK:
  yazdırma/PDF, danışman paylaşımı ve Word işaretli metni düz metin
  olarak yazmalı. İşaret bir çıktıya sızsaydı tez, hangi cümlenin
  asistandan geldiğini teslim edilen belgede taşırdı; metni düşürseydi
  daha kötüsü, cümle kaybolurdu.
*/
const json = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Öğrencinin cümlesi. " },
        { type: "text", text: "Asistanın cümlesi.", marks: [{ type: "asistanIzi", attrs: { kayit: "k1" } }] },
      ],
    },
  ],
};

test("şema işareti kabul ediyor ve özniteliği taşıyor", () => {
  const doc = belge(...(json.content as never[]));
  const isaretli = doc.firstChild!.child(1);
  assert.equal(isaretli.marks[0].type.name, "asistanIzi");
  assert.equal(isaretli.marks[0].attrs.kayit, "k1");
  assert.equal(isaretli.marks[0].type.spec.inclusive, false);
});

test("yazdırma ve Word: metin aynen, işaret yok", async () => {
  const html = renderTiptapHtml(json as never, {}).html;
  assert.match(html, /Öğrencinin cümlesi\. Asistanın cümlesi\./);
  assert.ok(!/asistan-izi|data-asistan/.test(html), html);

  const word = await buildDocxFromTiptap({ title: "T", doc: json as never, fetchImage: async () => null } as never);
  const xml = await (await JSZip.loadAsync(await Packer.toBuffer(word))).file("word/document.xml")!.async("string");
  assert.match(xml, /Asistanın cümlesi\./);
  assert.ok(!/asistan/i.test(xml.replace(/Asistanın cümlesi\./, "")));
});

test("rapor ile eklenti aynı işaret adını kullanıyor", async () => {
  const { ASISTAN_IZI } = await import("@/lib/tiptap-asistan-izi");
  const { ASISTAN_ISARETI } = await import("@/lib/yazarlik-raporu");
  assert.equal(ASISTAN_IZI, ASISTAN_ISARETI);
});
