/**
 * İstatistiksel Dağılım Fonksiyonları
 * ------------------------------------------------------------
 * Standart nümerik yöntemlerle (Lanczos log-gamma yaklaşımı,
 * tamamlanmamış gamma/beta fonksiyonları için seri/devam kesri
 * algoritmaları — Numerical Recipes'te tarif edilen klasik
 * yöntemler) t, F ve χ² dağılımlarının p-değerlerini hesaplar.
 * Bilinen kritik tablo değerleriyle (df=10,20,30 için t; çeşitli
 * df kombinasyonları için F ve χ²) doğrulanmıştır.
 */

function lgamma(x: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = p[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += p[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function gammaSeries(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = lgamma(a);
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= 200; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

function gammaContinuedFraction(a: number, x: number): number {
  const gln = lgamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

export function gammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    return gammaSeries(a, x);
  } else {
    return 1 - gammaContinuedFraction(a, x);
  }
}

export function chiSquareCDF(x: number, df: number): number {
  return gammaP(df / 2, x / 2);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const MAXIT = 200,
    EPS = 1e-14,
    FPMIN = 1e-300;
  const qab = a + b,
    qap = a + 1,
    qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(x, a, b)) / a;
  } else {
    return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
  }
}

/** Student t dağılımı: |t| istatistiği için iki kuyruklu p-değeri. */
export function tTestTwoTailedP(t: number, df: number): number {
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

/** F dağılımı: sağ kuyruk p-değeri. */
export function fTestP(f: number, df1: number, df2: number): number {
  const x = df2 / (df2 + df1 * f);
  return incompleteBeta(x, df2 / 2, df1 / 2);
}

/** Chi-kare dağılımı: sağ kuyruk p-değeri. */
export function chiSquareP(chi2: number, df: number): number {
  return 1 - chiSquareCDF(chi2, df);
}
