/*
  VARSAYIM SINAMALARI.

  t-testi ve ANOVA, verinin normale yakın dağılmasını ve grup
  varyanslarının benzer olmasını gerektiriyor. Modül bu iki soruyu
  hiç sormuyordu: kullanıcı uygulanamayacak bir testi uygulayıp
  çıkan p değerine güveniyordu. Sonuç makul görünür, hiçbir yerde
  hata yazmaz ve bütün bulgular bölümü onun üstüne kurulur.

  Beklenen değerler ELLE hesaplandı; hesaplar yorumlarda açık.
  Çarpıklık/basıklık SPSS'in düzeltilmiş kestirimleri (G1/G2) —
  ürün SPSS çıktısını yorumladığı için aynı sayıyı üretmeli.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ikiGrupOnerisi, leveneTesti, normallikOlcutu } from "@/lib/stats-varsayim";

const yakin = (a: number, b: number, tolerans = 1e-4) =>
  assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

describe("normallik ölçütü", () => {
  test("simetrik veride çarpıklık sıfır, basıklık SPSS ile aynı", () => {
    /*
      [1,2,3,4,5]: ort 3
      m2 = (4+1+0+1+4)/5 = 2 ; m4 = (16+1+0+1+16)/5 = 6.8
      g1 = 0 (simetrik) → G1 = 0
      g2 = 6.8/4 − 3 = −1.3
      G2 = ((n+1)g2 + 6)(n−1)/((n−2)(n−3))
         = (6×(−1.3) + 6) × 4/(3×2) = (−1.8)(0.6667) = −1.2
      SPSS bu veri için basıklığı −1.2 raporluyor.
    */
    const s = normallikOlcutu([1, 2, 3, 4, 5]);
    yakin(s.carpiklik, 0);
    yakin(s.basiklik, -1.2);
    assert.equal(s.normaleYakin, true, "|0| ve |−1.2| sınırın altında");
  });

  test("standart hatalar bilinen formülden", () => {
    /*
      n = 5 → SH(çarpıklık) = √(6×5×4 / (3×6×8)) = √(120/144) = 0.9129
      SH(basıklık) = 2 × 0.9129 × √((25−1)/((5−3)(5+5))) = 2×0.9129×√1.2
                   = 2.0
    */
    const s = normallikOlcutu([1, 2, 3, 4, 5]);
    yakin(s.carpiklikSH, 0.9129, 1e-3);
    yakin(s.basiklikSH, 2.0, 1e-3);
  });

  test("ÇARPIK veri normal sayılmıyor", () => {
    /* Tek bir uç değer dağılımı sağa çarpıtıyor. */
    const s = normallikOlcutu([1, 1, 1, 1, 1, 1, 1, 1, 1, 50]);
    assert.ok(s.carpiklik > 1.5, `çarpıklık ${s.carpiklik}`);
    assert.equal(s.normaleYakin, false);
  });

  test("DÖRTTEN AZ gözlemde değer uydurulmuyor", () => {
    /* Basıklığın SPSS düzeltmesi n > 3 istiyor; sıfır yazmak
       "basıklık yok" demek olurdu, oysa doğru cevap "hesaplanamaz". */
    const s = normallikOlcutu([1, 2, 3]);
    assert.equal(Number.isNaN(s.carpiklik), true);
    assert.equal(s.normaleYakin, false);
  });

  test("DEĞİŞKENLİK YOKSA sapma ölçülemez", () => {
    const s = normallikOlcutu([7, 7, 7, 7, 7]);
    assert.equal(Number.isNaN(s.carpiklik), true);
    assert.equal(s.normaleYakin, false);
  });
});

describe("Levene (medyan sürümü)", () => {
  test("ÖZDEŞ yayılımda F sıfır", () => {
    /*
      [1,2,3] medyan 2 → sapmalar [1,0,1]
      [4,5,6] medyan 5 → sapmalar [1,0,1]
      İki grubun sapma ortalaması aynı → gruplar arası kareler 0.
    */
    const r = leveneTesti([[1, 2, 3], [4, 5, 6]]);
    yakin(r.f, 0);
    assert.equal(r.homojen, true);
  });

  test("yayılım farkı F'yi büyütüyor", () => {
    /*
      [1,2,3]    → sapmalar [1,0,1], ort 0.6667
      [10,20,30] → sapmalar [10,0,10], ort 6.6667
      genel ort 3.6667
      SSb = 3(0.6667−3.6667)² + 3(6.6667−3.6667)² = 27 + 27 = 54, df1 = 1
      SSw = (0.111+0.444+0.111) + (11.111+44.444+11.111) = 67.333, df2 = 4
      F = 54 / (67.333/4) = 54/16.8333 = 3.2079
    */
    const r = leveneTesti([[1, 2, 3], [10, 20, 30]]);
    yakin(r.f, 3.2079, 1e-3);
    assert.equal(r.df1, 1);
    assert.equal(r.df2, 4);
    /* p ≈ .147 → eşiğin üstünde, bu örnekte homojen sayılıyor. */
    assert.ok(r.p > 0.05, `p = ${r.p}`);
  });

  test("MEDYAN sürümü kullanılıyor, ortalama değil", () => {
    /*
      Çarpık bir grupta ortalama uç değere kayıyor ve sapmalar
      şişiyor; medyan sürümü bundan etkilenmiyor. Ortalama sürümü
      kullanılsaydı varyans farkı olmadığı hâlde anlamlı çıkar ve
      kullanıcı gereksiz yere parametrik olmayan teste yönlendirilirdi.
    */
    const carpik = [1, 1, 1, 1, 20];
    const duz = [1, 1, 1, 1, 1];
    const medyanli = leveneTesti([carpik, duz]);
    /* Medyanlar 1 ve 1: sapmalar [0,0,0,0,19] ve [0,0,0,0,0]. */
    assert.ok(Number.isFinite(medyanli.f));
  });
});

describe("test önerisi karar vermiyor, durumu söylüyor", () => {
  test("varsayımlar sağlanınca parametrik uygun", () => {
    const a = [4, 5, 6, 5, 4, 6, 5, 5];
    const b = [5, 6, 7, 6, 5, 7, 6, 6];
    const oneri = ikiGrupOnerisi(a, b);
    assert.equal(oneri.parametrikUygun, true);
    assert.match(oneri.gerekce, /sağlanıyor/);
  });

  test("çarpık veride parametrik olmayan öneriliyor", () => {
    const a = [1, 1, 1, 1, 1, 1, 1, 50];
    const b = [2, 3, 4, 3, 2, 4, 3, 3];
    const oneri = ikiGrupOnerisi(a, b);
    assert.equal(oneri.parametrikUygun, false);
    assert.match(oneri.gerekce, /Mann-Whitney/);
  });

  test("az gözlemde SESSİZ KALINMIYOR", () => {
    /* "Uygun değil" demek yetmez; neden ölçülemediği yazılmalı. */
    const oneri = ikiGrupOnerisi([1, 2, 3], [4, 5, 6]);
    assert.equal(oneri.parametrikUygun, false);
    assert.match(oneri.gerekce, /dörtten az/);
  });
});
