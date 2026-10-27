import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { puntoAdimi, tabKarari } from "@/lib/klavye-karari";

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
});
