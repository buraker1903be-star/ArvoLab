import assert from "node:assert/strict";
import test from "node:test";
import { saatEtiketi } from "@/lib/tr-time";

/* Phase 2 (04.11.2026): "Kaydedildi · ss:dd" tarayıcının değil kullanıcının saat diliminde. */
const AN = "2026-11-04T06:31:00Z"; // İstanbul'da 09:31

test("Türkçede her zaman İstanbul saati, tarayıcının dilimi ne olursa olsun", () => {
  assert.equal(saatEtiketi(AN, "tr", "America/New_York"), "09:31");
  assert.equal(saatEtiketi(AN, "tr", "UTC"), "09:31");
});

test("İngilizcede kullanıcının dilimi", () => {
  assert.equal(saatEtiketi(AN, "en", "UTC"), "06:31 AM");
  assert.equal(saatEtiketi(AN, "en", "Europe/Istanbul"), "09:31 AM");
});
