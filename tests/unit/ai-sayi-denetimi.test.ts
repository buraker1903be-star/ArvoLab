import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sayilar, uydurmaSayilar } from "../../lib/ai/sayi-denetimi";

describe("sayı çıkarma", () => {
  test("virgül, nokta ve baştaki sıfır aynı sayıya çıkar", () => {
    assert.deepEqual(sayilar("p = 0,05 ve p = .05 ile .050"), [".05", ".05", ".05"]);
    // χ² içindeki üst simge 2 rakam sayılmaz; yalnızca gerçek değerler çıkar.
    assert.deepEqual(sayilar("χ²(1, N = 120) = 6.14"), ["1", "120", "6.14"]);
    assert.deepEqual(sayilar("r = -.42"), ["-.42"]);
  });
});

describe("uydurma sayı denetimi", () => {
  const girdi = "t(28) = 2.45, p = .021";

  test("girdideki sayılarla yazılmış yorum geçer", () => {
    assert.deepEqual(uydurmaSayilar("t(28) = 2.45, p = .021 olduğundan fark anlamlıdır (p < .05).", girdi), []);
  });

  test("girdide olmayan değer yakalanır", () => {
    // Döndürülen değerler normalleştirilmiştir: "0.83" → ".83"
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 olarak hesaplanmıştır.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });

  test("doğrulanmış ek kaynaktaki sayılar serbest", () => {
    const apa = "t(28) = 2.45, p = .021, N = 30";
    assert.deepEqual(uydurmaSayilar("30 katılımcıyla yapılan analizde fark anlamlıdır.", girdi, apa), []);
  });

  test("eşik değerleri ve madde numaraları serbest", () => {
    assert.deepEqual(uydurmaSayilar("1. Sonuç p < .001 düzeyinde anlamlıdır. 2. Etki yönü pozitiftir.", girdi), []);
  });
});

describe("yanlış alarmlar (canlı, 20.09.2026)", () => {
  const girdi = "t(58) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nχ²(1, N = 60) = 6.14, p = .013";

  test("boşluksuz serbestlik derecesi ondalık sayılmaz", () => {
    // Girdide "F(2, 57)" boşluklu; asistan "F(2,57)" yazınca Türkçe ondalık
    // kuralıyla 2,57 okunuyor ve uydurma sanılıp cevabın tamamı atılıyordu.
    assert.deepEqual(uydurmaSayilar("F(2,57) üç grupla tutarlı.", girdi), []);
    assert.deepEqual(sayilar("F(2,57)"), ["2", "57"]);
    assert.deepEqual(sayilar("χ²(1,58) anlamlı"), ["1", "58"]);
  });

  test("gerçek ondalığa dokunulmaz", () => {
    // Kural yalnızca test adından sonraki parantezde geçerli.
    assert.deepEqual(sayilar("(p = 0,021)"), [".021"]);
    assert.deepEqual(sayilar("ortalama 2,57 bulundu"), ["2.57"]);
  });

  test("standart sürümü sayısal iddia değildir", () => {
    assert.deepEqual(uydurmaSayilar("APA 7 standardı etki büyüklüğü ister.", girdi), []);
    assert.deepEqual(uydurmaSayilar("Tip 1 hata riski artar.", girdi), []);
  });

  test("gerçek uydurma hâlâ yakalanır", () => {
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 çıkar.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });
});
