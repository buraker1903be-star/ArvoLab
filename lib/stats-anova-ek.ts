/*
  ANOVA AİLESİNİN EKSİKLERİ (27.10.2026): tek örneklem t-testi,
  tekrarlı ölçümler ANOVA ve ANCOVA.

  - Tek örneklem: "ölçek ortalaması orta nokta (3) üzerinde mi" —
    Likert tezlerinin en sık sorusu; program yapamıyordu.
  - Tekrarlı ölçümler ANOVA: ön test / son test / izleme deseninin
    parametrik testi. Friedman vardı, parametrik karşılığı yoktu.
    Küresellik (Mauchly) ve Greenhouse-Geisser / Huynh-Feldt
    düzeltmesi birlikte: küresellik bozulduğunda düzeltilmemiş F fazla
    cömert ve SPSS çıktısını okuyan jüri ilk onu soruyor.
  - ANCOVA: deneysel tezlerde ön testi kontrol ederek son test
    karşılaştırması. Düzeltilmiş ortalamalar ve eğim homojenliği
    (varsayım) birlikte.

  Doğrulama bağımsız uygulamaya karşı: pingouin (rm_anova, sphericity,
  ancova, ttest) — beklenen değerler test dosyasında.

  Saf modül; testi tests/unit/stats-anova-ek.test.ts.
*/
import { chiSquareCDF as chiKareCDF, fTestP, tKritik, tTestTwoTailedP } from "@/lib/stats-math";
import { eslestirilmisTTest, mean, sd } from "@/lib/stats-tests-core";
import { enKucukKareler } from "@/lib/stats-regresyon";

/* ---------- Tek örneklem t-testi ---------- */

export interface TekOrneklemSonucu {
  n: number;
  ortalama: number;
  ss: number;
  testDegeri: number;
  t: number;
  df: number;
  p: number;
  /** Cohen d = (ortalama − test değeri) / SS. */
  d: number;
  /** Farkın %95 güven aralığı. */
  altSinir: number;
  ustSinir: number;
}

export function tekOrneklemTTest(dizi: number[], testDegeri: number): TekOrneklemSonucu {
  const n = dizi.length;
  const ortalama = mean(dizi);
  const ss = sd(dizi);
  const se = ss / Math.sqrt(n);
  const fark = ortalama - testDegeri;
  const t = se === 0 ? NaN : fark / se;
  const df = n - 1;
  const kritik = tKritik(df);
  return {
    n,
    ortalama,
    ss,
    testDegeri,
    t,
    df,
    p: Number.isFinite(t) ? tTestTwoTailedP(Math.abs(t), df) : NaN,
    d: ss === 0 ? NaN : fark / ss,
    altSinir: fark - kritik * se,
    ustSinir: fark + kritik * se,
  };
}

/* ---------- Küçük matris yardımcıları ---------- */

function determinant(m: number[][]): number {
  const a = m.map((r) => [...r]);
  const n = a.length;
  let det = 1;
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < 1e-14) return 0;
    if (pivot !== c) {
      [a[pivot], a[c]] = [a[c], a[pivot]];
      det = -det;
    }
    det *= a[c][c];
    for (let r = c + 1; r < n; r += 1) {
      const k = a[r][c] / a[c][c];
      for (let j = c; j < n; j += 1) a[r][j] -= k * a[c][j];
    }
  }
  return det;
}

const carp = (a: number[][], b: number[][]) =>
  a.map((satir) => b[0].map((_, j) => satir.reduce((t, x, k) => t + x * b[k][j], 0)));
const devrik = (a: number[][]) => a[0].map((_, j) => a.map((r) => r[j]));
const iz = (a: number[][]) => a.reduce((t, r, i) => t + r[i], 0);

/* Ortonormal Helmert karşıtları ((k−1) × k): küresellik bunlar üzerinden ölçülür. */
function helmert(k: number): number[][] {
  return Array.from({ length: k - 1 }, (_, i) => {
    const satir = new Array<number>(k).fill(0);
    const m = i + 1;
    const olcek = Math.sqrt(m * (m + 1));
    for (let j = 0; j < m; j += 1) satir[j] = 1 / olcek;
    satir[m] = -m / olcek;
    return satir;
  });
}

/* ---------- Tekrarlı ölçümler ANOVA ---------- */

export interface TekrarliAnovaSonucu {
  n: number;
  k: number;
  ortalamalar: number[];
  ssOlcum: number;
  ssHata: number;
  df1: number;
  df2: number;
  f: number;
  p: number;
  /** Kısmi η² = SS_ölçüm / (SS_ölçüm + SS_hata). */
  kismiEtaKare: number;
  /** Mauchly W; k = 2'de küresellik tanım gereği sağlanır (W = 1). */
  mauchlyW: number;
  mauchlyChi: number;
  mauchlyDf: number;
  mauchlyP: number;
  ggEpsilon: number;
  hfEpsilon: number;
  /** Greenhouse-Geisser düzeltmeli p (df'ler ε ile çarpılır). */
  ggP: number;
  hfP: number;
}

/**
 * `olcumler` sütun sütun; satırlar hizalı (aynı kişi) olmalı —
 * çağıran eslesenSatirlar ile hizalar.
 */
export function tekrarliOlcumlerAnova(olcumler: number[][]): TekrarliAnovaSonucu {
  const k = olcumler.length;
  const n = Math.min(...olcumler.map((o) => o.length));
  const ortalamalar = olcumler.map((o) => mean(o.slice(0, n)));
  const genel = mean(ortalamalar);
  const kisiOrt = Array.from({ length: n }, (_, i) => mean(olcumler.map((o) => o[i])));
  let ssToplam = 0;
  for (const o of olcumler) for (let i = 0; i < n; i += 1) ssToplam += (o[i] - genel) ** 2;
  const ssOlcum = n * ortalamalar.reduce((t, m) => t + (m - genel) ** 2, 0);
  const ssKisi = k * kisiOrt.reduce((t, m) => t + (m - genel) ** 2, 0);
  const ssHata = ssToplam - ssOlcum - ssKisi;
  const df1 = k - 1;
  const df2 = (k - 1) * (n - 1);
  const f = ssHata > 0 ? ssOlcum / df1 / (ssHata / df2) : NaN;
  const p = Number.isFinite(f) ? fTestP(f, df1, df2) : NaN;

  /* Kovaryans matrisi (n − 1) ve karşıtlar üzerinden küresellik. */
  const S = olcumler.map((a, i) =>
    olcumler.map((b, j) => {
      let t = 0;
      for (let r = 0; r < n; r += 1) t += (a[r] - ortalamalar[i]) * (b[r] - ortalamalar[j]);
      return t / (n - 1);
    }),
  );
  const C = helmert(k);
  const M = carp(carp(C, S), devrik(C));
  const izM = iz(M);
  const pp = k - 1;
  const ggEpsilon = izM ** 2 / (pp * iz(carp(M, M)));
  const hfHam = (n * pp * ggEpsilon - 2) / (pp * (n - 1 - pp * ggEpsilon));
  const hfEpsilon = Math.min(1, Math.max(ggEpsilon, hfHam));

  let mauchlyW = 1;
  let mauchlyChi = 0;
  let mauchlyP = 1;
  const mauchlyDf = (pp * (pp + 1)) / 2 - 1;
  if (k > 2) {
    mauchlyW = determinant(M) / (izM / pp) ** pp;
    const d = 1 - (2 * pp * pp + pp + 2) / (6 * pp * (n - 1));
    mauchlyChi = -(n - 1) * d * Math.log(mauchlyW);
    mauchlyP = Number.isFinite(mauchlyChi) ? 1 - chiKareCDF(mauchlyChi, mauchlyDf) : NaN;
  }

  return {
    n,
    k,
    ortalamalar,
    ssOlcum,
    ssHata,
    df1,
    df2,
    f,
    p,
    kismiEtaKare: ssOlcum + ssHata > 0 ? ssOlcum / (ssOlcum + ssHata) : NaN,
    mauchlyW,
    mauchlyChi,
    mauchlyDf,
    mauchlyP,
    ggEpsilon,
    hfEpsilon,
    ggP: Number.isFinite(f) ? fTestP(f, df1 * ggEpsilon, df2 * ggEpsilon) : NaN,
    hfP: Number.isFinite(f) ? fTestP(f, df1 * hfEpsilon, df2 * hfEpsilon) : NaN,
  };
}


/** Ölçüm çiftleri: eşleştirilmiş t, Bonferroni düzeltmeli. */
export function tekrarliIkiliKarsilastirmalar(olcumler: number[][], adlar: string[]) {
  const k = olcumler.length;
  const sayi = (k * (k - 1)) / 2;
  const ciftler: { a: string; b: string; fark: number; t: number; p: number; anlamli: boolean }[] = [];
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      const r = eslestirilmisTTest(olcumler[i], olcumler[j]);
      const p = Number.isFinite(r.p) ? Math.min(1, r.p * sayi) : NaN;
      ciftler.push({ a: adlar[i], b: adlar[j], fark: r.farkOrtalamasi, t: r.t, p, anlamli: Number.isFinite(p) && p < 0.05 });
    }
  }
  return ciftler;
}

/* ---------- ANCOVA ---------- */

export interface AncovaEtkisi {
  ad: string;
  ss: number;
  df: number;
  f: number;
  p: number;
  kismiEtaKare: number;
}

export interface AncovaSonucu {
  n: number;
  gruplar: string[];
  grupNleri: number[];
  hamOrtalamalar: number[];
  /** Kovaryatların genel ortalamasında düzeltilmiş ortalamalar. */
  duzeltilmisOrtalamalar: number[];
  etkiler: AncovaEtkisi[];
  hataSS: number;
  hataDf: number;
  /** Eğim homojenliği (grup × kovaryat): anlamlıysa ANCOVA varsayımı bozuk. */
  egimF: number;
  egimDf1: number;
  egimDf2: number;
  egimP: number;
}

export type AncovaHata = "az-grup" | "az-gozlem" | "tekil";

/**
 * `gozlemler`: her biri bir kişi — grup etiketi, bağımlı değişken,
 * kovaryat değerleri (sırası `kovaryatAdlari` ile aynı).
 */
export function ancova(
  gozlemler: { grup: string; y: number; kovaryatlar: number[] }[],
  kovaryatAdlari: string[],
  grupAdi = "Grup",
): AncovaSonucu | AncovaHata {
  const gruplar = [...new Set(gozlemler.map((g) => g.grup))];
  const k = gruplar.length;
  const c = kovaryatAdlari.length;
  const n = gozlemler.length;
  if (k < 2) return "az-grup";
  if (n <= k + c + 1) return "az-gozlem";

  const y = gozlemler.map((g) => g.y);
  const kukla = (g: string) => gruplar.slice(1).map((ad) => (g === ad ? 1 : 0));
  const tasarim = (grupVar: boolean, kovaryatlar: number[], etkilesim = false) =>
    gozlemler.map((g) => {
      const satir = [1];
      if (grupVar) satir.push(...kukla(g.grup));
      for (const i of kovaryatlar) satir.push(g.kovaryatlar[i]);
      if (etkilesim) for (const i of kovaryatlar) for (const d of kukla(g.grup)) satir.push(d * g.kovaryatlar[i]);
      return satir;
    });

  const hepsi = kovaryatAdlari.map((_, i) => i);
  const tam = enKucukKareler(y, tasarim(true, hepsi));
  const grupsuz = enKucukKareler(y, tasarim(false, hepsi));
  if (!tam || !grupsuz) return "tekil";
  const hataDf = n - k - c;
  const hataSS = tam.sse;
  const mse = hataSS / hataDf;

  const etki = (ad: string, ss: number, df: number): AncovaEtkisi => {
    const f = ss / df / mse;
    return { ad, ss, df, f, p: fTestP(f, df, hataDf), kismiEtaKare: ss / (ss + hataSS) };
  };
  const etkiler: AncovaEtkisi[] = [];
  for (const i of hepsi) {
    const kovaryatsiz = enKucukKareler(y, tasarim(true, hepsi.filter((j) => j !== i)));
    if (!kovaryatsiz) return "tekil";
    etkiler.push(etki(kovaryatAdlari[i], kovaryatsiz.sse - hataSS, 1));
  }
  etkiler.push(etki(grupAdi, grupsuz.sse - hataSS, k - 1));

  /* Düzeltilmiş ortalama: sabit + grup kuklası + Σ b·(kovaryatın genel ortalaması). */
  const kovOrt = hepsi.map((i) => mean(gozlemler.map((g) => g.kovaryatlar[i])));
  const b = tam.b;
  const kovaryatKatkisi = hepsi.reduce((t, i) => t + b[k + i] * kovOrt[i], 0);
  const duzeltilmisOrtalamalar = gruplar.map((_, j) => b[0] + (j > 0 ? b[j] : 0) + kovaryatKatkisi);

  const etkilesimli = enKucukKareler(y, tasarim(true, hepsi, true));
  const egimDf1 = c * (k - 1);
  const egimDf2 = n - k - c - egimDf1;
  let egimF = NaN;
  let egimP = NaN;
  if (etkilesimli && egimDf2 > 0 && etkilesimli.sse > 0) {
    egimF = (hataSS - etkilesimli.sse) / egimDf1 / (etkilesimli.sse / egimDf2);
    egimP = fTestP(egimF, egimDf1, egimDf2);
  }

  return {
    n,
    gruplar,
    grupNleri: gruplar.map((ad) => gozlemler.filter((g) => g.grup === ad).length),
    hamOrtalamalar: gruplar.map((ad) => mean(gozlemler.filter((g) => g.grup === ad).map((g) => g.y))),
    duzeltilmisOrtalamalar,
    etkiler,
    hataSS,
    hataDf,
    egimF,
    egimDf1,
    egimDf2,
    egimP,
  };
}
