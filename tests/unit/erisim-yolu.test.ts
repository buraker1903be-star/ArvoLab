import assert from "node:assert/strict";
import test from "node:test";
import { ALL_ROLES, ADMIN_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import { bagsizPersonel, erisimYolu } from "@/lib/erisim-yolu";
import { licenseDecision } from "@/lib/license-decision";

/*
  Ürün kararı (20.11.2026): AkademikMerkez personeli bireysel abonelik ya da
  ödeme engeline takılmaz; hakkını kurumun lisansından alır. Kural rolde
  değil KURUM BAĞINDA: e-posta istisnası yok, personel rolü tek başına hak
  vermez. Bu testler ikisini birlikte sabitler.
*/

const KURUM = "11111111-1111-1111-1111-111111111111";

test("kuruma bağlı her rol (iç ekip dışı) kurum yolundan geçer, bireysel ödemeye hiç sorulmaz", () => {
  for (const rol of ALL_ROLES) {
    if (ADMIN_ROLES.includes(rol)) continue;
    assert.equal(erisimYolu(rol, KURUM), "kurum", rol);
  }
});

test("iç ekip kurumdan bağımsız iç ekip yolundan geçer", () => {
  for (const rol of ADMIN_ROLES) {
    assert.equal(erisimYolu(rol, KURUM), "ic-ekip");
    assert.equal(erisimYolu(rol, null), "ic-ekip");
  }
});

test("kurumu olmayan personel rolü hak kazanmaz: bireysel yola düşer ve bağsız işaretlenir", () => {
  for (const rol of STAFF_ROLES) {
    if (ADMIN_ROLES.includes(rol)) continue;
    assert.equal(erisimYolu(rol, null), "bireysel", rol);
    assert.equal(bagsizPersonel(rol, null), true, rol);
    assert.equal(bagsizPersonel(rol, KURUM), false, rol);
  }
  assert.equal(bagsizPersonel("client", null), false);
  assert.equal(bagsizPersonel("founder", null), false);
  assert.equal(erisimYolu(undefined, null), "bireysel");
});

test("kurum yolunda karar yalnızca yansıtılmış lisanstan: açık lisans açar, kapalı lisans kapatır (rol fark etmez)", () => {
  const simdi = new Date("2026-11-20T12:00:00Z");
  const acik = licenseDecision({ name: "AkademikMerkez", license_status: "active", current_period_end: null, synced_at: "2026-11-20T00:00:00Z" }, simdi);
  assert.equal(acik.blocked, false);
  const kapali = licenseDecision({ name: "AkademikMerkez", license_status: "inactive", current_period_end: null, synced_at: "2026-11-20T00:00:00Z" }, simdi);
  assert.equal(kapali.blocked, true);
  const suresiGecmis = licenseDecision({ name: "AkademikMerkez", license_status: "active", current_period_end: "2026-11-01T00:00:00Z", synced_at: "2026-11-20T00:00:00Z" }, simdi);
  assert.equal(suresiGecmis.blocked, true);
});
