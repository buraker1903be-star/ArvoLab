/*
  YÖK Atlas dizininde üniversite eşleştirme.

  Yanlış eşleşmenin bedeli büyük: eşleşen üniversitenin BÜTÜN fakülte ve
  program dizini bizim kayıtlı kuruma aktarılıyor. Yanlış kuruma aktarılan
  bir dizin, sonradan kılavuz ve birim eşleştirmesini de yanlışlıyor.

  Eskiden tam eşleşme tutmazsa iki yönlü ÖNEK eşleşmesine düşülüyordu ve
  Türkiye'de bunu ısıran gerçek bir çift var: "İstanbul Üniversitesi" ile
  "İstanbul Üniversitesi-Cerrahpaşa" (2018'de ayrıldılar, ayrı kurumlar).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { yokUniversitesiSec } from "@/lib/yok-atlas-directory";

const dizin = [
  { universiteAdi: "İstanbul Üniversitesi-Cerrahpaşa", universiteId: 1 },
  { universiteAdi: "Ankara Üniversitesi", universiteId: 2 },
  { universiteAdi: "Gazi Üniversitesi", universiteId: 3 },
  { universiteAdi: "Ankara Hacı Bayram Veli Üniversitesi", universiteId: 4 },
  { universiteAdi: "Orta Doğu Teknik Üniversitesi", universiteId: 5 },
];

describe("YÖK üniversite eşleştirme", () => {
  test("tam ad eşleşir", () => {
    assert.equal(yokUniversitesiSec("Ankara Üniversitesi", dizin), 2);
    assert.equal(yokUniversitesiSec("Orta Doğu Teknik Üniversitesi", dizin), 5);
  });

  test("Türkçe harf ve noktalama farkı eşleşmeyi bozmaz", () => {
    assert.equal(yokUniversitesiSec("ANKARA ÜNİVERSİTESİ", dizin), 2);
    assert.equal(yokUniversitesiSec("istanbul üniversitesi cerrahpaşa", dizin), 1);
  });

  test("AYRI bir üniversiteye düşmüyor (eskiden düşüyordu)", () => {
    // Dizinde "İstanbul Üniversitesi" yok; önek kuralıyla Cerrahpaşa tek
    // aday kalıyor ve kabul ediliyordu. Ayırt edici sözcük farkı var.
    assert.equal(yokUniversitesiSec("İstanbul Üniversitesi", dizin), null);
  });

  test("ayırt edici sözcüğü olan başka bir ada da düşmüyor", () => {
    // "Ankara Üniversitesi" dizinde var, o yüzden tam eşleşir; tersini de
    // sınayalım: kayıtlı adımız daha uzunsa kısa olana düşmemeli.
    assert.equal(yokUniversitesiSec("Ankara Bilim Üniversitesi", dizin), null);
  });

  test("yalnızca 'Üniversitesi' farkı eşleşmeyi engellemez", () => {
    assert.equal(yokUniversitesiSec("Gazi", dizin), 3);
  });

  test("T.C. öneki eşleşmeyi engellemez (önek kuralında engelliyordu)", () => {
    assert.equal(yokUniversitesiSec("T.C. Gazi Üniversitesi", dizin), 3);
  });

  test("birden çok aday varsa emin olunamaz, null döner", () => {
    const ikizler = [
      { universiteAdi: "Gazi Üniversitesi", universiteId: 3 },
      { universiteAdi: "Gazi", universiteId: 9 },
    ];
    assert.equal(yokUniversitesiSec("Gazi Üniversitesi", ikizler), 3, "Tam eşleşme önce gelir");
    assert.equal(yokUniversitesiSec("T.C. Gazi", ikizler), null, "İki aday: emin olunamaz");
  });

  test("boş ve tanınmayan ad null döner", () => {
    assert.equal(yokUniversitesiSec("", dizin), null);
    assert.equal(yokUniversitesiSec("Üniversitesi", dizin), null, "Yalnızca gürültü sözcüğü kalıyor");
    assert.equal(yokUniversitesiSec("Bilinmeyen Üniversitesi", dizin), null);
  });
});
