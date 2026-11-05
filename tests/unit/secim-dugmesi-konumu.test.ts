import assert from "node:assert/strict";
import test from "node:test";
import { secimDugmesiKonumu } from "@/lib/secim-dugmesi-konumu";

/* Seçimdeki Arvo AI düğmesi seçimi ÖRTMEMELİ (4.3). Düğme dikeyde seçim kutusuyla kesişmez. */
const EKRAN = { genislik: 390, yukseklik: 844 };
const DUGME = { genislik: 96, yukseklik: 32 };
const kesismez = (y: number, s: { ust: number; alt: number }) => y + DUGME.yukseklik <= s.ust || y >= s.alt;

test("yer varsa seçimin son satırının ALTINA açılır", () => {
  const s = { ust: 200, alt: 260, sol: 40 };
  const k = secimDugmesiKonumu(s, DUGME, EKRAN);
  assert.equal(k.yukari, false);
  assert.ok(k.y >= s.alt);
  assert.ok(kesismez(k.y, s));
});

test("altta yer yoksa ilk satırın ÜSTÜNE açılır", () => {
  const s = { ust: 700, alt: 830, sol: 40 };
  const k = secimDugmesiKonumu(s, DUGME, EKRAN);
  assert.equal(k.yukari, true);
  assert.ok(kesismez(k.y, s));
});

test("seçim ekrandan uzunsa ekranın dibine yapışır, ekranın içinde kalır", () => {
  const k = secimDugmesiKonumu({ ust: -400, alt: 1200, sol: 40 }, DUGME, EKRAN);
  assert.ok(k.y + DUGME.yukseklik <= EKRAN.yukseklik);
  assert.ok(k.y >= 0);
});

test("yatayda ekran kenarlarından taşmaz (telefon)", () => {
  assert.equal(secimDugmesiKonumu({ ust: 100, alt: 120, sol: 370 }, DUGME, EKRAN).x, EKRAN.genislik - DUGME.genislik - 8);
  assert.equal(secimDugmesiKonumu({ ust: 100, alt: 120, sol: -20 }, DUGME, EKRAN).x, 8);
});

test("yapışkan araç çubuğunun altına girmez (seçim çubuğun altına kaymış)", () => {
  const k = secimDugmesiKonumu({ ust: 40, alt: 90, sol: 40 }, DUGME, { ...EKRAN, ust: 170 });
  assert.ok(k.y >= 170);
});
