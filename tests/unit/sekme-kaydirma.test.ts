import { test } from "node:test";
import assert from "node:assert/strict";
import { sekmeKaydirmasi } from "../../lib/os/sekme-kaydirma";

/*
  Telefonda etkin çalışma sekmesi şeritte görünür kalmalı (05.11.2026):
  390 pikselde Makale sekmesi "Maka…" diye kesik açılıyordu.
*/
test("etkin sekme zaten görünüyorsa şerit kıpırdamaz", () => {
  assert.equal(sekmeKaydirmasi({ serit: 360, icerik: 520, kaydirma: 0, sol: 4, genislik: 70 }), 0);
  assert.equal(sekmeKaydirmasi({ serit: 360, icerik: 520, kaydirma: 100, sol: 200, genislik: 80 }), 100);
});

test("sağda kesilen sekme ortaya gelir, şeridin ucunu aşmaz", () => {
  // Makale: 450–520, şerit 360 → orta 450 − 145 = 305, en çok 160.
  assert.equal(sekmeKaydirmasi({ serit: 360, icerik: 520, kaydirma: 0, sol: 450, genislik: 70 }), 160);
  // Ortadaki bir sekme ortalanır.
  assert.equal(sekmeKaydirmasi({ serit: 300, icerik: 800, kaydirma: 0, sol: 400, genislik: 100 }), 300);
});

test("solda kesilen sekme geri gelir, sıfırın altına inmez", () => {
  assert.equal(sekmeKaydirmasi({ serit: 360, icerik: 520, kaydirma: 160, sol: 4, genislik: 70 }), 0);
});

test("şerit taşmıyorsa kaydırma sıfır kalır", () => {
  assert.equal(sekmeKaydirmasi({ serit: 600, icerik: 520, kaydirma: 0, sol: 450, genislik: 70 }), 0);
});
