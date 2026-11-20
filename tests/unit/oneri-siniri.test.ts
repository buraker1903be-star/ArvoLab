import assert from "node:assert/strict";
import test from "node:test";
import { otomatikIzin } from "@/lib/oneri-siniri";

const S = { aralikMs: 12_000, saatlik: 3 };

test("otomatik öneri: iki istek arası en az aralık kadar", () => {
  const ilk = otomatikIzin([], 100_000, S);
  assert.equal(ilk.izin, true);
  const hemen = otomatikIzin(ilk.zamanlar, 105_000, S);
  assert.deepEqual([hemen.izin, !hemen.izin && hemen.neden], [false, "aralik"]);
  assert.equal(otomatikIzin(ilk.zamanlar, 112_000, S).izin, true);
});

test("otomatik öneri: saatlik tavan, bir saat sonra pencere açılır", () => {
  let z: number[] = [];
  for (const t of [0, 20_000, 40_000]) {
    const k = otomatikIzin(z, t, S);
    assert.equal(k.izin, true);
    z = k.zamanlar;
  }
  const dolu = otomatikIzin(z, 60_000, S);
  assert.deepEqual([dolu.izin, !dolu.izin && dolu.neden], [false, "saatlik"]);
  assert.equal(otomatikIzin(z, 3_600_001, S).izin, true, "en eski istek pencereden çıktı");
});

test("otomatik öneri: bozuk ya da gelecekteki kayıt sayılmaz", () => {
  assert.equal(otomatikIzin([Number.NaN, 9_999_999], 50_000, S).izin, true);
});
