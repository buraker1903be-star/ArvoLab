import assert from "node:assert/strict";
import test from "node:test";
import { hareketSerisi, ilkAd, selamlama } from "@/lib/genel-bakis";

// 26 Ekim 2026, 10:29 Türkiye saati (07:29 UTC)
const SIMDI = Date.parse("2026-10-26T07:29:00Z");

test("14 gün, boş günler de çubuk; bugün en sonda", () => {
  const seri = hareketSerisi([{ gun: "2026-10-26", tur: "kaynak", adet: 2 }, { gun: "2026-10-13", tur: "surum", adet: 1 }], SIMDI);
  assert.equal(seri.gunler.length, 14);
  assert.equal(seri.gunler[13].anahtar, "2026-10-26");
  assert.equal(seri.gunler[13].bugun, true);
  assert.equal(seri.gunler[0].anahtar, "2026-10-13");
  assert.equal(seri.toplam, 3);
  assert.deepEqual(seri.turler, { surum: 1, kaynak: 2, denetim: 0, asistan: 0, kanit: 0 });
});

test("önceki dönemle kıyas; önceki boşsa yüzde yok", () => {
  const seri = hareketSerisi(
    [{ gun: "2026-10-20", tur: "kaynak", adet: 6 }, { gun: "2026-10-05", tur: "kaynak", adet: 4 }, { gun: "2026-09-01", tur: "kaynak", adet: 99 }],
    SIMDI,
  );
  assert.equal(seri.onceki, 4);
  assert.equal(seri.degisim, 50);
  assert.equal(hareketSerisi([{ gun: "2026-10-20", tur: "kaynak", adet: 1 }], SIMDI).degisim, null);
});

test("tanınmayan tür grafiğe girer ama tür özetini bozmaz", () => {
  const seri = hareketSerisi([{ gun: "2026-10-26", tur: "constructor", adet: 1 }], SIMDI);
  assert.equal(seri.toplam, 1);
  assert.equal(Object.keys(seri.turler).length, 5);
});

test("Türkiye saatine göre selamlama", () => {
  assert.equal(selamlama(SIMDI), "Günaydın");
  assert.equal(selamlama(Date.parse("2026-10-26T12:00:00Z")), "İyi günler"); // 15:00
  assert.equal(selamlama(Date.parse("2026-10-26T17:00:00Z")), "İyi akşamlar"); // 20:00
  assert.equal(selamlama(Date.parse("2026-10-26T22:30:00Z")), "İyi geceler"); // 01:30
});

test("selamlamada yalnızca ad", () => {
  assert.equal(ilkAd("  Burak Erdoğan "), "Burak");
  assert.equal(ilkAd(""), null);
});

test("İngilizce selamlama ve gün etiketleri", () => {
  const sabah = Date.parse("2026-09-20T08:00:00+03:00");
  assert.equal(selamlama(sabah, "en"), "Good morning");
  assert.equal(selamlama(Date.parse("2026-09-20T14:00:00+03:00"), "en"), "Good afternoon");
  assert.equal(selamlama(Date.parse("2026-09-20T23:30:00+03:00"), "en"), "Good evening");
  // Kullanıcının dilimi verilirse onun saati: İstanbul'da 08:00, New York'ta 01:00.
  assert.equal(selamlama(sabah, "en", "America/New_York"), "Good evening");
  assert.equal(selamlama(sabah), "Günaydın");
  const seri = hareketSerisi([], Date.parse("2026-09-20T12:00:00+03:00"), 14, "en");
  assert.equal(seri.gunler[13].baslik, "Sun, Sep 20");
});
