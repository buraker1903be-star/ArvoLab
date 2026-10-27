/*
  PARAMETRİK OLMAYAN TESTLER (25.10.2026).

  Varsayım şeridi (lib/stats-varsayim) "dağılım normalden uzak;
  parametrik olmayan karşılığı daha uygun olabilir" diyordu ama
  program o testi YAPAMIYORDU. Öneri, karşılığı sunulmadığında
  kullanıcıyı çıkmaza sokar: ya aracı bırakıp SPSS'e döner ya da
  uyarıyı yok sayıp parametrik sonucu kullanır. İkisi de kötü.

  Bu testler sıralara (rank) dayanıyor, değerlerin kendisine değil;
  bu yüzden uç değerden ve çarpıklıktan etkilenmiyorlar.

  BAĞLI DEĞERLER (ties) HER ÜÇ TESTTE DE DÜZELTİLİYOR. Likert
  verisinde bağ kuraldır, istisna değil: "1–5 arası katılım"
  ölçeğinde yüzlerce gözlem beş değere düşüyor. Düzeltme
  yapılmazsa varyans olduğundan büyük hesaplanır, z küçülür ve
  gerçek bir fark anlamsız görünür.

  Saf modül; testi tests/unit/stats-parametrik-olmayan.test.ts.
*/
import { mean, pearsonCorrelation, type CorrelationResult } from "@/lib/stats-tests-core";
import { chiSquareP, normalIkiKuyrukP } from "@/lib/stats-math";

export type SiraSonucu = {
  /** Girdiyle aynı sıradaki sıra numaraları; bağlılar ortalama sıra alır. */
  siralar: number[];
  /** Σ(t³ − t): bağ düzeltmesinin payı. Bağ yoksa 0. */
  bagDuzeltmesi: number;
};

/**
 * Ortalama sıra numaraları. Bağlı değerler aynı (ortalama) sırayı
 * alır; aksi hâlde sıralama girdinin rastgele sırasına bağlı olurdu
 * ve aynı veri iki farklı sonuç verirdi.
 */
export function siralandir(degerler: number[]): SiraSonucu {
  const sirali = degerler.map((deger, i) => ({ deger, i })).sort((a, b) => a.deger - b.deger);
  const siralar = new Array<number>(degerler.length);
  let bagDuzeltmesi = 0;

  let bas = 0;
  while (bas < sirali.length) {
    let son = bas;
    while (son + 1 < sirali.length && sirali[son + 1].deger === sirali[bas].deger) son += 1;
    const uzunluk = son - bas + 1;
    /* Sıra numaraları 1'den başlıyor; bağlı grubun ortalaması. */
    const ortalamaSira = (bas + 1 + son + 1) / 2;
    for (let k = bas; k <= son; k += 1) siralar[sirali[k].i] = ortalamaSira;
    if (uzunluk > 1) bagDuzeltmesi += uzunluk ** 3 - uzunluk;
    bas = son + 1;
  }
  return { siralar, bagDuzeltmesi };
}

export interface MannWhitneySonucu {
  u: number;
  n1: number;
  n2: number;
  /** Grup sıra ortalamaları — raporlamada U'dan daha okunur. */
  siraOrtalamasi1: number;
  siraOrtalamasi2: number;
  z: number;
  p: number;
  /** r = |z| / √N; sıralara dayalı etki büyüklüğü. */
  etki: number;
}

/*
  Büyük örneklem (normal) yaklaşıklığı kullanılıyor; KESİN dağılım
  değil. Küçük örneklemde (n < 8) yaklaşıklık sapıyor ve bunu
  çağıran kullanıcıya söylemeli — sessizce yaklaşık bir p vermek,
  kesin sanılan bir sayı üretmek olurdu.
*/
export const YAKLASIKLIK_EN_AZ = 8;

export function mannWhitneyU(grup1: number[], grup2: number[]): MannWhitneySonucu {
  const n1 = grup1.length;
  const n2 = grup2.length;
  const N = n1 + n2;
  const { siralar, bagDuzeltmesi } = siralandir([...grup1, ...grup2]);

  const siralar1 = siralar.slice(0, n1);
  const siralar2 = siralar.slice(n1);
  const R1 = siralar1.reduce((t, x) => t + x, 0);

  const u1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);

  const ortalamaU = (n1 * n2) / 2;
  /* Bağ düzeltmeli varyans: bağ yoksa terim sıfır ve formül klasik
     hâline iniyor. */
  const varyans = ((n1 * n2) / 12) * (N + 1 - bagDuzeltmesi / (N * (N - 1)));
  const z = varyans > 0 ? (u - ortalamaU) / Math.sqrt(varyans) : NaN;

  return {
    u,
    n1,
    n2,
    siraOrtalamasi1: mean(siralar1),
    siraOrtalamasi2: mean(siralar2),
    z,
    p: normalIkiKuyrukP(z),
    etki: Number.isFinite(z) ? Math.abs(z) / Math.sqrt(N) : NaN,
  };
}

export interface KruskalWallisSonucu {
  h: number;
  df: number;
  p: number;
  siraOrtalamalari: number[];
  /** ε² = H / (N − 1); sıralara dayalı etki büyüklüğü. */
  epsilonKare: number;
}

export function kruskalWallis(gruplar: number[][]): KruskalWallisSonucu {
  const hepsi = gruplar.flat();
  const N = hepsi.length;
  const { siralar, bagDuzeltmesi } = siralandir(hepsi);

  let indis = 0;
  const siraOrtalamalari: number[] = [];
  let toplam = 0;
  for (const grup of gruplar) {
    const kendi = siralar.slice(indis, indis + grup.length);
    indis += grup.length;
    const R = kendi.reduce((t, x) => t + x, 0);
    siraOrtalamalari.push(mean(kendi));
    toplam += (R * R) / grup.length;
  }

  const hamH = (12 / (N * (N + 1))) * toplam - 3 * (N + 1);
  /* Bağ düzeltmesi H'yi BÜYÜTÜR: bağlar varyansı düşürdüğü için
     düzeltilmemiş H olduğundan küçük çıkar ve gerçek fark
     kaçırılır. */
  const bolen = 1 - bagDuzeltmesi / (N ** 3 - N);
  const h = bolen > 0 ? hamH / bolen : NaN;
  const df = gruplar.length - 1;

  return {
    h,
    df,
    p: chiSquareP(h, df),
    siraOrtalamalari,
    epsilonKare: N > 1 ? h / (N - 1) : NaN,
  };
}

/**
 * Spearman sıra korelasyonu: sıralar üzerinde Pearson.
 *
 * "Kısayol" formülü (1 − 6Σd²/(n³−n)) BİLEREK kullanılmıyor; o formül
 * bağ olmadığını varsayıyor ve Likert verisinde yanlış sonuç veriyor.
 * Sıralara Pearson uygulamak bağlarda da doğru.
 */
export function spearmanKorelasyonu(x: number[], y: number[]): CorrelationResult {
  return pearsonCorrelation(siralandir(x).siralar, siralandir(y).siralar);
}

export interface WilcoxonSonucu {
  /** Pozitif farkların (sonra > önce) sıra toplamı. */
  wArti: number;
  /** Negatif farkların sıra toplamı. */
  wEksi: number;
  /** Raporlanan istatistik: küçük sıra toplamı (SPSS'in T'si). */
  t: number;
  /** Eşleşen çift sayısı (sıfır farklar dahil). */
  n: number;
  /** Sıfır olmayan fark sayısı: testin gerçekte kullandığı çiftler. */
  nEtkin: number;
  artiSayisi: number;
  eksiSayisi: number;
  esitSayisi: number;
  z: number;
  p: number;
  /** r = |z| / √n; sıralara dayalı etki büyüklüğü. */
  etki: number;
}

/*
  WILCOXON İŞARETLİ SIRALAR TESTİ (27.10.2026). Eşleştirilmiş t-testinin
  parametrik olmayan karşılığı: ön test–son test deseninde farklar normal
  dağılmıyorsa. Program eşleştirilmiş t-testini yapıyor, varsayım şeridi
  farkların normalden uzak olduğunu söylüyordu ama karşılığı yoktu —
  Mann-Whitney'nin eklenme gerekçesinin aynısı.

  SIFIR FARKLAR ATILIR (Wilcoxon'un özgün yöntemi, SPSS de böyle):
  önce = sonra olan çift hiçbir yöne kanıt değil. Sayıları raporda
  "eşit" olarak ayrıca yazılıyor.

  Fark yönü SPSS'teki gibi SONRA − ÖNCE. Bağ düzeltmeli normal
  yaklaşıklık; küçük örneklemde (nEtkin < YAKLASIKLIK_EN_AZ) çağıran
  uyarmalı.
*/
export function wilcoxonIsaretliSiralar(once: number[], sonra: number[]): WilcoxonSonucu {
  const n = Math.min(once.length, sonra.length);
  const farklar: number[] = [];
  let esitSayisi = 0;
  for (let i = 0; i < n; i += 1) {
    const d = sonra[i] - once[i];
    if (d === 0) esitSayisi += 1;
    else farklar.push(d);
  }
  const nEtkin = farklar.length;
  const { siralar, bagDuzeltmesi } = siralandir(farklar.map(Math.abs));
  let wArti = 0;
  let wEksi = 0;
  let artiSayisi = 0;
  farklar.forEach((d, i) => {
    if (d > 0) {
      wArti += siralar[i];
      artiSayisi += 1;
    } else wEksi += siralar[i];
  });
  const t = Math.min(wArti, wEksi);
  const ortalama = (nEtkin * (nEtkin + 1)) / 4;
  const varyans = (nEtkin * (nEtkin + 1) * (2 * nEtkin + 1)) / 24 - bagDuzeltmesi / 48;
  const z = nEtkin > 0 && varyans > 0 ? (t - ortalama) / Math.sqrt(varyans) : NaN;
  return {
    wArti,
    wEksi,
    t,
    n,
    nEtkin,
    artiSayisi,
    eksiSayisi: nEtkin - artiSayisi,
    esitSayisi,
    z,
    p: normalIkiKuyrukP(z),
    etki: Number.isFinite(z) && n > 0 ? Math.abs(z) / Math.sqrt(n) : NaN,
  };
}

export interface FriedmanSonucu {
  chiKare: number;
  df: number;
  p: number;
  /** Katılımcı (satır) sayısı. */
  n: number;
  /** Her ölçümün ortalama sırası (1..k). */
  siraOrtalamalari: number[];
  /** Kendall W = χ² / (n(k − 1)); 0–1 arası uyum/etki büyüklüğü. */
  kendallW: number;
}

/*
  FRIEDMAN TESTİ (27.10.2026): üç ve daha çok TEKRARLI ölçüm (ön test,
  son test, izleme testi) — Kruskal-Wallis'in bağımlı ölçüm karşılığı.
  Sıralama HER KATILIMCININ KENDİ İÇİNDE yapılır; katılımcılar arası
  düzey farkı testi etkilemez.

  `olcumler` sütun sütun verilir (her dizi bir ölçüm, satırlar
  hizalı — çağıran eslesenSatirlar ile hizalar). Bağ düzeltmesi Likert
  verisinde şart (bkz. dosya başı).
*/
export function friedmanTesti(olcumler: number[][]): FriedmanSonucu {
  const k = olcumler.length;
  const n = k ? Math.min(...olcumler.map((o) => o.length)) : 0;
  const siraToplamlari = new Array<number>(k).fill(0);
  let bagToplami = 0;
  for (let i = 0; i < n; i += 1) {
    const { siralar, bagDuzeltmesi } = siralandir(olcumler.map((o) => o[i]));
    siralar.forEach((s, j) => (siraToplamlari[j] += s));
    bagToplami += bagDuzeltmesi;
  }
  const df = k - 1;
  const ham = n > 0 && k > 1
    ? (12 / (n * k * (k + 1))) * siraToplamlari.reduce((t, r) => t + r * r, 0) - 3 * n * (k + 1)
    : NaN;
  const bolen = n > 0 && k > 1 ? 1 - bagToplami / (n * (k ** 3 - k)) : 0;
  const chiKare = bolen > 0 ? ham / bolen : NaN;
  return {
    chiKare,
    df,
    p: chiSquareP(chiKare, df),
    n,
    siraOrtalamalari: siraToplamlari.map((r) => (n ? r / n : NaN)),
    kendallW: n > 0 && k > 1 && Number.isFinite(chiKare) ? chiKare / (n * (k - 1)) : NaN,
  };
}
