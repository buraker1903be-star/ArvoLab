import assert from "node:assert/strict";
import test from "node:test";
import { RED_ETIKETI, RED_ETIKETI_METIN, redEtiketi, YETENEK_ETIKETI, YETENEK_ETIKETI_METIN, yetenekEtiketi } from "@/lib/ai/kayit-gorunum";

test("asistan kaydı etiketleri iki dilde; eski haritalar Türkçe", () => {
  assert.equal(yetenekEtiketi("analiz", "en"), "Analysis check");
  assert.equal(yetenekEtiketi("analiz"), "Analiz denetimi");
  assert.equal(redEtiketi("uydurma_sayi", "en"), "fabricated number");
  assert.equal(redEtiketi("bilinmeyen", "en"), "bilinmeyen");
  for (const [k, m] of Object.entries(YETENEK_ETIKETI_METIN)) assert.equal(YETENEK_ETIKETI[k as keyof typeof YETENEK_ETIKETI], m.tr);
  for (const [k, m] of Object.entries(RED_ETIKETI_METIN)) assert.equal(RED_ETIKETI[k], m.tr);
});
