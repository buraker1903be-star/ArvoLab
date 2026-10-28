import assert from "node:assert/strict";
import test from "node:test";
import { yazimRitmi } from "@/lib/yazim-ritmi";

const SIMDI = Date.parse("2026-10-26T07:29:00Z"); // 26 Ekim, 10:29 TR

test("net yazım tabandan hesaplanır; ilk gün bütün tez sayılmaz", () => {
  const r = yazimRitmi(
    [{ gun: "2026-10-01", kelime: 1000 }, { gun: "2026-10-24", kelime: 1500 }, { gun: "2026-10-25", kelime: 1450 }],
    SIMDI,
  );
  const gun = (k: string) => r.gunler.find((g) => g.anahtar === k)!.net;
  assert.equal(gun("2026-10-24"), 500);
  assert.equal(gun("2026-10-25"), -50);
  assert.equal(r.buHafta, 450);
});

test("taban yoksa ilk görülen gün 0 sayılır", () => {
  const r = yazimRitmi([{ gun: "2026-10-20", kelime: 8000 }, { gun: "2026-10-21", kelime: 8300 }], SIMDI);
  assert.equal(r.gunler.find((g) => g.anahtar === "2026-10-20")!.net, 0);
  assert.equal(r.gunler.find((g) => g.anahtar === "2026-10-21")!.net, 300);
});

test("bugünün anlık sayısı son sürümün önüne geçer", () => {
  const r = yazimRitmi([{ gun: "2026-10-25", kelime: 1000 }], SIMDI, 14, 1250);
  assert.equal(r.gunler[13].net, 250);
});

test("seri bugün yazılmadıysa dünden sayılır", () => {
  const satirlar = [
    { gun: "2026-10-21", kelime: 100 },
    { gun: "2026-10-22", kelime: 200 },
    { gun: "2026-10-23", kelime: 300 },
    { gun: "2026-10-24", kelime: 400 },
    { gun: "2026-10-25", kelime: 500 },
  ];
  assert.equal(yazimRitmi(satirlar, SIMDI).seri, 4);
  assert.equal(yazimRitmi(satirlar, SIMDI).aktifGun, 4);
  assert.equal(yazimRitmi(satirlar, SIMDI, 14, 600).seri, 5);
});

test("İngilizce gün etiketleri, Türkiye gününe göre", () => {
  const r = yazimRitmi([], Date.parse("2026-09-20T01:00:00+03:00"), 14, null, "en");
  assert.equal(r.gunler[13].anahtar, "2026-09-20");
  assert.equal(r.gunler[13].baslik, "Sun, Sep 20");
});
