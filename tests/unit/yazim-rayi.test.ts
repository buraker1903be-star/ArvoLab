import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cssUzunlugu, yazimRayiGerekli } from "@/lib/os/kirilimlar";

/*
  Yazım rayı (V4.3-C1): ölçümler 1440/1366/1280/1200 px'te C1 öncesi
  editörden (geniş kenar + panel açık: kap 762 / 708 / 622 / 542 px).
*/
const temel = { panelYerlesik: true, kenarDar: false, rayAcik: false, sutun: 638, payMin: 24, kenarFarki: 172 };

describe("yazimRayiGerekli", () => {
  test("geniş kenar + panel sığıyorsa ray yok (1440, 1366)", () => {
    assert.equal(yazimRayiGerekli({ ...temel, kap: 762 }), false);
    assert.equal(yazimRayiGerekli({ ...temel, kap: 708 }), false);
  });
  test("sığmıyorsa ray (1280, 1200)", () => {
    assert.equal(yazimRayiGerekli({ ...temel, kap: 622 }), true);
    assert.equal(yazimRayiGerekli({ ...temel, kap: 542 }), true);
  });
  test("raydayken ölçülen kap geniş hâle çevrilir: karar titremez", () => {
    assert.equal(yazimRayiGerekli({ ...temel, rayAcik: true, kap: 622 + 172 }), true);
    assert.equal(yazimRayiGerekli({ ...temel, rayAcik: true, kap: 708 + 172 }), false);
  });
  test("negatif: panel yerleşik değilse, odakta ya da tercih zaten dar ise ray kurulmaz", () => {
    assert.equal(yazimRayiGerekli({ ...temel, panelYerlesik: false, kap: 300 }), false);
    assert.equal(yazimRayiGerekli({ ...temel, kenarDar: true, kap: 300 }), false);
  });
  test("kılavuzun dar sütunu 1280'de rayı gerektirmez (14,5 cm ≈ 548 px)", () => {
    assert.equal(yazimRayiGerekli({ ...temel, sutun: cssUzunlugu("14.5cm")!, kap: 622 }), false);
  });
});

describe("cssUzunlugu", () => {
  test("px ve cm okunur; başka birim okunmaz", () => {
    assert.equal(cssUzunlugu("638px"), 638);
    assert.ok(Math.abs(cssUzunlugu("14.5cm")! - 548.03) < 0.01);
    assert.equal(cssUzunlugu("50%"), null);
    assert.equal(cssUzunlugu(""), null);
  });
});
