import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bosSablonCsv, ornekSatirlar, sablonBasliklari, sablonDosyaAdi } from "@/lib/analiz-veri-sablonu";

/*
  GÜVENİLİRLİK VERİ ŞABLONU. Kart dosya seçilmeden önce doğru biçimi
  anlatıyor; buradaki testler şablonun gerçekten yüklenebilir bir CSV
  olduğunu ve örnek tablonun şablonla AYNI sütunları gösterdiğini
  sabitliyor. Şablonun gerçek yükleme akışından geçtiği
  scripts/yerel-yigin/analiz-alani-kabul.mjs S17'de ölçülüyor.
*/
describe("güvenilirlik veri şablonu", () => {
  for (const dil of ["tr", "en"] as const) {
    test(`${dil}: dört sütun, ilki katılımcı sütunu`, () => {
      const b = sablonBasliklari(dil);
      assert.equal(b.length, 4);
      assert.match(b[0], dil === "en" ? /^Participant$/ : /^Katılımcı$/);
      /* Üç madde: ω'nın en az gerektirdiği sayı. */
      assert.equal(b.slice(1).length, 3);
      for (const x of b) assert.ok(x.trim().length > 0);
    });

    test(`${dil}: boş şablonda YALNIZCA başlık satırı var`, () => {
      const csv = bosSablonCsv(dil);
      const satirlar = csv.split("\n").filter((x) => x.trim() !== "");
      assert.equal(satirlar.length, 1, `veri satırı olmamalı: ${csv}`);
      assert.equal(satirlar[0], sablonBasliklari(dil).join(","));
      /* Başlıklarda virgül olsaydı tırnaklamak gerekirdi; yok. */
      assert.equal(satirlar[0].split(",").length, 4);
    });

    test(`${dil}: örnek tablo şablonla aynı sütunları gösteriyor`, () => {
      const satirlar = ornekSatirlar(dil);
      assert.ok(satirlar.length >= 3, "birkaç kurgusal satır");
      for (const r of satirlar) {
        assert.equal(r.length, sablonBasliklari(dil).length);
        /* Katılımcı etiketi metin, yanıtlar sayı. */
        assert.ok(!Number.isFinite(Number(r[0])), `katılımcı etiketi sayı olmamalı: ${r[0]}`);
        for (const h of r.slice(1)) assert.ok(Number.isFinite(Number(h)), `yanıt sayı olmalı: ${h}`);
      }
      /* Satırlar birbirinin kopyası değil: varyans olmadan α da ω da hesaplanamaz. */
      assert.ok(new Set(satirlar.map((r) => r.slice(1).join(","))).size > 1);
    });

    test(`${dil}: dosya adı .csv`, () => {
      assert.match(sablonDosyaAdi(dil), /\.csv$/);
    });
  }

  test("iki dilin başlıkları ve dosya adları ayrı", () => {
    assert.notDeepEqual(sablonBasliklari("tr"), sablonBasliklari("en"));
    assert.notEqual(sablonDosyaAdi("tr"), sablonDosyaAdi("en"));
  });
});
