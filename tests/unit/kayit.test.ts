import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kayitGirdisiniDenetle } from "@/lib/kayit";

const gecerli = { email: "ogrenci@ornek.edu.tr", sifre: "uzunbirsifre", adSoyad: "Ahmet Yılmaz", kvkk: true };
const hata = (girdi: Parameters<typeof kayitGirdisiniDenetle>[0]) => {
  const sonuc = kayitGirdisiniDenetle(girdi);
  return "hata" in sonuc ? sonuc.hata : null;
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
    assert.match(hata({ ...gecerli, sifre: "kısa" }) ?? "", /en az 8/);
    assert.match(hata({ ...gecerli, kvkk: false }) ?? "", /aydınlatma/);
  });

  test("şifre e-posta ile aynı olamaz", () => {
    assert.match(hata({ ...gecerli, sifre: "ogrenci@ornek.edu.tr" }) ?? "", /aynı olamaz/);
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
