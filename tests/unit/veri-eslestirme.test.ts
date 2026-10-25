import assert from "node:assert/strict";
import test from "node:test";
import { elemeNotu, eslesenSatirlar, sayisalMi, type VeriSatiri } from "@/lib/veri-eslestirme";

test("satır eşleştirme", async (t) => {
  await t.test("boş hücre satırı düşürüyor, kalanların hizası bozulmuyor", () => {
    /*
      ESKİDEN: her sütun ayrı okunup boşlar atılıyor, sonra en kısa
      uzunluğa kesiliyordu. Burada "once" dizisi [20,30] olup "sonra"nın
      [15,25] yerine [10,15]'ine eşleşiyordu — yani 2. kişinin ön testi
      1. kişinin son testiyle. Tek bir boş hücre bütün veriyi kaydırıyordu.
    */
    const satirlar: VeriSatiri[] = [
      { once: null, sonra: 10 },
      { once: 20, sonra: 15 },
      { once: 30, sonra: 25 },
    ];
    const veri = eslesenSatirlar(satirlar, ["once", "sonra"]);
    assert.deepEqual(veri.sutunlar, [[20, 30], [15, 25]]);
    assert.equal(veri.n, 2);
    assert.equal(veri.dusen, 1);
  });

  await t.test("herhangi bir sütundaki eksik satırın tamamını düşürüyor", () => {
    const satirlar: VeriSatiri[] = [
      { a: 1, b: 1, c: 1 },
      { a: 2, b: "", c: 2 },
      { a: 3, b: 3, c: "metin" },
      { a: 4, b: 4, c: 4 },
    ];
    const veri = eslesenSatirlar(satirlar, ["a", "b", "c"]);
    assert.deepEqual(veri.sutunlar, [[1, 4], [1, 4], [1, 4]]);
    assert.equal(veri.dusen, 2);
  });

  await t.test("boş dize sayı sayılmıyor", () => {
    // Number("") === 0: eksik hücre sessizce SIFIR olarak analize girerdi.
    assert.equal(sayisalMi(""), false);
    assert.equal(sayisalMi(null), false);
    assert.equal(sayisalMi(0), true);
    assert.equal(sayisalMi("3,5"), false); // ondalık virgül sayı değil; nokta beklenir
    assert.equal(sayisalMi("3.5"), true);
    assert.equal(sayisalMi("abc"), false);
    assert.equal(sayisalMi(Infinity), false);
  });

  await t.test("hiç eksik yoksa not yazılmıyor", () => {
    const veri = eslesenSatirlar([{ a: 1, b: 2 }], ["a", "b"]);
    assert.equal(elemeNotu(veri), null);
  });

  await t.test("eleme olduğunda kullanıcıya söyleniyor", () => {
    const veri = eslesenSatirlar([{ a: 1, b: 2 }, { a: null, b: 2 }], ["a", "b"]);
    assert.equal(elemeNotu(veri), "1 satır eksik veri yüzünden analiz dışı bırakıldı (N = 1).");
  });

  await t.test("hiçbir satır eşleşmezse n sıfır", () => {
    const veri = eslesenSatirlar([{ a: null, b: 1 }], ["a", "b"]);
    assert.deepEqual(veri.sutunlar, [[], []]);
    assert.equal(veri.n, 0);
  });
});
