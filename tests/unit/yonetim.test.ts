import assert from "node:assert/strict";
import test from "node:test";
import { ALL_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import {
  calismaninListesi,
  kisiselCalismalar,
  listeTabani,
  yonetimeGirebilir,
  KISISEL_CALISMALAR,
  YONETIM_CALISMALAR,
} from "@/lib/yonetim";
import { filtreAdresi, DEFAULT_PROJECT_FILTERS } from "@/lib/project-filters";
import { personelSayaclari } from "@/lib/personel-sayaclari";
import { computeAttention } from "@/lib/attention";
import { secimAdresi } from "@/lib/calisma-karti";

/*
  Tek ana deneyim (20.11.2026): kişisel liste yalnızca kendi çalışmaları,
  yönetim ayrı alanda. Bu testler kararın iki yarısını sabitliyor:
  kimin hangi listeyi gördüğü ve bağlantıların listeden dışarı taşmaması.
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

test("Yönetim'e yalnızca personel rolleri girer; Üye/Öğrenci girmez", () => {
  for (const rol of ALL_ROLES) assert.equal(yonetimeGirebilir(rol), STAFF_ROLES.includes(rol), rol);
  assert.equal(yonetimeGirebilir("client"), false);
  assert.equal(yonetimeGirebilir("founder"), true);
  assert.equal(yonetimeGirebilir(null), false);
  assert.equal(yonetimeGirebilir(undefined), false);
  assert.equal(yonetimeGirebilir("bilinmeyen"), false);
});

test("liste tabanı kapsamdan", () => {
  assert.equal(listeTabani("kisisel"), KISISEL_CALISMALAR);
  assert.equal(listeTabani("yonetim"), YONETIM_CALISMALAR);
});

test("çalışma adresi: kendi çalışması kişisel listede, başkasınınki yetkiliyse Yönetim'de", () => {
  assert.equal(calismaninListesi({ calismaId: "a", sahipId: "u", kullaniciId: "u", rol: "founder" }), "/dashboard/editor?sec=a");
  assert.equal(calismaninListesi({ calismaId: "b", sahipId: "o", kullaniciId: "u", rol: "controller" }), "/dashboard/yonetim/calismalar?sec=b");
  // Yetkisiz kişi başkasının çalışmasına Yönetim üzerinden yönlenmez.
  assert.equal(calismaninListesi({ calismaId: "b", sahipId: "o", kullaniciId: "u", rol: "client" }), "/dashboard/editor?sec=b");
  // Sahip okunamadıysa en zararsız varsayılan.
  assert.equal(calismaninListesi({ calismaId: "b", sahipId: null, kullaniciId: "u", rol: "founder" }), "/dashboard/editor?sec=b");
  assert.equal(calismaninListesi({ calismaId: "a", sahipId: "u", kullaniciId: "u", rol: "client", kilavuz: true }), "/dashboard/editor?sec=a&kilavuz=1");
});

test("filtre, sayaç, dikkat maddesi ve seçim bağlantıları bulundukları listede kalır", () => {
  const taban = YONETIM_CALISMALAR;
  assert.equal(filtreAdresi({ ...DEFAULT_PROJECT_FILTERS, status: "gecikmis" }, taban), `${taban}?durum=gecikmis`);
  assert.equal(filtreAdresi(DEFAULT_PROJECT_FILTERS, taban), taban);
  for (const s of personelSayaclari([], DEFAULT_PROJECT_FILTERS, { lastEdited: () => undefined }, "tr", taban)) {
    assert.ok(s.href.startsWith(taban), s.href);
  }
  const maddeler = computeAttention(
    [{ id: "x", status: "ready", due_date: "2000-01-01", controller_approved_at: null, assignee_id: null, owner_id: "o" } as never],
    new Map([["x", 1]]),
    { now: new Date("2026-11-20T12:00:00Z"), taban },
  );
  assert.ok(maddeler.length > 0);
  for (const m of maddeler) assert.ok(m.href.startsWith(`${taban}?`), m.href);
  assert.equal(secimAdresi({ q: "tez" }, "x", taban), `${taban}?q=tez&sec=x`);
  // Varsayılan taban eskisi gibi Çalışmalarım (geriye dönük uyum).
  assert.equal(filtreAdresi({ ...DEFAULT_PROJECT_FILTERS, status: "gecikmis" }), "/dashboard/editor?durum=gecikmis");
});

import { listeAdresiOku, listeDonusEtiketi, LISTE_VARSAYILAN } from "@/lib/os/liste-donusu";

test("liste dönüşü Yönetim listesini kabul eder; çalışma alt yolu ve başka site kabul edilmez (kod incelemesi, PR #113)", () => {
  assert.equal(listeAdresiOku("/dashboard/yonetim/calismalar?q=tez&sec=a"), "/dashboard/yonetim/calismalar?q=tez&sec=a");
  assert.equal(listeAdresiOku("/dashboard/yonetim/calismalar"), "/dashboard/yonetim/calismalar");
  assert.equal(listeAdresiOku("/dashboard/editor?durum=aktif"), "/dashboard/editor?durum=aktif");
  for (const kotu of ["/dashboard/yonetim", "/dashboard/yonetim/calismalar/x", "/dashboard/editor/abc/write", "https://kotu.example/dashboard/editor", "//kotu.example", "/dashboard/yonetim/calismalar#x", null, ""]) {
    assert.equal(listeAdresiOku(kotu), LISTE_VARSAYILAN, String(kotu));
  }
  assert.equal(listeDonusEtiketi("/dashboard/yonetim/calismalar?sec=a").tr, "Yönetim listesine dön");
  assert.equal(listeDonusEtiketi("/dashboard/editor").tr, "Çalışmalarıma dön");
});

import { kurumSecimiGorunur, CALISMA_LISTESI_ADRESLERI } from "@/lib/yonetim";

test("kurum seçimi yalnızca yönetim ekranlarında; kişisel Ana Sayfa ve Çalışmalarım'da yok (PR #113)", () => {
  for (const yol of ["/dashboard/yonetim", "/dashboard/yonetim/calismalar", "/dashboard/team", "/dashboard/expert-requests", "/dashboard/support", "/dashboard/asistan", "/dashboard/abonelik"]) assert.equal(kurumSecimiGorunur(yol), true, yol);
  for (const yol of ["/dashboard", "/dashboard/editor", "/dashboard/editor/abc/write", "/dashboard/literature", "/dashboard/yonetimx", "/dashboard/teamx", null, undefined]) assert.equal(kurumSecimiGorunur(yol), false, String(yol));
});

test("kayıt sonrası yenilenen listeler Yönetim'in iki sayfasını da kapsıyor (PR #113)", () => {
  assert.deepEqual([...CALISMA_LISTESI_ADRESLERI].sort(), ["/dashboard", "/dashboard/editor", "/dashboard/yonetim", "/dashboard/yonetim/calismalar"].sort());
});
