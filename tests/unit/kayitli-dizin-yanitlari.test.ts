import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crossrefKayitlari, kayitlariBirlestir, openAlexKayitlari } from "@/lib/literatur-arama";

/*
  Yerel kabulün KAYITLI (sentetik) dizin yanıtları
  (scripts/yerel-yigin/kayitli-yanitlar/, 4. tur). Kabul betiği Makale bul'un
  sonuç listesini bu yanıtlarla sınıyor; yanıtlar uygulamanın ayrıştırıcısından
  geçmezse kabul hiçbir şey ölçmez. Bu test gerçek dizin kabulü değildir.
*/
const oku = (ad: string) => JSON.parse(readFileSync(`scripts/yerel-yigin/kayitli-yanitlar/${ad}`, "utf8"));

test("kayıtlı OpenAlex ve Crossref yanıtları ayrıştırılır; aynı DOI tek kayda iner", () => {
  const oa = openAlexKayitlari(oku("openalex-works.json"));
  const cr = crossrefKayitlari(oku("crossref-works.json"));
  assert.equal(oa.length, 3);
  assert.equal(cr.length, 2);
  assert.ok(oa.every((k) => k.saglayici === "openalex") && cr.every((k) => k.saglayici === "crossref"));
  // DOI'siz kayıt sayfa adresiyle tanınır; kurumsal yazar Crossref'te "name" alanından gelir.
  assert.equal(oa[2].doi, null);
  assert.deepEqual(cr[1].yazarlar, ["Synthetic Education Council"]);
  const birlesik = kayitlariBirlestir([oa, cr]);
  assert.equal(birlesik.length, 4);
  assert.equal(birlesik.filter((k) => k.doi === "10.5555/kayitli.2022.101").length, 1);
});
