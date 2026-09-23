import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { metinBiciminiDenetle } from "@/lib/metin-bicimi";

const KURAL = { fontFamily: "Times New Roman", fontSizePt: 12, lineSpacing: 1.5 };

const paragraf = (metin: string, stil?: Record<string, unknown>, attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  attrs: attrs ?? null,
  content: [{ type: "text", text: metin, ...(stil ? { marks: [{ type: "textStyle", attrs: stil }] } : {}) }],
});

describe("yazı tipi, punto ve satır aralığı denetimi", () => {
  test("elle biçim verilmemiş metin uyarı üretmez", () => {
    // Değer verilmemiş metin belgenin varsayılanıyla, yani kılavuzun
    // değeriyle çıkar; uyarı vermek yanlış alarm olurdu.
    assert.equal(metinBiciminiDenetle({ content: [paragraf("Normal bir cümle.")] }, KURAL), null);
  });

  test("kılavuzunkiyle aynı değer elle verilmişse de uyarı yok", () => {
    const doc = { content: [paragraf("Aynı biçim.", { fontFamily: "Times New Roman", fontSize: "12pt" }, { lineSpacing: "1.5" })] };
    assert.equal(metinBiciminiDenetle(doc, KURAL), null);
  });

  test("sapan yazı tipi, punto ve satır aralığı ayrı ayrı yakalanır", () => {
    const doc = {
      content: [
        paragraf("Yapıştırılmış bölüm.", { fontFamily: "Arial", fontSize: "11pt" }, { lineSpacing: "1" }),
      ],
    };
    const rapor = metinBiciminiDenetle(doc, KURAL);
    assert.equal(rapor?.yaziTipi[0].deger, "Arial");
    assert.equal(rapor?.punto[0].deger, "11 pt");
    assert.equal(rapor?.satirAraligi[0].deger, "1");
    assert.equal(rapor?.yaziTipi[0].ornek, "Yapıştırılmış bölüm.");
  });

  test("CSS yedekli ve tırnaklı yazı tipi adı aynı sayılır", () => {
    const doc = { content: [paragraf("Aynı aile.", { fontFamily: '"Times New Roman", Times, serif' })] };
    assert.equal(metinBiciminiDenetle(doc, { fontFamily: "Times New Roman" }), null);
  });

  test("aynı sapma birden çok yerde: sayılır, en yaygın olan başa gelir", () => {
    const doc = {
      content: [
        paragraf("Bir.", { fontFamily: "Arial" }),
        paragraf("İki.", { fontFamily: "Arial" }),
        paragraf("Üç.", { fontFamily: "Calibri" }),
      ],
    };
    const rapor = metinBiciminiDenetle(doc, { fontFamily: "Times New Roman" });
    assert.deepEqual(rapor?.yaziTipi.map((sapma) => [sapma.deger, sapma.sayi]), [["Arial", 2], ["Calibri", 1]]);
  });

  test("kılavuz bir alanı söylemiyorsa o alan denetlenmez", () => {
    const doc = { content: [paragraf("Serbest punto.", { fontSize: "9pt" })] };
    assert.equal(metinBiciminiDenetle(doc, { fontFamily: "Times New Roman" }), null);
    assert.equal(metinBiciminiDenetle(doc, {}), null);
  });

  test("boş metin ve boş paragraf sayılmaz", () => {
    const doc = { content: [paragraf("   ", { fontFamily: "Arial" }), { type: "paragraph", attrs: { lineSpacing: "1" } }] };
    assert.equal(metinBiciminiDenetle(doc, KURAL), null);
  });

  test("tablo içindeki metin de denetlenir", () => {
    const doc = {
      content: [
        {
          type: "table",
          content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraf("Hücre.", { fontFamily: "Arial" })] }] }],
        },
      ],
    };
    assert.equal(metinBiciminiDenetle(doc, KURAL)?.yaziTipi[0].deger, "Arial");
  });
});
