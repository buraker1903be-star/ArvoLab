import assert from "node:assert/strict";
import test from "node:test";
import { EDITOR_EN_DAR, OLCEK_EN_AZ, OLCEK_EN_COK, PANEL_EN_DAR, PANEL_EN_GENIS, PANEL_VARSAYILAN, olcekSinirla, panelGenisligiSinirla } from "@/lib/pdf-goruntu";

/* Yazım Stüdyosu: yakınlaştırma ve yan panel genişliği sınırları. */

test("yakınlaştırma %50–%300 arasında kalır; sayı olmayan %100'e döner", () => {
  assert.equal(olcekSinirla(0.1), OLCEK_EN_AZ);
  assert.equal(olcekSinirla(10), OLCEK_EN_COK);
  assert.equal(olcekSinirla(1.234), 1.23);
  assert.equal(olcekSinirla(Number.NaN), 1);
  assert.equal(olcekSinirla(Number.POSITIVE_INFINITY), 1);
});

test("panel genişliği: editör en az EDITOR_EN_DAR kalır", () => {
  const kap = 1100;
  const deger = panelGenisligiSinirla(5000, kap);
  assert.equal(deger, kap - EDITOR_EN_DAR);
  assert.ok(kap - deger >= EDITOR_EN_DAR);
});

test("panel genişliği: geniş ekranda üst sınır, dar istekte alt sınır", () => {
  assert.equal(panelGenisligiSinirla(5000, 3000), PANEL_EN_GENIS);
  assert.equal(panelGenisligiSinirla(10, 3000), PANEL_EN_DAR);
});

test("kayıtlı geniş tercih küçük ekranda sınırlara çekilir; panel en dar sınırın altına inmez", () => {
  assert.equal(panelGenisligiSinirla(900, 1000), 1000 - EDITOR_EN_DAR);
  // Ekran iki tarafın en azına yetmiyorsa panel yine de en dar sınırda kalır (masaüstü kırılımı üstünde olmaz).
  assert.equal(panelGenisligiSinirla(900, 600), PANEL_EN_DAR);
});

test("sayı olmayan istek varsayılana döner", () => {
  assert.equal(panelGenisligiSinirla(Number.NaN, 3000), PANEL_VARSAYILAN);
});
