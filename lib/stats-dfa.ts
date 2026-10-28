/*
  DOĞRULAYICI FAKTÖR ANALİZİ (DFA) — en çok olabilirlik (27.10.2026).

  Ölçek uyarlama tezlerinin ikinci adımı: AFA'nın bulduğu (ya da özgün
  ölçeğin önerdiği) yapı veride doğrulanıyor mu. Öğrenci bunun için AMOS
  ya da LISREL'e gidiyordu; ArvoLab yalnızca açımlayıcı analizi yapıyordu.

  MODEL: her madde yalnızca bir faktöre yüklenir (basit yapı), faktör
  varyansları 1'e sabit (standart gizil değişken), faktörler arası
  ilişkiler serbest, hatalar ilişkisiz. Σ(θ) = Λ Φ Λᵀ + Θ.

  KESTİRİM: F_ML = ln|Σ| + iz(S Σ⁻¹) − ln|S| − p; analitik gradyanla BFGS
  ve geri izlemeli adım. S yansız kovaryans (n − 1), χ² = (N − 1)·F_min —
  AMOS ve LISREL'in kuralı (lavaan N kullanır; fark yüzde birin altında
  ve tezlerde AMOS çıktısı beklendiği için bu seçildi).

  UYUM İNDEKSLERİ: χ², sd, χ²/sd, CFI, TLI, RMSEA, SRMR, GFI, AGFI.
  Standart hatalar sayısal Hessian'dan (Cov = 2/(N − 1) · H⁻¹).
  Standartlaştırılmış yükler (std.all), Bileşik Güvenirlik (CR) ve
  Açıklanan Ortalama Varyans (AVE).

  NEGATİF HATA VARYANSI (Heywood) SESSİZ GEÇİLMİYOR: kestirim
  tamamlanır ama sonuç bunu açıkça yazar — model tanımı ya da örneklem
  sorunlu demektir; AMOS da uyarır.

  DEĞİŞİKLİK İNDEKSLERİ (MI, 27.10.2026): modelde sabit (sıfır) duran iki
  tür parametre için — maddenin başka bir faktöre yüklenmesi ve iki
  maddenin hatasının ilişkilendirilmesi. MI, o parametre serbest
  bırakılsa χ²'nin yaklaşık ne kadar düşeceğidir (Sörbom, 1989; skor
  testi): MI = (N − 1)/4 · g² / V, g = ∂F/∂τ, V beklenen bilgi
  matrisinde τ'nun diğer parametrelerden arındırılmış payı. Yanında
  beklenen parametre değişimi (EPC) ve standartlaştırılmışı. Hata
  kovaryansı modele eklenebilir (hataKovaryanslari); çapraz yük
  basit yapıyı bozduğu için yalnızca bilgi olarak gösterilir.

  Doğrulama semopy'ye (bağımsız SEM uygulaması) karşı: standart yükler,
  faktör korelasyonları ve F_min; indeksler aynı F'ten formülle (test
  dosyasında).

  Saf modül; testi tests/unit/stats-dfa.test.ts.
*/
import type { Dil, Metin } from "@/lib/dil";
import { chiSquareP } from "@/lib/stats-math";
import { normalCDF } from "@/lib/stats-tukey";
import { mean } from "@/lib/stats-tests-core";
import { tersAl } from "@/lib/stats-regresyon";

type Matris = number[][];

/* Cholesky: pozitif tanımlı değilse null. */
function cholesky(A: Matris): Matris | null {
  const n = A.length;
  const L: Matris = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let t = A[i][j];
      for (let k = 0; k < j; k += 1) t -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(t > 1e-12)) return null;
        L[i][i] = Math.sqrt(t);
      } else L[i][j] = t / L[j][j];
    }
  }
  return L;
}

function logDet(A: Matris): number | null {
  const L = cholesky(A);
  if (!L) return null;
  return 2 * L.reduce((t, r, i) => t + Math.log(r[i]), 0);
}

const carp = (A: Matris, B: Matris): Matris => A.map((r) => B[0].map((_, j) => r.reduce((t, v, k) => t + v * B[k][j], 0)));
const devrik = (A: Matris): Matris => A[0].map((_, j) => A.map((r) => r[j]));

export interface DfaModeli {
  /** Faktör adları. */
  faktorler: string[];
  /** Her madde için faktör indeksi (madde sırası veri sütunlarıyla aynı). */
  maddeFaktoru: number[];
  /** Serbest bırakılmış hata kovaryansları: madde indeks çiftleri (i < j). */
  hataKovaryanslari?: [number, number][];
}

interface Parametreler {
  lambda: number[]; // madde başına
  phi: number[]; // faktör çiftleri (i<j)
  theta: number[]; // madde başına
  psi: number[]; // serbest hata kovaryansları
}

function coz(model: DfaModeli, v: number[]): Parametreler {
  const p = model.maddeFaktoru.length;
  const m = model.faktorler.length;
  const ciftSayisi = (m * (m - 1)) / 2;
  const t0 = p + ciftSayisi;
  return { lambda: v.slice(0, p), phi: v.slice(p, t0), theta: v.slice(t0, t0 + p), psi: v.slice(t0 + p) };
}

function phiMatrisi(m: number, phi: number[]): Matris {
  const P: Matris = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)));
  let k = 0;
  for (let i = 0; i < m; i += 1) for (let j = i + 1; j < m; j += 1) P[i][j] = P[j][i] = phi[k++];
  return P;
}

function lambdaMatrisi(model: DfaModeli, lambda: number[]): Matris {
  const m = model.faktorler.length;
  return model.maddeFaktoru.map((f, i) => Array.from({ length: m }, (_, k) => (k === f ? lambda[i] : 0)));
}

function sigma(model: DfaModeli, par: Parametreler): Matris {
  const L = lambdaMatrisi(model, par.lambda);
  const S = carp(carp(L, phiMatrisi(model.faktorler.length, par.phi)), devrik(L));
  const Sig = S.map((r, i) => r.map((v, j) => (i === j ? v + par.theta[i] : v)));
  (model.hataKovaryanslari ?? []).forEach(([i, j], k) => {
    Sig[i][j] += par.psi[k];
    Sig[j][i] += par.psi[k];
  });
  return Sig;
}

/* F_ML ve gradyanı; Σ pozitif tanımlı değilse null. */
function amacVeGradyan(model: DfaModeli, S: Matris, logDetS: number, v: number[]): { f: number; g: number[] } | null {
  const p = S.length;
  const m = model.faktorler.length;
  const par = coz(model, v);
  const Sig = sigma(model, par);
  const ld = logDet(Sig);
  if (ld === null) return null;
  const Si = tersAl(Sig);
  if (!Si) return null;
  const SiS = carp(Si, S);
  const f = ld + SiS.reduce((t, r, i) => t + r[i], 0) - logDetS - p;
  /* D = Σ⁻¹ − Σ⁻¹ S Σ⁻¹ */
  const SiSSi = carp(SiS, Si);
  const D = Si.map((r, i) => r.map((x, j) => x - SiSSi[i][j]));
  const L = lambdaMatrisi(model, par.lambda);
  const Phi = phiMatrisi(m, par.phi);
  const DLPhi = carp(carp(D, L), Phi);
  const gLambda = model.maddeFaktoru.map((f2, i) => 2 * DLPhi[i][f2]);
  const LtDL = carp(carp(devrik(L), D), L);
  const gPhi: number[] = [];
  for (let i = 0; i < m; i += 1) for (let j = i + 1; j < m; j += 1) gPhi.push(2 * LtDL[i][j]);
  const gTheta = D.map((r, i) => r[i]);
  const gPsi = (model.hataKovaryanslari ?? []).map(([i, j]) => 2 * D[i][j]);
  return { f, g: [...gLambda, ...gPhi, ...gTheta, ...gPsi] };
}

/* BFGS (geri izlemeli Armijo adımı). */
function enKucukle(fg: (v: number[]) => { f: number; g: number[] } | null, v0: number[]) {
  const n = v0.length;
  let v = [...v0];
  let cur = fg(v);
  if (!cur) return null;
  let H: Matris = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  let yakinsadi = false;
  for (let it = 0; it < 3000; it += 1) {
    const yon = H.map((r) => -r.reduce((t, h, j) => t + h * cur!.g[j], 0));
    let egim = yon.reduce((t, d, i) => t + d * cur!.g[i], 0);
    if (egim >= 0) {
      H = H.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
      for (let i = 0; i < n; i += 1) yon[i] = -cur.g[i];
      egim = -cur.g.reduce((t, x) => t + x * x, 0);
    }
    let adim = 1;
    let yeni: { f: number; g: number[] } | null = null;
    let vYeni = v;
    for (let k = 0; k < 60; k += 1) {
      vYeni = v.map((x, i) => x + adim * yon[i]);
      yeni = fg(vYeni);
      if (yeni && yeni.f <= cur.f + 1e-4 * adim * egim) break;
      yeni = null;
      adim /= 2;
    }
    if (!yeni) break;
    const s = vYeni.map((x, i) => x - v[i]);
    const y = yeni.g.map((x, i) => x - cur!.g[i]);
    const sy = s.reduce((t, x, i) => t + x * y[i], 0);
    const fFark = cur.f - yeni.f;
    v = vYeni;
    cur = yeni;
    if (Math.max(...cur.g.map(Math.abs)) < 1e-8 || fFark < 1e-14) {
      yakinsadi = Math.max(...cur.g.map(Math.abs)) < 1e-5;
      break;
    }
    if (sy > 1e-12) {
      const Hy = H.map((r) => r.reduce((t, h, j) => t + h * y[j], 0));
      const yHy = y.reduce((t, x, i) => t + x * Hy[i], 0);
      H = H.map((r, i) =>
        r.map((h, j) => h + ((sy + yHy) * s[i] * s[j]) / (sy * sy) - (Hy[i] * s[j] + s[i] * Hy[j]) / sy),
      );
    }
  }
  return { v, f: cur.f, yakinsadi };
}

export interface DfaYuk {
  madde: string;
  faktor: string;
  /** Standartlaştırılmamış yük (faktör varyansı 1). */
  b: number;
  se: number;
  z: number;
  p: number;
  /** Standartlaştırılmış yük (std.all). */
  std: number;
  /** Hata varyansı. */
  hata: number;
}

export interface DfaSonucu {
  n: number;
  maddeSayisi: number;
  parametreSayisi: number;
  chiKare: number;
  df: number;
  p: number;
  chiKareDf: number;
  cfi: number;
  tli: number;
  rmsea: number;
  srmr: number;
  gfi: number;
  agfi: number;
  fMin: number;
  yukler: DfaYuk[];
  /** Faktörler arası korelasyonlar [i][j]. */
  faktorKorelasyonlari: number[][];
  cr: number[];
  ave: number[];
  /** Negatif hata varyansı olan maddeler. */
  heywood: string[];
  yakinsadi: boolean;
  /** Modelde serbest bırakılmış hata kovaryansları (kestirimleriyle). */
  hataKovaryanslari: { i: number; j: number; a: string; b: string; kov: number; r: number; se: number; p: number }[];
  /** Değişiklik indeksleri, büyükten küçüğe. */
  degisiklikIndeksleri: DegisiklikIndeksi[];
}

export interface DegisiklikIndeksi {
  tur: "hata-kovaryansi" | "capraz-yuk";
  /** Hata kovaryansında madde indeksleri; çapraz yükte [madde, faktör]. */
  i: number;
  j: number;
  etiket: string;
  mi: number;
  /** Beklenen parametre değişimi ve standartlaştırılmışı (std.all). */
  epc: number;
  sepc: number;
}

/* MI eşiği: χ²(1) için %5 kritik değer; daha küçük öneriler gösterilmez. */
export const MI_ESIGI = 3.84;

export type DfaHata = "az-madde" | "az-gozlem" | "tanimsiz" | "kestirilemedi";

/* `dil` yalnızca değişiklik indekslerinin etiketindeki ekleri ("(hata)") seçer. */
export function dogrulayiciFaktorAnalizi(
  maddeler: number[][],
  maddeAdlari: string[],
  model: DfaModeli,
  dil: Dil = "tr",
): DfaSonucu | DfaHata {
  const p = maddeler.length;
  const n = maddeler[0]?.length ?? 0;
  const m = model.faktorler.length;
  if (p < 3) return "az-madde";
  if (n <= p) return "az-gozlem";
  /* Her faktörde en az iki madde; tek maddeli faktör (ve tek faktörde < 3 madde) tanımlanamaz. */
  const faktorMadde = model.faktorler.map((_, k) => model.maddeFaktoru.filter((f) => f === k).length);
  if (faktorMadde.some((s) => s < 2) || (m === 1 && p < 3)) return "tanimsiz";

  const ort = maddeler.map(mean);
  const S: Matris = maddeler.map((a, i) =>
    maddeler.map((b, j) => {
      let t = 0;
      for (let r = 0; r < n; r += 1) t += (a[r] - ort[i]) * (b[r] - ort[j]);
      return t / (n - 1);
    }),
  );
  const logDetS = logDet(S);
  if (logDetS === null) return "kestirilemedi";

  const hk = model.hataKovaryanslari ?? [];
  const q = p + (m * (m - 1)) / 2 + p + hk.length;
  const df = (p * (p + 1)) / 2 - q;
  if (df < 0) return "tanimsiz";

  const v0 = [
    ...S.map((r, i) => Math.sqrt(r[i] * 0.5)),
    ...new Array<number>((m * (m - 1)) / 2).fill(0.3),
    ...S.map((r, i) => r[i] * 0.5),
    ...hk.map(() => 0),
  ];
  const fg = (v: number[]) => amacVeGradyan(model, S, logDetS, v);
  const sonuc = enKucukle(fg, v0);
  if (!sonuc) return "kestirilemedi";
  const v = sonuc.v;
  const par = coz(model, v);
  const Sig = sigma(model, par);
  const Si = tersAl(Sig);
  if (!Si) return "kestirilemedi";

  const N1 = n - 1;
  const chiKare = N1 * sonuc.f;
  /* Bağımsızlık (taban) modeli: Σ = diag(S). */
  const fTaban = S.reduce((t, r, i) => t + Math.log(r[i]), 0) - logDetS;
  const chiTaban = N1 * fTaban;
  const dfTaban = (p * (p - 1)) / 2;
  const cfiPay = Math.max(chiKare - df, 0);
  const cfiPayda = Math.max(chiKare - df, chiTaban - dfTaban, 0);
  const cfi = cfiPayda > 0 ? 1 - cfiPay / cfiPayda : 1;
  const tli = df > 0 ? (chiTaban / dfTaban - chiKare / df) / (chiTaban / dfTaban - 1) : NaN;
  const rmsea = df > 0 ? Math.sqrt(Math.max((chiKare - df) / (df * N1), 0)) : 0;
  let srmrToplam = 0;
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) srmrToplam += ((S[i][j] - Sig[i][j]) / Math.sqrt(S[i][i] * S[j][j])) ** 2;
  }
  const srmr = Math.sqrt(srmrToplam / ((p * (p + 1)) / 2));
  const SiS = carp(Si, S);
  const iz = (A: Matris) => A.reduce((t, r, i) => t + r[i], 0);
  const A1 = SiS.map((r, i) => r.map((x, j) => x - (i === j ? 1 : 0)));
  const gfi = 1 - iz(carp(A1, A1)) / iz(carp(SiS, SiS));
  const agfi = df > 0 ? 1 - ((p * (p + 1)) / (2 * df)) * (1 - gfi) : NaN;

  /* Standart hatalar: analitik gradyandan merkezi farkla Hessian. */
  const H: Matris = Array.from({ length: q }, () => new Array<number>(q).fill(0));
  let hessianTamam = true;
  for (let i = 0; i < q; i += 1) {
    const h = 1e-5 * Math.max(1, Math.abs(v[i]));
    const arti = fg(v.map((x, k) => (k === i ? x + h : x)));
    const eksi = fg(v.map((x, k) => (k === i ? x - h : x)));
    if (!arti || !eksi) {
      hessianTamam = false;
      break;
    }
    for (let j = 0; j < q; j += 1) H[i][j] = (arti.g[j] - eksi.g[j]) / (2 * h);
  }
  const Hs = H.map((r, i) => r.map((x, j) => (x + H[j][i]) / 2));
  const Hters = hessianTamam ? tersAl(Hs) : null;
  const se = (i: number) => (Hters && Hters[i][i] > 0 ? Math.sqrt((2 / N1) * Hters[i][i]) : NaN);

  const yukler: DfaYuk[] = model.maddeFaktoru.map((f, i) => {
    const b = par.lambda[i];
    const s = se(i);
    const z = b / s;
    return {
      madde: maddeAdlari[i],
      faktor: model.faktorler[f],
      b,
      se: s,
      z,
      p: Number.isFinite(z) ? 2 * (1 - normalCDF(Math.abs(z))) : NaN,
      std: b / Math.sqrt(Sig[i][i]),
      hata: par.theta[i],
    };
  });
  /* İşaret: bir faktörün yüklerinin çoğu negatifse faktör ters dönmüş demektir; çevir (yorum değişmez). */
  const isaret = model.faktorler.map((_, k) => {
    const t = yukler.filter((_, i) => model.maddeFaktoru[i] === k).reduce((s2, y) => s2 + y.b, 0);
    return t < 0 ? -1 : 1;
  });
  for (let i = 0; i < p; i += 1) {
    const k = model.maddeFaktoru[i];
    yukler[i].b *= isaret[k];
    yukler[i].std *= isaret[k];
    yukler[i].z *= isaret[k];
  }
  const Phi = phiMatrisi(m, par.phi).map((r, i) => r.map((x, j) => x * isaret[i] * isaret[j]));

  const cr: number[] = [];
  const ave: number[] = [];
  for (let k = 0; k < m; k += 1) {
    const std = yukler.filter((_, i) => model.maddeFaktoru[i] === k).map((y) => y.std);
    const top = std.reduce((t, x) => t + x, 0);
    const hata = std.reduce((t, x) => t + (1 - x * x), 0);
    cr.push((top * top) / (top * top + hata));
    ave.push(std.reduce((t, x) => t + x * x, 0) / std.length);
  }

  return {
    n,
    maddeSayisi: p,
    parametreSayisi: q,
    chiKare,
    df,
    p: df > 0 ? chiSquareP(chiKare, df) : NaN,
    chiKareDf: df > 0 ? chiKare / df : NaN,
    cfi,
    tli,
    rmsea,
    srmr,
    gfi,
    agfi,
    fMin: sonuc.f,
    yukler,
    faktorKorelasyonlari: Phi,
    cr,
    ave,
    heywood: yukler.filter((y) => y.hata < 0).map((y) => y.madde),
    yakinsadi: sonuc.yakinsadi,
    hataKovaryanslari: hk.map(([i, j], k) => {
      const kov = par.psi[k];
      const s2 = se(p + (m * (m - 1)) / 2 + p + k);
      const z = kov / s2;
      return {
        i,
        j,
        a: maddeAdlari[i],
        b: maddeAdlari[j],
        kov,
        r: kov / Math.sqrt(par.theta[i] * par.theta[j]),
        se: s2,
        p: Number.isFinite(z) ? 2 * (1 - normalCDF(Math.abs(z))) : NaN,
      };
    }),
    degisiklikIndeksleri: degisiklikIndeksleri(model, par, Sig, Si, S, N1, maddeAdlari, dil).map((d) =>
      d.tur === "capraz-yuk" ? { ...d, epc: d.epc * isaret[d.j], sepc: d.sepc * isaret[d.j] } : d,
    ),
  };
}

/*
  DEĞİŞİKLİK İNDEKSLERİ. Her serbest ve aday parametre için ∂Σ/∂θ
  matrisleri kurulur; beklenen bilgi I_ab = ½ iz(Σ⁻¹ ∂Σ_a Σ⁻¹ ∂Σ_b).
  Aday τ için V = I_ττ − I_τθ I_θθ⁻¹ I_θτ, g = iz(D ∂Σ_τ),
  MI = (N − 1)/4 · g²/V, EPC = −(g/2)/V.
*/
function degisiklikIndeksleri(
  model: DfaModeli,
  par: Parametreler,
  Sig: Matris,
  Si: Matris,
  S: Matris,
  N1: number,
  maddeAdlari: string[],
  dil: Dil,
): DegisiklikIndeksi[] {
  const en = dil === "en";
  const p = Sig.length;
  const m = model.faktorler.length;
  const L = lambdaMatrisi(model, par.lambda);
  const LPhi = carp(L, phiMatrisi(m, par.phi));
  const SiS = carp(Si, S);
  const SiSSi = carp(SiS, Si);
  const D = Si.map((r, i) => r.map((x, j) => x - SiSSi[i][j]));

  const bos = (): Matris => Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const yukTurevi = (i: number, k: number) => {
    const A = bos();
    for (let j = 0; j < p; j += 1) {
      A[i][j] += LPhi[j][k];
      A[j][i] += LPhi[j][k];
    }
    return A;
  };
  const ciftTurevi = (i: number, j: number) => {
    const A = bos();
    A[i][j] += 1;
    A[j][i] += 1;
    return A;
  };

  /* Serbest parametrelerin türevleri (kestirimdeki sırayla). */
  const serbest: Matris[] = [];
  model.maddeFaktoru.forEach((k, i) => serbest.push(yukTurevi(i, k)));
  for (let a = 0; a < m; a += 1) {
    for (let b = a + 1; b < m; b += 1) {
      const A = bos();
      for (let i = 0; i < p; i += 1) for (let j = 0; j < p; j += 1) A[i][j] = L[i][a] * L[j][b] + L[i][b] * L[j][a];
      serbest.push(A);
    }
  }
  for (let i = 0; i < p; i += 1) {
    const A = bos();
    A[i][i] = 1;
    serbest.push(A);
  }
  const hk = model.hataKovaryanslari ?? [];
  hk.forEach(([i, j]) => serbest.push(ciftTurevi(i, j)));

  /* B = Σ⁻¹ ∂Σ; I_ab = ½ iz(B_a B_b) = ½ Σ B_a[i][j] B_b[j][i]. */
  const B = (A: Matris) => carp(Si, A);
  const izCarpim = (X: Matris, Y: Matris) => {
    let t = 0;
    for (let i = 0; i < p; i += 1) for (let j = 0; j < p; j += 1) t += X[i][j] * Y[j][i];
    return t;
  };
  const Bs = serbest.map(B);
  const I = Bs.map((x) => Bs.map((y) => 0.5 * izCarpim(x, y)));
  const Iters = tersAl(I);
  if (!Iters) return [];

  const adaylar: { tur: DegisiklikIndeksi["tur"]; i: number; j: number; etiket: string; A: Matris; olcek: number }[] = [];
  const varolan = new Set(hk.map(([i, j]) => `${i}-${j}`));
  for (let i = 0; i < p; i += 1) {
    for (let j = i + 1; j < p; j += 1) {
      if (varolan.has(`${i}-${j}`)) continue;
      adaylar.push({
        tur: "hata-kovaryansi",
        i,
        j,
        etiket: `${maddeAdlari[i]} ↔ ${maddeAdlari[j]} (${en ? "error" : "hata"})`,
        A: ciftTurevi(i, j),
        /* Hata kovaryansının standartlaştırılmışı hataların korelasyonu (lavaan std.all). */
        olcek: 1 / Math.sqrt(par.theta[i] * par.theta[j]),
      });
    }
  }
  for (let i = 0; i < p; i += 1) {
    for (let k = 0; k < m; k += 1) {
      if (k === model.maddeFaktoru[i]) continue;
      adaylar.push({
        tur: "capraz-yuk",
        i,
        j: k,
        etiket: `${model.faktorler[k]} → ${maddeAdlari[i]} (${en ? "cross-loading" : "çapraz yük"})`,
        A: yukTurevi(i, k),
        olcek: 1 / Math.sqrt(Sig[i][i]),
      });
    }
  }

  const sonuc: DegisiklikIndeksi[] = [];
  for (const a of adaylar) {
    const Ba = B(a.A);
    const g = izCarpim(D, a.A);
    const itt = 0.5 * izCarpim(Ba, Ba);
    const it = Bs.map((x) => 0.5 * izCarpim(Ba, x));
    let duzeltme = 0;
    for (let x = 0; x < it.length; x += 1) for (let y = 0; y < it.length; y += 1) duzeltme += it[x] * Iters[x][y] * it[y];
    const V = itt - duzeltme;
    if (!(V > 1e-10)) continue;
    const mi = (N1 / 4) * (g * g) / V;
    const epc = -(g / 2) / V;
    sonuc.push({ tur: a.tur, i: a.i, j: a.j, etiket: a.etiket, mi, epc, sepc: epc * a.olcek });
  }
  return sonuc.sort((x, y) => y.mi - x.mi);
}

/*
  Uyum yorumunun ekrandaki adı. `uyumYorumu` Türkçe anahtar döndürmeye
  devam ediyor (çağıranlar ve testler ona dayanıyor); ekran bu haritadan
  seçer.
*/
export const UYUM_YORUMU_METIN: Record<"iyi" | "kabul edilebilir" | "zayıf", Metin> = {
  iyi: { tr: "iyi", en: "good" },
  "kabul edilebilir": { tr: "kabul edilebilir", en: "acceptable" },
  zayıf: { tr: "zayıf", en: "poor" },
};

/* Yaygın kabul eşikleri (Hu & Bentler, 1999; Kline, 2016) — ekranda değerin yanında. */
export function uyumYorumu(ad: "cfi" | "tli" | "rmsea" | "srmr" | "chiKareDf" | "gfi" | "agfi", deger: number): "iyi" | "kabul edilebilir" | "zayıf" {
  switch (ad) {
    case "cfi":
    case "tli":
      return deger >= 0.95 ? "iyi" : deger >= 0.9 ? "kabul edilebilir" : "zayıf";
    case "gfi":
      return deger >= 0.95 ? "iyi" : deger >= 0.9 ? "kabul edilebilir" : "zayıf";
    case "agfi":
      return deger >= 0.9 ? "iyi" : deger >= 0.85 ? "kabul edilebilir" : "zayıf";
    case "rmsea":
      return deger <= 0.05 ? "iyi" : deger <= 0.08 ? "kabul edilebilir" : "zayıf";
    case "srmr":
      return deger <= 0.05 ? "iyi" : deger <= 0.08 ? "kabul edilebilir" : "zayıf";
    case "chiKareDf":
      return deger <= 3 ? "iyi" : deger <= 5 ? "kabul edilebilir" : "zayıf";
  }
}
