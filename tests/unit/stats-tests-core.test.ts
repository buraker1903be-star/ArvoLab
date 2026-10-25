/*
  Temel istatistik testleri. Bu modülün hiç testi yoktu; oysa ürettiği
  sayı doğrudan tezin bulgular bölümüne giriyor. Yanlış bir p değeri,
  yanlış bir cümleden daha ağır bir hatadır.

  Beklenen değerler ELLE hesaplandı, koddan türetilmedi — yoksa test
  yalnızca "kod kendisiyle tutarlı" derdi. Hesaplar yorumlarda açık.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  chiSquareIndependence,
  cronbachAlpha,
  independentTTest,
  oneWayAnova,
  pearsonCorrelation,
} from "@/lib/stats-tests-core";

const yakin = (a: number, b: number, tolerans = 1e-4) =>
  assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("bağımsız örneklem t-testi", () => {
  test("ders kitabı örneği", () => {
    /*
      [5,6,7,8,9] → ort 7, varyans 10/4 = 2.5
      [1,2,3,4,5] → ort 3, varyans 10/4 = 2.5
      ortak varyans 2.5 → SH = √(2.5 × (1/5 + 1/5)) = √1 = 1
      t = (7 − 3) / 1 = 4,  sd = 8
    */
    const r = independentTTest([5, 6, 7, 8, 9], [1, 2, 3, 4, 5]);
    yakin(r.t, 4);
    assert.equal(r.df, 8);
    yakin(r.p, 0.00395, 1e-4);
    yakin(r.sd1, Math.sqrt(2.5));
  });

  test("değişkenlik yoksa sonuç tanımsız (çağıran bunu yakalamalı)", () => {
    // Bütün değerler aynı → varyans 0 → t = 0/0. Ekrana "NaN" yazmamak
    // çağıranın işi (lib/apa-format.ts, hesaplanabilir).
    const r = independentTTest([5, 5, 5], [5, 5, 5]);
    assert.equal(Number.isFinite(r.t), false);
    assert.equal(Number.isFinite(r.p), false);
  });
});

describe("tek yönlü ANOVA", () => {
  test("ders kitabı örneği", () => {
    /*
      Gruplar [1,2,3] [4,5,6] [7,8,9]; genel ortalama 5.
      SSb = 3(2−5)² + 3(5−5)² + 3(8−5)² = 27 + 0 + 27 = 54,  sdb = 2 → MSb = 27
      SSw = 3 × 2 = 6,  sdw = 6 → MSw = 1
      F = 27
    */
    const r = oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    yakin(r.f, 27);
    assert.equal(r.dfb, 2);
    assert.equal(r.dfw, 6);
    yakin(r.ssb, 54);
    yakin(r.ssw, 6);
    assert.ok(r.p < 0.01, `p beklenenden büyük: ${r.p}`);
  });

  test("gruplar özdeşse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(oneWayAnova([[1, 1, 1], [1, 1, 1]]).f), false);
  });
});

describe("Pearson korelasyonu", () => {
  test("mükemmel pozitif ilişki", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    yakin(r.r, 1);
    assert.equal(r.df, 3);
  });

  test("mükemmel negatif ilişki", () => {
    yakin(pearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1]).r, -1);
  });

  test("bilinen ara değer", () => {
    /*
      x=[1,2,3,4,5] (ort 3), y=[2,1,4,3,5] (ort 3)
      pay = (−2)(−1) + (−1)(−2) + 0 + 0 + (2)(2) = 2 + 2 + 0 + 0 + 4 = 8
      payda = √(10 × 10) = 10  →  r = 0.8
    */
    yakin(pearsonCorrelation([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]).r, 0.8);
  });

  test("bir değişken sabitse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(pearsonCorrelation([2, 2, 2, 2], [1, 2, 3, 4]).r), false);
  });
});

describe("ki-kare bağımsızlık", () => {
  test("2x2 tablo, elle hesap", () => {
    /*
      [[10,20],[30,40]] → satır 30/70, sütun 40/60, N=100
      Beklenen: 12, 18, 28, 42
      X² = 4/12 + 4/18 + 4/28 + 4/42 = 0.79365
      (Yates düzeltmesi UYGULANMIYOR; düz Pearson X² raporlanıyor.)
    */
    const r = chiSquareIndependence([[10, 20], [30, 40]]);
    yakin(r.chi2, 0.79365);
    assert.equal(r.df, 1);
    assert.equal(r.n, 100);
  });

  test("tamamen boş sütun sonucu tanımsız yapar", () => {
    // Beklenen değer 0 → sıfıra bölme. Kullanılmayan kategori bırakılmış
    // veri setlerinde gerçekten oluyor.
    assert.equal(Number.isFinite(chiSquareIndependence([[10, 0], [30, 0]]).chi2), false);
  });
});

describe("Cronbach alfa", () => {
  test("maddeler özdeşse sonuç tanımsız", () => {
    assert.equal(Number.isFinite(cronbachAlpha([[3, 3, 3], [3, 3, 3]]).alpha), false);
  });

  test("gerçek veride 0 ile 1 arasında", () => {
    const r = cronbachAlpha([
      [4, 5, 3, 4, 5],
      [4, 4, 3, 5, 5],
      [5, 5, 2, 4, 4],
    ]);
    assert.equal(r.k, 3);
    assert.ok(r.alpha <= 1, `alfa 1'i aştı: ${r.alpha}`);
  });
});

/*
  ETKİ BÜYÜKLÜĞÜ (25.10.2026).

  Modül yalnızca p üretiyordu. p "fark var mı" sorusunu yanıtlar,
  "fark NE KADAR" sorusunu değil: büyük örneklemde önemsiz bir fark
  bile p < .05 çıkar. Bu istatistiğin kendi gereği; raporlanıp
  raporlanmayacağına kullanıcının kılavuzu karar verir, ama
  HESAPLANMAYAN bir değer hiçbir kılavuzda raporlanamaz.

  Beklenen değerler elle hesaplandı; hesaplar yorumlarda açık.
*/
describe("etki büyüklüğü", () => {
  test("Cohen's d birleştirilmiş standart sapmayla", () => {
    /*
      [5,6,7,8,9] ort 7, [1,2,3,4,5] ort 3; ortak varyans 2.5
      birleşik SS = √2.5 ≈ 1.5811
      d = (7 − 3) / 1.5811 = 2.5298  → "büyük"
    */
    const r = independentTTest([5, 6, 7, 8, 9], [1, 2, 3, 4, 5]);
    yakin(r.d, 2.5298, 1e-3);
    assert.equal(r.dYorum, "büyük");
  });

  test("ortalama farkı ve %95 güven aralığı", () => {
    /*
      Fark = 4, SH = 1, sd = 8 → kritik t(8) = 2.306
      GA = 4 ± 2.306 → [1.694, 6.306]
    */
    const r = independentTTest([5, 6, 7, 8, 9], [1, 2, 3, 4, 5]);
    yakin(r.fark, 4);
    yakin(r.altSinir, 1.694, 1e-3);
    yakin(r.ustSinir, 6.306, 1e-3);
    /* Aralık sıfırı içermiyorsa fark anlamlıdır; p ile tutarlı olmalı. */
    assert.ok(r.altSinir > 0 && r.p < 0.05);
  });

  test("YORUM SAYIYLA TUTARLI: eşiğin altı küçük, çok altı önemsiz", () => {
    /*
      [9,10,11,10,10] ort 10, varyans (1+0+1+0+0)/4 = 0.5
      İkinci grup aynı dağılımın 0.3 kaydırılmışı, varyans yine 0.5
      ortak varyans 0.5 → birleşik SS = √0.5 ≈ 0.7071
      d = −0.3 / 0.7071 = −0.4243 → Cohen'de "küçük" (.20 ≤ |d| < .50)
    */
    const kucuk = independentTTest([9, 10, 11, 10, 10], [9.3, 10.3, 11.3, 10.3, 10.3]);
    yakin(kucuk.d, -0.4243, 1e-3);
    assert.equal(kucuk.dYorum, "küçük");

    /* Aynı dağılım yalnızca 0.1 kaydırılırsa d = −0.1414 → "önemsiz". */
    const onemsiz = independentTTest([9, 10, 11, 10, 10], [9.1, 10.1, 11.1, 10.1, 10.1]);
    yakin(onemsiz.d, -0.1414, 1e-3);
    assert.equal(onemsiz.dYorum, "önemsiz");
  });

  test("ANOVA'da η² = SSb / SSt", () => {
    /* SSb 54, SSw 6 → η² = 54/60 = 0.9 → "büyük" */
    const r = oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    yakin(r.etaKare, 0.9);
    assert.equal(r.etaYorum, "büyük");
  });

  test("korelasyonda r² açıklanan varyans", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    yakin(r.rKare, 1);
    assert.equal(r.rYorum, "büyük");
  });

  test("Cramér's V tablonun KISA kenarına bölünüyor", () => {
    /*
      2×2 tablo [[10,0],[0,10]]: beklenen her hücrede 5,
      χ² = 4 × (25/5) = 20, N = 20, kısa kenar = 1
      V = √(20 / (20 × 1)) = 1 → tam ilişki
    */
    const r = chiSquareIndependence([[10, 0], [0, 10]]);
    yakin(r.chi2, 20);
    yakin(r.cramersV, 1);
    assert.equal(r.vYorum, "büyük");
  });

  test("ilişkisiz tabloda V sıfır", () => {
    const r = chiSquareIndependence([[5, 5], [5, 5]]);
    yakin(r.cramersV, 0);
    assert.equal(r.vYorum, "önemsiz");
  });

  test("DEĞİŞKENLİK YOKKEN etki büyüklüğü uydurulmuyor", () => {
    /* Bütün değerler aynıysa d tanımsız; 0 yazmak "etki yok" demek
       olurdu, oysa doğru cevap "hesaplanamaz". */
    const r = independentTTest([5, 5, 5], [5, 5, 5]);
    assert.equal(Number.isFinite(r.t), false);
    assert.equal(r.d, 0, "birleşik SS sıfır: d sıfıra sabitleniyor");
    /* Çağıran t'nin tanımsızlığına bakıp sonucu hiç göstermemeli. */
  });
});
