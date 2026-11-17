import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDF_ISLEM_VARSAYILAN, pdfIslemAnahtari, pdfIslemHakki, pdfIslemKarari } from "@/lib/pdf-islem-siniri";

/* RELEASE CLOSURE 05: PDF işleme sınırı — arızada KAPALI, asistan hakkından ayrı. */

test("yalnızca açık true izin verir, açık false 'doldu'; geri kalan her şey arıza", () => {
  assert.equal(pdfIslemKarari({ sayacVar: true, veri: true }), "izin");
  assert.equal(pdfIslemKarari({ sayacVar: true, veri: false }), "doldu");
  for (const veri of [null, undefined, "true", 1, [true], { izin: true }]) assert.equal(pdfIslemKarari({ sayacVar: true, veri }), "ariza", String(veri));
  assert.equal(pdfIslemKarari({ sayacVar: false, veri: true }), "ariza");
  assert.equal(pdfIslemKarari({ sayacVar: true, hata: { message: "x" }, veri: true }), "ariza");
});

test("saatlik hak: geçerli tamsayı ya da varsayılan", () => {
  assert.equal(pdfIslemHakki(undefined), PDF_ISLEM_VARSAYILAN);
  assert.equal(pdfIslemHakki("12"), 12);
  for (const k of ["0", "-3", "1.5", "abc", "100000"]) assert.equal(pdfIslemHakki(k), PDF_ISLEM_VARSAYILAN, k);
});

test("anahtar asistan hakkının anahtarından ayrı", () => {
  assert.equal(pdfIslemAnahtari("u1"), "pdf-islem:u1");
  assert.notEqual(pdfIslemAnahtari("u1"), "ai-asistan:u1");
});

test("okuyucu: sayaç pahalı işten (indirme/çözümleme) önce, önbellekte değilse; arızada iş yapılmıyor", () => {
  const kod = readFileSync("lib/kaynak-pdf-okuma.ts", "utf8");
  const govde = kod.slice(kod.indexOf("export async function kaynakPdfSayfalari"));
  const sinir = govde.indexOf("pdfIslemIzni(");
  const cozum = govde.indexOf("cozumle(supabase");
  const onbellek = govde.indexOf("SAYFA_ONBELLEGI.get(");
  assert.ok(onbellek > 0 && sinir > onbellek && cozum > sinir, "sıra: önbellek → sayaç → çözümleme");
  assert.match(govde, /if \(sinir\) return \{ ok: false, hata: sinir \}/);
  // Önbellekten dönmeden önce kullanıcının depo erişimi yeniden sınanır.
  assert.ok(govde.indexOf(".exists(depoYolu)") > 0 && govde.indexOf(".exists(depoYolu)") < govde.indexOf("if (onbellekte) return"));
});

test("asistan: seçim doğrulaması asistan hakkından önce (reddedilen seçim ücretli hak yakmaz)", () => {
  const eylem = readFileSync("app/actions/ai-kaynak-sohbeti.ts", "utf8");
  assert.ok(eylem.indexOf("secimiDogrula(") > 0 && eylem.indexOf("secimiDogrula(") < eylem.indexOf("asistanHakkiVar("));
});
