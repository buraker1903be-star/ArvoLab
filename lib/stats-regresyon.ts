/*
  DOĞRUSAL REGRESYON (25.10.2026).

  Makalelerin ve tezlerin belkemiği olan analiz programda HİÇ yoktu:
  kullanıcı "X, Y'yi yorduyor mu" sorusunu soramıyor, korelasyonla
  idare etmeye çalışıyordu. Korelasyon ilişkinin GÜCÜNÜ söyler,
  YÖNÜNÜ ve büyüklüğünü ("X bir birim artınca Y ne kadar artar")
  söylemez.

  En küçük kareler çözümü normal denklemlerden: β = (X'X)⁻¹X'y.
  Ters alma Gauss eliminasyonuyla ve KISMİ PİVOTLAMAYLA yapılıyor —
  pivotsuz eliminasyon, sütunlar ölçek olarak farklıysa (yaş 20–70,
  gelir 10.000–90.000 gibi, ki bu veride kuraldır) sayısal olarak
  dağılıyor ve katsayılar sessizce bozuluyor.

  ÇOKLU DOĞRUSALLIK SESSİZ GEÇİLMİYOR. İki yordayıcı birbirinin
  neredeyse aynısıysa X'X tekil olur; böyle bir durumda sayı
  üretmek, anlamsız katsayıları güvenilir göstermek olurdu.
  `tekil` bayrağıyla açıkça söyleniyor.

  Saf modül; testi tests/unit/stats-regresyon.test.ts.
*/
import { mean, sd } from "@/lib/stats-tests-core";
import { fTestP, tTestTwoTailedP } from "@/lib/stats-math";
import type { Dil } from "@/lib/dil";

export interface Katsayi {
  /** Değişken adı; sabit terim için "(Sabit)". */
  ad: string;
  b: number;
  standartHata: number;
  /** Standartlaştırılmış katsayı (β); sabit terimde tanımsız. */
  beta: number;
  t: number;
  p: number;
}

export interface RegresyonSonucu {
  n: number;
  /** Yordayıcı sayısı (sabit terim hariç). */
  k: number;
  katsayilar: Katsayi[];
  rKare: number;
  duzeltilmisRKare: number;
  f: number;
  dfb: number;
  dfw: number;
  p: number;
  /** X'X tersi alınamadı: yordayıcılar birbirinin neredeyse aynısı. */
  tekil: boolean;
}

/** Gauss eliminasyonu + kısmi pivotlama ile matris tersi; tekilse null. */
export function tersAl(m: number[][]): number[][] | null {
  const n = m.length;
  /* Genişletilmiş matris: [A | I] */
  const a = m.map((satir, i) => [...satir, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let sutun = 0; sutun < n; sutun += 1) {
    /* KISMİ PİVOTLAMA: en büyük mutlak değerli satır öne alınıyor.
       Pivotsuz eliminasyon ölçek farkı olan sütunlarda sayısal
       olarak dağılıyor ve katsayılar sessizce bozuluyor. */
    let enIyi = sutun;
    for (let satir = sutun + 1; satir < n; satir += 1) {
      if (Math.abs(a[satir][sutun]) > Math.abs(a[enIyi][sutun])) enIyi = satir;
    }
    if (Math.abs(a[enIyi][sutun]) < 1e-10) return null; // tekil
    [a[sutun], a[enIyi]] = [a[enIyi], a[sutun]];

    const pivot = a[sutun][sutun];
    for (let j = 0; j < 2 * n; j += 1) a[sutun][j] /= pivot;

    for (let satir = 0; satir < n; satir += 1) {
      if (satir === sutun) continue;
      const carpan = a[satir][sutun];
      if (carpan === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) a[satir][j] -= carpan * a[sutun][j];
    }
  }
  return a.map((satir) => satir.slice(n));
}

/*
  SABİT TERİMİN ADI bir ANAHTAR olarak da kullanılıyor: ekran
  `ad === "(Sabit)"` ile sabiti anlamlılık vurgusundan ve Exp(B) güven
  aralığından ayırıyor (regresyon, lojistik, düzenleyicilik). O yüzden
  sonuç nesnesinde dile göre DEĞİŞMİYOR; ekranda gösterilecek ad
  `katsayiAdi` ile seçilir (28.10.2026).
*/
export const SABIT_TERIM = "(Sabit)";

/** Katsayı adının ekrandaki yazımı: sabit terim çevrilir, değişken adları olduğu gibi. */
export function katsayiAdi(ad: string, dil: Dil = "tr"): string {
  return ad === SABIT_TERIM && dil === "en" ? "(Constant)" : ad;
}

const bosSonuc = (n: number, k: number, adlar: string[]): RegresyonSonucu => ({
  n,
  k,
  katsayilar: ["(Sabit)", ...adlar].map((ad) => ({
    ad, b: NaN, standartHata: NaN, beta: NaN, t: NaN, p: NaN,
  })),
  rKare: NaN,
  duzeltilmisRKare: NaN,
  f: NaN,
  dfb: k,
  dfw: n - k - 1,
  p: NaN,
  tekil: true,
});

/**
 * En küçük kareler regresyonu. `yordayicilar` sütun sütun verilir;
 * tek sütun verilirse basit doğrusal regresyon olur.
 */
export function dogrusalRegresyon(
  y: number[],
  yordayicilar: number[][],
  adlar: string[],
): RegresyonSonucu {
  const n = y.length;
  const k = yordayicilar.length;

  /*
    Serbestlik derecesi n − k − 1 ve bu POZİTİF olmalı: gözlem
    sayısı yordayıcı sayısından fazla değilse model veriyi birebir
    ezberler, hata kareleri sıfır çıkar ve bütün p değerleri
    anlamını yitirir.
  */
  if (n < k + 2) return bosSonuc(n, k, adlar);

  /* Tasarım matrisi: ilk sütun sabit terim. */
  const X = Array.from({ length: n }, (_, i) => [1, ...yordayicilar.map((sutun) => sutun[i])]);
  const p = k + 1;

  const XtX = Array.from({ length: p }, (_, a) =>
    Array.from({ length: p }, (_, b) => X.reduce((t, satir) => t + satir[a] * satir[b], 0)),
  );
  const Xty = Array.from({ length: p }, (_, a) => X.reduce((t, satir, i) => t + satir[a] * y[i], 0));

  const ters = tersAl(XtX);
  if (!ters) return bosSonuc(n, k, adlar);

  const b = ters.map((satir) => satir.reduce((t, deger, j) => t + deger * Xty[j], 0));

  const yOrt = mean(y);
  const tahmin = X.map((satir) => satir.reduce((t, deger, j) => t + deger * b[j], 0));
  const sse = y.reduce((t, deger, i) => t + (deger - tahmin[i]) ** 2, 0);
  const sst = y.reduce((t, deger) => t + (deger - yOrt) ** 2, 0);
  const ssr = sst - sse;

  const dfw = n - k - 1;
  const mse = sse / dfw;
  const rKare = sst === 0 ? NaN : ssr / sst;

  const ySS = sd(y);
  const katsayilar: Katsayi[] = b.map((deger, j) => {
    const standartHata = Math.sqrt(Math.max(0, mse * ters[j][j]));
    const t = standartHata === 0 ? NaN : deger / standartHata;
    return {
      ad: j === 0 ? "(Sabit)" : (adlar[j - 1] ?? `X${j}`),
      b: deger,
      standartHata,
      /* Standartlaştırılmış katsayı yordayıcıları aynı ölçeğe
         indiriyor; ham b'ler farklı birimlerde olduğu için
         "hangisi daha etkili" sorusu ancak bununla yanıtlanır. */
      beta: j === 0 || ySS === 0 ? NaN : (deger * sd(yordayicilar[j - 1])) / ySS,
      t,
      p: Number.isFinite(t) ? tTestTwoTailedP(Math.abs(t), dfw) : NaN,
    };
  });

  const f = mse === 0 || k === 0 ? NaN : ssr / k / mse;

  return {
    n,
    k,
    katsayilar,
    rKare,
    /* Düzeltilmiş R²: yordayıcı eklemek R²'yi HER ZAMAN büyütür,
       işe yaramayanı bile. Düzeltilmiş olan bunu cezalandırıyor. */
    duzeltilmisRKare: Number.isFinite(rKare) ? 1 - ((1 - rKare) * (n - 1)) / dfw : NaN,
    f,
    dfb: k,
    dfw,
    p: Number.isFinite(f) ? fTestP(f, k, dfw) : NaN,
    tekil: false,
  };
}

/*
  Bir TASARIM MATRİSİ için artık kareler toplamı (SSE).

  İki yönlü ANOVA, her etkinin kareler toplamını MODEL KARŞILAŞTIRMASIYLA
  buluyor: terim modelden çıkarılınca SSE ne kadar büyüyor. O yüzden
  "katsayılar" değil doğrudan SSE gerekiyor.

  Matris tersi burada da tersAl ile alınıyor; ikinci bir Gauss
  eliminasyonu yazmak, aynı hatayı iki yerde düzeltmek demekti.

  `X` sabit terim sütununu KENDİSİ taşır (ilk sütun hep 1). Tekil
  matriste null döner — çağıran "hesaplanamadı" demeli, sayı
  uydurmamalı.
*/
export function artikKareToplami(y: number[], X: number[][]): number | null {
  return enKucukKareler(y, X)?.sse ?? null;
}

/*
  En küçük kareler: katsayılar ve artık kareler toplamı. ANCOVA'nın
  düzeltilmiş ortalamaları katsayıyı da istiyor (27.10.2026); SSE'yi
  hesaplayan gövde buraya taşındı, artikKareToplami onu çağırıyor.
*/
export function enKucukKareler(y: number[], X: number[][]): { b: number[]; sse: number } | null {
  const n = y.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0) return null;

  const xtx: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const xty: number[] = Array(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < p; j += 1) {
      xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k += 1) xtx[j][k] += X[i][j] * X[i][k];
    }
  }
  const ters = tersAl(xtx);
  if (!ters) return null;

  const b = ters.map((satir) => satir.reduce((toplam, deger, j) => toplam + deger * xty[j], 0));
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    let tahmin = 0;
    for (let j = 0; j < p; j += 1) tahmin += X[i][j] * b[j];
    sse += (y[i] - tahmin) ** 2;
  }
  return { b, sse };
}
