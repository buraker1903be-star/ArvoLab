import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cikisKarari, harfCevir, odakEscKarari, puntoAdimi, siradakiHarfDurumu, tabKarari } from "@/lib/klavye-karari";

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

/* V4.3-B2: editörden klavyeyle çıkış (WCAG 2.1.2). */
test("çıkış: Esc kurar; kuruluyken Tab ileri, Shift+Tab geri çıkar", () => {
  assert.equal(cikisKarari(false, "Escape", false), "kur");
  assert.equal(cikisKarari(true, "Tab", false), "cik-ileri");
  assert.equal(cikisKarari(true, "Tab", true), "cik-geri");
});

test("çıkış: kurulu değilken Tab editörün kendi işine (girinti) bırakılır", () => {
  assert.equal(cikisKarari(false, "Tab", false), "dokunma");
  assert.equal(cikisKarari(false, "Tab", true), "dokunma");
});

test("çıkış: başka bir tuş kurulumu bozar, değiştirici tuşun kendisi bozmaz", () => {
  assert.equal(cikisKarari(true, "a", false), "boz");
  assert.equal(cikisKarari(true, "Enter", false), "boz");
  assert.equal(cikisKarari(true, "Shift", true), "dokunma");
  assert.equal(cikisKarari(false, "a", false), "dokunma");
});

/*
  TB-3 (Phase 4.6): odak modundan Esc. Eskiden kapalı çekmecelerin
  role="dialog"'u ve ProseMirror'ın koşulsuz preventDefault'u yüzünden Esc
  hiç çıkarmıyordu; karar artık yalnızca gerçekten açık katmana bakar.
*/
describe("odakEscKarari", () => {
  const g = (ek: Partial<Parameters<typeof odakEscKarari>[0]>) => ({ odak: true, tus: "Escape", acikKatman: false, oneriAcik: false, kendiEscliAlan: false, ...ek });
  test("odakta, katman yokken Esc çıkar", () => assert.equal(odakEscKarari(g({})), "cik"));
  test("odak kapalıyken ya da başka tuşta dokunmaz", () => {
    assert.equal(odakEscKarari(g({ odak: false })), "birak");
    for (const tus of ["Enter", "Tab", "a", "Esc"]) assert.equal(odakEscKarari(g({ tus })), "birak");
  });
  test("açık katman önce kapanır: pencere/menü, satır içi öneri, kendi Esc'i olan alan", () => {
    assert.equal(odakEscKarari(g({ acikKatman: true })), "birak");
    assert.equal(odakEscKarari(g({ oneriAcik: true })), "birak");
    assert.equal(odakEscKarari(g({ kendiEscliAlan: true })), "birak");
  });
});
