import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kunyeAyristir, kunyeleriAyristir } from "@/lib/atif/kunye";
import { STILLER, stilAdi, stilTanimi } from "@/lib/atif/stiller";

const hatalar = (kunye: { issues: { severity: string; field: string }[] }) =>
  kunye.issues.filter((s) => s.severity === "error").map((s) => s.field);
const alanlar = (kunye: { issues: { field: string }[] }) => kunye.issues.map((s) => s.field);

describe("stil tanımları", () => {
  test("dört stil de tanımlı ve türü belli", () => {
    assert.equal(STILLER.apa7.tur, "yazar-tarih");
    assert.equal(STILLER.chicago.tur, "yazar-tarih");
    assert.equal(STILLER.ieee.tur, "numara");
    assert.equal(STILLER.vancouver.tur, "numara");
  });

  test("bilinmeyen değer APA'ya düşer; kayıtların varsayılanı da odur", () => {
    assert.equal(stilTanimi("mla").id, "apa7");
    assert.equal(stilTanimi(null).id, "apa7");
    assert.equal(stilAdi("ieee"), "IEEE");
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
