import assert from "node:assert/strict";
import test from "node:test";
import { ESKI_KILAVUZ_BANDI_ANAHTARI, kilavuzBandiAnahtari, kilavuzUygulandiAnahtari } from "@/lib/kilavuz-bandi";

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
  /*
    V2 (Phase 4.5): "kurallar uygulandı" bildiriminin koşulu ayrı bir satırda
    (uygulandiGorunur = Boolean(guideline) && syncMode === "auto-applied" &&
    !uygulandiKapali). Kendi, SÜRÜME bağlı "Kapat" tercihi var (onaylı ürün
    kararı); "kılavuz yok" bandının tercihine bağlanmamalı. "Kılavuza göre
    güncelle" (offer) uyarısı hiçbir kapatma tercihine bağlı değil.
  */
  for (const uyari of ['syncMode === "auto-applied"', 'syncMode === "offer"']) {
    const satir = kaynak.find((s) => s.includes(uyari) && /guideline\)? &&/.test(s));
    assert.ok(satir, `${uyari} uyarısı bulunamadı`);
    assert.doesNotMatch(satir, /kilavuzBandi/, `${uyari} uyarısı gizleme tercihine bağlanmış`);
    if (uyari.includes("offer")) assert.doesNotMatch(satir, /Kapali|Gizli/, "'Kılavuza göre güncelle' uyarısı kapatılabilir olmuş");
  }
});


test("V2: 'kurallar uygulandı' kapatma anahtarı çalışma ve sürüm başına; eksikse tutulmaz", () => {
  const a = kilavuzUygulandiAnahtari("c1", "2026-11-01T09:00:00.000Z");
  assert.equal(a, "arvolab:kilavuz-uygulandi-kapali:c1:2026-11-01T09:00:00.000Z");
  assert.notEqual(a, kilavuzUygulandiAnahtari("c1", "2026-12-01T09:00:00.000Z"), "yeni sürüm yeni anahtar");
  assert.notEqual(a, kilavuzUygulandiAnahtari("c2", "2026-11-01T09:00:00.000Z"), "başka çalışma başka anahtar");
  assert.equal(kilavuzUygulandiAnahtari("c1", ""), null);
  assert.equal(kilavuzUygulandiAnahtari("", "s"), null);
});
