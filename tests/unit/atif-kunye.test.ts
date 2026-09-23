import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kunyeAyristir, kunyeleriAyristir } from "@/lib/atif/kunye";
import { STILLER, stilAdi, stilTanimi } from "@/lib/atif/stiller";

const hatalar = (kunye: { issues: { severity: string; field: string }[] }) =>
  kunye.issues.filter((s) => s.severity === "error").map((s) => s.field);
const alanlar = (kunye: { issues: { field: string }[] }) => kunye.issues.map((s) => s.field);

describe("stil tanımları", () => {
  test("beş stil de tanımlı ve türü belli", () => {
    assert.equal(STILLER.apa7.tur, "yazar-tarih");
    assert.equal(STILLER.chicago.tur, "yazar-tarih");
    assert.equal(STILLER.ieee.tur, "numara");
    assert.equal(STILLER.vancouver.tur, "numara");
    // MLA üçüncü tür: metin içi atıfta yıl değil SAYFA var.
    assert.equal(STILLER.mla.tur, "yazar-sayfa");
  });

  test("bilinmeyen değer APA'ya düşer; kayıtların varsayılanı da odur", () => {
    assert.equal(stilTanimi("turabian").id, "apa7");
    assert.equal(stilTanimi(null).id, "apa7");
    assert.equal(stilAdi("ieee"), "IEEE");
    assert.equal(stilAdi("mla"), "MLA 9");
  });

  test("numara stillerinde kaynakça atıf sırasında; alfabe uyarısı verilmemeli", () => {
    assert.equal(STILLER.vancouver.kaynakcaSirasi, "atif-sirasi");
    assert.equal(STILLER.apa7.kaynakcaSirasi, "alfabetik");
  });
});

describe("Chicago künyesi", () => {
  test("kusursuz künye sorunsuz geçer", () => {
    const kunye = kunyeAyristir('Yılmaz, A. 2020. Örgütsel bağlılık. Ankara Üniversitesi Yayınları.', "chicago");
    assert.equal(kunye.year, "2020");
    assert.deepEqual(hatalar(kunye), []);
  });

  test("yıl yoksa hata verir — eskiden Chicago hiç sorun üretmiyordu", () => {
    const kunye = kunyeAyristir("Yılmaz, A. Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(hatalar(kunye).includes("year"));
  });

  /*
    Chicago'nun yazar deseni APA'nınkiydi: yalnızca baş harf geçiyordu.
    Chicago'yu DOĞRU yazan öğrenci hata alıyor ve mesaj ona "beklenen:
    Soyad, Ad" diyordu — zaten yazdığı şey. Testler yokluğunda görünmedi,
    çünkü hepsi "Yılmaz, A." kullanıyordu.
  */
  /*
    author_format "error" değil "warning" — bu yüzden hatalar() ile
    sınamak boşa geçer. alanlar() bütün sorunları veriyor.
  */
  test("ad açık yazılmış künye yazar uyarısı almaz (asıl Chicago biçimi)", () => {
    const kunye = kunyeAyristir("Yılmaz, Ahmet. 2020. Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(!alanlar(kunye).includes("author_format"));
  });

  test("ikinci yazar düz yazılır, uyarı almaz", () => {
    const kunye = kunyeAyristir("Yılmaz, Ahmet, ve Ayşe Demir. 2020. Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(!alanlar(kunye).includes("author_format"));
  });

  test("baş harfli yazım da kabul edilir (Chicago izin verir)", () => {
    const kunye = kunyeAyristir("Yılmaz, A., ve B. Demir. 2020. Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(!alanlar(kunye).includes("author_format"));
  });

  test("ters yazılmamış ilk yazar yine uyarı alır", () => {
    const kunye = kunyeAyristir("ahmet yılmaz. 2020. Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(alanlar(kunye).includes("author_format"));
  });

  test("yıl parantez içindeyse Chicago kuralına uymaz", () => {
    // APA alışkanlığıyla yazılmış künye: Chicago'da yıl yazardan sonra, parantezsiz.
    const kunye = kunyeAyristir("Yılmaz, A. (2020). Örgütsel bağlılık. Ankara.", "chicago");
    assert.ok(hatalar(kunye).includes("year"));
  });
});

describe("Vancouver künyesi", () => {
  test("kusursuz künye sorunsuz geçer", () => {
    const kunye = kunyeAyristir("1. Yılmaz A, Demir B. Tip 2 diyabette egzersiz. Türk Tıp Dergisi. 2020;12(3):1-20.", "vancouver", 1);
    assert.equal(kunye.year, "2020");
    assert.deepEqual(hatalar(kunye), []);
  });

  test("numara atlanmışsa yakalanır", () => {
    // Metindeki (7) başka bir kaynağa denk gelir ve kimse fark etmez.
    const kunye = kunyeAyristir("7. Yılmaz A. Başlık. Dergi. 2020;1:1-5.", "vancouver", 3);
    assert.ok(hatalar(kunye).includes("number"));
  });

  test("numarasız künye yakalanır", () => {
    const kunye = kunyeAyristir("Yılmaz A. Başlık. Dergi. 2020;1:1-5.", "vancouver", 1);
    assert.ok(hatalar(kunye).includes("number"));
  });

  test("yıl yoksa hata verir", () => {
    const kunye = kunyeAyristir("1. Yılmaz A. Başlık. Dergi.", "vancouver", 1);
    assert.ok(hatalar(kunye).includes("year"));
  });
});

describe("IEEE künyesi", () => {
  test("köşeli parantezli numara beklenir", () => {
    const kunye = kunyeAyristir('[1] A. Yılmaz, "Derin öğrenme," IEEE Trans., cilt 12, no. 3, ss. 1-20, 2020.', "ieee", 1);
    assert.equal(kunye.year, "2020");
    assert.deepEqual(hatalar(kunye), []);
  });

  test("Vancouver biçiminde yazılmış künye IEEE'de numara hatası verir", () => {
    const kunye = kunyeAyristir("1. A. Yılmaz, Başlık, 2020.", "ieee", 1);
    assert.ok(hatalar(kunye).includes("number"));
  });
});

describe("APA yolu korunuyor", () => {
  test("mevcut motora gidiyor ve kusursuz künyeye hata basmıyor", () => {
    const kunye = kunyeAyristir("Bandura, A. (1977). Self-efficacy. Psychological Review.", "apa7");
    assert.equal(kunye.year, "1977");
    assert.deepEqual(hatalar(kunye), []);
  });

  test("yıl parantezi yoksa hata", () => {
    assert.ok(hatalar(kunyeAyristir("Bandura, A. 1977. Self-efficacy.", "apa7")).includes("year"));
  });
});

describe("kaynakça listesi", () => {
  test("numara stilinde sıra künyeye geçer", () => {
    const liste = kunyeleriAyristir(
      ["1. Yılmaz A. Bir. Dergi. 2019;1:1-5.", "3. Demir B. İki. Dergi. 2020;2:6-9."],
      "vancouver",
    );
    assert.deepEqual(hatalar(liste[0]), []);
    assert.ok(hatalar(liste[1]).includes("number"));
  });

  test("yazar-tarih stilinde sıra numarası aranmaz", () => {
    const liste = kunyeleriAyristir(
      ["Yılmaz, A. 2019. Bir. Ankara.", "Demir, B. 2020. İki. İstanbul."],
      "chicago",
    );
    assert.deepEqual(liste.flatMap(alanlar).filter((alan) => alan === "number"), []);
  });
});

describe("MLA künyesi", () => {
  const mla = (ham: string) => kunyeAyristir(ham, "mla");

  test("kusursuz künye sorunsuz geçer", () => {
    const kunye = mla("Yılmaz, Ahmet. Osmanlı'da Şehir Kültürü. İletişim Yayınları, 2020.");
    assert.deepEqual(hatalar(kunye), []);
    assert.equal(kunye.year, "2020");
    assert.equal(kunye.title, "Osmanlı'da Şehir Kültürü");
    assert.deepEqual(kunye.authors, ["Yılmaz, Ahmet"]);
  });

  test("yıl sonda okunur; cilt ve sayfa yılla karıştırılmaz", () => {
    const kunye = mla('Demir, Ayşe. "Metinlerarasılık." Edebiyat Dergisi, c. 12, sy. 3, 2019, ss. 45-60.');
    assert.equal(kunye.year, "2019");
    assert.deepEqual(hatalar(kunye), []);
  });

  test("yıl hiç yoksa hata verir", () => {
    const kunye = mla("Yılmaz, Ahmet. Osmanlı'da Şehir Kültürü. İletişim Yayınları.");
    assert.ok(hatalar(kunye).includes("year"));
  });

  test("MLA'da ad kısaltılmaz: 'Yılmaz, A.' uyarı alır", () => {
    const kunye = mla("Yılmaz, A. Osmanlı'da Şehir Kültürü. İletişim Yayınları, 2020.");
    assert.ok(alanlar(kunye).includes("author_format"));
  });

  test("ikinci yazar düz yazılır ve uyarı almaz", () => {
    // Tek desenle denetlenseydi kusursuz künyenin ikinci yazarına hata basılırdı.
    const kunye = mla("Yılmaz, Ahmet, ve Ayşe Demir. Ortak Kitap. İletişim Yayınları, 2021.");
    assert.deepEqual(alanlar(kunye).filter((alan) => alan === "author_format"), []);
  });
});
