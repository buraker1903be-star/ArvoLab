/*
  q DAĞILIMI, TUKEY HSD, GAMES-HOWELL.

  Beklenen değerler BAĞIMSIZ uygulamalardan: SciPy 1.18
  (scipy.stats.studentized_range.sf) ve pingouin (pairwise_tukey,
  pairwise_gameshowell). Elle yazılmış bir q tablosu yok; hata
  görünmez kalmasın diye her değer dışarıdan.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { gamesHowell, normalCDF, studentizedRangeP, tukeyHSD } from "@/lib/stats-tukey";

const yakin = (a: number, b: number, tolerans = 1e-4) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("studentized range", () => {
  test("SciPy studentized_range.sf ile aynı", () => {
    const ref: [number, number, number, number][] = [
      [3.5, 3, 10, 0.07710331083841038],
      [2.0, 4, 20, 0.5054403454121139],
      [4.2, 5, 12, 0.07216785129879821],
      [3.0, 3, 2, 0.28834998276502677],
      [5.0, 6, 60, 0.009820368062452789],
      [1.0, 2, 5, 0.5110840804302805],
      [3.31, 3, 1000, 0.05084730006599203],
      [6.5, 4, 3, 0.05683787071553548],
    ];
    for (const [q, k, df, p] of ref) yakin(studentizedRangeP(q, k, df), p);
  });

  test("normal CDF", () => {
    yakin(normalCDF(1.959964), 0.975, 1e-6);
    yakin(normalCDF(-1), 0.158655, 1e-6);
  });
});

const GRUPLAR = [[4, 5, 6, 5, 7, 6], [7, 8, 6, 9, 8], [5, 6, 5, 4, 6, 5, 7, 3]];
const ADLAR = ["A", "B", "C"];

describe("post-hoc (pingouin ile karşılaştırma)", () => {
  test("Tukey HSD (Tukey-Kramer)", () => {
    const r = tukeyHSD(GRUPLAR, ADLAR);
    const beklenen = [
      [-2.1, -2.986539, 0.022452],
      [0.375, 0.59796, 0.823178],
      [2.475, 3.738678, 0.004809],
    ];
    r.forEach((c, i) => {
      yakin(c.ortalamaFarki, beklenen[i][0]);
      yakin(c.t, beklenen[i][1]);
      yakin(c.p, beklenen[i][2]);
    });
    assert.deepEqual(r.map((c) => c.anlamli), [true, false, true]);
  });

  test("Games-Howell", () => {
    const r = gamesHowell(GRUPLAR, ADLAR);
    const beklenen = [
      [-3.153945, 0.031016],
      [0.610317, 0.817352],
      [3.672428, 0.012288],
    ];
    r.forEach((c, i) => {
      yakin(c.t, beklenen[i][0]);
      yakin(c.p, beklenen[i][1]);
    });
  });
});
