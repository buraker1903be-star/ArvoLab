import assert from "node:assert/strict";
import test from "node:test";
import { ESKI_KILAVUZ_BANDI_ANAHTARI, kilavuzBandiAnahtari } from "@/lib/kilavuz-bandi";

/* Kılavuz bandının gizleme tercihi çalışma başına (Aşama 1 takip R2). */
test("anahtar çalışma kimliğini taşır; iki çalışma iki ayrı anahtar", () => {
  const a = kilavuzBandiAnahtari("00000000-0000-4000-8000-0000000000b1");
  const b = kilavuzBandiAnahtari("00000000-0000-4000-8000-0000000000b2");
  assert.equal(a, "arvolab:kilavuz-bandi-gizli:00000000-0000-4000-8000-0000000000b1");
  assert.notEqual(a, b);
});

test("eski genel anahtar yeni anahtarların hiçbiriyle aynı değil (taşınmaz)", () => {
  for (const id of ["x", "00000000-0000-4000-8000-0000000000b1"]) assert.notEqual(kilavuzBandiAnahtari(id), ESKI_KILAVUZ_BANDI_ANAHTARI);
});

test("kimlik yoksa anahtar yok: tercih tutulmaz, bant görünür kalır", () => {
  assert.equal(kilavuzBandiAnahtari(""), null);
  assert.equal(kilavuzBandiAnahtari("  "), null);
  assert.equal(kilavuzBandiAnahtari(undefined), null);
  assert.equal(kilavuzBandiAnahtari(null), null);
});

/*
  Akademik uyumluluk uyarıları bu tercihten BAĞIMSIZ kalmalı. Örnek veride
  kılavuzu bağlı tez olmadığı için tarayıcıda görülemiyor; kaynakta
  sabitlenir: gizleme tercihi yalnızca "kılavuz yok" dalında (`!guideline
  && isThesis`) okunur. Bir uyumluluk uyarısının koşuluna eklenirse bu test
  düşer.
*/
test("gizleme tercihi yalnızca 'kılavuz yok' dalında okunur", async () => {
  const fs = await import("node:fs");
  const kaynak = fs.readFileSync("app/dashboard/editor/[id]/write/manuscript-editor.tsx", "utf8").split("\n");
  const kullanimlar = kaynak.map((satir, i) => ({ satir, i })).filter(({ satir }) => /kilavuzBandiGizli\b/.test(satir) && !/const kilavuzBandiGizli\b/.test(satir));
  assert.ok(kullanimlar.length >= 3, "beklenen kullanım bulunamadı");
  for (const { satir, i } of kullanimlar) assert.match(satir, /!guideline && isThesis/, `satır ${i + 1}: ${satir.trim()}`);
  for (const uyari of ['syncMode === "auto-applied"', 'syncMode === "offer"']) {
    const satir = kaynak.find((s) => s.includes(uyari) && s.includes("guideline &&"));
    assert.ok(satir, `${uyari} uyarısı bulunamadı`);
    assert.doesNotMatch(satir, /kilavuzBandi/, `${uyari} uyarısı gizleme tercihine bağlanmış`);
  }
});
