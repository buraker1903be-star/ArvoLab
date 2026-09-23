import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { baslikNumarasi, numaralandirmaSorunlari } from "@/lib/sekil-tablo-numaralari";

const mesajlar = (basliklar: string[], etiket = "Tablo") =>
  numaralandirmaSorunlari(etiket, basliklar).map((sorun) => sorun.message);

describe("başlık numarası okuma", () => {
  test("sürekli ve bölüme göre numarayı okur", () => {
    assert.equal(baslikNumarasi("Tablo", "Tablo 7. Katılımcılar"), "7");
    assert.equal(baslikNumarasi("Tablo", "Tablo 3.1. Katılımcılar"), "3.1");
    assert.equal(baslikNumarasi("Şekil", "Şekil 2 – Akış"), "2");
  });

  test("numarasız başlıkta null", () => {
    assert.equal(baslikNumarasi("Tablo", "Katılımcıların dağılımı"), null);
  });
});

describe("numaralandırma denetimi", () => {
  test("düzgün sıralı başlıklarda sorun yok", () => {
    assert.deepEqual(mesajlar(["Tablo 1. Bir", "Tablo 2. İki", "Tablo 3. Üç"]), []);
  });

  test("bölüme göre numaralandırmada her bölüm 1'den başlar", () => {
    assert.deepEqual(mesajlar(["Tablo 2.1. Bir", "Tablo 2.2. İki", "Tablo 3.1. Üç"]), []);
  });

  test("aynı numara iki kez kullanılmışsa yakalanır", () => {
    // Eskiden hiç yakalanmıyordu: başlıklar sıraya göre numaralı sayılıyordu.
    const cikti = mesajlar(["Tablo 1. Bir", "Tablo 3. İki", "Tablo 3. Üç"]);
    assert.ok(cikti.some((mesaj) => mesaj.includes("2 kez kullanılmış")), cikti.join(" | "));
  });

  test("atlanan numara yakalanır", () => {
    const cikti = mesajlar(["Tablo 1. Bir", "Tablo 2. İki", "Tablo 4. Dört"]);
    assert.ok(cikti.some((mesaj) => mesaj.includes("atlama var")), cikti.join(" | "));
  });

  test("1'den başlamayan numaralandırma yakalanır", () => {
    const cikti = mesajlar(["Tablo 2. İki", "Tablo 3. Üç"]);
    assert.ok(cikti.some((mesaj) => mesaj.includes("ile başlamalı")), cikti.join(" | "));
  });

  test("karışık düzen hatadır", () => {
    const cikti = mesajlar(["Tablo 1.1. Bir", "Tablo 2. İki"]);
    assert.ok(cikti.some((mesaj) => mesaj.includes("karışık")), cikti.join(" | "));
  });

  test("numarasız başlık uyarı alır", () => {
    const cikti = mesajlar(["Tablo 1. Bir", "Katılımcıların dağılımı"]);
    assert.ok(cikti.some((mesaj) => mesaj.includes("numarayla başlamıyor")), cikti.join(" | "));
  });

  test("başlık yoksa hiç sorun üretilmez", () => {
    assert.deepEqual(mesajlar([]), []);
  });

  test("etiket Şekil olunca mesajlar da Şekil der", () => {
    const cikti = mesajlar(["Şekil 1. Bir", "Şekil 3. Üç"], "Şekil");
    assert.ok(cikti.every((mesaj) => !mesaj.includes("Tablo")), cikti.join(" | "));
  });
});
