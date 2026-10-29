import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ayiriciBul, csvCoz, csvOku, excelSatirlariniDuzelt, hucreDegeri, kodluGrupSutunlari, metniCoz } from "@/lib/veri-okuma";

const utf8 = (metin: string) => new TextEncoder().encode(metin);
/* Windows-1254: Ş=0xDE, İ=0xDD, ı=0xFD, ğ=0xF0 */
const cp1254 = (metin: string) =>
  Uint8Array.from([...metin].map((c) => ({ Ş: 0xde, İ: 0xdd, ı: 0xfd, ğ: 0xf0, ş: 0xfe, ü: 0xfc, ö: 0xf6, ç: 0xe7 } as Record<string, number>)[c] ?? c.charCodeAt(0)));

describe("Türkçe Excel CSV'si", () => {
  test("noktalı virgül, ondalık virgül, binlik nokta", () => {
    // Eskiden: 3,5 → 35; 4,25 → 425; 1.250 → 1.25 (canlıda ölçüldü)
    const v = csvOku(utf8("Ad;Puan;Gelir\nAyşe;3,5;1.250\nAli;4,25;12.000,50\n"));
    assert.deepEqual(v.satirlar, [
      { Ad: "Ayşe", Puan: 3.5, Gelir: 1250 },
      { Ad: "Ali", Puan: 4.25, Gelir: 12000.5 },
    ]);
    assert.ok(v.notlar.some((n) => /virgül/.test(n)));
  });

  test("Windows-1254 kodlu dosya", () => {
    // Eskiden "Şehir" → "ehir", "İzmir" → "Ýzmir".
    const v = csvOku(cp1254("Şehir;Puan\nİzmir;3,5\n"));
    assert.deepEqual(v.sutunlar, ["Şehir", "Puan"]);
    assert.deepEqual(v.satirlar, [{ Şehir: "İzmir", Puan: 3.5 }]);
    assert.ok(v.notlar.some((n) => /1254/.test(n)));
  });

  test("UTF-8 BOM başlığa karışmaz", () => {
    assert.deepEqual(csvOku(utf8("﻿Yaş,Puan\n21,3.5\n")).sutunlar, ["Yaş", "Puan"]);
  });

  test("İngilizce CSV olduğu gibi", () => {
    const v = csvOku(utf8('name,score,income\nA,3.5,"1,250"\n'));
    assert.deepEqual(v.satirlar, [{ name: "A", score: 3.5, income: 1250 }]);
    assert.deepEqual(v.notlar, []);
  });
});

describe("hücre", () => {
  test("yalnızca boşluk BOŞ, 0 değil", () => {
    // Number(" ") === 0: boşlukla silinen hücre ortalamaya 0 olarak giriyordu.
    assert.equal(hucreDegeri("   ", "nokta"), null);
    assert.equal(hucreDegeri(" ", "virgul"), null);
  });

  test("metin metin kalır", () => {
    assert.equal(hucreDegeri("Kadın", "virgul"), "Kadın");
    assert.equal(hucreDegeri("12a", "nokta"), "12a");
  });

  test("baştaki sıfırı yazılmayan ve noktalı kesir", () => {
    assert.equal(hucreDegeri(",5", "virgul"), 0.5);
    assert.equal(hucreDegeri("1.5", "virgul"), 1.5);
    assert.equal(hucreDegeri("-2,75", "virgul"), -2.75);
  });
});

describe("ayrıştırma", () => {
  test("tırnak içinde ayırıcı ve satır sonu", () => {
    assert.deepEqual(csvCoz('a;b\n"x;y";"satır\nsonu"\n', ";"), [["a", "b"], ["x;y", "satır\nsonu"]]);
  });

  test("ayırıcı tutarlılıktan bulunur", () => {
    assert.equal(ayiriciBul("a;b;c\n1,5;2,5;3\n"), ";");
    assert.equal(ayiriciBul("a\tb\n1\t2\n"), "\t");
    assert.equal(ayiriciBul("a,b\n1,2\n"), ",");
  });

  /*
    Eskiden başlıkta ayırıcı yoksa "," varsayılıyordu: tek sütunlu Türkçe
    dosyada "3,5" bölünüp 3 oluyordu (ortalama 3,25 yerine 3, uyarısız).
  */
  test("tek sütunlu Türkçe dosyada ondalık kaybolmaz", () => {
    assert.equal(ayiriciBul("Puan\n3,5\n4,25\n2\n"), "");
    const v = csvOku(utf8("Puan\n3,5\n4,25\n2\n"));
    assert.deepEqual(v.sutunlar, ["Puan"]);
    assert.deepEqual(v.satirlar.map((s) => s.Puan), [3.5, 4.25, 2]);
  });

  test("başlıktan fazla alanı olan satır sessiz kalmaz", () => {
    const v = csvOku(utf8("a,b\n1,2\n3,4,5\n"));
    assert.ok(v.notlar.some((n) => /1 satırda başlıktan fazla alan/.test(n)), v.notlar.join(" | "));
  });

  test("geçersiz UTF-8 Windows-1254'e düşer", () => {
    assert.equal(metniCoz(Uint8Array.from([0xde, 0x61])).kodlama, "windows-1254");
    assert.equal(metniCoz(utf8("Şa")).kodlama, "utf-8");
  });
});

describe("Excel satırları", () => {
  test("metin hücresindeki '3,5' sayıya, boşluk boşa döner", () => {
    const v = excelSatirlariniDuzelt(["A", "B"], [{ A: "3,5", B: 2 }, { A: "4,0", B: " " }]);
    assert.deepEqual(v.satirlar, [{ A: 3.5, B: 2 }, { A: 4, B: null }]);
  });
});

describe("sayıyla kodlanmış grup", () => {
  test("1/2 kodlu cinsiyet grup olabilir, sürekli puan olamaz", () => {
    const satirlar = [
      { Cinsiyet: 1, Puan: 3.5, Yas: 21 },
      { Cinsiyet: 2, Puan: 4.1, Yas: 22 },
      { Cinsiyet: 1, Puan: 2.9, Yas: 35 },
    ];
    assert.deepEqual(kodluGrupSutunlari(["Cinsiyet", "Puan", "Yas"], satirlar), ["Cinsiyet", "Yas"]);
  });

  test("on birden fazla farklı değer grup değildir", () => {
    const satirlar = Array.from({ length: 30 }, (_, i) => ({ Yas: 18 + i }));
    assert.deepEqual(kodluGrupSutunlari(["Yas"], satirlar), []);
  });
});

describe("İngilizce notlar (28.10.2026)", () => {
  test("virgül ondalık notu ve adsız sütun İngilizce", () => {
    const bayt = new TextEncoder().encode(";puan\n1;3,5\n2;4,25\n");
    const en = csvOku(bayt, "en");
    assert.deepEqual(en.sutunlar, ["Column 1", "puan"]);
    assert.deepEqual(en.notlar, ["The comma was read as the decimal separator (3,5 → 3.5; 1.250 → 1250)."]);
    assert.deepEqual(csvOku(bayt).sutunlar, ["Sütun 1", "puan"]);
  });
});
