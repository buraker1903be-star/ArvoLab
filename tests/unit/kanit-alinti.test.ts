import assert from "node:assert/strict";
import test from "node:test";
import { ALINTI_EN_AZ, alintiDenetle, kanitMetniNormallestir } from "@/lib/kanit/alinti";
import { ALINTI_HATASI, alintiHatasi } from "@/lib/kanit/alinti";

/*
  Alıntı denetimi kanıt zincirinin en kritik halkası: "ilgili kanıt
  bulundu" yalnızca kaynaktaki metinden alınmış bir parça varsa
  söylenebilir. Veritabanıyla aynı kuralın sınandığı yer
  tests/db/kanit-zinciri.test.mjs.
*/

const METIN = "Bulgular, öğrencilerin öz-yeterlik puanlarının “anlamlı biçimde” yük-\nsek olduğunu göstermektedir.";

test("PDF kopyasındaki tireleme, kıvrık tırnak ve satır sonu alıntıyı düşürmez", () => {
  assert.deepEqual(alintiDenetle('puanlarının "anlamlı biçimde" yüksek olduğunu', METIN), { gecti: true });
});

test("metinde olmayan alıntı reddedilir", () => {
  assert.deepEqual(alintiDenetle("puanları iki kat arttı ve kalıcı oldu", METIN), { gecti: false, neden: "metinde_yok" });
});

test("büyük/küçük harf korunur: harfi değiştirilmiş alıntı doğrudan alıntı değildir", () => {
  assert.equal(alintiDenetle("BULGULAR, ÖĞRENCİLERİN ÖZ-YETERLİK", METIN).gecti, false);
});

test("çok kısa parça kanıt sayılmaz; metin yoksa alıntı da yok", () => {
  assert.deepEqual(alintiDenetle("Bulgular", METIN), { gecti: false, neden: "kisa" });
  assert.ok("Bulgular".length < ALINTI_EN_AZ);
  assert.deepEqual(alintiDenetle("öğrencilerin öz-yeterlik puanlarının", ""), { gecti: false, neden: "metin_yok" });
  assert.deepEqual(alintiDenetle("   ", METIN), { gecti: false, neden: "bos" });
});

test("normalleştirme yalnızca biçimi eşitler, sözcükleri birleştirmez", () => {
  assert.equal(kanitMetniNormallestir("a  b\n\tc"), "a b c");
  // Satır sonunda OLMAYAN tire korunur (öz-yeterlik).
  assert.equal(kanitMetniNormallestir("öz-yeterlik"), "öz-yeterlik");
  assert.equal(kanitMetniNormallestir("yük-\n  sek"), "yüksek");
});

test("alıntı hatası iki dilde; eski Türkçe harita aynı", () => {
  assert.equal(alintiHatasi("metinde_yok"), ALINTI_HATASI.metinde_yok);
  assert.equal(alintiHatasi("kisa", "en"), `The quotation must be at least ${ALINTI_EN_AZ} characters; a very short fragment can appear in any text.`);
});
