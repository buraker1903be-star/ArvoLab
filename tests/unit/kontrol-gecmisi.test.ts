import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kontrolSayilari, yapiSorunlariniTemizle } from "@/lib/kontrol-gecmisi";

describe("kontrol geçmişi", () => {
  test("yapı sorunları temizlenir: bozuk öğe atılır, bilinmeyen tür ve eylem düşer", () => {
    const temiz = yapiSorunlariniTemizle([
      { tone: "danger", message: "Atıf yok", target: "(Kaya, 2019)", kategori: "kaynakca", action: "sort-references" },
      { tone: "warning", message: "Boş", kategori: "uydurma", action: "rm -rf" },
      { tone: "info", message: "x" },
      { tone: "warning" },
      null,
      "metin",
    ]);
    assert.deepEqual(temiz, [
      { tone: "danger", message: "Atıf yok", target: "(Kaya, 2019)", kategori: "kaynakca", action: "sort-references" },
      { tone: "warning", message: "Boş" },
    ]);
    assert.deepEqual(yapiSorunlariniTemizle("x"), []);
    assert.equal(yapiSorunlariniTemizle(Array.from({ length: 200 }, () => ({ tone: "warning", message: "m" }))).length, 80);
  });

  test("sayılar yapı sorunlarından", () => {
    assert.deepEqual(
      kontrolSayilari([{ tone: "danger", message: "a" }, { tone: "warning", message: "b" }, { tone: "warning", message: "c" }], 2, 2479.4),
      { hata: 1, uyari: 2, eksik_bolum: 2, kelime: 2479 },
    );
  });
});
