import assert from "node:assert/strict";
import test from "node:test";
import { CROSSREF_USER_AGENT, DOI_PATTERN, crossrefWorkUrl, normalizeDoi } from "@/lib/doi";

test("yaygın yapıştırma biçimleri normalleşir", () => {
  const beklenen = "10.1000/xyz123";
  for (const girdi of [
    "10.1000/xyz123",
    "  10.1000/xyz123  ",
    "https://doi.org/10.1000/xyz123",
    "http://doi.org/10.1000/xyz123",
    "https://dx.doi.org/10.1000/xyz123",
    "doi:10.1000/xyz123",
    "doi: 10.1000/xyz123",
    "DOI: 10.1000/xyz123",
    "10.1000/xyz123.",
    "10.1000/xyz123,",
  ]) {
    assert.equal(normalizeDoi(girdi), beklenen, girdi);
  }
});

test("yüzde kodlu DOI çözülür", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000%2Fxyz123"), "10.1000/xyz123");
});

test("bozuk yüzde kodlaması çökertmez, ham değer denenir", () => {
  // decodeURIComponent burada atar. Modül bunu bilerek yutup değeri olduğu
  // gibi deniyor; kalıba uyduğu için ham hâli döner (çökme yok, veri kaybı yok).
  assert.equal(normalizeDoi("10.1000/%E0%A4%A"), "10.1000/%E0%A4%A");
  // Kalıba uymayan bozuk kodlama yine null.
  assert.equal(normalizeDoi("abc%E0%A4%A"), null);
});

test("geçersiz girdiler null döner", () => {
  for (const girdi of ["", "   ", "abc", "11.1000/xyz", "10.1/xyz", "10.1000/", "https://example.com/makale"]) {
    assert.equal(normalizeDoi(girdi), null, girdi);
  }
});

test("DOI kalıbı öneki 10. ve 4-9 hane ister", () => {
  assert.ok(DOI_PATTERN.test("10.1000/x"));
  assert.ok(DOI_PATTERN.test("10.123456789/x"));
  assert.ok(!DOI_PATTERN.test("10.123/x"), "4 haneden az");
  assert.ok(!DOI_PATTERN.test("10.1234567890/x"), "9 haneden fazla");
});

test("Crossref adresinde eğik çizgi korunur, gerisi kodlanır", () => {
  assert.equal(crossrefWorkUrl("10.1000/xyz123"), "https://api.crossref.org/works/10.1000/xyz123");
  // Boşluk ve özel karakter kodlanmalı, yapıdaki "/" bozulmamalı.
  assert.equal(
    crossrefWorkUrl("10.1000/a b&c"),
    "https://api.crossref.org/works/10.1000/a%20b%26c",
  );
});

test("User-Agent yalnızca ASCII", () => {
  // HTTP başlıkları Latin-1 kabul eder; Türkçe karakter isteği düşürür.
  assert.ok(/^[\x20-\x7e]+$/.test(CROSSREF_USER_AGENT), CROSSREF_USER_AGENT);
});
