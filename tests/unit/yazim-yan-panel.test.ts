import assert from "node:assert/strict";
import test from "node:test";
import { acilisGorunumu, gorunumOku, panelAcikMi, panelBicimi, PANEL_GORUNUMLERI } from "@/lib/yazim-yan-panel";

/*
  Yazım ekranının tek sağ paneli (Signature OS Phase 2). Eskiden iki
  panel vardı ve asistan inceleme panelinin üstüne biniyordu.
*/

test("gorunumOku: yalnızca dört görünüm; geri kalan varsayılan", () => {
  for (const g of PANEL_GORUNUMLERI) assert.equal(gorunumOku(g), g);
  for (const ham of [null, undefined, "", "Asistan", "ayarlar", 3]) assert.equal(gorunumOku(ham), "inceleme");
  assert.equal(gorunumOku("bilinmeyen", "asistan"), "asistan");
});

test("masaüstünde panel sütun, tablet ve telefonda belgenin üstüne açılan sayfa", () => {
  assert.equal(panelBicimi("masaustu"), "sutun");
  assert.equal(panelBicimi("tablet"), "sayfa");
  assert.equal(panelBicimi("telefon"), "sayfa");
});

test("masaüstü: hatırlanan tercih geçerli, oturumdaki seçim onu ezer", () => {
  assert.equal(panelAcikMi({ ekran: "masaustu", tercih: true, oturumdaAcildi: null }), true);
  assert.equal(panelAcikMi({ ekran: "masaustu", tercih: false, oturumdaAcildi: null }), false);
  assert.equal(panelAcikMi({ ekran: "masaustu", tercih: false, oturumdaAcildi: true }), true);
  assert.equal(panelAcikMi({ ekran: "masaustu", tercih: true, oturumdaAcildi: false }), false);
});

test("tablet ve telefon: masaüstünde açık bırakılan panel belgeyi örtmez; yalnızca açılınca açık", () => {
  for (const ekran of ["tablet", "telefon"] as const) {
    assert.equal(panelAcikMi({ ekran, tercih: true, oturumdaAcildi: null }), false);
    assert.equal(panelAcikMi({ ekran, tercih: true, oturumdaAcildi: true }), true);
  }
});

test("açılış: ?teslim teslim görünümünü, ?asistan asistanı açar; ikisi birden gelirse teslim", () => {
  assert.equal(acilisGorunumu({ asistan: false, teslim: null }), null);
  assert.equal(acilisGorunumu({ asistan: true, teslim: null }), "asistan");
  assert.equal(acilisGorunumu({ asistan: false, teslim: "kaynakca" }), "teslim");
  assert.equal(acilisGorunumu({ asistan: true, teslim: "kaynakca" }), "teslim");
});
