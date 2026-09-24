/*
  APA biçimlendirmesi ve NaN koruması.

  Gerçek veride tanımsız sonuç sık: bir grubun bütün değerleri aynıysa
  varyans sıfır, t = 0/0 = NaN. Bu değer eskiden olduğu gibi
  biçimlendiriliyordu ve öğrenci ekranda tezine yapıştırabileceği görünümde
  bir satır görüyordu: "t(4) = NaN, p = NaN — istatistiksel olarak anlamlı
  değil". İkinci yarısı daha sinsiydi: hesaplanamamış bir testi "anlamlı
  değil" diye raporlamak, veri hakkında yanlış bir iddiadır.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, formatP, hesaplanabilir, HESAPLANAMADI, isSignificant } from "@/lib/apa-format";

describe("APA p değeri", () => {
  test("eşik altı ve üstü APA biçiminde", () => {
    assert.equal(formatP(0.0004), "p < .001");
    assert.equal(formatP(0.0221), "p = .022");
    assert.equal(formatP(0.5), "p = .500");
  });

  test("baştaki sıfır APA'da yazılmaz", () => {
    assert.equal(formatP(0.049), "p = .049");
  });

  test("hesaplanamayan p sayı gibi gösterilmez", () => {
    assert.equal(formatP(Number.NaN), HESAPLANAMADI);
    assert.equal(formatP(Number.POSITIVE_INFINITY), HESAPLANAMADI);
    assert.equal(formatP(Number.NaN).includes("NaN"), false);
  });
});

describe("anlamlılık", () => {
  test("eşik", () => {
    assert.equal(isSignificant(0.049), true);
    assert.equal(isSignificant(0.05), false);
    assert.equal(isSignificant(0.2), false);
  });

  test("hesaplanamayan p ANLAMLI DEĞİL diye raporlanamaz", () => {
    // isSignificant(NaN) zaten false dönüyordu; sorun çağıranın bunu
    // "anlamlı değil" cümlesine çevirmesiydi. Burada niyet sabitleniyor:
    // hesaplanabilir() ile ayrı ayrı sorulmalı.
    assert.equal(isSignificant(Number.NaN), false);
    assert.equal(hesaplanabilir(Number.NaN), false, "Çağıran önce bunu sormalı");
  });
});

describe("sayı biçimi", () => {
  test("ondalık basamak", () => {
    assert.equal(formatNumber(4), "4.00");
    assert.equal(formatNumber(2.345), "2.35");
    assert.equal(formatNumber(2.345, 3), "2.345");
  });

  test("hesaplanamayan sayı NaN yazmaz", () => {
    assert.equal(formatNumber(Number.NaN), HESAPLANAMADI);
    assert.equal(formatNumber(Number.NEGATIVE_INFINITY), HESAPLANAMADI);
  });
});

describe("hesaplanabilir", () => {
  test("hepsi sonluysa doğru", () => {
    assert.equal(hesaplanabilir(1, 2, 0.5), true);
    assert.equal(hesaplanabilir(), true);
  });

  test("biri bile tanımsızsa yanlış", () => {
    assert.equal(hesaplanabilir(1, Number.NaN), false);
    assert.equal(hesaplanabilir(Number.POSITIVE_INFINITY, 2), false);
  });
});
