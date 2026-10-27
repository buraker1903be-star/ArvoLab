/*
  PARAMETRİK OLMAYAN TESTLER.

  Varsayım şeridi bunları ÖNERİYORDU ama program yapamıyordu; öneri,
  karşılığı sunulmadığında kullanıcıyı çıkmaza sokar.

  Beklenen değerler ELLE hesaplandı; hesaplar yorumlarda açık.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  friedmanTesti,
  kruskalWallis,
  mannWhitneyU,
  siralandir,
  spearmanKorelasyonu,
  wilcoxonIsaretliSiralar,
} from "@/lib/stats-parametrik-olmayan";

const yakin = (a: number, b: number, tolerans = 1e-3) =>
  assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("sıralama", () => {
  test("bağlı değerler ORTALAMA sırayı alır", () => {
    /*
      [1,2,2,2,3,4] → 1 birinci; üç tane 2, sıra 2-3-4'ü paylaşıyor
      ve ortalaması 3; 3 beşinci, 4 altıncı.
      Bağ grubu uzunluğu 3 → düzeltme 3³ − 3 = 24.
    */
    const { siralar, bagDuzeltmesi } = siralandir([1, 2, 2, 2, 3, 4]);
    assert.deepEqual(siralar, [1, 3, 3, 3, 5, 6]);
    assert.equal(bagDuzeltmesi, 24);
  });

  test("bağ yoksa düzeltme sıfır ve sıra girdinin yerini korur", () => {
    const { siralar, bagDuzeltmesi } = siralandir([30, 10, 20]);
    assert.deepEqual(siralar, [3, 1, 2], "sıra numarası girdinin konumuna yazılır");
    assert.equal(bagDuzeltmesi, 0);
  });
});

describe("Mann-Whitney U", () => {
  test("bağsız ders kitabı örneği", () => {
    /*
      [1,2,3] ve [4,5,6]; birleşik sıralar 1..6
      R1 = 1+2+3 = 6
      U1 = 3×3 + 3×4/2 − 6 = 9 + 6 − 6 = 9 ; U2 = 0 ; U = 0
      ortalama U = 4.5
      varyans = (9/12)(7 − 0) = 5.25 → SS = 2.2913
      z = (0 − 4.5)/2.2913 = −1.9640
    */
    const r = mannWhitneyU([1, 2, 3], [4, 5, 6]);
    assert.equal(r.u, 0);
    yakin(r.z, -1.964);
    yakin(r.siraOrtalamasi1, 2);
    yakin(r.siraOrtalamasi2, 5);
    /* z² = 3.857, df 1 → p ≈ .0495 */
    yakin(r.p, 0.0495, 1e-3);
    /* r = |z|/√6 = 1.964/2.4495 = 0.8018 */
    yakin(r.etki, 0.8018);
  });

  test("BAĞ DÜZELTMESİ varyansı küçültüyor", () => {
    /*
      [1,2,2] ve [2,3,4]: üç tane 2 → sıralar 2,3,4 ortalaması 3
      sıralar: 1→1, 2→3, 2→3, 2→3, 3→5, 4→6
      R1 = 1 + 3 + 3 = 7
      U1 = 9 + 6 − 7 = 8 ; U2 = 1 ; U = 1
      bağ düzeltmesi 24 → varyans = (9/12)(7 − 24/30) = 0.75×6.2 = 4.65
      SS = 2.1564 → z = (1 − 4.5)/2.1564 = −1.6231
    */
    const r = mannWhitneyU([1, 2, 2], [2, 3, 4]);
    assert.equal(r.u, 1);
    yakin(r.z, -1.6231);
  });

  test("DEĞİŞKENLİK YOKSA sonuç uydurulmuyor", () => {
    /* Bütün değerler aynı: varyans sıfır, z tanımsız. Sıfır yazmak
       "fark yok" demek olurdu; doğru cevap "hesaplanamaz". */
    const r = mannWhitneyU([5, 5, 5], [5, 5, 5]);
    assert.equal(Number.isNaN(r.z), true);
    assert.equal(Number.isNaN(r.p), true);
  });
});

describe("Kruskal-Wallis", () => {
  test("bağsız ders kitabı örneği", () => {
    /*
      [1,2,3] [4,5,6] [7,8,9]; sıralar 1..9
      R = 6, 15, 24 ; n = 3 her grupta ; N = 9
      H = 12/(9×10) × (36/3 + 225/3 + 576/3) − 3×10
        = 0.13333 × 279 − 30 = 37.2 − 30 = 7.2
      df = 2
    */
    const r = kruskalWallis([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    yakin(r.h, 7.2);
    assert.equal(r.df, 2);
    yakin(r.p, 0.0273, 1e-3);
    assert.deepEqual(r.siraOrtalamalari, [2, 5, 8]);
    /* ε² = H/(N−1) = 7.2/8 = 0.9 */
    yakin(r.epsilonKare, 0.9);
  });

  test("BAĞ DÜZELTMESİ H'yi BÜYÜTÜYOR", () => {
    /*
      [1,1,2] [2,3,3] [4,4,5]; N = 9
      Sıralar: 1,1→1.5 ; 2,2→3.5 ; 3,3→5.5 ; 4,4→7.5 ; 5→9
      R = 6.5 , 14.5 , 24
      ΣR²/n = (42.25 + 210.25 + 576)/3 = 276.1667
      Düzeltmesiz H = 12/90 × 276.1667 − 30 = 36.8222 − 30 = 6.8222

      Dört bağ grubu (her biri 2) → Σ(t³−t) = 4 × 6 = 24
      bölen = 1 − 24/(729 − 9) = 0.966667
      Düzeltilmiş H = 6.8222 / 0.966667 = 7.0575

      Bağlar varyansı düşürdüğü için düzeltilmemiş H olduğundan
      KÜÇÜK çıkar ve gerçek fark kaçırılır; düzeltme onu büyütmeli.
    */
    const r = kruskalWallis([[1, 1, 2], [2, 3, 3], [4, 4, 5]]);
    yakin(r.h, 7.0575);
    assert.ok(r.h > 6.8222, "düzeltilmiş H ham değerinden büyük olmalı");
    assert.deepEqual(
      r.siraOrtalamalari.map((x) => Number(x.toFixed(4))),
      [2.1667, 4.8333, 8],
    );
  });
});

describe("Spearman", () => {
  test("tekdüze artan ilişkide rho = 1", () => {
    /* Doğrusal olmayan ama tekdüze: Pearson 1'den küçük çıkardı,
       Spearman 1 verir — sıralar birebir aynı. */
    const r = spearmanKorelasyonu([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]);
    yakin(r.r, 1);
  });

  test("ters ilişkide rho = −1", () => {
    const r = spearmanKorelasyonu([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    yakin(r.r, -1);
  });

  test("KISAYOL FORMÜLÜ kullanılmıyor: bağlarda da doğru", () => {
    /*
      Kısayol (1 − 6Σd²/(n³−n)) bağ olmadığını varsayıyor ve Likert
      verisinde yanlış sonuç veriyor. Sıralara Pearson uygulandığı
      için bağlı veride de tutarlı: aynı sıralara sahip iki değişken
      tam ilişki verir.
    */
    const r = spearmanKorelasyonu([1, 2, 2, 3], [5, 7, 7, 9]);
    yakin(r.r, 1);
  });
});

describe("Wilcoxon işaretli sıralar", () => {
  /*
    Farklar (sonra − önce): 2, 3, −1, 4, 0, 5, 5, 6. Sıfır atılır (n'=7).
    |d| sıraları: 1→1, 2→2, 3→3, 4→4, 5,5→5,5, 6→7.
    W− = 1, W+ = 27 (toplam 28 = 7·8/2). T = 1.
    Ortalama 7·8/4 = 14; varyans 7·8·15/24 − (2³−2)/48 = 35 − 0,125.
    z = (1 − 14)/√34,875 = −2,2013; r = 2,2013/√8 = 0,7783.
  */
  test("sıfır farkı atar, bağları düzeltir", () => {
    const s = wilcoxonIsaretliSiralar([10, 12, 14, 16, 18, 20, 22, 24], [12, 15, 13, 20, 18, 25, 27, 30]);
    assert.deepEqual([s.wArti, s.wEksi, s.t, s.n, s.nEtkin], [27, 1, 1, 8, 7]);
    assert.deepEqual([s.artiSayisi, s.eksiSayisi, s.esitSayisi], [6, 1, 1]);
    yakin(s.z, -2.2013);
    yakin(s.etki, 0.7783);
    assert.ok(s.p < 0.05 && s.p > 0.02);
  });

  test("bütün farklar sıfırsa test tanımsız (NaN), anlamsız sayılmaz", () => {
    const s = wilcoxonIsaretliSiralar([3, 4, 5], [3, 4, 5]);
    assert.equal(s.nEtkin, 0);
    assert.ok(Number.isNaN(s.z));
  });
});

describe("Friedman", () => {
  /*
    Dört katılımcı, üç ölçüm; satır içi sıralar 123, 231, 132, 123.
    R = 5, 10, 9; ΣR² = 206. χ² = 12/(4·3·4)·206 − 3·4·4 = 3,5; df 2.
    p = e^(−1,75) = 0,1738; W = 3,5/(4·2) = 0,4375.
  */
  test("satır içi sıralar, Kendall W", () => {
    const s = friedmanTesti([[1, 2, 1, 1], [2, 3, 3, 2], [3, 1, 2, 3]]);
    yakin(s.chiKare, 3.5);
    assert.equal(s.df, 2);
    yakin(s.p, 0.1738);
    yakin(s.kendallW, 0.4375);
    assert.deepEqual(s.siraOrtalamalari, [1.25, 2.5, 2.25]);
  });

  /*
    Bağlı satır [1,1,2] → sıralar 1,5 1,5 3; Σ(t³−t) = 6.
    R = 2,5; 3,5; 6 → ΣR² = 54,5; ham χ² = 12/24·54,5 − 24 = 3,25.
    Bölen 1 − 6/(2·24) = 0,875 → χ² = 3,7143.
  */
  test("satır içi bağ düzeltmesi χ²'yi büyütür", () => {
    const s = friedmanTesti([[1, 1], [1, 2], [2, 3]]);
    yakin(s.chiKare, 3.7143);
  });
});
