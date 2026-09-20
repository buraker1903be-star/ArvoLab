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
