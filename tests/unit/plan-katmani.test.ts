import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_ADI, planKatmani } from "@/lib/plan-katmani";

/*
  Plan katmanı (Signature OS 4.4): bugün yalnızca erişim türünden; uydurma
  bir katman adı (Plus, Pro) üretilmez. Köprüye ulaşılamayınca etiket
  "bireysel" iddia etmez, "Abonelik" kalır.
*/
test("erişim türünden katman", () => {
  assert.equal(planKatmani({ kind: "individual", status: "active" }), "bireysel");
  assert.equal(planKatmani({ kind: "individual", status: "trialing" }), "bireysel");
  assert.equal(planKatmani({ kind: "organization", status: "active" }), "kurum");
  assert.equal(planKatmani({ kind: "staff", status: "internal" }), "ic-ekip");
});

test("bilinmeyen ya da ulaşılamayan durum: genel 'Abonelik'", () => {
  assert.equal(planKatmani({ kind: "individual", status: "unreachable" }), "bilinmiyor");
  assert.equal(planKatmani({ kind: "individual", status: "unknown" }), "bilinmiyor");
  assert.equal(planKatmani({ kind: "staff", status: "unknown" }), "bilinmiyor");
  assert.equal(PLAN_ADI.bilinmiyor.tr, "Abonelik");
});

test("her katmanın iki dilde adı var ve hiçbiri Plus/Pro gibi tanımsız bir plan iddia etmiyor", () => {
  for (const ad of Object.values(PLAN_ADI)) {
    assert.ok(ad.tr && ad.en);
    assert.equal(/plus|pro\b|premium|ücretsiz|free/i.test(`${ad.tr} ${ad.en}`), false);
  }
});
