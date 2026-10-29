import assert from "node:assert/strict";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import type { JsonNode } from "./ortam";

/*
  Word çıktısının 29.10.2026 incelemesinde bulunan ayrışmaları. Her senaryo
  editör ve baskıdaki karşılığını ve eski Word davranışını yazıyor.
*/

async function wordXml(content: JsonNode[], dosya = "word/document.xml", title = "Test"): Promise<string> {
  const doc = await buildDocxFromTiptap({ title, doc: { type: "doc", content } as never, fetchImage: async () => null } as never);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file(dosya)!.async("string");
}

const p = (text: string, marks?: unknown[], attrs?: Record<string, unknown>): JsonNode =>
  ({ type: "paragraph", ...(attrs ? { attrs } : {}), content: [{ type: "text", text, ...(marks ? { marks } : {}) }] }) as JsonNode;

test("XML'de yasak denetim karakterleri dosyayı bozmaz", async () => {
  // PDF'ten yapıştırılan \u0002 ve Word'den gelen \u000B eskiden olduğu gibi yazılıyor, Word dosyayı açmıyordu.
  const xml = await wordXml([p("a\u000Bb\u0002c")]);
  assert.match(xml, /<w:t[^>]*>abc<\/w:t>/);
  assert.doesNotMatch(xml, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  const cekirdek = await wordXml([p("x")], "docProps/core.xml", "Başlık\u0002");
  assert.doesNotMatch(cekirdek, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
});

test("yapıştırılan px/em boyutu punto sanılmaz", async () => {
  // Eskiden "16px" 16pt, "0.875em" 1pt (görünmez) yazılıyordu.
  const px = await wordXml([p("x", [{ type: "textStyle", attrs: { fontSize: "16px" } }])]);
  assert.match(px, /<w:sz w:val="24"\/>/);
  const em = await wordXml([p("x", [{ type: "textStyle", attrs: { fontSize: "0.875em" } }])]);
  assert.doesNotMatch(em, /<w:sz w:val="2"\/>/);
});

test("maddenin ikinci paragrafı numara almaz, liste başlangıcı korunur", async () => {
  const xml = await wordXml([
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        { type: "listItem", content: [p("ilk"), p("devam")] },
        { type: "listItem", content: [p("ikinci")] },
      ],
    } as JsonNode,
  ]);
  // Üç paragraf, yalnızca ikisi numaralı (eskiden üçü de numaralıydı).
  assert.equal((xml.match(/<w:numPr>/g) ?? []).length, 2);
  const numbering = await wordXml([{ type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p("x")] }] } as JsonNode], "word/numbering.xml");
  assert.match(numbering, /<w:start w:val="3"\/>/);
});

test("şekil/tablo başlığı seçilen hizada kalır", async () => {
  // APA 7 sola dayalı başlık istiyor; Word eskiden her zaman ortalıyordu.
  const sol = await wordXml([p("Örnek", undefined, { caption: "figure", textAlign: "left" })]);
  assert.match(sol, /<w:jc w:val="left"\/>/);
  const varsayilan = await wordXml([p("Örnek", undefined, { caption: "figure" })]);
  assert.match(varsayilan, /<w:jc w:val="center"\/>/);
});

test("tablo başlık hücresi kalın, sütun genişlikleri editördeki oranda", async () => {
  const xml = await wordXml([
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", attrs: { colwidth: [300] }, content: [p("A")] },
            { type: "tableHeader", attrs: { colwidth: [100] }, content: [p("B")] },
          ],
        },
        { type: "tableRow", content: [{ type: "tableCell", content: [p("1")] }, { type: "tableCell", content: [p("2")] }] },
      ],
    } as JsonNode,
  ]);
  assert.match(xml, /<w:b\/>[\s\S]*?<w:t[^>]*>A<\/w:t>/);
  const genislikler = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
  assert.equal(genislikler.length, 2);
  assert.ok(genislikler[0] > genislikler[1] * 2.5, `genişlikler: ${genislikler}`);
});

test("kılavuzsuz belgede satır aralığı baskıyla aynı (1,5)", async () => {
  // Eskiden Word tek aralıklı, PDF 1,5 aralıklıydı.
  const stiller = await wordXml([p("x")], "word/styles.xml");
  assert.match(stiller, /w:line="360"/);
});
