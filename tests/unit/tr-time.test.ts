import { test } from "node:test";
import assert from "node:assert/strict";
import { trGunFarki, trTarih, trTarihSaat, trUzunTarih } from "../../lib/tr-time";

test("tarih ve saat Türkiye saatine göre (sunucu UTC olsa da)", () => {
  // 20 Eylül 11:05 UTC = 14:05 TR
  assert.equal(trTarihSaat("2026-09-20T11:05:00Z"), "20.09.2026 14:05");
  // 19 Eylül 21:30 UTC = 20 Eylül 00:30 TR: gün ileri
  assert.equal(trTarih("2026-09-19T21:30:00Z"), "20.09.2026");
  assert.equal(trUzunTarih("2026-09-19T21:30:00Z"), "20 Eylül 2026");
});

test("gün farkı saat farkından etkilenmez", () => {
  assert.equal(trGunFarki("2026-09-20T21:30:00Z", "2026-09-20T05:00:00Z"), 1); // 21:30 UTC = ertesi gün 00:30 TR
  assert.equal(trGunFarki("2026-09-27T08:00:00Z", "2026-09-20T20:00:00Z"), 7);
});
