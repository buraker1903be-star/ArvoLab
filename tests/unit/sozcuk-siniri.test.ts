/*
  Sözcük sınırı yardımcısı (lib/sozcuk-siniri.ts).

  Var olma sebebi: JavaScript'te \b ASCII tabanlı. Türkçe harfle BAŞLAYAN
  bir sözcüğün önünde sınır oluşmaz, yani kalıp "çalışıyor" görünür ama tam
  o sözcüklerde hiç eşleşmez. Kodda üç ayrı yerde üç farklı yazımla duran
  önbakış burada tek tanıma indirildi.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { SOZCUK_BASI, SOZCUK_SONU, sozcuk } from "@/lib/sozcuk-siniri";

const desen = (govde: string) => new RegExp(sozcuk(govde), "iu");

describe("sözcük sınırı", () => {
  test("Türkçe harfle başlayan sözcük yakalanır (\\b yakalayamıyordu)", () => {
    const eski = /\b(çalışma)/iu;
    const yeni = desen("çalışma");
    assert.equal(eski.test("bu çalışma kapsamında"), false, "Eski davranış değişmiş; testin gerekçesi güncellenmeli");
    assert.equal(yeni.test("bu çalışma kapsamında"), true);
  });

  test("satır başındaki Türkçe sözcük de yakalanır", () => {
    assert.equal(desen("şubat").test("Şubat 2024"), true);
  });

  test("sözcüğün içine düşen eşleşme sayılmaz", () => {
    // "tez" içeren "tezgah" tez değildir; sonu da sınırlı olmalı.
    assert.equal(desen("tez").test("tezgah"), false);
    assert.equal(desen("tez").test("bu tez"), true);
  });

  test("rakam da sınır sayılır", () => {
    // "Tablo 3" ararken "Tablo 31" eşleşmemeli; sınırın rakamı da
    // dışlaması bunun için.
    assert.equal(new RegExp(`${SOZCUK_BASI}3${SOZCUK_SONU}`, "u").test("Tablo 31"), false);
    assert.equal(new RegExp(`${SOZCUK_BASI}3${SOZCUK_SONU}`, "u").test("Tablo 3"), true);
  });

  test("tire ve noktalama sınır sayılır", () => {
    assert.equal(desen("kaya").test("Demir-Kaya"), true);
    assert.equal(desen("kaya").test("(Kaya)"), true);
  });
});
