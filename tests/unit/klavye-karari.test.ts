import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { harfCevir, puntoAdimi, siradakiHarfDurumu, tabKarari } from "@/lib/klavye-karari";

const d = (ek: Partial<Parameters<typeof tabKarari>[0]>) => ({ listede: false, tabloda: false, satirBasinda: false, girintili: false, ...ek });

describe("editörde Tab", () => {
  test("satır başında girinti, içeride sekme; Shift+Tab girintiyi kaldırır", () => {
    assert.equal(tabKarari(d({ satirBasinda: true }), false), "girinti-ekle");
    assert.equal(tabKarari(d({ satirBasinda: true, girintili: true }), false), "sekme");
    assert.equal(tabKarari(d({}), false), "sekme");
    assert.equal(tabKarari(d({ satirBasinda: true, girintili: true }), true), "girinti-kaldir");
    assert.equal(tabKarari(d({}), true), "yut");
  });

  test("listede ve tabloda tuş editörden çıkmaz", () => {
    assert.equal(tabKarari(d({ listede: true, satirBasinda: true }), false), "yut");
    assert.equal(tabKarari(d({ tabloda: true }), true), "yut");
  });

  test("punto adımı Word gibi bir punto; sınırlar ve varsayılan", () => {
    assert.equal(puntoAdimi("12pt", 12, 1), "13pt");
    assert.equal(puntoAdimi(null, 12, -1), "11pt");
    assert.equal(puntoAdimi("8pt", 12, -1), "8pt");
    assert.equal(puntoAdimi("72pt", 12, 1), "72pt");
  });

  test("Shift+F3: küçük → BÜYÜK → Başlık Düzeni, Türkçe i/İ ile", () => {
    assert.equal(siradakiHarfDurumu("işsizlik ve enflasyon"), "buyuk");
    assert.equal(harfCevir("işsizlik ve enflasyon", "buyuk"), "İŞSİZLİK VE ENFLASYON");
    assert.equal(siradakiHarfDurumu("İŞSİZLİK VE ENFLASYON"), "baslik");
    assert.equal(harfCevir("İŞSİZLİK VE ENFLASYON", "baslik"), "İşsizlik Ve Enflasyon");
    assert.equal(siradakiHarfDurumu("İşsizlik Ve Enflasyon"), "kucuk");
    assert.equal(harfCevir("IŞIK ILIK", "kucuk"), "ışık ılık");
    assert.equal(harfCevir("türkiye'de büyüme", "baslik"), "Türkiye'de Büyüme");
    // Kelime ortasından başlayan seçim: baş harf büyütülmez.
    assert.equal(harfCevir("zlik ve", "baslik", false), "zlik Ve");
    assert.equal(siradakiHarfDurumu("2026 – 15"), "kucuk");
  });
});
