import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  R1 HAYALET KAYIT (14.11.2026). Editör bileşeni React'e bağlı; sözleşme
  kaynak metinden okunur (tests/unit kuralı). Davranış gerçek tarayıcıda:
  scripts/onizleme/hayalet-kayit-kabul.mjs.

  Tiptap v3'te setEditable(editable, emitUpdate = true): ikinci argüman
  verilmezse belge değişmeden "update" yayılıyor ve onUpdate → markDirty
  yolu otomatik kaydı başlatıyordu. Her açılış updated_at'i ileri alıyor,
  otomatik sürüm ekliyor ve iki sekmede yanlış çakışma üretebiliyordu.
*/
const kaynak = fs
  .readFileSync(path.join(process.cwd(), "app/dashboard/editor/[id]/write/manuscript-editor.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

test("her setEditable çağrısı update yaymaz (emitUpdate=false)", () => {
  const cagrilar = [...kaynak.matchAll(/\.setEditable\(([^;]*?)\);/g)].map((m) => m[1]);
  assert.ok(cagrilar.length >= 1, "setEditable çağrısı bulunamadı");
  for (const argumanlar of cagrilar) assert.match(argumanlar, /,\s*false\s*$/, `setEditable(${argumanlar})`);
});

test("kilit efekti hâlâ taslak teklifi ve uyumsuz içerikte salt okunur yapıyor", () => {
  assert.match(kaynak, /editor\.setEditable\(!draftOffer && !icerikUyumsuz, false\)/);
});

test("gerçek değişiklik yolu değişmedi: onUpdate markDirty'yi çağırıyor", () => {
  assert.match(kaynak, /onUpdate: \(\) => markDirtyRef\.current\(\)/);
});
