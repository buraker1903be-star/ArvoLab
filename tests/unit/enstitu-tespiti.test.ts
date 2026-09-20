import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { enstituTespitEt, fakulteVeyaBolumBelgesi } from "@/lib/enstitu-tespiti";

/** Gerçek kapak sayfalarının biçimi: büyük harf, T.C. ile başlar. */
const kapak = (universite: string, enstitu: string) =>
  `T.C.\n${universite.toLocaleUpperCase("tr")}\n${enstitu.toLocaleUpperCase("tr")}\nTEZ YAZIM KILAVUZU`;

describe("enstitü tespiti", () => {
  test("kapak sayfasından enstitü okunur", () => {
    const sonuc = enstituTespitEt({ metin: kapak("Ankara Üniversitesi", "Sosyal Bilimler Enstitüsü") });
    assert.equal(sonuc?.ad, "Sosyal Bilimler Enstitüsü");
    assert.equal(sonuc?.kaynak, "metin");
  });

  test("üniversite adı enstitü adına karışmaz", () => {
    // "ANKARA ÜNİVERSİTESİ FEN BİLİMLERİ ENSTİTÜSÜ" → yalnız enstitü kısmı.
    const sonuc = enstituTespitEt({ metin: kapak("Ankara Üniversitesi", "Fen Bilimleri Enstitüsü") });
    assert.equal(sonuc?.ad, "Fen Bilimleri Enstitüsü");
  });

  test("yazım varyantları aynı kanonik ada düşer", () => {
    // Aynı enstitü iki farklı yazımla iki ayrı kayıt olmamalı.
    const a = enstituTespitEt({ metin: "SAĞLIK BİLİMLERİ ENSTİTÜSÜ" });
    const b = enstituTespitEt({ metin: "Sağlık Bilimleri Enstitüsü tez yazım kılavuzu" });
    assert.equal(a?.ad, "Sağlık Bilimleri Enstitüsü");
    assert.equal(b?.ad, a?.ad);
  });

  test("başlık da metin sayılır", () => {
    const sonuc = enstituTespitEt({ baslik: "Eğitim Bilimleri Enstitüsü Tez Yazım Kılavuzu", metin: "" });
    assert.equal(sonuc?.ad, "Eğitim Bilimleri Enstitüsü");
  });

  test('"Enstitüsü" sözcüğü olmadan eşleşme olmaz', () => {
    // "Sosyal Bilimler" tek başına bir fakülte, bölüm ya da alan adı olabilir.
    assert.equal(enstituTespitEt({ metin: "Sosyal Bilimler Fakültesi öğrencileri için" }), null);
  });

  test("iki enstitü yarışıyorsa karar verilmez", () => {
    /*
      Ortak kılavuzlarda ve örnek kapak listelerinde birden çok enstitü adı
      geçer. Yanlış enstitüye bağlamak, bağlamamaktan kötüdür.
    */
    const metin = "SOSYAL BİLİMLER ENSTİTÜSÜ ... FEN BİLİMLERİ ENSTİTÜSÜ";
    assert.equal(enstituTespitEt({ metin }), null);
  });

  test("baskın enstitü kazanır", () => {
    const metin = `${"SOSYAL BİLİMLER ENSTİTÜSÜ ".repeat(4)} FEN BİLİMLERİ ENSTİTÜSÜ`;
    assert.equal(enstituTespitEt({ metin })?.ad, "Sosyal Bilimler Enstitüsü");
  });

  test("metin yoksa adres yedek olarak kullanılır", () => {
    const sonuc = enstituTespitEt({ metin: "Tez yazım kuralları", url: "https://sbe.gazi.edu.tr/kilavuz.pdf" });
    assert.equal(sonuc?.ad, "Sosyal Bilimler Enstitüsü");
    assert.equal(sonuc?.kaynak, "adres");
  });

  test("metin adresi ezer", () => {
    // Kapak sayfası kurumun kendi beyanı; alt alan adı kısaltması tahmindir
    // ve üniversiteden üniversiteye farklı anlama gelebiliyor.
    const sonuc = enstituTespitEt({
      metin: kapak("Gazi Üniversitesi", "Fen Bilimleri Enstitüsü"),
      url: "https://sbe.gazi.edu.tr/kilavuz.pdf",
    });
    assert.equal(sonuc?.ad, "Fen Bilimleri Enstitüsü");
    assert.equal(sonuc?.kaynak, "metin");
  });

  test("tanınmayan adreste tahmin yapılmaz", () => {
    assert.equal(enstituTespitEt({ metin: "Tez kuralları", url: "https://www.ornek.edu.tr/belge.pdf" }), null);
  });

  test("lisansüstü eğitim enstitüsü tanınır", () => {
    // Çok sayıda üniversite enstitülerini bu tek çatı altında birleştirdi.
    assert.equal(
      enstituTespitEt({ metin: kapak("Bartın Üniversitesi", "Lisansüstü Eğitim Enstitüsü") })?.ad,
      "Lisansüstü Eğitim Enstitüsü",
    );
  });
});

describe("fakülte / bölüm belgesi ayıklama", () => {
  test("fakülte belgesi enstitü kılavuzu sayılmaz", () => {
    // Canlıda "Hacettepe Üniversitesi — Tıp Fakültesi" kaydı oluşmuştu.
    assert.equal(fakulteVeyaBolumBelgesi({ metin: "HACETTEPE ÜNİVERSİTESİ TIP FAKÜLTESİ TEZ YAZIM" }), true);
  });

  test("bölüm belgesi enstitü kılavuzu sayılmaz", () => {
    // Canlıda "Bilkent Üniversitesi — Arkeoloji Bölümü" kaydı oluşmuştu.
    assert.equal(fakulteVeyaBolumBelgesi({ baslik: "Arkeoloji Bölümü Tez Kılavuzu" }), true);
  });

  test("enstitü geçiyorsa fakülte sözcüğü belgeyi diskalifiye etmez", () => {
    // Kılavuzlar sık sık "… Fakültesi öğrencileri" diye örnek verir.
    assert.equal(
      fakulteVeyaBolumBelgesi({ metin: "SOSYAL BİLİMLER ENSTİTÜSÜ … İktisat Fakültesi mezunları için" }),
      false,
    );
  });

  test("hiçbiri geçmiyorsa diskalifiye edilmez", () => {
    assert.equal(fakulteVeyaBolumBelgesi({ metin: "Tez yazım kuralları" }), false);
  });
});
