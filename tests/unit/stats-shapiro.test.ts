/*
  SHAPIRO-WILK: beklenen değerler SciPy 1.18'den (scipy.stats.shapiro,
  aynı Royston algoritması). Elle hesaplanamayan bir testi kendi
  çıktısıyla sınamamak için hepsi dışarıdan.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalTers, shapiroWilk } from "@/lib/stats-shapiro";

const yakin = (a: number, b: number, tolerans = 1e-5) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

const SCIPY: [number[], number, number][] = [
  [[1, 2, 4], 0.9642857142857144, 0.6368868450289701],
  [[2.1, 3.4, 1.9, 5.6, 4.4], 0.9320849396015234, 0.6106559050550942],
  [[148, 154, 158, 160, 161, 162, 166, 170], 0.9822817034439244, 0.9733029146383335],
  [[3, 4, 4, 5, 5, 5, 6, 6, 7, 9, 12, 15], 0.838299012178658, 0.026401462875017472],
  [[70.41, 24.44, 54.18, 44.32, 45.47, 47.84, 29.8, 47.68, 41.35, 83.23, 52.26, 46.47, 47.19, 43.32, 39.45, 46.09, 54.82, 47.61, 59.58, 48.0], 0.9004436299027639, 0.04203642008718411],
  [[1.415, 2.05, 1.137, 1.79, 0.413, 6.767, 0.02, 5.618, 1.151, 0.601, 1.082, 0.624, 1.8, 2.147, 3.769, 0.444, 6.289, 1.472, 0.697, 1.767, 0.15, 0.12, 2.447, 1.546, 4.392, 0.95, 1.043, 2.362, 1.053, 0.044, 0.587, 2.029, 1.269, 2.793, 0.017, 1.808, 0.501, 0.711, 6.15, 2.809, 7.591, 3.496, 4.486, 0.29, 0.605, 0.478, 2.296, 2.447, 0.254, 0.768, 2.136, 0.137, 0.196, 1.743, 3.748, 5.393, 1.412, 2.612, 1.527, 1.874], 0.8472280348417076, 2.5258825190192798e-6],
];

test("Shapiro-Wilk SciPy ile aynı (n = 3 … 60)", () => {
  for (const [veri, w, p] of SCIPY) {
    const r = shapiroWilk(veri);
    yakin(r.w, w);
    yakin(r.p, p, Math.max(1e-5, p * 1e-3));
  }
});

test("değişkenliği olmayan ya da çok küçük veri: tanımsız", () => {
  assert.ok(Number.isNaN(shapiroWilk([5, 5, 5, 5]).w));
  assert.ok(Number.isNaN(shapiroWilk([1, 2]).p));
});

test("ters normal", () => {
  yakin(normalTers(0.975), 1.959964);
  yakin(normalTers(0.01), -2.326348);
});
