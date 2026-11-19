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
  // Görsel uyum: paylar daraldığı için PDF istenen genişliğinde kalıyor (eskiden 440'a iniyordu).
  assert.equal(a.sagGenislik, 520);
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

/*
  Görsel uyum (19.11.2026): 8b28897'de AI paneli 1440 px'te gezinmeyi raya
  indiriyordu. Prototipte gezinme açık, belge ve AI yan yana. Sınır %85'te
  kaldı; yer paylardan ve panelin en dar genişliğinden açıldı.
*/
test("AI paneli: 1440'ta gezinme açık, belge yanında ve ≥ %85; 1280'de gezinme raya iner, panel örtmez", () => {
  const a = karar(1440, null, "ai", 396);
  assert.deepEqual([a.kenar, a.sag, a.sagGenislik], ["tam", "sutun", 360]);
  assert.ok(a.olcek >= BELGE_OKUNUR_EN_AZ, String(a.olcek));
  const b = karar(1280, null, "ai", 396);
  assert.deepEqual([b.kenar, b.sag, b.sagGenislik], ["ray", "sutun", 360]);
  assert.ok(b.olcek >= BELGE_OKUNUR_EN_AZ, String(b.olcek));
  // 1200'de ray + en dar AI ile belge %81 olurdu: çekmece (sınır gevşetilmez).
  assert.equal(karar(1200, null, "ai", 396).sag, "cekmece");
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

/*
  İnceleme paneli (19.11.2026, kabul turu): ilk sürümde karara girmiyordu ve
  sağ panel yokken 340 px'lik sütunu belgeyi 1440 px'te %84'e, 1280 px'te
  %66'ya, sol araçla %60'a indiriyordu.
*/
const incele = (ekran: number, solArac: "bolumler" | "kaynaklar" | "arama" | null, sagPanel: "ai" | "pdf" | null = null, kenarDar = false) =>
  yerlesimKarari({ ekran, solArac, sagPanel, sagGenislik: sagPanel === "pdf" ? 520 : 396, kenarDar, inceleme: true });

test("inceleme paneli: geniş ekranda sütun, belge okunur sınırın üstünde", () => {
  const k = incele(1920, null);
  assert.deepEqual([k.kenar, k.inceleme, k.olcek], ["tam", "sutun", 1]);
});

test("inceleme paneli: 1440'ta gezinme açık; belge %85 altına inecekse önce gezinme raya iner", () => {
  const k = incele(1440, null);
  assert.deepEqual([k.inceleme, k.kenar], ["sutun", "tam"]);
  assert.ok(k.olcek >= BELGE_OKUNUR_EN_AZ, `ölçek ${k.olcek}`);
  const r = incele(1280, null);
  assert.deepEqual([r.inceleme, r.kenar], ["sutun", "ray"]);
});

test("inceleme paneli: ray da yetmezse çekmece; sol araç daraltılmaz", () => {
  const ray1280 = incele(1280, null);
  assert.deepEqual([ray1280.kenar, ray1280.inceleme], ["ray", "sutun"]);
  assert.ok(ray1280.olcek >= BELGE_OKUNUR_EN_AZ);
  for (const [ekran, sol] of [[1440, "kaynaklar"], [1280, "kaynaklar"], [1200, null]] as const) {
    const k = incele(ekran, sol);
    assert.equal(k.inceleme, "cekmece", `${ekran} ${sol}`);
    if (sol) assert.equal(k.kenar, "arac");
  }
});

test("inceleme paneli: sağ panel (AI/PDF) açıkken gösterilmez; kapalıyken karar eskisiyle aynı", () => {
  assert.equal(incele(1920, null, "pdf").inceleme, "yok");
  assert.equal(incele(1024, null, "ai").inceleme, "yok");
  const kapali = yerlesimKarari({ ekran: 1440, solArac: null, sagPanel: null, sagGenislik: 0, kenarDar: false });
  assert.deepEqual([kapali.kenar, kapali.inceleme, kapali.olcek], ["tam", "yok", 1]);
});

test("inceleme paneli: tablet ve telefonda akış (belgenin üstünde/altında), belge sıkışmaz", () => {
  for (const ekran of [1024, 768, 390]) {
    const k = incele(ekran, null);
    assert.deepEqual([k.inceleme, k.sabitKagit, k.olcek], ["akis", false, 1]);
  }
});

/*
  4. tur (18.11.2026): kaynak listesi + belge + PDF. Eskiden 1472/1440 px'te
  300 px'lik liste açıkken PDF çekmeceye düşüyordu (en dar PDF ile bile
  belge %69–%71). Önce araç şeride iner; belge ve PDF yan yana kalır.
*/
test("kaynak listesi + PDF: 1472 ve 1440'ta araç şeride iner, belge ≥ %85 ve PDF sütun", () => {
  const a = karar(1472, "kaynaklar", "pdf", 520);
  assert.deepEqual([a.kenar, a.sag, a.sagGenislik], ["aracDar", "sutun", 520]);
  assert.ok(a.olcek >= BELGE_OKUNUR_EN_AZ, String(a.olcek));
  const b = karar(1440, "kaynaklar", "pdf", 520);
  assert.deepEqual([b.kenar, b.sag, b.sagGenislik], ["aracDar", "sutun", 520]);
  assert.ok(b.olcek >= BELGE_OKUNUR_EN_AZ, String(b.olcek));
  // Geniş ekranda araç tam genişliğinde kalır.
  assert.deepEqual([karar(1920, "kaynaklar", "pdf", 520).kenar, karar(1920, "kaynaklar", "pdf", 520).sag], ["arac", "sutun"]);
});

test("kaynak listesi + PDF: şeritle de sığmıyorsa (1280) ya da kullanıcı aracı geri açtıysa çekmece", () => {
  const c = karar(1280, "kaynaklar", "pdf", 520);
  assert.deepEqual([c.kenar, c.sag], ["arac", "cekmece"]);
  const d = yerlesimKarari({ ekran: 1472, solArac: "kaynaklar", sagPanel: "pdf", sagGenislik: 520, kenarDar: false, solGenisIstendi: true });
  assert.deepEqual([d.kenar, d.sag], ["arac", "cekmece"]);
  // AI panelinde araç daraltılmaz (önceki kural yerinde).
  assert.equal(karar(1472, "kaynaklar", "ai", 396).kenar, "arac");
});
