import assert from "node:assert/strict";
import test from "node:test";
import {
  chiSquareCDF,
  chiSquareP,
  fTestP,
  gammaP,
  incompleteBeta,
  tTestTwoTailedP,
} from "@/lib/stats-math";

// stats-math.ts'in başında "bilinen kritik tablo değerleriyle doğrulanmıştır"
// yazıyordu ama bu doğrulama otomatik değildi. Aşağıdaki değerler standart
// istatistik tablolarından: her kritik değerde p tam olarak 0.05 çıkmalı.
// Tablolar 3 ondalık basamağa yuvarlı olduğu için tolerans 6e-4.
const TOL = 6e-4;
const yakin = (a: number, b: number, tol = TOL) => Math.abs(a - b) < tol;

test("Student t: kritik değerlerde iki kuyruklu p = 0.05", () => {
  const tablo: [number, number][] = [
    [1, 12.706], [2, 4.303], [5, 2.571], [10, 2.228], [20, 2.086], [30, 2.042], [120, 1.980],
  ];
  for (const [df, t] of tablo) {
    const p = tTestTwoTailedP(t, df);
    assert.ok(yakin(p, 0.05), `df=${df} t=${t} → p=${p}`);
  }
});

test("Student t: 0.01 düzeyi", () => {
  for (const [df, t] of [[10, 3.169], [20, 2.845], [30, 2.750]] as [number, number][]) {
    assert.ok(yakin(tTestTwoTailedP(t, df), 0.01), `df=${df} t=${t}`);
  }
});

test("Chi-kare: kritik değerlerde sağ kuyruk p = 0.05", () => {
  const tablo: [number, number][] = [[1, 3.841], [2, 5.991], [3, 7.815], [5, 11.070], [10, 18.307], [20, 31.410]];
  for (const [df, x] of tablo) {
    const p = chiSquareP(x, df);
    assert.ok(yakin(p, 0.05), `df=${df} x²=${x} → p=${p}`);
  }
});

test("F: kritik değerlerde sağ kuyruk p = 0.05", () => {
  const tablo: [number, number, number][] = [
    [1, 1, 161.4], [2, 30, 3.316], [3, 10, 3.708], [5, 20, 2.711], [10, 10, 2.978],
  ];
  for (const [df1, df2, f] of tablo) {
    const p = fTestP(f, df1, df2);
    assert.ok(yakin(p, 0.05), `F(${df1},${df2})=${f} → p=${p}`);
  }
});

test("p-değerleri her zaman [0,1] aralığında ve monoton", () => {
  let onceki = 1;
  for (const t of [0, 0.5, 1, 2, 3, 5, 10]) {
    const p = tTestTwoTailedP(t, 15);
    assert.ok(p >= 0 && p <= 1, `t=${t} → p=${p}`);
    assert.ok(p <= onceki, `t büyüdükçe p küçülmeli (t=${t})`);
    onceki = p;
  }
});

test("sınır değerler", () => {
  assert.equal(tTestTwoTailedP(0, 10), 1, "t=0 → p=1");
  assert.equal(chiSquareP(0, 1), 1, "x²=0 → p=1");
  assert.equal(chiSquareCDF(0, 1), 0);
  assert.equal(gammaP(1, 0), 0);
  assert.ok(Number.isNaN(gammaP(-1, 1)), "geçersiz a → NaN");
  assert.ok(Number.isNaN(gammaP(1, -1)), "negatif x → NaN");
});

test("incompleteBeta bilinen değerler", () => {
  // I_x(1,1) = x (düzgün dağılım)
  for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.ok(yakin(incompleteBeta(x, 1, 1), x, 1e-9), `I_${x}(1,1)`);
  }
  assert.equal(incompleteBeta(0, 2, 3), 0);
  assert.equal(incompleteBeta(1, 2, 3), 1);
  // Simetri: I_x(a,b) = 1 - I_{1-x}(b,a)
  assert.ok(yakin(incompleteBeta(0.3, 2, 5), 1 - incompleteBeta(0.7, 5, 2), 1e-9));
});

test("chiSquareCDF ve chiSquareP birbirini tamamlar", () => {
  for (const [x, df] of [[1, 1], [4, 2], [12, 7]] as [number, number][]) {
    assert.ok(yakin(chiSquareCDF(x, df) + chiSquareP(x, df), 1, 1e-12));
  }
});
