import assert from "node:assert/strict";
import test from "node:test";
import { gorunumKarari, onizleyebilir } from "@/lib/onizleme";

test("gerçek görünüm: personel ve öğrenci, kurumlu ve bireysel", () => {
  assert.deepEqual(gorunumKarari({ rol: "system_admin", personelRolu: true, kurumVar: false, cerez: undefined }), { personel: true, bireysel: false, onizleme: null });
  assert.deepEqual(gorunumKarari({ rol: "client", personelRolu: false, kurumVar: true, cerez: undefined }), { personel: false, bireysel: false, onizleme: null });
  assert.deepEqual(gorunumKarari({ rol: "client", personelRolu: false, kurumVar: false, cerez: undefined }), { personel: false, bireysel: true, onizleme: null });
});

test("sistem yöneticisi ve kurucu öğrenci görünümlerini önizler", () => {
  assert.deepEqual(gorunumKarari({ rol: "system_admin", personelRolu: true, kurumVar: false, cerez: "ogrenci_kurumlu" }), { personel: false, bireysel: false, onizleme: "ogrenci_kurumlu" });
  assert.deepEqual(gorunumKarari({ rol: "founder", personelRolu: true, kurumVar: true, cerez: "ogrenci_bireysel" }), { personel: false, bireysel: true, onizleme: "ogrenci_bireysel" });
  // "personel" seçimi önizleme değil, gerçek görünüm.
  assert.equal(gorunumKarari({ rol: "system_admin", personelRolu: true, kurumVar: false, cerez: "personel" }).onizleme, null);
});

test("diğer roller önizleyemez; çerez olsa da yok sayılır", () => {
  for (const rol of ["controller", "academic_manager", "expert", "employee", "client", null]) {
    assert.equal(onizleyebilir(rol), false, String(rol));
    assert.equal(gorunumKarari({ rol, personelRolu: rol !== "client", kurumVar: true, cerez: "ogrenci_bireysel" }).onizleme, null);
  }
  assert.equal(gorunumKarari({ rol: "system_admin", personelRolu: true, kurumVar: false, cerez: "uydurma" }).onizleme, null);
});
