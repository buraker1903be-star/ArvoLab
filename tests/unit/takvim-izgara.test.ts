import { test } from "node:test";
import assert from "node:assert/strict";
import { anahtardanTarih, ayEkle, ayIzgarasi, gunEkle, gunFarki, sinirDisi } from "@/lib/takvim-izgara";

test("geçersiz ve taşan günler reddedilir", () => {
  assert.equal(anahtardanTarih("2026-02-30"), null);
  assert.equal(anahtardanTarih("28.10.2026"), null);
  assert.equal(anahtardanTarih(""), null);
  assert.ok(anahtardanTarih("2028-02-29"));
});

test("gün ve ay ekleme ay/yıl sınırını doğru geçer", () => {
  assert.equal(gunEkle("2026-12-31", 1), "2027-01-01");
  assert.equal(gunEkle("2026-03-01", -1), "2026-02-28");
  assert.equal(ayEkle("2026-01-31", 1), "2026-02-28");
  assert.equal(ayEkle("2028-01-31", 1), "2028-02-29");
  assert.equal(ayEkle("2026-01-15", -1), "2025-12-15");
});

test("ızgara 42 gün, hafta başı Pazartesi ya da Pazar", () => {
  // 1 Ekim 2026 Perşembe.
  const pzt = ayIzgarasi("2026-10-17", 1);
  assert.equal(pzt.length, 42);
  assert.equal(pzt[0].anahtar, "2026-09-28");
  assert.equal(pzt[3].anahtar, "2026-10-01");
  assert.equal(pzt[0].buAy, false);
  assert.equal(pzt[3].buAy, true);
  const paz = ayIzgarasi("2026-10-17", 0);
  assert.equal(paz[0].anahtar, "2026-09-27");
  assert.equal(paz[4].anahtar, "2026-10-01");
  // Pazartesi başlayan ay boşluk bırakmaz.
  assert.equal(ayIzgarasi("2026-06-10", 1)[0].anahtar, "2026-06-01");
});

test("sınır ve fark", () => {
  assert.equal(sinirDisi("2026-10-27", "2026-10-28"), true);
  assert.equal(sinirDisi("2026-10-28", "2026-10-28", "2026-12-01"), false);
  assert.equal(sinirDisi("2026-12-02", null, "2026-12-01"), true);
  assert.equal(gunFarki("2026-10-28", "2026-11-04"), 7);
});
