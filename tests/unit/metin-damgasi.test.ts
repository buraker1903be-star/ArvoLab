import assert from "node:assert/strict";
import { test } from "node:test";
import { damgaAyniMi, damgaCoz } from "@/lib/metin-damgasi";

/*
  İyimser kilidin anahtarı olan damganın karşılaştırması (P52a2). Yanlış
  "aynı" cevabı eski sürümden yazan sekmeyi geçirir (veri kaybı), yanlış
  "farklı" cevabı yetki reddini çakışma diye gösterir.
*/

test("aynı anın farklı yazımları aynı sayılır", () => {
  assert.ok(damgaAyniMi("2026-11-15T10:00:00.123Z", "2026-11-15T10:00:00.123+00:00"));
  assert.ok(damgaAyniMi("2026-11-15T10:00:00.1230+00:00", "2026-11-15T10:00:00.123+00:00"));
  assert.ok(damgaAyniMi("2026-11-15T13:00:00.5+03:00", "2026-11-15T10:00:00.500000+00:00"));
  assert.ok(damgaAyniMi("2026-11-15 10:00:00+00", "2026-11-15T10:00:00Z"));
});

test("aynı milisaniyedeki farklı mikrosaniyeler AYRI sayılır (Date bunu göremez)", () => {
  const a = "2026-11-15T10:00:00.123456+00:00";
  const b = "2026-11-15T10:00:00.123457+00:00";
  assert.equal(new Date(a).getTime(), new Date(b).getTime(), "ön koşul: Date ikisini eşit görüyor");
  assert.equal(damgaAyniMi(a, b), false);
});

test("farklı anlar ve çözülemeyen değerler eşit sayılmaz", () => {
  assert.equal(damgaAyniMi("2026-11-15T10:00:00Z", "2026-11-15T10:00:01Z"), false);
  assert.equal(damgaAyniMi("bozuk", "2026-11-15T10:00:00Z"), false);
  assert.equal(damgaCoz("bozuk"), null);
  // Birebir aynı metin her zaman eşit (çözülemese bile).
  assert.ok(damgaAyniMi("bozuk", "bozuk"));
});
