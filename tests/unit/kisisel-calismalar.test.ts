import assert from "node:assert/strict";
import test from "node:test";
import { ALL_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import { CALISMA_LISTESI_ADRESLERI, KISISEL_CALISMALAR, kisiselCalismalar, personelRolu } from "@/lib/kisisel-calismalar";
import { listeAdresiOku, LISTE_VARSAYILAN } from "@/lib/os/liste-donusu";
import { labUygulamalari } from "@/lib/os/uygulamalar";

/*
  Tek ana deneyim (20.11.2026, güncellenmiş ürün kararı): Ana Sayfa ve
  Çalışmalarım herkes için kişinin KENDİ çalışmaları; Yönetim sayfası, kurum
  seçici ve personel görünümü yok. Bu testler kararın kodda geri gelmesini
  yakalar.
*/

const calismalar = [
  { id: "a", owner_id: "kurucu" },
  { id: "b", owner_id: "ogrenci-1" },
  { id: "c", owner_id: "kurucu" },
  { id: "d", owner_id: "ogrenci-2" },
];

test("kişisel liste yalnızca sahibi olunan çalışmalar; gözetimle görülenler karışmaz", () => {
  assert.deepEqual(kisiselCalismalar(calismalar, "kurucu").map((c) => c.id), ["a", "c"]);
  assert.deepEqual(kisiselCalismalar(calismalar, "ogrenci-1").map((c) => c.id), ["b"]);
  assert.deepEqual(kisiselCalismalar(calismalar, "kimse"), []);
});

test("oturum yoksa kişisel liste boş (bütün satırları göstermez)", () => {
  assert.deepEqual(kisiselCalismalar(calismalar, null), []);
  assert.deepEqual(kisiselCalismalar(calismalar, undefined), []);
  assert.deepEqual(kisiselCalismalar(calismalar, ""), []);
});

test("personel rolü STAFF_ROLES'tan; Üye/Öğrenci değil", () => {
  for (const rol of ALL_ROLES) assert.equal(personelRolu(rol), STAFF_ROLES.includes(rol), rol);
  assert.equal(personelRolu("client"), false);
  assert.equal(personelRolu(null), false);
  assert.equal(personelRolu("bilinmeyen"), false);
});

test("kayıt sonrası yenilenen listeler yalnızca Ana Sayfa ve Çalışmalarım (Yönetim adresi yok)", () => {
  assert.deepEqual([...CALISMA_LISTESI_ADRESLERI].sort(), ["/dashboard", KISISEL_CALISMALAR].sort());
});

test("gezinmede Yönetim ve Doçentlik uygulaması yok; adresleri hiçbir uygulamada geçmiyor", () => {
  const uygulamalar = labUygulamalari();
  for (const anahtar of ["yonetim", "docentlik"]) assert.equal(uygulamalar.some((u) => u.key === anahtar), false, anahtar);
  for (const u of uygulamalar) {
    for (const yol of [u.href, ...(u.yollar ?? [])]) {
      assert.ok(!yol.startsWith("/dashboard/yonetim"), yol);
      assert.ok(!yol.startsWith("/dashboard/associate-professorship"), yol);
    }
  }
});

test("liste dönüşü yalnızca Çalışmalarım'ı kabul eder; eski Yönetim adresi varsayılana düşer", () => {
  assert.equal(listeAdresiOku("/dashboard/editor?durum=aktif"), "/dashboard/editor?durum=aktif");
  for (const eski of ["/dashboard/yonetim/calismalar?sec=a", "/dashboard/yonetim"]) assert.equal(listeAdresiOku(eski), LISTE_VARSAYILAN, eski);
});
