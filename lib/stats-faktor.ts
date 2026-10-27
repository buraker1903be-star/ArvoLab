/*
  AÇIMLAYICI FAKTÖR ANALİZİ (27.10.2026).

  Ölçek geliştirme ve uyarlama tezlerinin olmazsa olmazı: KMO, Bartlett
  küresellik testi, öz değerler, açıklanan varyans ve döndürülmüş faktör
  yükleri. Program yalnızca Cronbach α veriyordu; yapı geçerliği için
  öğrenci SPSS'e dönüyordu.

  YÖNTEM: temel bileşenler + varimax (Kaiser normalleştirmeli) — SPSS'te
  Türkçe tezlerde en sık raporlanan birleşim. Faktör sayısı varsayılan
  olarak öz değeri 1'den büyük olanlar (Kaiser ölçütü); kullanıcı sayıyı
  kendisi de verebilir (yamaç grafiği ya da kuramsal yapı).

  Ekranın kendi yorumu YOK, yalnızca bilinen eşikleri işaretler: yükü
  0,30'un altında kalan madde ve iki faktöre 0,10'dan yakın yüklenen
  (binişik) madde. Hangi maddenin atılacağına öğrenci ve danışmanı
  karar verir.

  Doğrulama: KMO ve Bartlett factor_analyzer'a, öz değerler NumPy'ye,
  döndürülmüş yükler factor_analyzer (principal + varimax) çıktısına
  karşı; işaret ve sıra serbest olduğu için mutlak değerle (test
  dosyasında).

  Saf modül; testi tests/unit/stats-faktor.test.ts.
*/
import { chiSquareP } from "@/lib/stats-math";
import { tersAl } from "@/lib/stats-regresyon";
import { mean } from "@/lib/stats-tests-core";

/* Simetrik matrisin öz değer ve vektörleri (Jacobi), öz değere göre büyükten küçüğe. */
export function ozAyristir(m: number[][]): { degerler: number[]; vektorler: number[][] } {
  const n = m.length;
  const a = m.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let tur = 0; tur < 100; tur += 1) {
    let kosegenDisi = 0;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) kosegenDisi += a[i][j] ** 2;
    if (kosegenDisi < 1e-22) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const teta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(teta || 1) / (Math.abs(teta) + Math.sqrt(teta * teta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const sira = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[y][y] - a[x][x]);
  return { degerler: sira.map((i) => a[i][i]), vektorler: v.map((satir) => sira.map((i) => satir[i])) };
}

function korelasyonMatrisi(maddeler: number[][]): number[][] {
  const ort = maddeler.map(mean);
  const n = maddeler[0].length;
  const ss = maddeler.map((m, i) => Math.sqrt(m.reduce((t, x) => t + (x - ort[i]) ** 2, 0)));
  return maddeler.map((a, i) =>
    maddeler.map((b, j) => {
      if (i === j) return 1;
      let t = 0;
      for (let r = 0; r < n; r += 1) t += (a[r] - ort[i]) * (b[r] - ort[j]);
      return t / (ss[i] * ss[j]);
    }),
  );
}

function determinant(m: number[][]): number {
  const { degerler } = ozAyristir(m);
  return degerler.reduce((t, d) => t * d, 1);
}

/*
  VARIMAX (Kaiser normalleştirmeli): yükleri faktörler arasında
  "ya yüksek ya sıfıra yakın" olacak biçimde döndürür. Klasik ikili
  döndürme (Kaiser 1958); her faktör çifti için en iyi açı kapalı
  formülle bulunur ve değişim kalmayana kadar yinelenir.
*/
export function varimax(yukler: number[][]): number[][] {
  const p = yukler.length;
  const m = yukler[0]?.length ?? 0;
  if (m < 2) return yukler.map((r) => [...r]);
  const h = yukler.map((r) => Math.sqrt(r.reduce((t, x) => t + x * x, 0)) || 1);
  const L = yukler.map((r, i) => r.map((x) => x / h[i]));
  for (let tur = 0; tur < 500; tur += 1) {
    let degisim = 0;
    for (let a = 0; a < m - 1; a += 1) {
      for (let b = a + 1; b < m; b += 1) {
        let A = 0;
        let B = 0;
        let C = 0;
        let D = 0;
        for (let i = 0; i < p; i += 1) {
          const u = L[i][a] ** 2 - L[i][b] ** 2;
          const v = 2 * L[i][a] * L[i][b];
          A += u;
          B += v;
          C += u * u - v * v;
          D += 2 * u * v;
        }
        const pay = D - (2 * A * B) / p;
        const payda = C - (A * A - B * B) / p;
        const aci = Math.atan2(pay, payda) / 4;
        if (Math.abs(aci) < 1e-12) continue;
        degisim = Math.max(degisim, Math.abs(aci));
        const c = Math.cos(aci);
        const s = Math.sin(aci);
        for (let i = 0; i < p; i += 1) {
          const x = L[i][a];
          const y = L[i][b];
          L[i][a] = c * x + s * y;
          L[i][b] = -s * x + c * y;
        }
      }
    }
    if (degisim < 1e-10) break;
  }
  return L.map((r, i) => r.map((x) => x * h[i]));
}

export interface FaktorSonucu {
  n: number;
  maddeSayisi: number;
  kmo: number;
  /** Madde başına örneklem yeterliliği (MSA). */
  maddeKmo: number[];
  bartlettChi: number;
  bartlettDf: number;
  bartlettP: number;
  ozDegerler: number[];
  faktorSayisi: number;
  /** Döndürülmüş yükler: madde × faktör. Faktörler açıklanan varyansa göre sıralı, işaret düzeltilmiş. */
  yukler: number[][];
  /** Ortak varyans (h²). */
  ortakVaryans: number[];
  /** Döndürme sonrası faktör başına açıklanan varyans yüzdesi. */
  aciklananYuzde: number[];
  toplamAciklanan: number;
}

export type FaktorHata = "az-madde" | "az-gozlem" | "tekil";

export const DUSUK_YUK = 0.3;
export const BINISIK_FARK = 0.1;

export function aciklayiciFaktorAnalizi(maddeler: number[][], istenenFaktor?: number): FaktorSonucu | FaktorHata {
  const p = maddeler.length;
  const n = maddeler[0]?.length ?? 0;
  if (p < 3) return "az-madde";
  if (n <= p) return "az-gozlem";
  const R = korelasyonMatrisi(maddeler);
  const Rters = tersAl(R);
  if (!Rters || R.some((r) => r.some((x) => !Number.isFinite(x)))) return "tekil";

  /* KMO: korelasyonların kısmi korelasyonlara göre büyüklüğü. */
  let r2 = 0;
  let a2 = 0;
  const maddeKmo: number[] = [];
  for (let i = 0; i < p; i += 1) {
    let ri = 0;
    let ai = 0;
    for (let j = 0; j < p; j += 1) {
      if (i === j) continue;
      const kismi = -Rters[i][j] / Math.sqrt(Rters[i][i] * Rters[j][j]);
      ri += R[i][j] ** 2;
      ai += kismi ** 2;
    }
    maddeKmo.push(ri / (ri + ai));
    r2 += ri;
    a2 += ai;
  }
  const det = determinant(R);
  const bartlettDf = (p * (p - 1)) / 2;
  const bartlettChi = det > 0 ? -(n - 1 - (2 * p + 5) / 6) * Math.log(det) : NaN;

  const { degerler, vektorler } = ozAyristir(R);
  const kaiser = degerler.filter((d) => d > 1).length;
  const faktorSayisi = Math.max(1, Math.min(p - 1, istenenFaktor && istenenFaktor > 0 ? Math.round(istenenFaktor) : kaiser));
  const hamYukler = Array.from({ length: p }, (_, i) =>
    Array.from({ length: faktorSayisi }, (_, f) => vektorler[i][f] * Math.sqrt(Math.max(0, degerler[f]))),
  );
  const donmus = varimax(hamYukler);

  /* Faktörleri açıklanan varyansa göre sırala; en büyük yükü pozitif olacak biçimde işaretle. */
  const varyans = Array.from({ length: faktorSayisi }, (_, f) => donmus.reduce((t, r) => t + r[f] ** 2, 0));
  const sira = varyans.map((_, f) => f).sort((x, y) => varyans[y] - varyans[x]);
  const isaret = sira.map((f) => {
    const enBuyuk = donmus.reduce((e, r) => (Math.abs(r[f]) > Math.abs(e) ? r[f] : e), 0);
    return enBuyuk < 0 ? -1 : 1;
  });
  const yukler = donmus.map((r) => sira.map((f, k) => r[f] * isaret[k]));
  const aciklananYuzde = sira.map((f) => (varyans[f] / p) * 100);

  return {
    n,
    maddeSayisi: p,
    kmo: r2 / (r2 + a2),
    maddeKmo,
    bartlettChi,
    bartlettDf,
    bartlettP: Number.isFinite(bartlettChi) ? chiSquareP(bartlettChi, bartlettDf) : NaN,
    ozDegerler: degerler,
    faktorSayisi,
    yukler,
    ortakVaryans: yukler.map((r) => r.reduce((t, x) => t + x * x, 0)),
    aciklananYuzde,
    toplamAciklanan: aciklananYuzde.reduce((t, x) => t + x, 0),
  };
}

/** Maddenin uyarı durumu: düşük yük ya da binişik. */
export function maddeUyarisi(satir: number[]): "dusuk" | "binisik" | null {
  const sirali = satir.map(Math.abs).sort((a, b) => b - a);
  if (sirali[0] < DUSUK_YUK) return "dusuk";
  if (sirali.length > 1 && sirali[1] >= DUSUK_YUK && sirali[0] - sirali[1] < BINISIK_FARK) return "binisik";
  return null;
}

/* KMO'nun yaygın (Kaiser) yorum basamakları; ekranda sayının yanında. */
export function kmoYorumu(kmo: number): string {
  if (kmo >= 0.9) return "mükemmel";
  if (kmo >= 0.8) return "çok iyi";
  if (kmo >= 0.7) return "iyi";
  if (kmo >= 0.6) return "orta";
  if (kmo >= 0.5) return "zayıf";
  return "kabul edilemez";
}
