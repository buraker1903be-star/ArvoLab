import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kayitGirdisiniDenetle, telefonuTemizle, TELEFON_DESENI } from "@/lib/kayit";

const gecerli = {
  email: "ogrenci@ornek.edu.tr", adSoyad: "Ahmet Yılmaz",
  telefon: "0532 123 45 67", kvkk: true, sozlesme: true, sozlesmeOkundu: true,
};
const hata = (girdi: Parameters<typeof kayitGirdisiniDenetle>[0]) => {
  const sonuc = kayitGirdisiniDenetle(girdi);
  return "hata" in sonuc ? sonuc.hata.tr : null;
};

describe("kayıt doğrulaması", () => {
  test("geçerli girdi kabul edilir ve temizlenir", () => {
    const sonuc = kayitGirdisiniDenetle({ ...gecerli, email: "  Ogrenci@Ornek.Edu.TR ", adSoyad: "  Ahmet   Yılmaz " });
    assert.ok("deger" in sonuc);
    assert.equal(sonuc.deger.email, "ogrenci@ornek.edu.tr");
    assert.equal(sonuc.deger.adSoyad, "Ahmet Yılmaz");
  });

  test("eksik alanlar tek tek söyleniyor", () => {
    assert.match(hata({ ...gecerli, adSoyad: "" }) ?? "", /Ad ve soyad/);
    assert.match(hata({ ...gecerli, email: "ornek" }) ?? "", /e-posta/);
    assert.match(hata({ ...gecerli, kvkk: false }) ?? "", /aydınlatma/);
  });

  /* G1: şifre kayıtta alınmıyor; gönderilse bile değere girmiyor. */
  test("kayıt şifre almaz (doğrulamadan sonra belirlenir)", () => {
    const sonuc = kayitGirdisiniDenetle({ ...gecerli, sifre: "saldirganin-sifresi" } as Parameters<typeof kayitGirdisiniDenetle>[0]);
    assert.ok("deger" in sonuc);
    assert.equal("sifre" in sonuc.deger, false);
  });

  test("sıra dışı ama geçerli adresler reddedilmiyor", () => {
    // Dar bir desen, geçerli adresi olan kullanıcıyı kapıda bırakırdı.
    for (const email of ["ad.soyad+tez@ornek.edu.tr", "a@b.co", "kisi@alt.kurum.gov.tr"]) {
      assert.equal(hata({ ...gecerli, email }), null, `${email} reddedildi`);
    }
  });

  test("Türkçe büyük harf dönüşümü adresi bozmuyor", () => {
    // toLowerCase() "I"yı "i" yapar; tr-TR "ı" yapar. Adres ASCII olduğu
    // için ikisi de aynı sonucu vermeli — vermezse giriş ile kayıt ayrışır.
    const sonuc = kayitGirdisiniDenetle({ ...gecerli, email: "ISIK@ORNEK.COM" });
    assert.ok("deger" in sonuc);
    assert.equal(sonuc.deger.email, "isik@ornek.com");
  });
});

describe("kayıt: telefon ve sözleşme (02.11.2026)", () => {
  test("telefon serbest yazımla kabul edilir, rakamlara iner", () => {
    assert.equal(telefonuTemizle("0532 123 45 67"), "05321234567");
    assert.equal(telefonuTemizle("+90 (532) 123-4567"), "+905321234567");
    assert.equal(telefonuTemizle("+44 20 7946 0958"), "+442079460958");
    for (const kotu of ["", "12345", "0532abc4567", "+1234567890123456", "05-32-12"]) assert.equal(telefonuTemizle(kotu), null, kotu);
  });

  test("telefon zorunlu", () => {
    assert.match(hata({ ...gecerli, telefon: "" }) ?? "", /telefon/);
  });

  /* Kutu işaretli ama metin okunmamış: onay delil olarak yazılmamalı. */
  test("sözleşme kutusu ve okuma ikisi de gerekli", () => {
    assert.match(hata({ ...gecerli, sozlesme: false }) ?? "", /Kullanım Sözleşmesi/);
    assert.match(hata({ ...gecerli, sozlesmeOkundu: false }) ?? "", /Kullanım Sözleşmesi/);
  });

  test("iletişim izni isteğe bağlı, varsayılan hayır", () => {
    const sonuc = kayitGirdisiniDenetle(gecerli);
    assert.ok("deger" in sonuc && sonuc.deger.iletisimIzni === false && sonuc.deger.telefon === "05321234567");
    const izinli = kayitGirdisiniDenetle({ ...gecerli, iletisimIzni: true });
    assert.ok("deger" in izinli && izinli.deger.iletisimIzni === true);
  });
});

describe("kayıt: telefon deseni tarayıcıda geçerli (RC06k, 17.11.2026)", () => {
  /* Tarayıcı <input pattern>'i ^(?:desen)$ biçiminde `v` bayrağıyla derler.
     Eski desen "\+?[\d\s().\-]{10,20}" bu kipte SyntaxError veriyordu. */
  const derle = (bayrak: "u" | "v") => new RegExp(`^(?:${TELEFON_DESENI})$`, bayrak);

  test("eski desen v kipinde derlenmiyordu (hatanın kendisi)", () => {
    assert.throws(() => new RegExp(String.raw`^(?:\+?[\d\s().\-]{10,20})$`, "v"), SyntaxError);
  });

  test("yeni desen u ve v kipinde derlenir ve sunucuyla aynı yazımları kabul eder", () => {
    for (const bayrak of ["u", "v"] as const) {
      const desen = derle(bayrak);
      for (const yazim of ["0532 123 45 67", "+90 (532) 123-4567", "05321234567", "0532.123.45.67"]) {
        assert.ok(desen.test(yazim), `${bayrak}: ${yazim}`);
        assert.ok(telefonuTemizle(yazim), `sunucu: ${yazim}`);
      }
      for (const yazim of ["abc1234567890", "0532/123/45/67", "12345"]) assert.equal(desen.test(yazim), false, `${bayrak}: ${yazim}`);
    }
  });

  test("sunucu doğrulaması desenden bağımsız korunur: desenin geçirdiği kısa rakam dizisi sunucuda düşer", () => {
    // "(((())))))" 10 karakter, desene uyar ama rakam yok: istemci erken uyarıdır, karar sunucuda.
    assert.ok(derle("v").test("((((()))))"));
    assert.equal(telefonuTemizle("((((()))))"), null);
    assert.match(hata({ ...gecerli, telefon: "((((()))))" }) ?? "", /telefon/);
    assert.ok("deger" in kayitGirdisiniDenetle(gecerli));
  });
});
