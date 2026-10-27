/*
  KISMİ KORELASYON VE McNEMAR (27.10.2026).

  - Kısmi korelasyon: "yaşı kontrol ettiğimde kaygı ile başarı ilişkili
    mi" — üçüncü değişkenin etkisini çıkarıp kalan ilişki. Program
    yalnızca ham korelasyon veriyordu; öğrenci kontrol değişkenini
    yok sayıyordu.
  - McNemar: iki kategorili BAĞIMLI ölçüm (eğitimden önce/sonra
    "Evet/Hayır"). Ki-kare bağımsız gruplar ister; aynı kişilerin iki
    cevabına ki-kare uygulamak yaygın ve yanlış bir kısayoldu.

  Doğrulama pingouin (partial_corr) ve statsmodels (mcnemar) ile; test
  dosyasında.

  Saf modül; testi tests/unit/stats-iliski.test.ts.
*/
import { chiSquareP, logFaktoriyel, tTestTwoTailedP } from "@/lib/stats-math";
import { pearsonCorrelation } from "@/lib/stats-tests-core";
import { enKucukKareler } from "@/lib/stats-regresyon";

export interface KismiKorelasyonSonucu {
  r: number;
  n: number;
  df: number;
  t: number;
  p: number;
  /** Kontrol edilmeden önceki (sıfırıncı derece) korelasyon: farkı görmek için. */
  hamR: number;
}

/* Değişkenin kontrol değişkenleriyle açıklanamayan kısmı (artıklar). */
function artiklar(y: number[], kontroller: number[][]): number[] | null {
  const X = y.map((_, i) => [1, ...kontroller.map((k) => k[i])]);
  const sonuc = enKucukKareler(y, X);
  if (!sonuc) return null;
  return y.map((deger, i) => deger - X[i].reduce((t, x, j) => t + x * sonuc.b[j], 0));
}

export function kismiKorelasyon(x: number[], y: number[], kontroller: number[][]): KismiKorelasyonSonucu | null {
  const n = x.length;
  const ax = artiklar(x, kontroller);
  const ay = artiklar(y, kontroller);
  if (!ax || !ay) return null;
  const r = pearsonCorrelation(ax, ay).r;
  const df = n - 2 - kontroller.length;
  const t = Math.abs(r) < 1 ? r * Math.sqrt(df / (1 - r * r)) : NaN;
  return { r, n, df, t, p: Number.isFinite(t) && df > 0 ? tTestTwoTailedP(Math.abs(t), df) : NaN, hamR: pearsonCorrelation(x, y).r };
}

export interface McNemarSonucu {
  /** 2×2 tablo: [önce1-sonra1, önce1-sonra2], [önce2-sonra1, önce2-sonra2]. */
  tablo: number[][];
  /** Değişen çiftler: b (1→2), c (2→1). */
  b: number;
  c: number;
  /** Kesin (binom) iki yönlü p — SPSS'in 2×2 için verdiği. */
  pKesin: number;
  /** Süreklilik düzeltmeli χ² (b + c ≥ 25 olduğunda raporlanabilir). */
  chiKare: number;
  pChiKare: number;
}

export function mcnemar(once: string[], sonra: string[], duzeyler: [string, string]): McNemarSonucu {
  const tablo = [
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < once.length; i += 1) {
    const a = duzeyler.indexOf(once[i]);
    const d = duzeyler.indexOf(sonra[i]);
    if (a >= 0 && d >= 0) tablo[a][d] += 1;
  }
  const b = tablo[0][1];
  const c = tablo[1][0];
  const m = b + c;
  let pKesin = 1;
  if (m > 0) {
    /* P(X ≤ min(b,c)), X ~ Binom(m, 0,5); log ölçekte (büyük m'de taşmasın). */
    let kuyruk = 0;
    for (let i = 0; i <= Math.min(b, c); i += 1) {
      kuyruk += Math.exp(logFaktoriyel(m) - logFaktoriyel(i) - logFaktoriyel(m - i) - m * Math.LN2);
    }
    pKesin = Math.min(1, 2 * kuyruk);
  }
  const chiKare = m > 0 ? (Math.abs(b - c) - 1) ** 2 / m : NaN;
  return { tablo, b, c, pKesin, chiKare, pChiKare: Number.isFinite(chiKare) ? chiSquareP(chiKare, 1) : NaN };
}
