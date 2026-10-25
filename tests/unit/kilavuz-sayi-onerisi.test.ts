/*
  KILAVUZ METNİNDEN SAYI BİÇİMİ ÖNERİSİ.

  Öneri hiçbir şeyi kendiliğinden uygulamıyor; yönetici onaylıyor.
  Ama YANLIŞ bir öneri de pahalı: onaylanan kural öğrencinin bütün
  istatistiklerini kılavuza aykırı yazdırır ve araç bunu doğruymuş
  gibi sunar. O yüzden ölçüt sayıma ve baskınlığa dayanıyor; net
  kazanan yoksa null (lib/atif-sistemi'ndeki kalıbın aynısı).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { istatistikDegerleri, sayiKuraliOner } from "@/lib/kilavuz-sayi-onerisi";

describe("yalnızca istatistik değerlerine bakılır", () => {
  test("BÖLÜM NUMARALARI sayılmıyor", () => {
    /*
      Kılavuzlar bölüm numarasıyla dolu ve hepsi nokta taşıyor.
      Metindeki her ondalığı saymak her kılavuzda "nokta" derdi —
      Türkçe kılavuzların çoğu virgül isterken.
    */
    const metin = `
      1.2.3 Bulguların Sunumu
      Tablo 4.1 Betimsel İstatistikler
      Şekil 2.5 Dağılım
    `;
    assert.deepEqual(istatistikDegerleri(metin), []);
    const oneri = sayiKuraliOner(metin);
    assert.equal(oneri.ayirici, null, "bölüm numarasından kural çıkarılmamalı");
    assert.match(oneri.uyarilar[0], /istatistik örneği bulunamadı/);
  });

  test("istatistik işaretinin ardındaki değer yakalanır", () => {
    const metin = "p < 0,05 düzeyinde anlamlıdır; r = 0,42 ve t = 2,45 olarak raporlanır.";
    assert.deepEqual(istatistikDegerleri(metin), ["0,05", "0,42", "2,45"]);
  });

  test("bitişik yazım da yakalanır", () => {
    assert.deepEqual(istatistikDegerleri("p<0,05 ve p<0,01"), ["0,05", "0,01"]);
  });
});

describe("öneri sayıma ve baskınlığa dayanır", () => {
  test("Türkçe kılavuz: virgül ve baştaki sıfır", () => {
    const oneri = sayiKuraliOner("p < 0,05; p < 0,01; r = 0,42; t = 2,45");
    assert.equal(oneri.ayirici, "comma");
    assert.equal(oneri.bastakiSifir, true);
  });

  test("APA biçimli kılavuz: nokta ve sıfırsız", () => {
    const oneri = sayiKuraliOner("p < .05; p < .01; r = .42");
    assert.equal(oneri.ayirici, "period");
    assert.equal(oneri.bastakiSifir, false);
  });

  test("YETERSİZ ÖRNEK varsa öneri yok", () => {
    /* İki örnek bir kılavuzun kuralını göstermez; yönetici belgeyi
       açıp bakmalı. */
    const oneri = sayiKuraliOner("p < 0,05 ve r = 0,42");
    assert.equal(oneri.ayirici, null);
    assert.deepEqual(oneri.ayiriciGecisleri, [{ etiket: "comma", sayim: 2 }]);
  });

  test("İKİSİ DE GEÇİYORSA ve biri baskın değilse öneri yok", () => {
    /* Karşılaştırmalı örnek veren kılavuzlar var; tek bir geçiş
       sistemi belirlememeli (atif-sistemi'nde aynı hata yapılmıştı:
       18 kılavuzun 5'inde yanlış sistem algılanmıştı). */
    const oneri = sayiKuraliOner("p < 0,05; r = 0,42; p < .05; r = .42; t = 2,45; t = 2.45");
    assert.equal(oneri.ayirici, null);
    assert.match(oneri.uyarilar.join(" "), /iki ondalık ayırıcı da geçiyor/);
  });

  test("BASKIN olan kazanır ve uyarı yazılır", () => {
    const oneri = sayiKuraliOner("p < 0,05; p < 0,01; r = 0,42; t = 2,45; F = 4,31; p < .05");
    assert.equal(oneri.ayirici, "comma", "6 virgüle 1 nokta: baskın");
    assert.match(oneri.uyarilar.join(" "), /iki ondalık ayırıcı da geçiyor/);
  });

  test("BAŞTAKİ SIFIR yalnızca birden küçük değerlerden çıkarılır", () => {
    /*
      "t = 2,45" bir sıfır kuralı taşımıyor. Onu "sıfır yazılır"
      saysaydık her kılavuzda "yazılır" çıkardı ve APA isteyen
      kılavuzlar yanlış işaretlenirdi.
    */
    const oneri = sayiKuraliOner("t = 2,45; F = 4,31; z = 1,96");
    assert.equal(oneri.bastakiSifir, null, "birden büyük değerlerden kural çıkmaz");
    assert.deepEqual(oneri.sifirGecisleri, []);
    /* Ayırıcı yine de okunabiliyor. */
    assert.equal(oneri.ayirici, "comma");
  });

  test("sıfırsız yazım da sayılıyor", () => {
    const oneri = sayiKuraliOner("p < ,05; r = ,42; p = ,003");
    assert.equal(oneri.bastakiSifir, false);
    assert.equal(oneri.ayirici, "comma");
  });

  test("KARAR VERİLEMESE DE sayımlar dönüyor", () => {
    /* Yöneticinin kararı tam olarak bu veriye dayanıyor; sayımları
       atmak "bulunamadı" ile "ikisi de var" hâllerini aynı
       gösterirdi (atif-sistemi'nde yazılı gerekçe). */
    const oneri = sayiKuraliOner("p < 0,05; p < .05");
    assert.equal(oneri.ayirici, null);
    assert.equal(oneri.ayiriciGecisleri.length, 2);
  });
});
