/*
  DOĞRUSAL REGRESYON.

  Makalelerin ve tezlerin belkemiği olan analiz programda hiç yoktu;
  kullanıcı "X, Y'yi yorduyor mu" sorusunu soramıyordu. Korelasyon
  ilişkinin GÜCÜNÜ söyler, "X bir birim artınca Y ne kadar artar"
  sorusunu yanıtlamaz.

  Beklenen değerler ELLE hesaplandı; hesaplar yorumlarda açık.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { dogrusalRegresyon } from "@/lib/stats-regresyon";

const yakin = (a: number, b: number, tolerans = 1e-4) =>
  assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("basit doğrusal regresyon", () => {
  /*
    x = [1,2,3,4,5], y = [2,4,5,4,5]
    x̄ = 3, ȳ = 4
    Sxy = (−2)(−2)+(−1)(0)+(0)(1)+(1)(0)+(2)(1) = 6
    Sxx = 4+1+0+1+4 = 10
    b1 = 6/10 = 0.6 ; b0 = 4 − 0.6×3 = 2.2
    tahmin 2.8, 3.4, 4.0, 4.6, 5.2
    artıklar −0.8, 0.6, 1.0, −0.6, −0.2
    SSE = 0.64+0.36+1+0.36+0.04 = 2.4
    SST = 4+0+1+0+1 = 6 → SSR = 3.6 → R² = 0.6
    MSE = 2.4/3 = 0.8
    SH(b1) = √(0.8/10) = 0.2828 → t = 0.6/0.2828 = 2.1213
    F = 3.6/0.8 = 4.5 (sd 1, 3)
    Düzeltilmiş R² = 1 − (1−0.6)(4/3) = 0.4667
  */
  const sonuc = dogrusalRegresyon([2, 4, 5, 4, 5], [[1, 2, 3, 4, 5]], ["x"]);

  test("katsayılar", () => {
    const [sabit, egim] = sonuc.katsayilar;
    assert.equal(sabit.ad, "(Sabit)");
    yakin(sabit.b, 2.2);
    assert.equal(egim.ad, "x");
    yakin(egim.b, 0.6);
    yakin(egim.standartHata, 0.2828, 1e-3);
    yakin(egim.t, 2.1213, 1e-3);
  });

  test("uyum ölçüleri", () => {
    yakin(sonuc.rKare, 0.6);
    yakin(sonuc.duzeltilmisRKare, 0.4667, 1e-3);
    yakin(sonuc.f, 4.5);
    assert.equal(sonuc.dfb, 1);
    assert.equal(sonuc.dfw, 3);
    assert.equal(sonuc.tekil, false);
  });

  test("BASİT REGRESYONDA F = t² ve p değerleri aynı", () => {
    /* Tek yordayıcılı modelde eğimin t-testiyle modelin F-testi
       aynı şeyi sınıyor; ayrışıyorlarsa hesapların biri yanlıştır. */
    const egim = sonuc.katsayilar[1];
    yakin(egim.t ** 2, sonuc.f, 1e-6);
    yakin(egim.p, sonuc.p, 1e-9);
  });

  test("basit regresyonda β = korelasyon katsayısı", () => {
    /* Tek yordayıcıda standartlaştırılmış katsayı r'ye eşittir;
       R² = 0.6 → r = 0.7746. */
    yakin(sonuc.katsayilar[1].beta, Math.sqrt(0.6), 1e-6);
  });
});

describe("çoklu regresyon", () => {
  test("iki yordayıcı veriyi tam açıklıyorsa R² = 1", () => {
    /* y = 1 + 2x₁ + 3x₂ birebir kuruluyor. */
    const x1 = [1, 2, 3, 4, 5, 6];
    const x2 = [2, 1, 4, 3, 6, 5];
    const y = x1.map((a, i) => 1 + 2 * a + 3 * x2[i]);
    const r = dogrusalRegresyon(y, [x1, x2], ["x1", "x2"]);
    yakin(r.rKare, 1, 1e-8);
    yakin(r.katsayilar[0].b, 1, 1e-6);
    yakin(r.katsayilar[1].b, 2, 1e-6);
    yakin(r.katsayilar[2].b, 3, 1e-6);
  });

  test("ÇOKLU DOĞRUSALLIK sessiz geçilmiyor", () => {
    /*
      İkinci yordayıcı birincinin katı: X'X tekil. Sayı üretmek,
      anlamsız katsayıları güvenilir göstermek olurdu.
    */
    const x1 = [1, 2, 3, 4, 5];
    const r = dogrusalRegresyon([2, 4, 5, 4, 5], [x1, x1.map((v) => v * 2)], ["x1", "x2"]);
    assert.equal(r.tekil, true);
    assert.equal(Number.isNaN(r.rKare), true);
  });

  test("ÖLÇEK FARKI katsayıları bozmuyor", () => {
    /*
      Kısmi pivotlama olmadan, sütunlar ölçek olarak çok farklıysa
      (yaş 20–70, gelir 10.000–90.000) eliminasyon sayısal olarak
      dağılıyor ve katsayılar sessizce bozuluyor. Bu veride gerçek
      katsayılar biliniyor: y = 5 + 0.5·yaş + 0.001·gelir
    */
    const yas = [20, 35, 50, 65, 28, 42];
    const gelir = [10000, 25000, 40000, 90000, 18000, 33000];
    const y = yas.map((a, i) => 5 + 0.5 * a + 0.001 * gelir[i]);
    const r = dogrusalRegresyon(y, [yas, gelir], ["yaş", "gelir"]);
    yakin(r.katsayilar[1].b, 0.5, 1e-6);
    yakin(r.katsayilar[2].b, 0.001, 1e-8);
    yakin(r.rKare, 1, 1e-8);
  });

  test("GÖZLEM YETMİYORSA model kurulmuyor", () => {
    /* n ≤ k + 1 ise model veriyi ezberler, hata kareleri sıfır
       çıkar ve bütün p değerleri anlamını yitirir. */
    const r = dogrusalRegresyon([1, 2, 3], [[1, 2, 3], [4, 5, 7]], ["a", "b"]);
    assert.equal(r.tekil, true);
    assert.equal(Number.isNaN(r.f), true);
  });

  test("DÜZELTİLMİŞ R² işe yaramaz yordayıcıyı cezalandırıyor", () => {
    /*
      Yordayıcı eklemek R²'yi HER ZAMAN büyütür, işe yaramayanı
      bile; düzeltilmiş olan bunu cezalandırır.
    */
    const x1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const gurultu = [5, 3, 8, 1, 7, 2, 6, 4];
    const y = [2, 4, 5, 4, 5, 7, 8, 9];
    const tek = dogrusalRegresyon(y, [x1], ["x1"]);
    const iki = dogrusalRegresyon(y, [x1, gurultu], ["x1", "gürültü"]);
    assert.ok(iki.rKare >= tek.rKare, "R² büyümeli ya da aynı kalmalı");
    assert.ok(iki.duzeltilmisRKare < iki.rKare, "düzeltilmiş olan cezalandırmalı");
  });
});
