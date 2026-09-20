import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { taranmisBelgeMi } from "@/lib/ocr";

describe("taranmış belge tespiti", () => {
  test("metin PDF'i OCR'a girmez", () => {
    // Gerçek ölçüm: Gazi kılavuzu 72 sayfada 81.548 karakter (~1.130/sayfa).
    assert.equal(taranmisBelgeMi("x".repeat(81_548), 72), false);
  });

  test("boş metin taranmış sayılır", () => {
    // pdf-parse görüntü PDF'te hata vermiyor, boş metin dönüyor; kimse
    // belgenin okunamadığını fark etmiyordu.
    assert.equal(taranmisBelgeMi("", 40), true);
  });

  test("kapağı metin, gövdesi görüntü olan karma belge de girer", () => {
    // 40 sayfalık belgede yalnızca kapaktan 900 karakter: sayfa başına ~22.
    assert.equal(taranmisBelgeMi("x".repeat(900), 40), true);
  });

  test("kısa ama yoğun belge OCR'a girmez", () => {
    // 2 sayfalık bir özet kılavuz: sayfa başına 1.000 karakter.
    assert.equal(taranmisBelgeMi("x".repeat(2_000), 2), false);
  });

  test("sayfa sayısı bilinmiyorsa karar verilmez", () => {
    // Bölme tanımsız olurdu; OCR'ı boşuna çalıştırmak pahalıdır.
    assert.equal(taranmisBelgeMi("", 0), false);
  });
});
