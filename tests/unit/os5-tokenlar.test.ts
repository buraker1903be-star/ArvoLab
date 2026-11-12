import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Signature OS 5 token katmanı (app/styles/os5-tokens.css). Onaylı
  başlangıç değerleri burada sabitlenir: bir değer bilinçsizce
  değişirse görsel kabul yeniden gerekir. tokens.css'e DOKUNULMADIĞI da
  sınanır — Phase 1 mevcut ekranların görünümünü değiştirmez.
*/
const kaynak = readFileSync("app/styles/os5-tokens.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const blok = (secici: string) => {
  const i = kaynak.indexOf(`${secici} {`);
  assert.ok(i >= 0, `${secici} bloğu yok`);
  const j = kaynak.indexOf("\n}", i);
  return kaynak.slice(i, j);
};
const deger = (b: string, ad: string) => new RegExp(`${ad}:\\s*([^;]+);`).exec(b)?.[1].trim();

describe("onaylı başlangıç değerleri", () => {
  const kok = blok(":root");
  test("kontrol 40 px, radius 4 px; kart 16 px; kenar çubuğu 240 px", () => {
    assert.equal(deger(kok, "--os5-kontrol-h"), "40px");
    assert.equal(deger(kok, "--os5-kontrol-r"), "4px");
    assert.equal(deger(kok, "--os5-r-kart"), "16px");
    assert.equal(deger(kok, "--os5-kenar-genis"), "240px");
  });
  test("Paddle ritmi: gezinme 42/38/32, içerik 1248, form 400, bölüm 40", () => {
    assert.equal(deger(kok, "--os5-gezinme-satir"), "42px");
    assert.equal(deger(kok, "--os5-gezinme-aktif"), "38px");
    assert.equal(deger(kok, "--os5-gezinme-alt"), "32px");
    assert.equal(deger(kok, "--os5-icerik-azami"), "1248px");
    assert.equal(deger(kok, "--os5-form-genislik"), "400px");
    assert.equal(deger(kok, "--os5-bolum-aralik"), "40px");
  });
  test("gövde Inter, vurgu Newsreader (font-display)", () => {
    assert.match(deger(kok, "--os5-font-govde") ?? "", /^var\(--font-inter/);
    assert.equal(deger(kok, "--os5-font-vurgu"), "var(--font-display)");
  });
  test("en küçük yazı 11 px kuralı", () => {
    for (const m of kaynak.matchAll(/--os5-fs-[a-z-]+:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 11, m[0]);
  });
});

describe("tema ve hareket", () => {
  test("renk token'ları palete başvuruyor, ham renk yok", () => {
    assert.doesNotMatch(kaynak, /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
  });
  test("koyu tema bloğu var ve odak halkası koyuda açık tonda", () => {
    const koyu = blok('html[data-theme="dark"]');
    assert.equal(deger(koyu, "--os5-kontrol-odak"), "var(--brand-300)");
    assert.ok(deger(koyu, "--os5-vurgu-kart"));
  });
  test("azaltılmış harekette süreler sıfır", () => {
    const i = kaynak.indexOf("prefers-reduced-motion: reduce");
    assert.ok(i >= 0);
    const b = kaynak.slice(i, kaynak.indexOf("\n}", kaynak.indexOf("}", i) + 1));
    assert.match(b, /--os5-sure-hizli:\s*0ms/);
    assert.match(b, /--os5-sure-orta:\s*0ms/);
  });
  test("bütün token'lar os5 önekli: mevcut token'ların üzerine yazılmaz", () => {
    for (const m of kaynak.matchAll(/(--[a-z0-9-]+)\s*:/g)) assert.match(m[1], /^--os5-/, m[1]);
  });
});
