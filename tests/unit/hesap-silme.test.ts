/*
  Hesap silmenin bekleme süresi ve onayı.

  Silinen şey bir tez: bu modülün her kuralı "geri alınamaz bir işlemi
  yanlışlıkla yapmayı zorlaştırmak" için var.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BEKLEME_GUNU, kalanGun, onayGecerli, silinmeTarihi, suresiDoldu } from "@/lib/hesap-silme";

const T = new Date("2026-09-25T12:00:00Z");
const gun = (n: number) => new Date(T.getTime() + n * 86_400_000);

describe("bekleme süresi", () => {
  test("silinme tarihi talepten BEKLEME_GUNU sonra", () => {
    assert.equal(silinmeTarihi(T).toISOString(), gun(BEKLEME_GUNU).toISOString());
  });

  test("kalan gün yukarı yuvarlanır", () => {
    // Yarım gün kalmışken "0 gün" demek, daha vakti varken bugün
    // silineceğini düşündürür.
    assert.equal(kalanGun(T, gun(BEKLEME_GUNU - 0.5)), 1);
    assert.equal(kalanGun(T, T), BEKLEME_GUNU);
    assert.equal(kalanGun(T, gun(1)), BEKLEME_GUNU - 1);
  });

  test("süre dolunca 0 ve negatife düşmüyor", () => {
    assert.equal(kalanGun(T, gun(BEKLEME_GUNU)), 0);
    assert.equal(kalanGun(T, gun(BEKLEME_GUNU + 5)), 0);
  });

  test("süresi doldu mu", () => {
    assert.equal(suresiDoldu(T, gun(BEKLEME_GUNU - 1)), false);
    assert.equal(suresiDoldu(T, gun(BEKLEME_GUNU)), true);
    assert.equal(suresiDoldu(T, gun(BEKLEME_GUNU + 1)), true);
  });
});

describe("onay", () => {
  test("kendi e-postası kabul edilir", () => {
    assert.equal(onayGecerli("ayse@ornek.com", "ayse@ornek.com"), true);
    assert.equal(onayGecerli("  Ayse@Ornek.COM  ", "ayse@ornek.com"), true, "Boşluk ve harf boyutu engel değil");
  });

  test("noktalı I taşıyan adres kendi sahibini reddetmiyor", () => {
    /*
      Türkçe küçültmeyle "ISIK@ORNEK.COM" → "ısık@ornek.com" olur ve
      kullanıcı kendi adresini doğru yazdığı hâlde onay tutmazdı; hesabını
      silemezdi. lib/kayit.ts'te aynı tuzak e-postayı bozuyordu.
    */
    assert.equal(onayGecerli("ISIK@ORNEK.COM", "isik@ornek.com"), true);
    assert.equal(onayGecerli("isik@ornek.com", "ISIK@ORNEK.COM"), true);
  });

  test("başka bir şey yazmak yetmiyor", () => {
    assert.equal(onayGecerli("SİL", "ayse@ornek.com"), false);
    assert.equal(onayGecerli("baska@ornek.com", "ayse@ornek.com"), false);
    assert.equal(onayGecerli("", "ayse@ornek.com"), false);
    assert.equal(onayGecerli("   ", "ayse@ornek.com"), false);
  });

  test("e-posta bilinmiyorsa onay geçersiz", () => {
    // Oturum bozuksa silme işlemi başlamamalı.
    assert.equal(onayGecerli("ayse@ornek.com", null), false);
    assert.equal(onayGecerli("ayse@ornek.com", undefined), false);
  });
});
