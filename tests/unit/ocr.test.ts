import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ocrCalismadiUyarisi, ocrEksikDosyaUyarisi, taranmisBelgeMi } from "@/lib/ocr";

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

describe("OCR okuyamadığında yöneticiye söylenen", () => {
  test("eksik dosya uyarısı sorunun sunucuda olduğunu söylüyor", () => {
    /*
      05.10–25.10.2026: işçi betiği dağıtım paketinde olmadığı için gece
      turu her gece düştü. Kayıt "%0 güven, kural çıkmadı" diye duruyordu;
      yönetici kılavuzu ya da adresi düzeltmeye uğraşırdı, oysa yapılacak iş
      dosyayı pakete eklemekti.
    */
    const uyari = ocrEksikDosyaUyarisi("tesseract.js/src/worker-script/node/index.js");
    assert.match(uyari, /worker-script/);
    assert.match(uyari, /kılavuzun değil sunucunun/);
  });

  test("belgeden gelen hata sunucuyu suçlamıyor", () => {
    // Bozuk PDF de buraya düşüyor; "sunucunun sorunu" demek yanlış iz verirdi.
    const uyari = ocrCalismadiUyarisi("Invalid PDF structure.");
    assert.match(uyari, /OCR ile okunamadı/);
    assert.doesNotMatch(uyari, /sunucunun sorunu/);
  });

  test("uyarı tek parça metindir", () => {
    // Uyarılar diziye yayılıyor; dizge harflerine ayrılırsa panel okunmaz olur.
    assert.equal(typeof ocrCalismadiUyarisi("bellek yetmedi"), "string");
  });
});

describe("İngilizce uyarı (28.10.2026)", () => {
  test("OCR uyarıları İngilizce", () => {
    assert.equal(
      ocrCalismadiUyarisi("bellek yetmedi", "en"),
      "The document consists of scanned images but could not be read with OCR (bellek yetmedi); no rules could be extracted.",
    );
    assert.match(ocrEksikDosyaUyarisi("worker.js", "en"), /OCR files are missing on the server: worker\.js.*deployment bundle/);
  });
});
