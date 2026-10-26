import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GRUPSUZ, kriterGruplari, puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";

const k = (puan: number, grup: string | null) => ({ computed_points: puan, criteria: { category_group: grup } });

describe("doçentlik özeti", () => {
  test("gruplar toplamı tutar, en çok puan getiren önce, grupsuzlar 'Diğer'de", () => {
    const { toplam, gruplar } = puanGruplari([k(20, "Makaleler"), k(10, "Atıflar"), k(15, "Makaleler"), k(5, null), k(0.1, " "), k(0.2, "Atıflar")]);
    assert.equal(toplam, 50.3);
    assert.deepEqual(gruplar.map((g) => [g.grup, g.toplam, g.kayitlar.length]), [
      ["Makaleler", 35, 2],
      ["Atıflar", 10.2, 2],
      [GRUPSUZ, 5.1, 2],
    ]);
    assert.equal(gruplar.reduce((t, g) => t + g.toplam, 0).toFixed(6), toplam.toFixed(6));
    assert.equal(gruplar[0].pay, 70);
  });

  test("boş liste sıfır; kriterler grup ve doğal kod sırasıyla", () => {
    assert.deepEqual(puanGruplari([]), { toplam: 0, gruplar: [] });
    const sirali = kriterGruplari([
      { code: "A10", category_group: "Makaleler" },
      { code: "A2", category_group: "Makaleler" },
      { code: "X1", category_group: null },
      { code: "B1", category_group: "Atıflar" },
    ]);
    assert.deepEqual(sirali.map((g) => [g.grup, g.kriterler.map((c) => c.code)]), [
      ["Atıflar", ["B1"]],
      ["Makaleler", ["A2", "A10"]],
      [GRUPSUZ, ["X1"]],
    ]);
    assert.equal(puanYazisi(12.5), "12,5");
    assert.equal(puanYazisi(20), "20");
  });
});
