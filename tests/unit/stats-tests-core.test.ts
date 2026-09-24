/*
  Temel istatistik testleri. Bu modülün hiç testi yoktu; oysa ürettiği
  sayı doğrudan tezin bulgular bölümüne giriyor. Yanlış bir p değeri,
  yanlış bir cümleden daha ağır bir hatadır.

  Beklenen değerler ELLE hesaplandı, koddan türetilmedi — yoksa test
  yalnızca "kod kendisiyle tutarlı" derdi. Hesaplar yorumlarda açık.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  chiSquareIndependence,
  cronbachAlpha,
  independentTTest,
  oneWayAnova,
  pearsonCorrelation,
} from "@/lib/stats-tests-core";

const yakin = (a: number, b: number, tolerans = 1e-4) =>
  assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("bağımsız örneklem t-testi", () => {
  test("ders kitabı örneği", () => {
    /*
      [5,6,7,8,9] → ort 7, varyans 10/4 = 2.5
      [1,2,3,4,5] → ort 3, varyans 10/4 = 2.5
      ortak varyans 2.5 → SH = √(2.5 × (1/5 + 1/5)) = √1 = 1
      t = (7 − 3) / 1 = 4,  sd = 8
    */
    const r = independentTTest([5, 6, 7, 8, 9], [1, 2, 3, 4, 5]);
    yakin(r.t, 4);
    assert.equal(r.df, 8);
    yakin(r.p, 0.00395, 1e-4);
    yakin(r.sd1, Math.sqrt(2.5));
  });

  test("değişkenlik yoksa sonuç tanımsız (çağıran bunu yakalamalı)", () => {
    // Bütün değerler aynı → varyans 0 → t = 0/0. Ekrana "NaN" yazmamak
    // çağıranın işi (lib/apa-format.ts, hesaplanabilir).
    const r = independentTTest([5, 5, 5], [5, 5, 5]);
    assert.equal(Number.isFinite(r.t), false);
    assert.equal(Number.isFinite(r.p), false);
  });
});

describe("tek yönlü ANOVA", () => {
  test("ders kitabı örneği", () => {
    /*
      Gruplar [1,2,3] [4,5,6] [7,8,9]; genel ortalama 5.
      SSb = 3(2−5)² + 3(5−5)² + 3(8−5)² = 27 + 0 + 27 = 54,  sdb = 2 → MSb = 27
      SSw = 3 × 2 = 6,  sdw = 6 → MSw = 1
      F = 27
    */
    const r = oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    yakin(r.f, 27);
    assert.equal(r.dfb, 2);
    assert.equal(r.dfw, 6);
    yakin(r.ssb, 54);
    yakin(r.ssw, 6);
    assert.ok(r.p < 0.01, `p beklenenden büyük: ${r.p}`);
  });

  test("gruplar özdeşse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(oneWayAnova([[1, 1, 1], [1, 1, 1]]).f), false);
  });
});

describe("Pearson korelasyonu", () => {
  test("mükemmel pozitif ilişki", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    yakin(r.r, 1);
    assert.equal(r.df, 3);
  });

  test("mükemmel negatif ilişki", () => {
    yakin(pearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1]).r, -1);
  });

  test("bilinen ara değer", () => {
    /*
      x=[1,2,3,4,5] (ort 3), y=[2,1,4,3,5] (ort 3)
      pay = (−2)(−1) + (−1)(−2) + 0 + 0 + (2)(2) = 2 + 2 + 0 + 0 + 4 = 8
      payda = √(10 × 10) = 10  →  r = 0.8
    */
    yakin(pearsonCorrelation([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]).r, 0.8);
  });

  test("bir değişken sabitse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(pearsonCorrelation([2, 2, 2, 2], [1, 2, 3, 4]).r), false);
  });
});

describe("ki-kare bağımsızlık", () => {
  test("2x2 tablo, elle hesap", () => {
    /*
      [[10,20],[30,40]] → satır 30/70, sütun 40/60, N=100
      Beklenen: 12, 18, 28, 42
      X² = 4/12 + 4/18 + 4/28 + 4/42 = 0.79365
      (Yates düzeltmesi UYGULANMIYOR; düz Pearson X² raporlanıyor.)
    */
    const r = chiSquareIndependence([[10, 20], [30, 40]]);
    yakin(r.chi2, 0.79365);
    assert.equal(r.df, 1);
    assert.equal(r.n, 100);
  });

  test("tamamen boş sütun sonucu tanımsız yapar", () => {
    // Beklenen değer 0 → sıfıra bölme. Kullanılmayan kategori bırakılmış
    // veri setlerinde gerçekten oluyor.
    assert.equal(Number.isFinite(chiSquareIndependence([[10, 0], [30, 0]]).chi2), false);
  });
});

describe("Cronbach alfa", () => {
  test("maddeler özdeşse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(cronbachAlpha([[3, 3, 3], [3, 3, 3]]).alpha), false);
  });

  test("gerçek veride 0 ile 1 arasında", () => {
    const r = cronbachAlpha([
      [4, 5, 3, 4, 5],
      [4, 4, 3, 5, 5],
      [5, 5, 2, 4, 4],
    ]);
    assert.equal(r.k, 3);
    assert.ok(r.alpha <= 1, `alfa 1'i aştı: ${r.alpha}`);
  });
});
