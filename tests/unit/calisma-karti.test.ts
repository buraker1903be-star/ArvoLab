import assert from "node:assert/strict";
import test from "node:test";
import { filtrelerGorunsun, kartIlerlemesi } from "@/lib/calisma-karti";

test("filtreler personelde hep, öğrencide yalnızca uzun listede", () => {
  assert.equal(filtrelerGorunsun(1, false), false);
  assert.equal(filtrelerGorunsun(3, false), false);
  assert.equal(filtrelerGorunsun(4, false), true);
  assert.equal(filtrelerGorunsun(1, true), true);
});

test("hedef varsa yüzde gerçek yazımdan; elle girilen değer ezilir", () => {
  const i = kartIlerlemesi({ kelime: 9710, hedefKelime: 18400, elleIlerleme: 100 });
  assert.deepEqual([i?.yuzde, i?.etiket], [53, "yazıldı"]);
  assert.equal(kartIlerlemesi({ kelime: 30000, hedefKelime: 18400, elleIlerleme: null })?.yuzde, 100);
});

test("hedef yoksa yalnızca girilmiş elle değer, o da 'ilerleme' adıyla", () => {
  assert.deepEqual(kartIlerlemesi({ kelime: 500, hedefKelime: null, elleIlerleme: 40 })?.etiket, "ilerleme");
  assert.equal(kartIlerlemesi({ kelime: 500, hedefKelime: null, elleIlerleme: 0 }), null);
  assert.equal(kartIlerlemesi({ kelime: null, hedefKelime: null, elleIlerleme: null }), null);
});
