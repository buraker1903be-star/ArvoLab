/*
  SAYININ YAZILIŞI KILAVUZDAN GELİR.

  İstatistik çıktısının tipografisi koda sabitlenmişti: baştaki sıfır
  siliniyor, ondalık ayırıcı noktaya çevriliyordu. İkisi de APA
  kuralı ve bu kurallar üniversiteden üniversiteye değişiyor —
  kılavuzu "0,021" diyen öğrenci araçtan ".021" alıyordu.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sayiBicimi, sayiMetniBicimle, sayiYaz, VARSAYILAN_BICIM } from "@/lib/sayi-bicimi";

describe("biçim kararı üç kademeli", () => {
  test("kılavuz söylüyorsa kılavuz kazanır", () => {
    const b = sayiBicimi({ ayirici: "comma", bastakiSifir: true }, "apa7");
    assert.equal(b.ayirici, "comma");
    assert.equal(b.bastakiSifir, true);
    assert.equal(b.kaynak, "kilavuz");
  });

  test("kılavuz SUSUYORSA atıf sisteminin geleneği", () => {
    const apa = sayiBicimi(null, "apa7");
    assert.deepEqual(
      { ayirici: apa.ayirici, bastakiSifir: apa.bastakiSifir },
      { ayirici: "period", bastakiSifir: false },
      "APA ±1 ile sınırlı değerlerde baştaki sıfırı atar",
    );
    assert.equal(apa.kaynak, "atif-sistemi");

    /* Öteki sistemlerde böyle bir kural yok; sıfır yazılır. */
    for (const stil of ["chicago", "mla", "ieee", "vancouver"]) {
      const b = sayiBicimi(null, stil);
      assert.equal(b.bastakiSifir, true, stil);
      assert.equal(b.ayirici, "period", stil);
    }
  });

  test("atıf sistemi de bilinmiyorsa varsayılan, AMA kaynağı söylenir", () => {
    const b = sayiBicimi(null, null);
    assert.deepEqual({ ayirici: b.ayirici, bastakiSifir: b.bastakiSifir }, VARSAYILAN_BICIM);
    /* Çağıran bunu ekranda söylemeli; sessizce varsayılana düşmek
       kodun eski hâlinin yaptığı şeyin aynısıydı. */
    assert.equal(b.kaynak, "varsayilan");
  });

  test("kılavuz alanları BİRBİRİNDEN BAĞIMSIZ", () => {
    /* Bir kılavuz yalnızca ondalık ayırıcıyı söyleyip baştaki sıfır
       hakkında susabilir; susulan alan geleneğe düşer. */
    const b = sayiBicimi({ ayirici: "comma" }, "apa7");
    assert.equal(b.ayirici, "comma", "kılavuzdan");
    assert.equal(b.bastakiSifir, false, "APA geleneğinden");
    assert.equal(b.kaynak, "kilavuz");
  });

  test("bastakiSifir=false AÇIK BİR KURAL, susmak değil", () => {
    /* `false` ile `null` aynı şey değil: biri "yazma" der, öteki
       "bilmiyorum". `??` kullanıldığı için false korunmalı. */
    const b = sayiBicimi({ bastakiSifir: false }, "chicago");
    assert.equal(b.bastakiSifir, false);
    assert.equal(b.kaynak, "kilavuz");
  });
});

describe("yazılan sayı biçimleniyor", () => {
  const virgulluSifirli = { ayirici: "comma" as const, bastakiSifir: true };
  const noktaliSifirsiz = { ayirici: "period" as const, bastakiSifir: false };

  test("Türkçe kılavuz: virgül ve baştaki sıfır", () => {
    assert.equal(sayiMetniBicimle("0.021", virgulluSifirli, true), "0,021");
    assert.equal(sayiMetniBicimle(".021", virgulluSifirli, true), "0,021");
    assert.equal(sayiMetniBicimle("0,021", virgulluSifirli, true), "0,021");
  });

  test("APA: nokta ve sıfırsız", () => {
    assert.equal(sayiMetniBicimle("0,021", noktaliSifirsiz, true), ".021");
    assert.equal(sayiMetniBicimle("0.021", noktaliSifirsiz, true), ".021");
  });

  test("YAZILAN BASAMAK KORUNUR", () => {
    /* "p < .050" yazan kullanıcıya ".05" döndürmek, kaynağında
       olmayan bir kesinlik uydurmaktır (stats-interpreter'ın kendi
       kuralı). Metin yolu sayıya çevirmediği için basamak duruyor. */
    assert.equal(sayiMetniBicimle("0.050", noktaliSifirsiz, true), ".050");
    assert.equal(sayiMetniBicimle("0,10", virgulluSifirli, true), "0,10");
  });

  test("SINIRSIZ DEĞERDE baştaki sıfıra dokunulmaz", () => {
    /* Kural yalnızca ±1 ile sınırlı değerler (p, r, β) için. "0.5 kg"
       ölçümünden sıfırı atmak yanlış olurdu. */
    assert.equal(sayiMetniBicimle("0.5", noktaliSifirsiz), "0.5");
    assert.equal(sayiMetniBicimle("2.45", virgulluSifirli), "2,45");
  });

  test("eksi işareti korunur ve sıfır kuralı gövdeye uygulanır", () => {
    assert.equal(sayiMetniBicimle("-0.42", noktaliSifirsiz, true), "-.42");
    assert.equal(sayiMetniBicimle("-.42", virgulluSifirli, true), "-0,42");
  });

  test("sayıdan yazarken basamak verilir", () => {
    assert.equal(sayiYaz(0.0213, 3, virgulluSifirli, true), "0,021");
    assert.equal(sayiYaz(0.0213, 3, noktaliSifirsiz, true), ".021");
    assert.equal(sayiYaz(2.4531, 2, virgulluSifirli), "2,45");
  });

  test("hesaplanamayan değer sayı gibi yazılmıyor", () => {
    /* NaN "0,00" diye yazılsaydı kullanıcı onu gerçek bir sonuç
       sanardı; tire açıkça "hesaplanamadı" diyor. */
    assert.equal(sayiYaz(NaN, 2, virgulluSifirli), "—");
    assert.equal(sayiYaz(Infinity, 2, noktaliSifirsiz), "—");
  });
});
