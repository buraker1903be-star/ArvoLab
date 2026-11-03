import assert from "node:assert/strict";
import test from "node:test";
import { kaynakOku, kaynakSutunlari } from "@/lib/guideline-sync";

/*
  03.11.2026: öğrencinin kılavuzunun kimliği ("calisma:<uuid>") UUID
  sütununa yazılıyor, Postgres 22P02 ile reddediyor ve editör metni hiç
  kaydedemiyordu.
*/
const KATALOG = "1f0c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CALISMA = "calisma:082e2efa-39ef-491e-b551-b6e0196fd532";

test("öğrenci kılavuzunun kimliği UUID sütununa yazılmıyor", () => {
  const sutun = kaynakSutunlari({ guidelineId: CALISMA, version: "2026-11-03T06:10:00.1+00:00#2" });
  assert.equal(sutun.settings_guideline_id, null);
  assert.deepEqual(kaynakOku(sutun.settings_guideline_id, sutun.settings_guideline_version), {
    guidelineId: CALISMA,
    version: "2026-11-03T06:10:00.1+00:00#2",
  });
});

test("katalog kılavuzu olduğu gibi yazılıp okunuyor", () => {
  const sutun = kaynakSutunlari({ guidelineId: KATALOG, version: "v3" });
  assert.deepEqual(sutun, { settings_guideline_id: KATALOG, settings_guideline_version: "v3" });
  assert.deepEqual(kaynakOku(KATALOG, "v3"), { guidelineId: KATALOG, version: "v3" });
});

test("boş kaynak ve sürümsüz öğrenci kılavuzu", () => {
  assert.deepEqual(kaynakSutunlari({ guidelineId: null, version: null }), { settings_guideline_id: null, settings_guideline_version: null });
  assert.deepEqual(kaynakOku(null, null), { guidelineId: null, version: null });
  const sutun = kaynakSutunlari({ guidelineId: CALISMA, version: null });
  assert.deepEqual(kaynakOku(null, sutun.settings_guideline_version), { guidelineId: CALISMA, version: null });
});
