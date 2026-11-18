import assert from "node:assert/strict";
import { test } from "node:test";
import { BELGE_DILLERI, belgeDiliKarari, secilenBelgeDili } from "@/lib/belge-dili";

/*
  K1-A (19.11.2026): çalışmada seçilen dil önce gelir; seçilmemişse eski
  türetme (makale profili → arayüz dili) aynen sürer.
*/
test("çalışmada seçilen dil arayüz dilinden bağımsız", () => {
  assert.equal(belgeDiliKarari({ calisma: "tr", profil: null, arayuz: "en" }), "tr");
  assert.equal(belgeDiliKarari({ calisma: "en", profil: "tr", arayuz: "tr" }), "en");
});

test("seçilmemiş (NULL) eski çalışma: bugünkü kural — profil, yoksa arayüz", () => {
  assert.equal(belgeDiliKarari({ calisma: null, profil: "en", arayuz: "tr" }), "en");
  assert.equal(belgeDiliKarari({ calisma: null, profil: null, arayuz: "tr" }), "tr");
  assert.equal(belgeDiliKarari({ calisma: null, profil: null, arayuz: "en" }), "en");
  // Profildeki "diger" desteklenmiyor: arayüze düşer (eski davranış).
  assert.equal(belgeDiliKarari({ calisma: undefined, profil: "diger", arayuz: "tr" }), "tr");
});

test("formdan gelen değer: yalnızca desteklenen diller; boş seçim NULL", () => {
  assert.equal(secilenBelgeDili("en"), "en");
  assert.equal(secilenBelgeDili(""), null);
  assert.equal(secilenBelgeDili(null), null);
  assert.equal(secilenBelgeDili("de"), null);
  assert.deepEqual([...BELGE_DILLERI], ["tr", "en"]);
});
