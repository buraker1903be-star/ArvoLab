import { test } from "node:test";
import assert from "node:assert/strict";
import { acilirKonum } from "@/lib/acilir-konum";

const dugme = (left: number, top: number, width = 160, height = 36) => ({ left, top, width, right: left + width, bottom: top + height });
const ekran = { genislik: 1200, yukseklik: 800 };

test("yer varsa düğmenin altına, sol kenarı hizalı", () => {
  assert.deepEqual(acilirKonum(dugme(100, 100), { genislik: 290, yukseklik: 360 }, ekran), { x: 100, y: 142, yukari: false });
});

test("altta yer yoksa üste açılır", () => {
  const k = acilirKonum(dugme(100, 700), { genislik: 290, yukseklik: 360 }, ekran);
  assert.equal(k.yukari, true);
  assert.equal(k.y, 700 - 6 - 360);
});

test("sağa taşıyorsa sağ kenar düğmeyle hizalanır", () => {
  const k = acilirKonum(dugme(1050, 100, 120), { genislik: 290, yukseklik: 200 }, ekran);
  assert.equal(k.x, 1170 - 290);
});

test("dar ekranda kenar payının dışına çıkmaz", () => {
  const k = acilirKonum(dugme(200, 100, 150), { genislik: 300, yukseklik: 200 }, { genislik: 390, yukseklik: 800 });
  // Sağ kenar düğmeyle hizalı (350 − 300), ekranın içinde.
  assert.equal(k.x, 50);
  const sol = acilirKonum(dugme(2, 100, 50), { genislik: 300, yukseklik: 200 }, { genislik: 390, yukseklik: 800 });
  assert.equal(sol.x, 8);
});

test("iki tarafta da yer yoksa ekranın içinde kalır", () => {
  const k = acilirKonum(dugme(100, 300), { genislik: 290, yukseklik: 700 }, ekran);
  assert.ok(k.y >= 8 && k.y + 700 <= 792);
});
