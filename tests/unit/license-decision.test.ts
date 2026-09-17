import assert from "node:assert/strict";
import test from "node:test";
import { licenseDecision, type LicenseRow } from "@/lib/license-decision";

const SIMDI = new Date("2026-09-17T12:00:00Z");
const satir = (over: Partial<LicenseRow>): LicenseRow => ({
  name: "Test Kurumu",
  license_status: "active",
  current_period_end: null,
  synced_at: "2026-09-10T00:00:00Z",
  ...over,
});

test("aktif lisans geçer", () => {
  assert.equal(licenseDecision(satir({}), SIMDI).blocked, false);
  assert.equal(licenseDecision(satir({ license_status: "trialing" }), SIMDI).blocked, false);
});

test("kurum kaydı okunamazsa engellenmez", () => {
  // Geçici bir veritabanı hatası bütün kullanıcıları dışarıda bırakmamalı.
  for (const yok of [null, undefined]) {
    const karar = licenseDecision(yok, SIMDI);
    assert.equal(karar.blocked, false);
    assert.equal(karar.status, "unknown");
  }
});

test("ArvoOS bu kurumu hiç bildirmediyse engellenmez", () => {
  // license_status varsayılanı 'inactive'; yansıtma başlamadan önce her kurum
  // "lisanssız" görünür. Bu bir cevap değil, cevabın gelmemiş olmasıdır.
  const karar = licenseDecision(satir({ synced_at: null, license_status: "inactive" }), SIMDI);
  assert.equal(karar.blocked, false);
  assert.equal(karar.status, "unsynced");
});

test("yansıtma bir kez çalıştıktan sonra kapı normal işler", () => {
  const karar = licenseDecision(satir({ synced_at: "2026-09-16T00:00:00Z", license_status: "inactive" }), SIMDI);
  assert.equal(karar.blocked, true);
  assert.equal(karar.status, "inactive");
});

test("bilinmeyen durum adı geçersiz sayılır", () => {
  for (const durum of ["past_due", "canceled", "paused", "ACTIVE", "", "bilinmeyen"]) {
    assert.equal(licenseDecision(satir({ license_status: durum }), SIMDI).blocked, true, durum);
  }
});

test("dönem sonu geçmişse engellenir", () => {
  const gecmis = licenseDecision(satir({ current_period_end: "2026-09-16T00:00:00Z" }), SIMDI);
  assert.equal(gecmis.blocked, true);
  const gelecek = licenseDecision(satir({ current_period_end: "2026-10-01T00:00:00Z" }), SIMDI);
  assert.equal(gelecek.blocked, false);
});

test("dönem sonu yoksa süresizdir", () => {
  assert.equal(licenseDecision(satir({ current_period_end: null }), SIMDI).blocked, false);
});

test("durum geçerli ama süre dolmuşsa yine engellenir", () => {
  const karar = licenseDecision(
    satir({ license_status: "trialing", current_period_end: "2026-09-01T00:00:00Z" }),
    SIMDI,
  );
  assert.equal(karar.blocked, true);
});

test("kurum adı ve dönem sonu karara taşınır", () => {
  const karar = licenseDecision(satir({ name: "Akademik Merkez", current_period_end: "2026-10-01T00:00:00Z" }), SIMDI);
  assert.equal(karar.organizationName, "Akademik Merkez");
  assert.equal(karar.periodEnd, "2026-10-01T00:00:00Z");
});

test("license_status hiç yoksa inactive sayılır", () => {
  assert.equal(licenseDecision(satir({ license_status: null }), SIMDI).blocked, true);
});
