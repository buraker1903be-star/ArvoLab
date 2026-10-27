/*
  İKİLİ LOJİSTİK REGRESYON (27.10.2026).

  Bağımlı değişken iki kategorili olduğunda ("mezun oldu / olmadı",
  "hastalık var / yok") doğrusal regresyon yanlış: tahmin 0–1 dışına
  taşar, varsayımlar bozulur. Sağlık ve eğitim tezlerinde yaygın bir
  analiz ve program yapamıyordu.

  Kestirim Newton-Raphson (IRLS), SPSS'in de kullandığı en çok
  olabilirlik. Çıktı SPSS'in "Variables in the Equation" tablosu: B,
  SH, Wald, p, Exp(B) ve %95 GA; model χ² (omnibus), −2LL, Cox-Snell
  ve Nagelkerke R², sınıflandırma tablosu (kesim 0,5).

  TAM AYRIŞMA SESSİZ GEÇİLMİYOR: bir yordayıcı sonucu kusursuz
  ayırıyorsa en çok olabilirlik kestirimi sonsuza gider; algoritma
  durduğunda çıkan dev katsayı ve SH anlamsızdır. Bu durumda sonuç
  verilmez, neden söylenir.

  Doğrulama statsmodels Logit'e karşı (test dosyasında).

  Saf modül; testi tests/unit/stats-lojistik.test.ts.
*/
import { chiSquareP } from "@/lib/stats-math";
import { tersAl } from "@/lib/stats-regresyon";

export interface LojistikKatsayi {
  ad: string;
  b: number;
  se: number;
  wald: number;
  p: number;
  expB: number;
  expAlt: number;
  expUst: number;
}

export interface LojistikSonucu {
  n: number;
  /** Olay (1) olan gözlem sayısı. */
  olaySayisi: number;
  katsayilar: LojistikKatsayi[];
  /** −2 log olabilirlik (model). */
  eksiIkiLL: number;
  modelChiKare: number;
  modelDf: number;
  modelP: number;
  coxSnell: number;
  nagelkerke: number;
  /** [gerçek 0 → tahmin 0, gerçek 0 → tahmin 1], [gerçek 1 → 0, gerçek 1 → 1]. */
  siniflama: number[][];
  dogruOrani: number;
  iterasyon: number;
}

export type LojistikHata = "tek-sinif" | "az-gozlem" | "tekil" | "ayrisma";

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function lojistikRegresyon(y: number[], yordayicilar: number[][], adlar: string[]): LojistikSonucu | LojistikHata {
  const n = y.length;
  const k = yordayicilar.length;
  const olaySayisi = y.filter((v) => v === 1).length;
  if (olaySayisi === 0 || olaySayisi === n) return "tek-sinif";
  if (n <= k + 1) return "az-gozlem";
  const X = y.map((_, i) => [1, ...yordayicilar.map((c) => c[i])]);
  const p = k + 1;
  let b = new Array<number>(p).fill(0);
  let kovaryans: number[][] | null = null;
  let iterasyon = 0;
  for (; iterasyon < 50; iterasyon += 1) {
    const olas = X.map((satir) => sigmoid(satir.reduce((t, x, j) => t + x * b[j], 0)));
    const H: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const g = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i += 1) {
      const w = olas[i] * (1 - olas[i]);
      for (let j = 0; j < p; j += 1) {
        g[j] += X[i][j] * (y[i] - olas[i]);
        for (let m = 0; m < p; m += 1) H[j][m] += w * X[i][j] * X[i][m];
      }
    }
    kovaryans = tersAl(H);
    /* İlk adımda tekillik yordayıcıların kendisinden (aynı sütun iki kez);
       sonraki adımlarda ağırlıklar sıfıra indiği için — yani ayrışma. */
    if (!kovaryans) return iterasyon > 0 ? "ayrisma" : "tekil";
    const adim = kovaryans.map((satir) => satir.reduce((t, h, j) => t + h * g[j], 0));
    b = b.map((v, j) => v + adim[j]);
    if (Math.max(...adim.map(Math.abs)) < 1e-10) break;
  }
  /* Ayrışma: yakınsamadı ya da katsayı/olasılık uca kaçtı. */
  const olas = X.map((satir) => sigmoid(satir.reduce((t, x, j) => t + x * b[j], 0)));
  if (iterasyon >= 50 || b.some((v) => !Number.isFinite(v) || Math.abs(v) > 30) || olas.every((q, i) => Math.abs(q - y[i]) < 1e-6)) {
    return "ayrisma";
  }
  // Son kovaryans, son b'de yeniden hesaplanıyor (adım küçük ama doğru SH için).
  const H: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < n; i += 1) {
    const w = olas[i] * (1 - olas[i]);
    for (let j = 0; j < p; j += 1) for (let m = 0; m < p; m += 1) H[j][m] += w * X[i][j] * X[i][m];
  }
  kovaryans = tersAl(H);
  if (!kovaryans) return "ayrisma";

  const ll = y.reduce((t, v, i) => t + (v === 1 ? Math.log(olas[i]) : Math.log(1 - olas[i])), 0);
  const ll0 = olaySayisi * Math.log(olaySayisi / n) + (n - olaySayisi) * Math.log(1 - olaySayisi / n);
  const modelChiKare = 2 * (ll - ll0);
  const coxSnell = 1 - Math.exp((2 * (ll0 - ll)) / n);
  const nagelkerke = coxSnell / (1 - Math.exp((2 * ll0) / n));
  const siniflama = [
    [0, 0],
    [0, 0],
  ];
  olas.forEach((q, i) => (siniflama[y[i]][q >= 0.5 ? 1 : 0] += 1));

  return {
    n,
    olaySayisi,
    katsayilar: b.map((v, j) => {
      const se = Math.sqrt(kovaryans![j][j]);
      const wald = (v / se) ** 2;
      return {
        ad: j === 0 ? "(Sabit)" : adlar[j - 1],
        b: v,
        se,
        wald,
        p: chiSquareP(wald, 1),
        expB: Math.exp(v),
        expAlt: Math.exp(v - 1.959964 * se),
        expUst: Math.exp(v + 1.959964 * se),
      };
    }),
    eksiIkiLL: -2 * ll,
    modelChiKare,
    modelDf: k,
    modelP: chiSquareP(modelChiKare, k),
    coxSnell,
    nagelkerke,
    siniflama,
    dogruOrani: (siniflama[0][0] + siniflama[1][1]) / n,
    iterasyon,
  };
}
