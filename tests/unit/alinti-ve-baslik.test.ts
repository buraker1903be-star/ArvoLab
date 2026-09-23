import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { baslikYerlesimSorunlari, uzunAlintilar } from "@/lib/alinti-ve-baslik";

const kelimeler = (adet: number) => Array.from({ length: adet }, (_, i) => `kelime${i}`).join(" ");
const p = (metin: string, attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  attrs: attrs ?? null,
  content: [{ type: "text", text: metin }],
});
const gorselli = () => ({ type: "image", attrs: { src: "https://x.example/a.png" } });
const tablo = () => ({ type: "table", content: [{ type: "tableRow", content: [] }] });

describe("uzun doğrudan alıntı", () => {
  test("40 kelimeyi aşan tırnaklı alıntı yakalanır", () => {
    const doc = { content: [p(`Şöyle demektedir: “${kelimeler(45)}” (Yılmaz, 2020).`)] };
    const bulunan = uzunAlintilar(doc);
    assert.equal(bulunan.length, 1);
    assert.equal(bulunan[0].kelime, 45);
  });

  test("kısa alıntı uyarı üretmez", () => {
    assert.deepEqual(uzunAlintilar({ content: [p(`Şöyle der: “${kelimeler(20)}” (Yılmaz, 2020).`)] }), []);
  });

  test("zaten blok alıntı olarak yazılmışsa uyarı yok", () => {
    const doc = { content: [{ type: "blockquote", content: [p(`“${kelimeler(60)}”`)] }] };
    assert.deepEqual(uzunAlintilar(doc), []);
  });

  test("şekil/tablo başlıkları alıntı sayılmaz", () => {
    const doc = { content: [p(`“${kelimeler(50)}”`, { caption: "figure" })] };
    assert.deepEqual(uzunAlintilar(doc), []);
  });

  test("Türkçe ve düz tırnak ile « » aynı şekilde okunur", () => {
    for (const [ac, kapa] of [["“", "”"], ['"', '"'], ["«", "»"]]) {
      const doc = { content: [p(`${ac}${kelimeler(50)}${kapa}`)] };
      assert.equal(uzunAlintilar(doc).length, 1, `${ac}${kapa} tırnağı okunmadı`);
    }
  });
});

describe("şekil/tablo başlığının tarafı", () => {
  test("tablo başlığı tablonun altındaysa uyarır", () => {
    const doc = { content: [tablo(), p("Tablo 1. Katılımcılar", { caption: "table" })] };
    assert.deepEqual(baslikYerlesimSorunlari(doc), [{ tur: "table", baslik: "Tablo 1. Katılımcılar" }]);
  });

  test("doğru yerleşim uyarı üretmez", () => {
    const dogru = { content: [p("Tablo 1. Katılımcılar", { caption: "table" }), tablo(), gorselli(), p("Şekil 1. Akış", { caption: "figure" })] };
    assert.deepEqual(baslikYerlesimSorunlari(dogru), []);
  });

  test("şekil başlığı şeklin üstündeyse uyarır", () => {
    const doc = { content: [p("Şekil 1. Akış", { caption: "figure" }), gorselli()] };
    assert.deepEqual(baslikYerlesimSorunlari(doc), [{ tur: "figure", baslik: "Şekil 1. Akış" }]);
  });

  test("aradaki boş paragraf yerleşimi bozmaz", () => {
    const doc = { content: [p("Tablo 1. Katılımcılar", { caption: "table" }), p(""), tablo()] };
    assert.deepEqual(baslikYerlesimSorunlari(doc), []);
  });

  test("öge hiç eklenmemişse sessiz kalınır (numaralandırma denetimi söylüyor)", () => {
    const doc = { content: [p("Tablo 1. Katılımcılar", { caption: "table" }), p("Gövde metni.")] };
    assert.deepEqual(baslikYerlesimSorunlari(doc), []);
  });
});
