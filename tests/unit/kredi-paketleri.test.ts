import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { binKrediFiyati, krediPaketleriniOku, paketFiyati } from "@/lib/kredi-paketleri";

describe("kredi paketleri", () => {
  test("ArvoOS listesi okunur ve küçükten büyüğe sıralanır", () => {
    const paketler = krediPaketleriniOku({
      creditPackages: [
        { kod: "k2500", ad: "2.500 kredi", kredi: 2500, fiyat: 199_900 },
        { kod: "k500", ad: "500 kredi", kredi: 500, fiyat: 49_900 },
      ],
    });
    assert.deepEqual(paketler.map((p) => p.kod), ["k500", "k2500"]);
  });

  test("fiyatı ya da kredisi eksik paket atılır, uydurulmaz", () => {
    // Fiyatı bilinmeyen "Satın al" düğmesi, ne ödeneceğini söylemeden para istemek olurdu.
    const paketler = krediPaketleriniOku({
      creditPackages: [
        { kod: "k500", kredi: 500 },
        { kod: "k0", kredi: 0, fiyat: 100 },
        { kod: "bozuk kod!", kredi: 10, fiyat: 100 },
        { kod: "k10", kredi: "10", fiyat: "1000" },
        null,
      ],
    });
    assert.deepEqual(paketler, [{ kod: "k10", ad: "10 kredi", kredi: 10, fiyat: 1000 }]);
  });

  test("liste yoksa boş: eski ArvoOS sürümü sayfayı bozmaz", () => {
    assert.deepEqual(krediPaketleriniOku({ status: "active" }), []);
    assert.deepEqual(krediPaketleriniOku(null), []);
  });

  test("fiyat yazımı ve birim fiyat", () => {
    assert.equal(paketFiyati(49_900), "499 TL");
    assert.equal(paketFiyati(49_950), "499,50 TL");
    assert.equal(binKrediFiyati({ kod: "k500", ad: "", kredi: 500, fiyat: 49_900 }), 99_800);
  });
});
