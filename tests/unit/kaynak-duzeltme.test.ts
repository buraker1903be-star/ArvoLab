import assert from "node:assert/strict";
import test from "node:test";
import { duzeltmeFarklari, yazarBicimiBelirsiz } from "@/lib/kaynak-duzeltme";
import type { DoiMetadata } from "@/lib/doi";

const dizin: DoiMetadata = {
  doi: "10.1/x",
  title: "Peer study groups in higher education",
  authors: "Demir, B., & Kaya, C.",
  year: "2019",
  sourceType: "article",
  containerTitle: "Journal of Education",
  volume: "12",
  issue: "3",
  pages: "45–67",
  publisher: null,
  publicationPlace: null,
};

test("düzeltme: yalnızca gerçek farklar önerilir; biçim farkı ve dizinde boş alan önerilmez", () => {
  const farklar = duzeltmeFarklari(
    { title: "Peer Study Groups in Higher Education.", authors: "B. Demir and C. Kaya", year: "2019", container_title: "Journal of Education", volume: null, issue: "3", pages: "45-67", publisher: "Eski Yayınevi" },
    dizin,
  );
  assert.deepEqual(farklar.map((f) => f.alan), ["authors", "volume"]);
  assert.deepEqual(farklar.find((f) => f.alan === "volume"), { alan: "volume", mevcut: null, onerilen: "12" });
  // publisher dizinde boş: öğrencinin yazdığı silinmez.
  assert.equal(farklar.some((f) => f.alan === "publisher"), false);
});

test("düzeltme: her şey aynıysa öneri yok", () => {
  assert.deepEqual(duzeltmeFarklari({ title: dizin.title, authors: dizin.authors, year: "2019", container_title: "Journal of Education", volume: "12", issue: "3", pages: "45–67" }, dizin), []);
});

test("yazar biçimi: APA dizisi belirsiz değil; 'and', 'et al.' ve ad-önce biçim belirsiz", () => {
  assert.equal(yazarBicimiBelirsiz("Demir, B., & Kaya, C."), false);
  assert.equal(yazarBicimiBelirsiz("Demir, B."), false);
  assert.equal(yazarBicimiBelirsiz("B. Demir and C. Kaya"), true);
  assert.equal(yazarBicimiBelirsiz("Demir, B. et al."), true);
  assert.equal(yazarBicimiBelirsiz(null), false);
});
