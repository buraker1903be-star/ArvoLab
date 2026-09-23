import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { farkMetni, sayfaDuzeniFarklari, sayfaDuzeniOzeti } from "@/lib/sayfa-duzeni";

const KENAR = { top: 3, bottom: 2.5, left: 4, right: 2.5 };

describe("sayfa düzeni farkları", () => {
  test("kılavuza uyan çalışmada fark yok", () => {
    const farklar = sayfaDuzeniFarklari({
      margins: KENAR,
      showPageNumbers: true,
      kilavuz: { margins: KENAR, showPageNumbers: true },
    });
    assert.deepEqual(farklar, []);
  });

  test("değiştirilmiş kenar boşluğu yakalanır", () => {
    const farklar = sayfaDuzeniFarklari({
      margins: { ...KENAR, left: 2.5 },
      showPageNumbers: true,
      kilavuz: { margins: KENAR, showPageNumbers: true },
    });
    assert.equal(farklar.length, 1);
    assert.equal(farklar[0].alan, "Sol boşluk");
    assert.equal(farkMetni(farklar[0]), "Sol boşluk 4 cm olmalı (şu an 2,5 cm)");
  });

  test("sayfa numarası kapatılmışsa yakalanır", () => {
    const farklar = sayfaDuzeniFarklari({
      margins: KENAR,
      showPageNumbers: false,
      kilavuz: { margins: KENAR, showPageNumbers: true },
    });
    assert.deepEqual(farklar.map((f) => f.alan), ["Sayfa numarası"]);
    assert.equal(farklar[0].kilavuz, "açık");
  });

  test("kılavuzda tanımlı olmayan alan hata sayılmaz", () => {
    // "Bilmiyorum" ile "yanlış" aynı şey değil: kılavuz sayfa numarası
    // hakkında bir şey söylemiyorsa öğrencinin tercihi hata değildir.
    const farklar = sayfaDuzeniFarklari({
      margins: { ...KENAR, left: 2 },
      showPageNumbers: false,
      kilavuz: { margins: undefined, showPageNumbers: undefined },
    });
    assert.deepEqual(farklar, []);
  });

  test("kılavuz bağlı değilse karşılaştırma yapılmaz", () => {
    assert.deepEqual(
      sayfaDuzeniFarklari({ margins: KENAR, showPageNumbers: false, kilavuz: null }),
      [],
    );
  });

  test("2.5 ile \"2.50\" aynı sayılır", () => {
    // Kenar boşlukları veritabanında numeric; PostgREST metin döndürebiliyor.
    const farklar = sayfaDuzeniFarklari({
      margins: { top: "2.50" as unknown as number, bottom: 2.5, left: 2.5, right: 2.5 },
      showPageNumbers: true,
      kilavuz: { margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }, showPageNumbers: true },
    });
    assert.deepEqual(farklar, []);
  });

  test("dört kenar da farklıysa dördü de listelenir", () => {
    const farklar = sayfaDuzeniFarklari({
      margins: { top: 2, bottom: 2, left: 2, right: 2 },
      showPageNumbers: true,
      kilavuz: { margins: KENAR, showPageNumbers: true },
    });
    assert.equal(farklar.length, 4);
  });
});

describe("özet metni", () => {
  test("üçten fazla fark kısaltılır", () => {
    const farklar = sayfaDuzeniFarklari({
      margins: { top: 2, bottom: 2, left: 2, right: 2 },
      showPageNumbers: false,
      kilavuz: { margins: KENAR, showPageNumbers: true },
    });
    const ozet = sayfaDuzeniOzeti(farklar);
    assert.ok(ozet.endsWith("ve 2 fark daha."), ozet);
  });

  test("tek fark nokta ile biter", () => {
    const ozet = sayfaDuzeniOzeti([{ alan: "Üst boşluk", simdi: "2,5 cm", kilavuz: "3 cm" }]);
    assert.equal(ozet, "Üst boşluk 3 cm olmalı (şu an 2,5 cm).");
  });
});
