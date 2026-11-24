import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { celiskiliAdaylar, stilDayanagi } from "@/lib/kilavuz-stil-dayanagi";

/*
  Dayanak gösterilmeden yapılan çıkarım, öğrencinin doğrulayamadığı bir
  hükümdür. Bu dosya üç şeyi sabitler: kuralı SÖYLEYEN cümle seçiliyor,
  bölüm başlığı bulunuyor ve kanıt yoksa null dönüyor (uydurulmuyor).
*/

const KILAVUZ = [
  "T.C. ÖRNEK ÜNİVERSİTESİ",
  "SOSYAL BİLİMLER ENSTİTÜSÜ",
  "TEZ YAZIM KILAVUZU",
  "",
  "1. GİRİŞ",
  "Bu kılavuz tez yazımında uyulacak kuralları açıklar.",
  "Tezlerde APA, Chicago, MLA gibi yaygın sistemlerden biri görülebilir.",
  "",
  "2. KAYNAK GÖSTERME",
  "Tez metninde kaynak gösterimi APA 7 sistemine göre yapılır.",
  "Kaynakça alfabetik sırayla düzenlenir.",
].join("\n");

describe("stilDayanagi", () => {
  test("kuralı söyleyen cümleyi seçiyor, sayım cümlesini değil", () => {
    const d = stilDayanagi(KILAVUZ, "apa7");
    assert.ok(d);
    assert.match(d.alinti, /APA 7 sistemine göre yapılır/);
    assert.doesNotMatch(d.alinti, /gibi yaygın sistemlerden/);
  });

  test("alıntının üstündeki bölüm başlığını buluyor", () => {
    assert.equal(stilDayanagi(KILAVUZ, "apa7")?.bolum, "KAYNAK GÖSTERME");
  });

  test("sayfa ayracı yoksa sayfa UYDURULMUYOR", () => {
    assert.equal(stilDayanagi(KILAVUZ, "apa7")?.sayfa, null);
  });

  test("sayfa ayracı varsa sayfa numarası veriliyor", () => {
    const sayfali = `Kapak\n\fİçindekiler\n\f2. KAYNAK GÖSTERME\nKaynak gösterimi Vancouver sistemine göre yapılır.`;
    const d = stilDayanagi(sayfali, "vancouver");
    assert.equal(d?.sayfa, 3);
    assert.equal(d?.bolum, "KAYNAK GÖSTERME");
  });

  test("adı hiç geçmeyen stilde null", () => {
    assert.equal(stilDayanagi(KILAVUZ, "ieee"), null);
  });

  test("boş metinde ve stilsizde null", () => {
    assert.equal(stilDayanagi("", "apa7"), null);
    assert.equal(stilDayanagi(KILAVUZ, null), null);
  });

  /* "Harvard University" bir üniversite adı, atıf sistemi değil. */
  test("Harvard University dayanak sayılmıyor", () => {
    const metin = "Bu kılavuz Harvard University uygulamasından esinlenmiştir.\nKaynak gösterimi APA 7 sistemine göre yapılır.";
    assert.equal(stilDayanagi(metin, "harvard"), null);
  });
});

describe("kuralın kapsamı (hangi program)", () => {
  test("cümlenin başındaki program ifadesi kapsam oluyor; ek düşüyor", () => {
    const metin = "2. KAYNAK GÖSTERME\nSağlık bilimleri programlarında Vancouver sistemi kullanılır.";
    /* Ekli hâli cümleye konunca "…programlarında için" diye okunuyordu. */
    assert.equal(stilDayanagi(metin, "vancouver")?.kapsam, "Sağlık bilimleri programları");
  });

  /* Taranmış kılavuzlarda OCR Türkçe harfleri aşındırıyor; kapsam yine okunmalı. */
  test("aksanı aşınmış metinde de kapsam okunuyor", () => {
    const metin = "2. KAYNAK GOSTERME\nSaglik bilimleri programlarinda Vancouver sistemi kullanilir.";
    assert.equal(stilDayanagi(metin, "vancouver")?.kapsam, "Saglik bilimleri programları");
  });

  test("aksansız bölüm başlığı da kapsam sayılıyor", () => {
    const metin = "3. SAGLIK BILIMLERI PROGRAMLARI\nKaynak gosterimi Vancouver sistemine gore yapilir.";
    assert.equal(stilDayanagi(metin, "vancouver")?.kapsam, "SAGLIK BILIMLERI PROGRAMLARI");
  });

  test("cümlede kapsam yoksa bölüm başlığına düşülüyor (başlık program diyorsa)", () => {
    const metin = "3. SAĞLIK BİLİMLERİ PROGRAMLARI\nKaynak gösterimi Vancouver sistemine göre yapılır.";
    assert.equal(stilDayanagi(metin, "vancouver")?.kapsam, "SAĞLIK BİLİMLERİ PROGRAMLARI");
  });

  /* "… yazılır:" satırı kuralı anlatan cümledir, bölüm başlığı değil. */
  test("yüklemi olan satır başlık sayılmıyor", () => {
    const metin = [
      "4.3 İNTERNET KAYNAKLARI",
      "Kaynak gösterimi aşağıdaki biçimde yazılır:",
      "Sağlık bilimleri programlarında Vancouver sistemi kullanılacaktır.",
    ].join("\n");
    assert.equal(stilDayanagi(metin, "vancouver")?.bolum, "İNTERNET KAYNAKLARI");
  });

  test("kapsam yoksa null; uydurulmuyor", () => {
    const metin = "2. KAYNAK GÖSTERME\nKaynak gösterimi APA 7 sistemine göre yapılır.";
    const d = stilDayanagi(metin, "apa7");
    assert.equal(d?.bolum, "KAYNAK GÖSTERME");
    assert.equal(d?.kapsam, null);
  });

  test("İngilizce kapsam", () => {
    const metin = "2. REFERENCING\nFor social sciences programmes the APA style is used.";
    assert.equal(stilDayanagi(metin, "apa7")?.kapsam, "social sciences programmes");
  });
});

describe("çelişkili kuralda adaylar dayanağıyla geliyor", () => {
  test("iki sistem birden geçiyorsa ikisinin de cümlesi veriliyor", () => {
    const celiskili = [
      "2. KAYNAK GÖSTERME",
      "Sosyal bilimler programlarında kaynak gösterimi APA 7 sistemine göre yapılır.",
      "",
      "3. SAĞLIK BİLİMLERİ",
      "Sağlık bilimleri programlarında Vancouver sistemi kullanılır.",
    ].join("\n");
    const adaylar = celiskiliAdaylar(celiskili, [
      { sistem: "apa7", etiket: "APA 7", sayim: 3 },
      { sistem: "vancouver", etiket: "Vancouver", sayim: 2 },
    ]);
    assert.equal(adaylar.length, 2);
    assert.match(adaylar[0].dayanak!.alinti, /APA 7 sistemine göre yapılır/);
    assert.equal(adaylar[0].dayanak!.bolum, "KAYNAK GÖSTERME");
    assert.match(adaylar[1].dayanak!.alinti, /Vancouver sistemi kullanılır/);
    assert.equal(adaylar[1].dayanak!.bolum, "SAĞLIK BİLİMLERİ");
  });

  test("dayanağı bulunamayan aday null dayanakla geliyor, listeden düşmüyor", () => {
    const adaylar = celiskiliAdaylar("Kaynak gösterimi APA 7 sistemine göre yapılır.", [
      { sistem: "apa7", etiket: "APA 7", sayim: 3 },
      { sistem: "ieee", etiket: "IEEE", sayim: 1 },
    ]);
    assert.equal(adaylar.length, 2);
    assert.ok(adaylar[0].dayanak);
    assert.equal(adaylar[1].dayanak, null);
  });
});
