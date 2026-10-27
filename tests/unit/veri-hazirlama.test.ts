import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { aralikTahmini, benzersizAd, olcekPuani, tersKodla } from "@/lib/veri-hazirlama";

/* Ters madde ve ölçek puanı: Likert verisinin analiz öncesi hazırlığı. */

const VERI = [
  { m1: 5, m2: 1, m3: 4 },
  { m1: 4, m2: 2, m3: null },
  { m1: 3, m2: 7, m3: 3 },
  { m1: "", m2: 5, m3: 2 },
];

describe("veri hazırlama", () => {
  test("ters kodlama 1–5 ölçekte 1↔5; aralık dışı değer çevrilmez, boş kalır", () => {
    const s = tersKodla(VERI, "m2", { min: 1, max: 5 }, ["m1", "m2", "m3"]);
    assert.equal(s.sutun, "m2_ters");
    assert.deepEqual(s.satirlar.map((r) => r.m2_ters), [5, 4, null, 1]);
    assert.equal(s.bos, 1, "7 aralık dışı");
    assert.equal(s.spss, "COMPUTE m2_ters = 6 - m2.\nEXECUTE.");
    assert.equal(VERI[0].m2, 1, "girdi değişmez");
  });

  test("ölçek puanı: eksik maddesi olan kişinin puanı boş kalır", () => {
    const ort = olcekPuani(VERI, ["m1", "m3"], "ortalama", "toplam puan", ["m1", "m2", "m3"]);
    assert.deepEqual(ort.satirlar.map((r) => r["toplam puan"]), [4.5, null, 3, null]);
    assert.equal(ort.bos, 2);
    assert.equal(ort.spss, "COMPUTE toplam_puan = MEAN.2(m1, m3).\nEXECUTE.");
    const top = olcekPuani(VERI, ["m1", "m3"], "toplam", "t", []);
    assert.deepEqual(top.satirlar.map((r) => r.t), [9, null, 6, null]);
    assert.throws(() => olcekPuani(VERI, ["m1"], "toplam", "t", []), /en az iki madde/);
  });

  test("ad çakışırsa numaralanır; aralık verideki tam sayılardan tahmin edilir", () => {
    assert.equal(benzersizAd("puan", ["puan", "puan_2"]), "puan_3");
    assert.deepEqual(aralikTahmini(VERI, ["m1", "m3"]), { min: 2, max: 5 });
    assert.equal(aralikTahmini([{ a: 1.5 }, { a: 3 }], ["a"]), null);
  });
});
