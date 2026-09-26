import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { universiteAnahtari, universiteBul } from "../../lib/universite-adi";

const LISTE = [
  { id: "1", name: "Akdeniz Üniversitesi" },
  { id: "2", name: "Ağrı İbrahim Çeçen Üniversitesi" },
  { id: "3", name: "İstanbul Teknik Üniversitesi" },
];

describe("üniversite adı anahtarı", () => {
  test("büyük/küçük harf ve noktalama fark etmiyor", () => {
    assert.equal(universiteAnahtari("Akdeniz Üniversitesi"), universiteAnahtari("AKDENİZ ÜNİVERSİTESİ"));
    assert.equal(universiteAnahtari("Akdeniz  Üniversitesi "), universiteAnahtari("Akdeniz-Üniversitesi"));
  });

  /*
    YÖK dizini adları BÜYÜK harfle veriyor ("AKDENİZ ÜNİVERSİTESİ"),
    veritabanı ise başlık düzeninde. İkisi aynı anahtara inmezse keşif
    üniversiteyi hiç bulamaz.
  */
  test("YÖK yazımı ile veritabanı yazımı aynı anahtara iniyor", () => {
    assert.equal(universiteAnahtari("AKDENİZ ÜNİVERSİTESİ"), "AKDENIZ UNIVERSITESI");
    assert.equal(universiteAnahtari("Akdeniz Üniversitesi"), "AKDENIZ UNIVERSITESI");
  });

  /*
    Noktasız "ı" birleşen işaret taşımadığı için NFKD ile sadeleşmiyor;
    elle "i"ye çevrilmezse sonraki süzgeç onu ATAR ve "Ağrı" → "AGR" olur.
  */
  test("noktasız ı atılmıyor, i'ye çevriliyor", () => {
    assert.equal(universiteAnahtari("Ağrı"), "AGRI");
    assert.ok(universiteAnahtari("Ağrı İbrahim Çeçen Üniversitesi").includes("AGRI"));
  });

  test("Türkçe harfler ASCII karşılığına iniyor", () => {
    assert.equal(universiteAnahtari("Çukurova Öğretim Şubesi Güzel"), "CUKUROVA OGRETIM SUBESI GUZEL");
  });

  test("boş ad boş anahtar", () => {
    assert.equal(universiteAnahtari("   "), "");
    assert.equal(universiteAnahtari("—"), "");
  });
});

describe("üniversite bulma", () => {
  test("yazım farkına rağmen buluyor", () => {
    assert.equal(universiteBul(LISTE, "AKDENİZ ÜNİVERSİTESİ")?.id, "1");
    assert.equal(universiteBul(LISTE, "  akdeniz üniversitesi ")?.id, "1");
  });

  /*
    TAHMİN YOK. Yanlış üniversiteye kılavuz bağlamak, hiç bağlamamaktan
    kötü: öğrencinin editörüne başka kurumun kuralları iner.
  */
  test("kısmi ad eşleşmiyor", () => {
    assert.equal(universiteBul(LISTE, "Akdeniz"), null);
    assert.equal(universiteBul(LISTE, "İstanbul Üniversitesi"), null, "Teknik ile karıştırılmamalı");
  });

  test("boş ad null", () => {
    assert.equal(universiteBul(LISTE, ""), null);
    assert.equal(universiteBul(LISTE, "   "), null);
  });
});
