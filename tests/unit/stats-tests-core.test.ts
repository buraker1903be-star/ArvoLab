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
  bonferroniKarsilastirmalari,
  chiSquareIndependence,
  eslestirilmisTTest,
  cronbachAlpha,
  welchTTest,
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
    // Elde hesaplandı ve ikinci bir yoldan (ortalama madde-içi kovaryans
    // formülü) doğrulandı: iki yol da 0,809524 veriyor.
    assert.ok(Math.abs(r.alpha - 0.809524) < 1e-6, String(r.alpha));
  });

  test("madde istatistikleri elde hesaplananla birebir", () => {
    /*
      SPSS'in bastığı iki sütun. Tek bir alfa sayısı tezde yetmiyor:
      alfa düşük çıktığında hangi maddenin ölçeği bozduğunu ancak
      bunlar gösteriyor.
    */
    const r = cronbachAlpha([
      [4, 5, 3, 4, 5],
      [4, 4, 3, 5, 5],
      [5, 5, 2, 4, 4],
    ]);
    const beklenen = [
      { duzeltilmisKorelasyon: 0.801784, alphaSilinirse: 0.625 },
      { duzeltilmisKorelasyon: 0.590301, alphaSilinirse: 0.810811 },
      { duzeltilmisKorelasyon: 0.672977, alphaSilinirse: 0.782609 },
    ];
    r.maddeler.forEach((madde, i) => {
      assert.equal(madde.sira, i);
      assert.ok(Math.abs(madde.duzeltilmisKorelasyon - beklenen[i].duzeltilmisKorelasyon) < 1e-6, String(madde.duzeltilmisKorelasyon));
      assert.ok(Math.abs(madde.alphaSilinirse - beklenen[i].alphaSilinirse) < 1e-6, String(madde.alphaSilinirse));
    });
    // 2. madde atılınca alfa YÜKSELİYOR (0,810 > 0,809): ölçeğe en az katan madde o.
    assert.ok(r.maddeler[1].alphaSilinirse > r.alpha);
  });

  test("korelasyon DÜZELTİLMİŞ: madde kendi toplamına katılmıyor", () => {
    /*
      Düzeltilmemiş hâlinde madde kendisiyle de ilişkilendirilir ve her
      madde olduğundan tutarlı görünür — tam da gizlenmemesi gereken
      bozuk madde gizlenir. Burada 4. madde ters yönlü (ters kodlanmış
      ve çevrilmemiş bir madde): düzeltilmiş korelasyonu NEGATİF çıkmalı.

      Üç maddeyle yazmak işe yaramıyor: ters madde diğer ikisini tam
      dengelediğinde "diğerlerinin toplamı" SABİT oluyor ve korelasyon
      tanımsız kalıyor. Dördüncü madde bu dejenere durumu kaldırıyor.
    */
    const r = cronbachAlpha([
      [1, 2, 3, 4, 5],
      [2, 2, 3, 4, 5],
      [1, 3, 3, 4, 5],
      [5, 4, 3, 2, 1],
    ]);
    assert.ok(Math.abs(r.maddeler[3].duzeltilmisKorelasyon - -0.9979) < 1e-3, String(r.maddeler[3].duzeltilmisKorelasyon));
    assert.ok(Math.abs(r.maddeler[0].duzeltilmisKorelasyon - 0.9707) < 1e-3, String(r.maddeler[0].duzeltilmisKorelasyon));
  });

  test("diğer maddelerin toplamı sabitse korelasyon sayı uydurmuyor", () => {
    // Ters madde diğerini tam dengeliyor: toplam her satırda 6. Bölen sıfır.
    const r = cronbachAlpha([
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
    ]);
    assert.equal(Number.isFinite(r.maddeler[0].duzeltilmisKorelasyon), false);
  });

  test("iki maddede \"silinirse\" hesaplanamıyor", () => {
    // Geriye tek madde kalıyor, alfa tanımsız. Sayı üretmek uydurma olurdu.
    const r = cronbachAlpha([[1, 2, 3, 4], [2, 3, 4, 6]]);
    assert.equal(Number.isNaN(r.maddeler[0].alphaSilinirse), true);
    assert.equal(Number.isFinite(r.alpha), true);
  });

  test("tek madde ve eşit olmayan uzunluk reddediliyor", () => {
    assert.equal(Number.isFinite(cronbachAlpha([[1, 2, 3]]).alpha), false);
    /*
      Eskiden farklı uzunluktaki maddeler sessizce NaN üretiyordu:
      items[0].length kadar dönülüyor, kısa maddede item[i] undefined
      geliyordu. Eksik veri artık çağıranda eleniyor
      (lib/veri-eslestirme.ts); yine de burada açıkça reddediliyor.
    */
    assert.throws(() => cronbachAlpha([[1, 2, 3], [1, 2]]), /aynı sayıda gözlem/);
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

/*
  EŞLEŞTİRİLMİŞ ÖRNEKLEM t-TESTİ.

  Ön test–son test deseni tezlerde en yaygın kurgulardan biri ve
  program bunu hiç yapamıyordu. Aynı kişilerin iki ölçümünü BAĞIMSIZ
  iki grup saymak eşleşmeden gelen bilgiyi atıyor: fark gerçek olsa
  bile test onu bulamıyor ve "anlamlı fark yok" yanlış yere yazılıyor.
*/
describe("eşleştirilmiş örneklem t-testi", () => {
  test("ders kitabı örneği", () => {
    /*
      önce  [5,7,6,8,9]
      sonra [3,4,5,5,6]
      farklar [2,3,1,3,3] → ortalama 2.4
      sapmalar −0.4, 0.6, −1.4, 0.6, 0.6
      kareler 0.16+0.36+1.96+0.36+0.36 = 3.2 → varyans 3.2/4 = 0.8
      SS = 0.8944 ; SH = 0.8944/√5 = 0.4
      t = 2.4/0.4 = 6.0 ; sd = 4
      dz = 2.4/0.8944 = 2.6833
      kritik t(4) = 2.7764 → GA = 2.4 ± 1.1106
    */
    const r = eslestirilmisTTest([5, 7, 6, 8, 9], [3, 4, 5, 5, 6]);
    yakin(r.t, 6);
    assert.equal(r.df, 4);
    assert.equal(r.n, 5);
    yakin(r.farkOrtalamasi, 2.4);
    yakin(r.farkSS, 0.8944, 1e-3);
    yakin(r.dz, 2.6833, 1e-3);
    assert.equal(r.dzYorum, "büyük");
    yakin(r.altSinir, 1.2894, 1e-3);
    yakin(r.ustSinir, 3.5106, 1e-3);
    yakin(r.p, 0.00388, 1e-4);
  });

  test("EŞLEŞMEYEN GÖZLEM atılıyor, sıfır sayılmıyor", () => {
    /* Fazlalık ölçümü sıfır farkla dahil etmek, gerçekte olmayan
       "değişim yok" gözlemleri uydurmak olurdu ve etkiyi küçültürdü. */
    const r = eslestirilmisTTest([5, 7, 6, 8, 9, 10], [3, 4, 5, 5, 6]);
    assert.equal(r.n, 5, "altıncı ölçümün eşi yok");
    yakin(r.farkOrtalamasi, 2.4);
  });

  test("FARK HİÇ DEĞİŞMİYORSA sonuç tanımsız", () => {
    /* Bütün farklar aynıysa SS sıfır ve t = 0/0. Sonsuz bir t
       yazmak yerine çağıran bunu yakalamalı. */
    const r = eslestirilmisTTest([5, 6, 7], [1, 2, 3]);
    assert.equal(Number.isFinite(r.t), false);
    assert.equal(Number.isNaN(r.dz), true);
  });
});

/*
  ANOVA SONRASI İKİLİ KARŞILAŞTIRMA.

  ANOVA "gruplardan en az biri farklı" diyor, hangisi olduğunu
  söylemiyordu; kullanıcı anlamlı bir F görüp cevapsız kalıyordu.
*/
describe("Bonferroni ikili karşılaştırmaları", () => {
  test("üç grupta üç çift üretiliyor ve p düzeltiliyor", () => {
    /*
      [1,2,3] [4,5,6] [7,8,9]: MSw = 1, sdw = 6
      1–2 farkı −3 ; SH = √(1×(1/3+1/3)) = 0.8165 → t = −3.674
      düzeltmesiz p ≈ .0104 → ×3 = .0312
    */
    const ciftler = bonferroniKarsilastirmalari(
      [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      ["A", "B", "C"],
    );
    assert.equal(ciftler.length, 3);
    const ab = ciftler.find((c) => c.a === "A" && c.b === "B")!;
    yakin(ab.ortalamaFarki, -3);
    yakin(ab.t, -3.6742, 1e-3);
    yakin(ab.pHam, 0.0104, 1e-3);
    yakin(ab.p, ab.pHam * 3, 1e-6);
  });

  test("düzeltilmiş p 1'i AŞMIYOR", () => {
    /* p × karşılaştırma sayısı 1'i geçebilir; olasılık olarak
       okunan bir sayının 1'den büyük yazılması anlamsız olurdu. */
    const ciftler = bonferroniKarsilastirmalari(
      [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
      ["A", "B", "C"],
    );
    for (const c of ciftler) assert.ok(c.p <= 1, `p = ${c.p}`);
  });

  test("DÜZELTME TEMKİNLİ tarafta: ham p anlamlıyken düzeltilmiş olmayabilir", () => {
    /*
      Bonferroni gerçek farkı kaçırabilir ama olmayan farkı bulmaz.
      Bir tez bulgusunda yanlış pozitif, yanlış negatiften pahalıdır.
      Ham p şeffaflık için duruyor; karar düzeltilmişle veriliyor.
    */
    const ciftler = bonferroniKarsilastirmalari(
      [[1, 2, 3], [2, 3, 4], [3, 4, 5]],
      ["A", "B", "C"],
    );
    const ac = ciftler.find((c) => c.a === "A" && c.b === "C")!;
    assert.ok(ac.p > ac.pHam, "düzeltilmiş p ham p'den büyük olmalı");
  });
});

describe("Welch t-testi", () => {
  /*
    Varsayım şeridi Levene p < .05 olduğunda Welch öneriyordu ama
    program Welch'i YAPAMIYORDU: kullanıcıya uygulayamayacağı bir
    öneri veriliyordu.
  */
  const A = [27.5, 21.0, 19.0, 23.6, 17.0, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19.0, 21.7, 21.4];
  const B = [27.1, 22.0, 20.8, 23.4, 23.4, 23.5, 25.8, 22.0, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4];

  test("yayımlanmış örnekle birebir", () => {
    const r = welchTTest(A, B);
    assert.ok(Math.abs(r.t - -2.455356) < 1e-6, String(r.t));
    // Serbestlik derecesi ONDALIKLI kalıyor: yuvarlamak p'yi kaydırır.
    assert.ok(Math.abs(r.df - 24.988529) < 1e-6, String(r.df));
    assert.ok(Math.abs(r.p - 0.021378) < 1e-6, String(r.p));
  });

  test("varyanslar eşitken birleşik varyanslı testle örtüşüyor", () => {
    /*
      Eşit varyansta iki testin ayrışmaması gerekiyor; ayrışıyorsa
      Welch'in formülünde hata vardır.
    */
    const x = [10, 12, 14, 16, 18];
    const y = [11, 13, 15, 17, 19];
    const welch = welchTTest(x, y);
    const birlesik = independentTTest(x, y);
    assert.ok(Math.abs(welch.t - birlesik.t) < 1e-9, `${welch.t} ≠ ${birlesik.t}`);
    assert.ok(Math.abs(welch.d - birlesik.d) < 1e-9, `${welch.d} ≠ ${birlesik.d}`);
  });

  test("varyanslar çok farklıyken birleşik varyanslı testten AYRILIYOR", () => {
    // Küçük grubun varyansı büyükse birleşik test p'yi olduğundan küçük verir.
    const dar = [50, 50.1, 49.9, 50.2, 49.8, 50, 50.1, 49.9, 50, 50.1];
    const genis = [40, 60, 45, 55, 38, 62];
    const welch = welchTTest(dar, genis);
    const birlesik = independentTTest(dar, genis);
    assert.ok(welch.df < birlesik.df, `${welch.df} < ${birlesik.df} olmalı`);
    assert.ok(welch.p > birlesik.p, `Welch daha temkinli olmalı: ${welch.p} > ${birlesik.p}`);
  });

  test("hiç değişkenlik yoksa sayı uydurmuyor", () => {
    const r = welchTTest([5, 5, 5], [5, 5, 5]);
    assert.equal(Number.isFinite(r.p), false);
  });
});
