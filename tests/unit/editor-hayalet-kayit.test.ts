import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";

/*
  HAYALET KAYIT (05.11.2026) — editör bileşenindeki bağlantılar. Editör
  tarayıcısız testte kurulamadığı için (DOM yok) davranış
  scripts/onizleme/kayit-kabul.mjs ile tarayıcıda sınanıyor; burası
  düzeltmenin üç parçasının yerinde durduğunu sabitliyor. Biri geri
  alınırsa editörü AÇMAK yeniden belgenin tamamını kaydeder.
*/
const kaynak = readFileSync("app/dashboard/editor/[id]/write/manuscript-editor.tsx", "utf8");

describe("editör: belgeye dokunmayan olay kayıt tetiklemez", () => {
  test("setEditable olay yayınlamadan çağrılıyor (emitUpdate = false)", () => {
    const cagrilar = [...kaynak.matchAll(/\.setEditable\(([^;]*)\);/g)].map((m) => m[1]);
    assert.ok(cagrilar.length > 0, "setEditable çağrısı bulunamadı");
    for (const argumanlar of cagrilar) assert.match(argumanlar, /,\s*false\s*\)?$/, `emitUpdate false değil: setEditable(${argumanlar})`);
  });

  test("onUpdate yalnızca gerçek belge değişikliğinde kirli sayıyor (ana + eklenen işlemler)", () => {
    const onUpdate = /onUpdate:\s*\(\{\s*transaction,\s*appendedTransactions\s*\}\)\s*=>\s*\{\s*if \(belgeGercektenDegisti\(\{\s*transaction,\s*appendedTransactions\s*\}\)\) markDirtyRef\.current\(\);\s*\}/;
    assert.match(kaynak, onUpdate);
    assert.doesNotMatch(kaynak, /onUpdate:\s*\(\)\s*=>\s*markDirtyRef\.current\(\)/, "eski koşulsuz bağlantı geri gelmiş");
  });

  test("kılavuzun yeni sürümü uygulanınca kayıt süzgeçten geçmeden, doğrudan isteniyor", () => {
    assert.match(kaynak, /guidelineSync\.mode !== "auto-applied" \|\| autoAppliedRef\.current\) return;\s*autoAppliedRef\.current = true;\s*markDirtyRef\.current\(\);/);
  });

  test("sayfa ayarı / kapak değişikliği de doğrudan kayıt istiyor", () => {
    assert.match(kaynak, /if \(previous === null \|\| previous === serialized\) return;\s*markDirtyRef\.current\(\);/);
  });
});
