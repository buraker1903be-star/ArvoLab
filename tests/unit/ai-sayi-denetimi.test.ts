import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sayilar, uydurmaSayilar } from "../../lib/ai/sayi-denetimi";
import { bulgulariCozumle } from "@/lib/ai/bulgu";

describe("sayı çıkarma", () => {
  test("virgül, nokta ve baştaki sıfır aynı sayıya çıkar", () => {
    assert.deepEqual(sayilar("p = 0,05 ve p = .05 ile .050"), [".05", ".05", ".05"]);
    // χ² içindeki üst simge 2 rakam sayılmaz; yalnızca gerçek değerler çıkar.
    assert.deepEqual(sayilar("χ²(1, N = 120) = 6.14"), ["1", "120", "6.14"]);
    assert.deepEqual(sayilar("r = -.42"), ["-.42"]);
  });
});

describe("uydurma sayı denetimi", () => {
  const girdi = "t(28) = 2.45, p = .021";

  test("girdideki sayılarla yazılmış yorum geçer", () => {
    assert.deepEqual(uydurmaSayilar("t(28) = 2.45, p = .021 olduğundan fark anlamlıdır (p < .05).", girdi), []);
  });

  test("girdide olmayan değer yakalanır", () => {
    // Döndürülen değerler normalleştirilmiştir: "0.83" → ".83"
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 olarak hesaplanmıştır.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });

  test("doğrulanmış ek kaynaktaki sayılar serbest", () => {
    const apa = "t(28) = 2.45, p = .021, N = 30";
    assert.deepEqual(uydurmaSayilar("30 katılımcıyla yapılan analizde fark anlamlıdır.", girdi, apa), []);
  });

  test("eşik değerleri ve madde numaraları serbest", () => {
    assert.deepEqual(uydurmaSayilar("1. Sonuç p < .001 düzeyinde anlamlıdır. 2. Etki yönü pozitiftir.", girdi), []);
  });
});

describe("yanlış alarmlar (canlı, 20.09.2026)", () => {
  const girdi = "t(58) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nχ²(1, N = 60) = 6.14, p = .013";

  test("boşluksuz serbestlik derecesi ondalık sayılmaz", () => {
    // Girdide "F(2, 57)" boşluklu; asistan "F(2,57)" yazınca Türkçe ondalık
    // kuralıyla 2,57 okunuyor ve uydurma sanılıp cevabın tamamı atılıyordu.
    assert.deepEqual(uydurmaSayilar("F(2,57) üç grupla tutarlı.", girdi), []);
    assert.deepEqual(sayilar("F(2,57)"), ["2", "57"]);
    assert.deepEqual(sayilar("χ²(1,58) anlamlı"), ["1", "58"]);
  });

  test("gerçek ondalığa dokunulmaz", () => {
    // Kural yalnızca test adından sonraki parantezde geçerli.
    assert.deepEqual(sayilar("(p = 0,021)"), [".021"]);
    assert.deepEqual(sayilar("ortalama 2,57 bulundu"), ["2.57"]);
  });

  test("standart sürümü sayısal iddia değildir", () => {
    assert.deepEqual(uydurmaSayilar("APA 7 standardı etki büyüklüğü ister.", girdi), []);
    assert.deepEqual(uydurmaSayilar("Tip 1 hata riski artar.", girdi), []);
  });

  test("gerçek uydurma hâlâ yakalanır", () => {
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 çıkar.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });
});

describe("serbest liste · bilinçli dengenin bedeli", () => {
  /*
    Bu testler bir DOĞRULUĞU değil, kabul edilmiş bir SINIRI sabitliyor.
    Serbest listenin gerekçesi lib/ai/sayi-denetimi.ts'te yazılı; burada
    bedeli görünür tutuluyor ki bir sonraki okuyan "denetim uydurmayı
    yakalıyor" diye fazla güvenmesin.
  */
  const girdi = "t(28) = 2.45, p = .021";

  test("95 ve 100 serbest: güven aralığı cümlesi cevabı düşürmüyor", () => {
    // Asıl kazanç bu: kullanıcı yalnızca t ve p yapıştırdığında standart
    // bir güven aralığı cümlesi yanlış alarm üretmiyor.
    assert.deepEqual(uydurmaSayilar("Etki %95 güven aralığında raporlanmalı.", girdi), []);
  });

  test("aynı değerlerle kurulmuş uydurma KAÇIYOR (kabul edilmiş sınır)", () => {
    /*
      Bu satırlar "geçmesi gereken" değil, "bugün geçtiği bilinen"
      durumlar. Daraltma yolu bağlama bakmak olurdu ama "%95 güven
      aralığı" ile "%95'i kadındır" ayırt edilemiyor.
    */
    assert.deepEqual(uydurmaSayilar("Katılımcıların %95'i kadındır.", girdi), []);
    assert.deepEqual(uydurmaSayilar("Çalışma 100 katılımcıyla yapılmıştır.", girdi), []);
  });

  test("sınırın DIŞINDAKİ uydurmalar yakalanmaya devam ediyor", () => {
    // Serbest liste dar tutulmalı: 68, 83, 42 gibi değerler yakalanıyor.
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
    assert.deepEqual(uydurmaSayilar("Ortalama yaş 42 idi.", girdi), ["42"]);
    assert.deepEqual(uydurmaSayilar("Örneklem 96 kişiydi.", girdi), ["96"]);
  });
});

describe("çıktı kanalı düz yazı taşıyamaz", () => {
  /*
    "Asistan denetler, yazmaz" kuralının koddaki karşılığı YAPISAL: model
    ne yazarsa yazsın, bulgu listesi biçiminde olmayan hiçbir şey okunmuyor.
    Ayrı bir "hazır cümle" denetimi bilerek yok — asistanın öğrencinin kendi
    cümlesini alıntılaması meşru ve ikisi ayırt edilemiyor.
  */
  test("düz yazı yanıt hiç bulguya dönüşmüyor", () => {
    const duzYazi = "Şöyle yazabilirsiniz: Bulgular hipotezi desteklemektedir. Ayrıca tartışmayı genişletin.";
    assert.deepEqual(bulgulariCozumle(duzYazi), []);
  });

  test("başlık ve açıklama kırpılıyor: paragraf sığmaz", () => {
    const uzun = JSON.stringify({
      bulgular: [{ tur: "oneri", baslik: "x".repeat(200), aciklama: "y".repeat(2000) }],
    });
    const [bulgu] = bulgulariCozumle(uzun);
    assert.equal(bulgu.baslik.length, 60);
    assert.equal(bulgu.aciklama.length, 400);
  });
});
