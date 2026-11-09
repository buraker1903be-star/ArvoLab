import { describe, test as it } from "node:test";
import assert from "node:assert/strict";
import { belgeSutunuCm, belgeSutunuDegeri, VARSAYILAN_SUTUN_PX } from "@/lib/belge-sutunu";

/*
  K-4 (V4.3-C1): ekrandaki metin sütunu kılavuzdan, yoksa tasarımdan.
  Negatif denetimler: kılavuzsuz belgenin kendi kenar boşlukları sütunu
  DEĞİŞTİRMEZ; saçma ölçü varsayılana düşer.
*/
describe("belgeSutunuCm", () => {
  it("kılavuz yoksa tasarımın 638 px'i (null), belgenin kendi boşlukları ne olursa olsun", () => {
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: false, margins: { left: 4, right: 2.5 }, pageSize: "a4" }), null);
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: false, margins: { left: 2.5, right: 2.5 }, pageSize: "a4" }), null);
    assert.equal(VARSAYILAN_SUTUN_PX, 638);
  });
  it("kılavuz varsa kâğıt genişliği eksi sol ve sağ boşluk", () => {
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: 4, right: 2.5 }, pageSize: "a4" }), 14.5);
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: 3, right: 2.5 }, pageSize: "a4" }), 15.5);
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: 2.54, right: 2.54 }, pageSize: "letter" }), 16.51);
  });
  it("okunamaz ya da kâğıttan taşan ölçü varsayılana düşer", () => {
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: 8, right: 8 }, pageSize: "a4" }), null);
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: 0.5, right: 0.5 }, pageSize: "a4" }), null);
    assert.equal(belgeSutunuCm({ kilavuzOlcusuVar: true, margins: { left: Number.NaN, right: 2 }, pageSize: "a4" }), null);
  });
  it("CSS değeri cm cinsinden; null'da değişken yazılmaz", () => {
    assert.equal(belgeSutunuDegeri(14.5), "14.5cm");
    assert.equal(belgeSutunuDegeri(null), null);
  });
});
