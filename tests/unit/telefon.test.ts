import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  telefonGecerliMi,
  telefonuAyir,
  telefonuBirlestir,
  ULKE_KODLARI,
  ulkeKoduVarMi,
  VARSAYILAN_ULKE_KODU,
} from "@/lib/telefon";

describe("telefonuBirlestir", () => {
  test("ülke kodu ve numarayı tek metinde birleştirir", () => {
    assert.equal(telefonuBirlestir("+90", "532 000 00 00"), "+90 532 000 00 00");
  });

  test("numara boşsa null: telefon isteğe bağlı", () => {
    assert.equal(telefonuBirlestir("+90", ""), null);
    assert.equal(telefonuBirlestir("+90", "   "), null);
  });

  test("tanınmayan ülke kodu varsayılana düşer", () => {
    assert.equal(telefonuBirlestir("+999", "532 000 00 00"), `${VARSAYILAN_ULKE_KODU} 532 000 00 00`);
  });

  test("rakam ve ayırıcı dışındaki karakterler atılır", () => {
    assert.equal(telefonuBirlestir("+44", "20 <script> 7946 0018"), "+44 20 7946 0018");
  });
});

describe("telefonuAyir", () => {
  test("kayıtlı numarayı kod ve yerel olarak ayırır", () => {
    assert.deepEqual(telefonuAyir("+90 532 000 00 00"), { ulkeKodu: "+90", yerel: "532 000 00 00" });
  });

  test("boş değerde varsayılan kod ve boş numara", () => {
    assert.deepEqual(telefonuAyir(null), { ulkeKodu: VARSAYILAN_ULKE_KODU, yerel: "" });
    assert.deepEqual(telefonuAyir(""), { ulkeKodu: VARSAYILAN_ULKE_KODU, yerel: "" });
  });

  test("önek çakışmasında EN UZUN kod kazanır", () => {
    /* "+7" de listede: "+90…" numarası "+7" ile eşleşmemeli. */
    assert.deepEqual(telefonuAyir("+90 532 000 00 00").ulkeKodu, "+90");
    assert.deepEqual(telefonuAyir("+7 701 000 00 00").ulkeKodu, "+7");
    assert.deepEqual(telefonuAyir("+971 50 000 0000").ulkeKodu, "+971");
  });

  test("birleştir ve ayır birbirinin tersi", () => {
    for (const { kod } of ULKE_KODLARI) {
      const saklanan = telefonuBirlestir(kod, "532 000 00 00");
      assert.deepEqual(telefonuAyir(saklanan), { ulkeKodu: kod, yerel: "532 000 00 00" }, `kod ${kod}`);
    }
  });
});

describe("telefonGecerliMi", () => {
  test("null geçerli: alan isteğe bağlı", () => {
    assert.equal(telefonGecerliMi(null), true);
  });

  test("ülke kodlu numara geçerli", () => {
    assert.equal(telefonGecerliMi("+90 532 000 00 00"), true);
    assert.equal(telefonGecerliMi("+44 20 7946 0018"), true);
  });

  test("ülke kodu olmayan numara geçersiz", () => {
    assert.equal(telefonGecerliMi("532 000 00 00"), false);
  });

  test("çok kısa ve çok uzun numaralar geçersiz", () => {
    assert.equal(telefonGecerliMi("+90 123"), false);
    assert.equal(telefonGecerliMi(`+90 ${"1".repeat(18)}`), false);
  });

  test("harf içeren değer geçersiz", () => {
    assert.equal(telefonGecerliMi("+90 532 ABC 00 00"), false);
  });

  test("veritabanı kısıtıyla aynı biçimi kabul eder", () => {
    /* supabase/migrations/…_profil_ad_soyad_telefon.sql içindeki
       profiles_telefon_bicim kısıtı: iki taraf ayrışırsa kayıt sunucuda
       geçer, veritabanında düşer. */
    const kisit = /^\+[0-9]{1,4}[0-9 ()-]{4,20}$/;
    for (const deger of ["+90 532 000 00 00", "+1 (212) 555-0100", "+971 50 000 0000"]) {
      assert.equal(telefonGecerliMi(deger), true, deger);
      assert.ok(kisit.test(deger), `kısıt reddetti: ${deger}`);
    }
  });
});

describe("ülke kodu listesi", () => {
  test("varsayılan kod listede", () => {
    assert.equal(ulkeKoduVarMi(VARSAYILAN_ULKE_KODU), true);
  });
  test("kodlar tekil ve + ile başlıyor", () => {
    const kodlar = ULKE_KODLARI.map((u) => u.kod);
    assert.equal(new Set(kodlar).size, kodlar.length);
    for (const kod of kodlar) assert.match(kod, /^\+\d{1,4}$/);
  });
  test("her kodun iki dilde adı var", () => {
    for (const u of ULKE_KODLARI) {
      assert.ok(u.ad.tr.length > 0, u.kod);
      assert.ok(u.ad.en.length > 0, u.kod);
    }
  });
});
