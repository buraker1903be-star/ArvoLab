import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { baglamKur } from "../../lib/ai/baglam";

const uzun = (n: number) => "x".repeat(n);

describe("bağlam kurma", () => {
  test("hepsi sığıyorsa çağıranın sırası korunur", () => {
    const { metin, kirpilanlar } = baglamKur(
      [
        { baslik: "Çıktı", metin: "t(28) = 2.45", oncelik: 1 },
        { baslik: "Soru", metin: "Gruplar arasında fark var mı?", oncelik: 2 },
      ],
      5000,
    );
    assert.deepEqual(kirpilanlar, []);
    assert.ok(metin.indexOf("### Çıktı") < metin.indexOf("### Soru"));
  });

  test("bütçe dolunca önce düşük öncelikli parça düşer", () => {
    // Eskiden metin baştan kesiliyordu: sondaki araştırma sorusu modele
    // hiç ulaşmıyordu. Artık öncelik belirliyor.
    const { metin, kirpilanlar } = baglamKur(
      [
        { baslik: "Ham metin", metin: uzun(4000), oncelik: 3 },
        { baslik: "Soru", metin: "Araştırma sorusu burada", oncelik: 1 },
      ],
      600,
    );
    assert.ok(metin.includes("Araştırma sorusu burada"));
    assert.deepEqual(kirpilanlar, ["Ham metin"]);
  });

  test("kısmen sığan parça kırpılır ve bildirilir", () => {
    const { metin, kirpilanlar } = baglamKur([{ baslik: "Ham", metin: uzun(4000), oncelik: 1 }], 1200);
    assert.ok(metin.includes("kısaltıldı"));
    assert.deepEqual(kirpilanlar, ["Ham"]);
    assert.ok(metin.length <= 1200);
  });

  test("çok az yer kalmışsa parça hiç konulmaz", () => {
    // Yarım cümlelik bir kırıntı modele yardım etmez, bütçe yer.
    const { metin, kirpilanlar } = baglamKur(
      [
        { baslik: "Soru", metin: uzun(500), oncelik: 1 },
        { baslik: "Ham", metin: uzun(4000), oncelik: 2 },
      ],
      620,
    );
    assert.ok(!metin.includes("### Ham"));
    assert.deepEqual(kirpilanlar, ["Ham"]);
  });

  test("boş parçalar bağlamı kirletmez", () => {
    const { metin } = baglamKur(
      [
        { baslik: "Soru", metin: "   ", oncelik: 1 },
        { baslik: "Çıktı", metin: "F(2, 57) = 4.31", oncelik: 2 },
      ],
      5000,
    );
    assert.equal(metin, "### Çıktı\nF(2, 57) = 4.31");
  });
});
