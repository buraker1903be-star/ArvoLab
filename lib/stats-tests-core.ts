/**
 * Temel İstatistiksel Testler
 * ------------------------------------------------------------
 * Bağımsız örneklem t-testi, tek yönlü ANOVA, Pearson korelasyonu,
 * ki-kare bağımsızlık testi ve Cronbach Alpha güvenilirlik analizi.
 * Tüm formüller elle hesaplanmış / ders kitabı örnekleriyle
 * doğrulanmıştır (bkz. proje test notları). Bu modül YORUM
 * ÜRETMEZ — yalnızca sayısal sonucu hesaplar; APA biçimlendirmesi
 * ve anlamlılık işaretlemesi ayrı bir katmanda (stats-interpreter.ts
 * ile aynı ilkede) yapılır.
 */
import { tTestTwoTailedP, fTestP, chiSquareP } from "./stats-math";

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

export function sd(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface DescriptiveStats {
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  median: number;
}

export function describeNumeric(arr: number[]): DescriptiveStats {
  return {
    n: arr.length,
    mean: mean(arr),
    sd: arr.length > 1 ? sd(arr) : 0,
    min: Math.min(...arr),
    max: Math.max(...arr),
    median: median(arr),
  };
}

export interface TTestResult {
  t: number;
  df: number;
  p: number;
  m1: number;
  m2: number;
  n1: number;
  n2: number;
  sd1: number;
  sd2: number;
}

export function independentTTest(group1: number[], group2: number[]): TTestResult {
  const n1 = group1.length,
    n2 = group2.length;
  const m1 = mean(group1),
    m2 = mean(group2);
  const v1 = variance(group1),
    v2 = variance(group2);
  const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
  const t = (m1 - m2) / se;
  const df = n1 + n2 - 2;
  const p = tTestTwoTailedP(Math.abs(t), df);
  return { t, df, p, m1, m2, n1, n2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2) };
}

export interface AnovaResult {
  f: number;
  dfb: number;
  dfw: number;
  p: number;
  ssb: number;
  ssw: number;
  msb: number;
  msw: number;
  groupMeans: number[];
  groupNs: number[];
}

export function oneWayAnova(groups: number[][]): AnovaResult {
  const allValues = groups.flat();
  const grandMean = mean(allValues);
  const N = allValues.length;
  const k = groups.length;
  let ssb = 0,
    ssw = 0;
  const groupMeans: number[] = [];
  for (const g of groups) {
    const gm = mean(g);
    groupMeans.push(gm);
    ssb += g.length * (gm - grandMean) ** 2;
    ssw += g.reduce((s, x) => s + (x - gm) ** 2, 0);
  }
  const dfb = k - 1,
    dfw = N - k;
  const msb = ssb / dfb,
    msw = ssw / dfw;
  const f = msb / msw;
  const p = fTestP(f, dfb, dfw);
  return { f, dfb, dfw, p, ssb, ssw, msb, msw, groupMeans, groupNs: groups.map((g) => g.length) };
}

export interface CorrelationResult {
  r: number;
  df: number;
  p: number;
  n: number;
}

export function pearsonCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = x.length;
  const mx = mean(x),
    my = mean(y);
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const r = num / Math.sqrt(dx * dy);
  const df = n - 2;
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  const p = tTestTwoTailedP(Math.abs(t), df);
  return { r, df, p, n };
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  p: number;
  n: number;
}

export function chiSquareIndependence(table: number[][]): ChiSquareResult {
  const rowTotals = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = table[0].map((_, c) => table.reduce((s, row) => s + row[c], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  for (let r = 0; r < table.length; r++) {
    for (let c = 0; c < table[0].length; c++) {
      const expected = (rowTotals[r] * colTotals[c]) / grandTotal;
      chi2 += (table[r][c] - expected) ** 2 / expected;
    }
  }
  const df = (table.length - 1) * (table[0].length - 1);
  const p = chiSquareP(chi2, df);
  return { chi2, df, p, n: grandTotal };
}

export interface CronbachAlphaResult {
  alpha: number;
  k: number;
  n: number;
}

export function cronbachAlpha(items: number[][]): CronbachAlphaResult {
  const k = items.length;
  const itemVariances = items.map((item) => variance(item));
  const n = items[0].length;
  const totalScores: number[] = [];
  for (let i = 0; i < n; i++) {
    totalScores.push(items.reduce((s, item) => s + item[i], 0));
  }
  const totalVar = variance(totalScores);
  const alpha = (k / (k - 1)) * (1 - itemVariances.reduce((a, b) => a + b, 0) / totalVar);
  return { alpha, k, n };
}
