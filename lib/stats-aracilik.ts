/*
  ARACILIK (MEDIATION) VE DÜZENLEYİCİLİK (MODERATION) ANALİZİ (27.10.2026).

  Tezlerde "X, Y'yi M üzerinden mi etkiliyor" (aracılık) ve "X'in Y'ye
  etkisi W'ye göre değişiyor mu" (düzenleyicilik) soruları yaygın; SPSS'te
  Hayes'in PROCESS eklentisiyle yapılıyor (Model 4 ve Model 1). Program
  ikisini de yapamıyordu.

  ARACILIK (Model 4): a (X→M), b (M→Y | X), c (toplam), c' (doğrudan) ve
  dolaylı etki a·b. Dolaylı etkinin anlamlılığı BOOTSTRAP güven
  aralığıyla (yüzdelik, 5000 örnek) — Sobel testi de yazılır ama a·b'nin
  dağılımı normal olmadığı için kararın ölçütü aralıktır (Hayes, 2018):
  aralık sıfırı içermiyorsa dolaylı etki anlamlı.

  Bootstrap TOHUMLU: aynı veri her açılışta aynı aralığı vermeli. Rastgele
  tohum, öğrencinin tezine yazdığı aralığın danışman ekranında başka
  çıkması demekti.

  DÜZENLEYİCİLİK (Model 1): Y = b0 + b1·X + b2·W + b3·X·W. Etkileşimin
  anlamlılığı ve ΔR²; W'nin seçilmiş değerlerinde (ortalama ± 1 SS ya da
  iki değerli W'nin iki değeri) koşullu etkiler (basit eğimler) ve
  Johnson-Neyman anlamlılık sınırı. X ve W ortalamadan arındırılarak
  (merkezlenerek) kestirilir; etkileşim katsayısı merkezlemeden
  etkilenmez, b1 ve b2 ise "diğerinin ortalamasında" yorumlanabilir olur.

  Doğrulama statsmodels OLS'e (katsayı, SH, doğrusal birleşim testi) ve
  pingouin.mediation_analysis'e (bootstrap aralığı, gevşek tolerans:
  rastgele örnekler farklı) karşı; test dosyasında.

  Saf modül; testi tests/unit/stats-aracilik.test.ts.
*/
import { tKritik, tTestTwoTailedP } from "@/lib/stats-math";
import { normalCDF } from "@/lib/stats-tukey";
import { mean, sd } from "@/lib/stats-tests-core";
import { tersAl } from "@/lib/stats-regresyon";

/* ---------- Ortak: katsayı kovaryansıyla en küçük kareler ---------- */

export interface OlsSonucu {
  b: number[];
  se: number[];
  /** Katsayı kovaryans matrisi (MSE · (X'X)⁻¹). */
  kov: number[][];
  sse: number;
  df: number;
  rKare: number;
}

export function ols(y: number[], X: number[][]): OlsSonucu | null {
  const n = y.length;
  const p = X[0]?.length ?? 0;
  if (n <= p) return null;
  const xtx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < p; j += 1) {
      xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k += 1) xtx[j][k] += X[i][j] * X[i][k];
    }
  }
  const ters = tersAl(xtx);
  if (!ters) return null;
  const b = ters.map((r) => r.reduce((t, v, j) => t + v * xty[j], 0));
  let sse = 0;
  for (let i = 0; i < n; i += 1) sse += (y[i] - X[i].reduce((t, x, j) => t + x * b[j], 0)) ** 2;
  const ort = mean(y);
  const sst = y.reduce((t, v) => t + (v - ort) ** 2, 0);
  const df = n - p;
  const mse = sse / df;
  const kov = ters.map((r) => r.map((v) => v * mse));
  return { b, se: kov.map((r, i) => Math.sqrt(r[i])), kov, sse, df, rKare: sst > 0 ? 1 - sse / sst : NaN };
}

const tasarim = (sutunlar: number[][]) => sutunlar[0].map((_, i) => [1, ...sutunlar.map((s) => s[i])]);

/* Tohumlu üretici (mulberry32): aynı tohum, aynı örnekler. */
export function tohumluRastgele(tohum: number) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function yuzdelik(sirali: number[], q: number) {
  const konum = (sirali.length - 1) * q;
  const alt = Math.floor(konum);
  const ust = Math.ceil(konum);
  return sirali[alt] + (sirali[ust] - sirali[alt]) * (konum - alt);
}

/* ---------- Aracılık ---------- */

export interface Yol {
  b: number;
  se: number;
  t: number;
  p: number;
}

export interface AracilikSonucu {
  n: number;
  a: Yol;
  b: Yol;
  c: Yol;
  cUs: Yol;
  dolayli: number;
  bootAlt: number;
  bootUst: number;
  bootSE: number;
  bootOrnek: number;
  sobelZ: number;
  sobelP: number;
  /** Tamamen standartlaştırılmış dolaylı etki: a·b · SS(X) / SS(Y). */
  standartDolayli: number;
  /** M ve Y modellerinin R²'si. */
  rKareM: number;
  rKareY: number;
}

const yol = (r: OlsSonucu, j: number): Yol => {
  const t = r.b[j] / r.se[j];
  return { b: r.b[j], se: r.se[j], t, p: tTestTwoTailedP(Math.abs(t), r.df) };
};

export const BOOTSTRAP_ORNEK = 5000;
export const BOOTSTRAP_TOHUM = 20261027;

export function aracilik(
  x: number[],
  m: number[],
  y: number[],
  kovaryatlar: number[][] = [],
  ornekSayisi = BOOTSTRAP_ORNEK,
): AracilikSonucu | null {
  const n = x.length;
  if (n < kovaryatlar.length + 5) return null;
  const modelM = ols(m, tasarim([x, ...kovaryatlar]));
  const modelY = ols(y, tasarim([x, m, ...kovaryatlar]));
  const modelC = ols(y, tasarim([x, ...kovaryatlar]));
  if (!modelM || !modelY || !modelC) return null;
  const a = yol(modelM, 1);
  const b = yol(modelY, 2);
  const dolayli = a.b * b.b;

  const rastgele = tohumluRastgele(BOOTSTRAP_TOHUM);
  const dagilim: number[] = [];
  const xs = new Array<number>(n);
  const ms = new Array<number>(n);
  const ys = new Array<number>(n);
  const ks = kovaryatlar.map(() => new Array<number>(n));
  for (let r = 0; r < ornekSayisi; r += 1) {
    for (let i = 0; i < n; i += 1) {
      const s = Math.floor(rastgele() * n);
      xs[i] = x[s];
      ms[i] = m[s];
      ys[i] = y[s];
      kovaryatlar.forEach((k, j) => (ks[j][i] = k[s]));
    }
    const rm = ols(ms, tasarim([xs, ...ks]));
    const ry = ols(ys, tasarim([xs, ms, ...ks]));
    if (rm && ry) dagilim.push(rm.b[1] * ry.b[2]);
  }
  dagilim.sort((p, q) => p - q);
  const bootOrt = mean(dagilim);
  const sobelSE = Math.sqrt(b.b ** 2 * a.se ** 2 + a.b ** 2 * b.se ** 2);
  const sobelZ = dolayli / sobelSE;

  return {
    n,
    a,
    b,
    c: yol(modelC, 1),
    cUs: yol(modelY, 1),
    dolayli,
    bootAlt: yuzdelik(dagilim, 0.025),
    bootUst: yuzdelik(dagilim, 0.975),
    bootSE: Math.sqrt(dagilim.reduce((t, v) => t + (v - bootOrt) ** 2, 0) / (dagilim.length - 1)),
    bootOrnek: dagilim.length,
    sobelZ,
    sobelP: 2 * (1 - normalCDF(Math.abs(sobelZ))),
    standartDolayli: (dolayli * sd(x)) / sd(y),
    rKareM: modelM.rKare,
    rKareY: modelY.rKare,
  };
}

/* ---------- Çoklu aracı: paralel (Model 4) ve seri (Model 6) ---------- */

/*
  ÇOKLU ARACI (27.10.2026). Tezlerde aracı çoğu zaman tek değil:
  - PARALEL (PROCESS Model 4, k aracı): X her aracıyı ayrı etkiler,
    aracılar birbirini etkilemez. Her aracının özgül dolaylı etkisi
    a_j·b_j; toplam dolaylı etki bunların toplamı. Özgül etkilerin
    farkı (karşıtlık) "hangi aracı daha güçlü" sorusunu yanıtlar.
  - SERİ (PROCESS Model 6, 2–4 aracı): X → M1 → M2 → Y zinciri; her
    aracı kendinden öncekilerle de yordanır. Dolaylı yollar aracıların
    sıralı her alt kümesi: 2 aracıda 3, 3 aracıda 7, 4 aracıda 15 yol.

  Her yolun ve karşıtlığın anlamlılığı aynı tohumlu yüzdelik bootstrap'la
  (tek aracılı analizle aynı ilke). Tek aracılı analiz `aracilik`
  olarak kalıyor; bu fonksiyon iki ve daha çok aracı içindir.
*/

export interface DolayliYol {
  /** Yoldaki aracıların indeksleri (sırayla). */
  araciSirasi: number[];
  etki: number;
  bootAlt: number;
  bootUst: number;
  bootSE: number;
}

export interface Karsitlik {
  a: number;
  b: number;
  fark: number;
  bootAlt: number;
  bootUst: number;
}

export interface CokluAracilikSonucu {
  n: number;
  tur: "paralel" | "seri";
  /** a_j: X → M_j. */
  a: Yol[];
  /** d[j][i]: M_i → M_j (yalnızca seride, i < j). */
  d: (Yol | null)[][];
  /** b_j: M_j → Y (X ve diğer aracılar kontrol). */
  b: Yol[];
  c: Yol;
  cUs: Yol;
  yollar: DolayliYol[];
  toplamDolayli: DolayliYol;
  karsitliklar: Karsitlik[];
  bootOrnek: number;
  rKareM: number[];
  rKareY: number;
}

export const SERI_EN_COK = 4;
export const PARALEL_EN_COK = 10;

/* Seride sıralı alt kümeler (boş olmayan), kısa yollar önce; paralelde tekli. */
function yolKumeleri(k: number, tur: "paralel" | "seri"): number[][] {
  if (tur === "paralel") return Array.from({ length: k }, (_, j) => [j]);
  const kumeler: number[][] = [];
  for (let maske = 1; maske < 1 << k; maske += 1) {
    kumeler.push(Array.from({ length: k }, (_, j) => j).filter((j) => maske & (1 << j)));
  }
  return kumeler.sort((x, y) => x.length - y.length || x.join().localeCompare(y.join()));
}

/* Tek bir veri kümesinde (asıl ya da bootstrap) bütün katsayılar. */
function cokluKatsayilar(x: number[], ms: number[][], y: number[], kovaryatlar: number[][], tur: "paralel" | "seri") {
  const k = ms.length;
  const modeller: OlsSonucu[] = [];
  for (let j = 0; j < k; j += 1) {
    const oncekiler = tur === "seri" ? ms.slice(0, j) : [];
    const r = ols(ms[j], tasarim([x, ...oncekiler, ...kovaryatlar]));
    if (!r) return null;
    modeller.push(r);
  }
  const modelY = ols(y, tasarim([x, ...ms, ...kovaryatlar]));
  if (!modelY) return null;
  const a = modeller.map((r) => r.b[1]);
  /* d[j][i] = M_i'nin M_j modelindeki katsayısı (sütun 2 + i). */
  const d = modeller.map((r, j) => Array.from({ length: k }, (_, i) => (tur === "seri" && i < j ? r.b[2 + i] : 0)));
  const b = Array.from({ length: k }, (_, j) => modelY.b[2 + j]);
  return { modeller, modelY, a, d, b };
}

function yolEtkisi(kume: number[], a: number[], d: number[][], b: number[]) {
  let etki = a[kume[0]];
  for (let t = 1; t < kume.length; t += 1) etki *= d[kume[t]][kume[t - 1]];
  return etki * b[kume[kume.length - 1]];
}

export function cokluAracilik(
  x: number[],
  ms: number[][],
  y: number[],
  tur: "paralel" | "seri",
  kovaryatlar: number[][] = [],
  ornekSayisi = BOOTSTRAP_ORNEK,
): CokluAracilikSonucu | null {
  const n = x.length;
  const k = ms.length;
  if (k < 2 || (tur === "seri" && k > SERI_EN_COK) || k > PARALEL_EN_COK) return null;
  if (n < k + kovaryatlar.length + 5) return null;
  const asil = cokluKatsayilar(x, ms, y, kovaryatlar, tur);
  const modelC = ols(y, tasarim([x, ...kovaryatlar]));
  if (!asil || !modelC) return null;
  const kumeler = yolKumeleri(k, tur);
  const etkiler = kumeler.map((km) => yolEtkisi(km, asil.a, asil.d, asil.b));
  const toplam = etkiler.reduce((t, e) => t + e, 0);
  const ciftler: [number, number][] = [];
  for (let i = 0; i < kumeler.length; i += 1) for (let j = i + 1; j < kumeler.length; j += 1) ciftler.push([i, j]);

  /* Bootstrap: her örnekte yollar, toplam ve karşıtlıklar. */
  const rastgele = tohumluRastgele(BOOTSTRAP_TOHUM);
  const dagYol: number[][] = kumeler.map(() => []);
  const dagToplam: number[] = [];
  const dagKarsit: number[][] = ciftler.map(() => []);
  const xs = new Array<number>(n);
  const yss = new Array<number>(n);
  const mss = ms.map(() => new Array<number>(n));
  const kss = kovaryatlar.map(() => new Array<number>(n));
  for (let r = 0; r < ornekSayisi; r += 1) {
    for (let i = 0; i < n; i += 1) {
      const s = Math.floor(rastgele() * n);
      xs[i] = x[s];
      yss[i] = y[s];
      for (let j = 0; j < k; j += 1) mss[j][i] = ms[j][s];
      for (let j = 0; j < kovaryatlar.length; j += 1) kss[j][i] = kovaryatlar[j][s];
    }
    const kt = cokluKatsayilar(xs, mss, yss, kss, tur);
    if (!kt) continue;
    const e = kumeler.map((km) => yolEtkisi(km, kt.a, kt.d, kt.b));
    e.forEach((v, i) => dagYol[i].push(v));
    dagToplam.push(e.reduce((t, v) => t + v, 0));
    ciftler.forEach(([i, j], c) => dagKarsit[c].push(e[i] - e[j]));
  }
  const ozet = (dagilim: number[]) => {
    const sirali = [...dagilim].sort((p, q) => p - q);
    const ort = mean(sirali);
    return {
      bootAlt: yuzdelik(sirali, 0.025),
      bootUst: yuzdelik(sirali, 0.975),
      bootSE: Math.sqrt(sirali.reduce((t, v) => t + (v - ort) ** 2, 0) / (sirali.length - 1)),
    };
  };

  return {
    n,
    tur,
    a: asil.modeller.map((r) => yol(r, 1)),
    d: asil.modeller.map((r, j) => Array.from({ length: k }, (_, i) => (tur === "seri" && i < j ? yol(r, 2 + i) : null))),
    b: Array.from({ length: k }, (_, j) => yol(asil.modelY, 2 + j)),
    c: yol(modelC, 1),
    cUs: yol(asil.modelY, 1),
    yollar: kumeler.map((km, i) => ({ araciSirasi: km, etki: etkiler[i], ...ozet(dagYol[i]) })),
    toplamDolayli: { araciSirasi: [], etki: toplam, ...ozet(dagToplam) },
    karsitliklar: ciftler.map(([i, j], c) => {
      const o = ozet(dagKarsit[c]);
      return { a: i, b: j, fark: etkiler[i] - etkiler[j], bootAlt: o.bootAlt, bootUst: o.bootUst };
    }),
    bootOrnek: dagToplam.length,
    rKareM: asil.modeller.map((r) => r.rKare),
    rKareY: asil.modelY.rKare,
  };
}

/* ---------- Düzenleyicilik ---------- */

export interface KosulluEtki {
  /** W'nin değeri (özgün ölçekte). */
  w: number;
  etiket: string;
  etki: number;
  se: number;
  t: number;
  p: number;
  alt: number;
  ust: number;
}

export interface DuzenleyicilikSonucu {
  n: number;
  df: number;
  /** Merkezlenmiş modelin katsayıları: sabit, X, W, X·W. */
  katsayilar: (Yol & { ad: string })[];
  rKare: number;
  /** Etkileşimin eklediği açıklama: R²(tam) − R²(etkileşimsiz). */
  deltaRKare: number;
  deltaF: number;
  deltaP: number;
  kosullu: KosulluEtki[];
  /** Johnson-Neyman: X'in etkisinin anlamlılığının değiştiği W değerleri (gözlenen aralıkta). */
  jnSinirlari: number[];
  wAralik: [number, number];
}

export function duzenleyicilik(x: number[], w: number[], y: number[], kovaryatlar: number[][] = []): DuzenleyicilikSonucu | null {
  const n = x.length;
  if (n < kovaryatlar.length + 6) return null;
  const xOrt = mean(x);
  const wOrt = mean(w);
  const xc = x.map((v) => v - xOrt);
  const wc = w.map((v) => v - wOrt);
  const xw = xc.map((v, i) => v * wc[i]);
  const tam = ols(y, tasarim([xc, wc, xw, ...kovaryatlar]));
  const etkilesimsiz = ols(y, tasarim([xc, wc, ...kovaryatlar]));
  if (!tam || !etkilesimsiz) return null;

  const adlar = ["(Sabit)", "X", "W", "X × W"];
  const katsayilar = adlar.map((ad, j) => ({ ad, ...yol(tam, j) }));
  const deltaRKare = tam.rKare - etkilesimsiz.rKare;
  const deltaF = (etkilesimsiz.sse - tam.sse) / (tam.sse / tam.df);
  const kritik = tKritik(tam.df);

  const [b1, b3] = [tam.b[1], tam.b[3]];
  const [v11, v33, v13] = [tam.kov[1][1], tam.kov[3][3], tam.kov[1][3]];
  const kosul = (wDeger: number, etiket: string): KosulluEtki => {
    const d = wDeger - wOrt;
    const etki = b1 + b3 * d;
    const se = Math.sqrt(v11 + d * d * v33 + 2 * d * v13);
    const t = etki / se;
    return { w: wDeger, etiket, etki, se, t, p: tTestTwoTailedP(Math.abs(t), tam.df), alt: etki - kritik * se, ust: etki + kritik * se };
  };
  /* İki değerli W (ör. 0/1 cinsiyet) kendi değerlerinde; sürekli W'de ortalama ± 1 SS. */
  const farkli = [...new Set(w)].sort((p, q) => p - q);
  const wSd = sd(w);
  const kosullu =
    farkli.length === 2
      ? farkli.map((v) => kosul(v, `W = ${v}`))
      : [kosul(wOrt - wSd, "Ortalama − 1 SS"), kosul(wOrt, "Ortalama"), kosul(wOrt + wSd, "Ortalama + 1 SS")];

  /*
    Johnson-Neyman: (b1 + b3·d)² = t²·(v11 + 2d·v13 + d²·v33) denkleminin
    kökleri; d = W − ortalama. Yalnızca gözlenen W aralığındakiler.
  */
  const t2 = kritik * kritik;
  const A = b3 * b3 - t2 * v33;
  const B = 2 * (b1 * b3 - t2 * v13);
  const C = b1 * b1 - t2 * v11;
  const wMin = Math.min(...w);
  const wMax = Math.max(...w);
  const kokler: number[] = [];
  if (Math.abs(A) > 1e-12) {
    const disk = B * B - 4 * A * C;
    if (disk >= 0) for (const s of [-1, 1]) kokler.push((-B + s * Math.sqrt(disk)) / (2 * A));
  } else if (Math.abs(B) > 1e-12) kokler.push(-C / B);
  const jnSinirlari = farkli.length === 2 ? [] : kokler.map((d) => d + wOrt).filter((v) => v >= wMin && v <= wMax).sort((p, q) => p - q);

  return {
    n,
    df: tam.df,
    katsayilar,
    rKare: tam.rKare,
    deltaRKare,
    deltaF,
    deltaP: tTestTwoTailedP(Math.sqrt(Math.max(0, deltaF)), tam.df),
    kosullu,
    jnSinirlari,
    wAralik: [wMin, wMax],
  };
}
