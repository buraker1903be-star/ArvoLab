/*
  STUDENTIZED RANGE (q) DAĞILIMI, TUKEY HSD VE GAMES-HOWELL (27.10.2026).

  Tek yönlü ANOVA'nın ardından ikili karşılaştırma yalnızca Bonferroni
  ile yapılıyordu; Tukey HSD ve Games-Howell bilerek YAZILMAMIŞTI:
  ikisi de q dağılımını istiyor ve elle yazılan bir q tablosundaki hata
  görünmez olurdu (makul bir p çıkar, kimse fark etmez). Oysa jüriler ve
  dergiler post-hoc olarak çoğunlukla Tukey'i, varyanslar homojen
  değilse Games-Howell'i bekliyor; öğrenci SPSS'e dönüyordu.

  Bu sefer tablo yok: dağılım tanımından SAYISAL İNTEGRALLE hesaplanıyor
  ve sonuçlar bağımsız bir uygulamaya (SciPy, studentized_range;
  pingouin, Tukey/Games-Howell) karşı test dosyasında sabitleniyor —
  kendi formülümüzü kendi formülümüzle sınamıyoruz.

    W(w; k)    = k ∫ φ(z) [Φ(z + w) − Φ(z)]^(k−1) dz     (k normalin aralığı)
    P(Q ≤ q)   = ∫₀^∞ f_S(s) W(q·s; k) ds,  S = √(χ²_ν / ν)

  Saf modül; testi tests/unit/stats-tukey.test.ts.
*/
import { lgamma } from "@/lib/stats-math";
import { mean, variance, type IkiliKarsilastirma } from "@/lib/stats-tests-core";

/* Tamamlayıcı hata fonksiyonu (Numerical Recipes erfcc; bağıl hata < 1,2e−7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
        t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Standart normal birikimli dağılım. */
export function normalCDF(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/* Simpson; n çift olmalı. */
function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let toplam = f(a) + f(b);
  for (let i = 1; i < n; i += 1) toplam += f(a + i * h) * (i % 2 ? 4 : 2);
  return (toplam * h) / 3;
}

/* k standart normalin aralığının CDF'i. */
function aralikCDF(w: number, k: number): number {
  if (w <= 0) return 0;
  const deger = simpson(
    (z) => {
      const fark = normalCDF(z + w) - normalCDF(z);
      return fark <= 0 ? 0 : (Math.exp(-0.5 * z * z) / SQRT_2PI) * fark ** (k - 1);
    },
    -8,
    8,
    240,
  );
  return Math.min(1, k * deger);
}

/**
 * Studentized range dağılımının birikimli olasılığı P(Q ≤ q; k, ν).
 * ν çok büyükse (> 5000) S ≈ 1 alınır.
 */
export function studentizedRangeCDF(q: number, k: number, df: number): number {
  if (!(q > 0) || k < 2 || !(df > 0)) return q > 0 ? NaN : 0;
  if (df > 5000) return aralikCDF(q, k);
  /* S'nin yoğunluğu log ölçekte: ν^(ν/2) s^(ν−1) e^(−νs²/2) / (Γ(ν/2) 2^(ν/2−1)). */
  const logSabit = (df / 2) * Math.log(df) - lgamma(df / 2) - (df / 2 - 1) * Math.log(2);
  const yogunluk = (s: number) => (s <= 0 ? 0 : Math.exp(logSabit + (df - 1) * Math.log(s) - (df * s * s) / 2));
  /* S'nin kütlesi 1 civarında, yayılımı ~1/√(2ν); küçük ν'de kuyruk uzun. */
  const ust = 1 + 10 / Math.sqrt(df) + (df < 5 ? 6 : 0);
  return Math.min(1, simpson((s) => yogunluk(s) * aralikCDF(q * s, k), 0, ust, 400));
}

/** Üst kuyruk olasılığı: post-hoc p değeri. */
export function studentizedRangeP(q: number, k: number, df: number): number {
  const p = 1 - studentizedRangeCDF(q, k, df);
  return Number.isFinite(p) ? Math.max(0, p) : NaN;
}

/*
  TUKEY HSD (eşit olmayan n'de Tukey-Kramer). Ortak hata karesi (MSw)
  kullanıyor; yani eşit varyans varsayıyor — varyanslar homojen
  değilse Games-Howell. `t` alanında q/√2 tutuluyor (t ölçeğinde,
  Bonferroni tablosuyla aynı sütun); p q dağılımından.
*/
export function tukeyHSD(gruplar: number[][], adlar: string[]): IkiliKarsilastirma[] {
  const k = gruplar.length;
  const N = gruplar.reduce((t, g) => t + g.length, 0);
  const dfw = N - k;
  const msw = gruplar.reduce((t, g) => {
    const o = mean(g);
    return t + g.reduce((s, x) => s + (x - o) ** 2, 0);
  }, 0) / dfw;
  const ciftler: IkiliKarsilastirma[] = [];
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      const fark = mean(gruplar[i]) - mean(gruplar[j]);
      const se = Math.sqrt((msw / 2) * (1 / gruplar[i].length + 1 / gruplar[j].length));
      const q = se === 0 ? NaN : Math.abs(fark) / se;
      const p = Number.isFinite(q) ? studentizedRangeP(q, k, dfw) : NaN;
      ciftler.push({
        a: adlar[i] ?? `Grup ${i + 1}`,
        b: adlar[j] ?? `Grup ${j + 1}`,
        ortalamaFarki: fark,
        t: Number.isFinite(q) ? (Math.sign(fark) * q) / Math.SQRT2 : NaN,
        pHam: p,
        p,
        anlamli: Number.isFinite(p) ? p < 0.05 : false,
      });
    }
  }
  return ciftler;
}

/*
  GAMES-HOWELL: eşit varyans ve eşit n varsaymaz. Her çift kendi
  varyanslarıyla (Welch serbestlik derecesi), p yine q dağılımından.
*/
export function gamesHowell(gruplar: number[][], adlar: string[]): IkiliKarsilastirma[] {
  const k = gruplar.length;
  const ciftler: IkiliKarsilastirma[] = [];
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      const ni = gruplar[i].length;
      const nj = gruplar[j].length;
      const vi = variance(gruplar[i]) / ni;
      const vj = variance(gruplar[j]) / nj;
      const fark = mean(gruplar[i]) - mean(gruplar[j]);
      const se = Math.sqrt(vi + vj);
      const t = se === 0 ? NaN : fark / se;
      const df = (vi + vj) ** 2 / (vi ** 2 / (ni - 1) + vj ** 2 / (nj - 1));
      const p = Number.isFinite(t) ? studentizedRangeP(Math.abs(t) * Math.SQRT2, k, df) : NaN;
      ciftler.push({
        a: adlar[i] ?? `Grup ${i + 1}`,
        b: adlar[j] ?? `Grup ${j + 1}`,
        ortalamaFarki: fark,
        t,
        pHam: p,
        p,
        anlamli: Number.isFinite(p) ? p < 0.05 : false,
      });
    }
  }
  return ciftler;
}
