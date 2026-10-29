import { test } from "node:test";
import assert from "node:assert/strict";
import { TARAMA_OMRU_MS, taramaDogrula, taramaImzala } from "@/lib/imzali-tarama";

const ANAHTAR = "gizli";
const veri = { suggestedRules: { font_size_pt: 12 }, confidence: 1 };

test("imzalanan sonuç aynı kapsamda geri okunur", () => {
  const b = taramaImzala(veri, ANAHTAR, "u1:p1")!;
  assert.deepEqual(taramaDogrula(b, ANAHTAR, "u1:p1"), { ok: true, veri });
});

test("değiştirilmiş, başka kapsamın, süresi dolmuş ya da bozuk belirteç reddedilir", () => {
  const b = taramaImzala(veri, ANAHTAR, "u1:p1", 1000)!;
  const [govde, imza] = b.split(".");
  const sahte = Buffer.from(JSON.stringify({ k: "u1:p1", s: Date.now() + 1e6, v: { suggestedRules: { font_size_pt: 40 } } })).toString("base64url");
  assert.equal(taramaDogrula(`${sahte}.${imza}`, ANAHTAR, "u1:p1").ok, false, "içerik değişirse imza tutmaz");
  assert.deepEqual(taramaDogrula(taramaImzala(veri, ANAHTAR, "u1:p1")!, ANAHTAR, "u2:p1"), { ok: false, neden: "kapsam" });
  assert.deepEqual(taramaDogrula(b, ANAHTAR, "u1:p1", 1000 + TARAMA_OMRU_MS + 1), { ok: false, neden: "sure" });
  assert.deepEqual(taramaDogrula(`${govde}`, ANAHTAR, "u1:p1"), { ok: false, neden: "bozuk" });
  assert.deepEqual(taramaDogrula({ suggestedRules: {} }, ANAHTAR, "u1:p1"), { ok: false, neden: "bozuk" }, "eski istemcinin düz nesnesi");
  assert.equal(taramaDogrula(b, "baska", "u1:p1").ok, false);
});

test("çok büyük sonuç imzalanmaz", () => {
  assert.equal(taramaImzala({ x: "a".repeat(200_000) }, ANAHTAR, "k"), null);
});
