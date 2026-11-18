import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BELGE_OKUNUR_EN_AZ,
  olcekAdimi,
  olcekTercihiOku,
  sagPanelGenisligiSinirla,
  yerlesimKarari,
} from "@/lib/calisma-alani-yerlesimi";

const karar = (ekran: number, solArac: "bolumler" | "kaynaklar" | "arama" | null, sagPanel: "ai" | "pdf" | null, sagGenislik = 520, kenarDar = false) =>
  yerlesimKarari({ ekran, solArac, sagPanel, sagGenislik, kenarDar });

test("panel yokken belge doğal boyunda, gezinme açık", () => {
  const k = karar(1440, null, null);
  assert.deepEqual([k.kenar, k.sag, k.olcek, k.sabitKagit], ["tam", "yok", 1, true]);
});

test("otomatik küçültme okunabilirlik sınırının altına inmez: önce ray, sonra çekmece", () => {
  // 1440 + PDF 520: önce PDF 440'a iner, sonra gezinme raya.
  const a = karar(1440, null, "pdf", 520);
  assert.equal(a.kenar, "ray");
  assert.equal(a.sag, "sutun");
  assert.equal(a.sagGenislik, 440);
  // 1920'de istenen genişlik korunur, gezinme açık kalır.
  const g = karar(1920, null, "pdf", 520);
  assert.deepEqual([g.kenar, g.sag, g.sagGenislik], ["tam", "sutun", 520]);
  assert.ok(a.olcek >= BELGE_OKUNUR_EN_AZ, String(a.olcek));
  // 1280 + PDF 520: rayla da sığmıyor → PDF çekmece, belge tam boy.
  const b = karar(1280, null, "pdf", 520);
  assert.equal(b.sag, "cekmece");
  assert.equal(b.olcek, 1);
  // Hiçbir masaüstü durumunda sağ panel sütun iken ölçek sınırın altında değil.
  for (let ekran = 1200; ekran <= 2560; ekran += 40) {
    for (const panel of ["ai", "pdf"] as const) {
      for (const sol of [null, "bolumler", "arama"] as const) {
        const k = karar(ekran, sol, panel, 600);
        if (k.sag === "sutun") assert.ok(k.olcek >= BELGE_OKUNUR_EN_AZ, `${ekran} ${sol} ${panel} ${k.olcek}`);
      }
    }
  }
});

test("sol araç açıkken araç daraltılmaz; yer yoksa sağ panel çekmeceye geçer", () => {
  const k = karar(1440, "arama", "ai", 396);
  assert.equal(k.kenar, "arac");
  assert.equal(k.sag, "cekmece");
  const genis = karar(1920, "arama", "ai", 396);
  assert.deepEqual([genis.kenar, genis.sag], ["arac", "sutun"]);
});

test("tablet ve telefonda belge akar; paneller çekmece", () => {
  const k = karar(1024, "kaynaklar", "pdf");
  assert.deepEqual([k.kenar, k.sag, k.olcek, k.sabitKagit], ["arac", "cekmece", 1, false]);
  assert.equal(karar(390, null, null).sabitKagit, false);
});

test("sağ panel genişliği talimattaki aralıkta", () => {
  assert.equal(sagPanelGenisligiSinirla("ai", 1000), 420);
  assert.equal(sagPanelGenisligiSinirla("ai", 100), 360);
  assert.equal(sagPanelGenisligiSinirla("pdf", 960), 600);
  assert.equal(sagPanelGenisligiSinirla("pdf", Number.NaN), 520);
});

test("kullanıcı ölçeği: sınırlı, adım %10; bozuk değer Sığdır", () => {
  assert.equal(olcekTercihiOku("sigdir"), "sigdir");
  assert.equal(olcekTercihiOku("abc"), "sigdir");
  assert.equal(olcekTercihiOku("5"), 2);
  assert.equal(olcekTercihiOku("0.1"), 0.5);
  assert.equal(olcekAdimi(0.86, 1), 1);
  assert.equal(olcekAdimi(0.86, -1), 0.8);
  assert.equal(olcekAdimi(2, 1), 2);
});
