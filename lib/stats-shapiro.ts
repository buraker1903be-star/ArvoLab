/*
  SHAPIRO-WILK NORMALLİK TESTİ (27.10.2026).

  Varsayım şeridi normalliği yalnızca çarpıklık ve basıklıkla ölçüyordu
  (lib/stats-varsayim.ts). Jürilerin çoğu ise "normallik testi" olarak
  Shapiro-Wilk'i soruyor; öğrenci bunun için SPSS'e dönüyordu. Test
  daha önce yazılmamıştı çünkü katsayılar ve p değeri bir yaklaşıklığa
  dayanıyor ve elle doğrulanamıyordu.

  Uygulama Royston'un algoritması (1995, AS R94) — SPSS, R
  (shapiro.test) ve SciPy'nin kullandığıyla aynı; sonuçlar SciPy'ye
  karşı test dosyasında sabitleniyor. Geçerli aralık 3 ≤ n ≤ 5000.

  KARAR HÂLÂ ÇARPIKLIK–BASIKLIKTA: Shapiro-Wilk büyük örneklemde
  önemsiz sapmayı bile anlamlı buluyor (n = 400'de neredeyse hiçbir
  gerçek veri geçmiyor). Şerit iki ölçütü de yazıyor, kararı hangi
  ölçütle verdiğini söylüyor.

  Saf modül; testi tests/unit/stats-shapiro.test.ts.
*/
import { normalCDF } from "@/lib/stats-tukey";

/* Ters normal (Acklam), bir Newton adımıyla inceltilmiş. */
export function normalTers(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const alt = 0.02425;
  let x: number;
  if (p < alt) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - alt) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normalCDF(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

const poly = (c: number[], x: number) => c.reduce((t, k, i) => t + k * x ** i, 0);

export interface ShapiroWilkSonucu {
  w: number;
  p: number;
  n: number;
}

export function shapiroWilk(dizi: number[]): ShapiroWilkSonucu {
  const n = dizi.length;
  if (n < 3 || n > 5000) return { w: NaN, p: NaN, n };
  const x = [...dizi].sort((p, q) => p - q);
  const ort = x.reduce((t, v) => t + v, 0) / n;
  const ss = x.reduce((t, v) => t + (v - ort) ** 2, 0);
  if (ss === 0) return { w: NaN, p: NaN, n };

  /* Katsayılar (a): simetrik, üst yarı pozitif. */
  const a = new Array<number>(n).fill(0);
  if (n === 3) {
    a[0] = -Math.SQRT1_2;
    a[2] = Math.SQRT1_2;
  } else {
    const m = Array.from({ length: n }, (_, i) => normalTers((i + 1 - 0.375) / (n + 0.25)));
    const summ2 = m.reduce((t, v) => t + v * v, 0);
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(n);
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) + m[n - 1] / ssumm2;
    if (n > 5) {
      const a2 = poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn) + m[n - 2] / ssumm2;
      const fac = Math.sqrt((summ2 - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
      for (let i = 0; i < n; i += 1) a[i] = m[i] / fac;
      a[n - 1] = a1;
      a[n - 2] = a2;
      a[0] = -a1;
      a[1] = -a2;
    } else {
      const fac = Math.sqrt((summ2 - 2 * m[n - 1] ** 2) / (1 - 2 * a1 ** 2));
      for (let i = 0; i < n; i += 1) a[i] = m[i] / fac;
      a[n - 1] = a1;
      a[0] = -a1;
    }
  }
  const pay = a.reduce((t, k, i) => t + k * x[i], 0) ** 2;
  const w = Math.min(1, pay / ss);

  let p: number;
  if (n === 3) {
    p = Math.max(0, Math.min(1, (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.asin(Math.sqrt(0.75)))));
  } else if (n <= 11) {
    const gamma = poly([-2.273, 0.459], n);
    const mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
    const sigma = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    const y = Math.log(1 - w);
    /* Küçük n'de dönüşüm γ − log(1 − W) > 0 ister; değilse W 1'e çok yakın, p ≈ 1. */
    p = gamma - y <= 0 ? 1 : 1 - normalCDF((-Math.log(gamma - y) - mu) / sigma);
  } else {
    const ln = Math.log(n);
    const mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln);
    const sigma = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln));
    p = 1 - normalCDF((Math.log(1 - w) - mu) / sigma);
  }
  return { w, p, n };
}
