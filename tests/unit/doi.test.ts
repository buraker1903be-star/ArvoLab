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

/*
  TEK DOI KURALI (A1, 07.11.2026). Eskiden üç ayrı kural aynı DOI'yi farklı
  okuyordu; aşağıdakilerin her biri önce/sonra dökümünde (A1 raporu) farklı
  çıkan bir girdidir. Aynı DOI'nin her yazımı AYNI anahtarı üretmeli, yoksa
  tekrar denetimi kaçar.
*/
import { doiAnahtari, metindekiDoiler } from "@/lib/doi";
import { doiAyikla as kunyeDoisi } from "@/lib/kanit/kunye-karsilastirma";
import { doiAyikla as metindenDoiler, kaynakAnahtarlari } from "@/lib/kaynak-aktarim";

test("A1: sarmalayıcılı, şemasız ve sonu noktalamalı yazımlar aynı DOI'dir", () => {
  for (const girdi of [
    "(doi: 10.1000/xyz123)",
    "10.1000/xyz123),",
    "[10.1000/xyz123]",
    "<10.1000/xyz123>",
    '"10.1000/xyz123"',
    "“10.1000/xyz123”",
    "10.1000/xyz123:",
    "doi.org/10.1000/xyz123",
    "https://www.doi.org/10.1000/xyz123",
    "https://doi.org/10.1000/xyz123/",
  ]) {
    assert.equal(normalizeDoi(girdi), "10.1000/xyz123", girdi);
    assert.equal(doiAnahtari(girdi), "10.1000/xyz123", girdi);
    // Tekrar anahtarı da aynı: eskiden "doi:10.1000/xyz123)" gibi ayrı anahtarlar üretiyordu.
    assert.ok(kaynakAnahtarlari({ title: "", year: null, doi_or_url: girdi }).includes("doi:10.1000/xyz123"), girdi);
  }
});

test("A1: parantezli DOI'ler bozulmaz; yalnızca açılışı olmayan kapanış atılır", () => {
  const sici = "10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-O";
  assert.equal(normalizeDoi(sici), sici);
  assert.equal(normalizeDoi("10.1016/0005-2736(77)90194-3"), "10.1016/0005-2736(77)90194-3");
  // Eskiden metinden ayıklayıcı bunu "10.1000/abc(1" diye kesiyordu.
  assert.equal(normalizeDoi("10.1000/abc(1)"), "10.1000/abc(1)");
  assert.deepEqual(metindekiDoiler("bkz. 10.1000/abc(1) ve"), ["10.1000/abc(1)"]);
  assert.equal(normalizeDoi("10.1000/abc(1))"), "10.1000/abc(1)");
  assert.deepEqual(metindenDoiler(`(bkz. ${sici}).`), [sici]);
});

test("A1: büyük/küçük harf korunur, anahtar küçük harftir", () => {
  assert.equal(normalizeDoi("http://dx.doi.org/10.1000/XYZ123"), "10.1000/XYZ123");
  assert.equal(doiAnahtari("http://dx.doi.org/10.1000/XYZ123"), "10.1000/xyz123");
  assert.equal(doiAnahtari("https://ornek.com/makale"), null);
  assert.equal(doiAnahtari(null), null);
});

test("A1: metinden ayıklama yüzde kodlu adresi bulur, sırayı ve benzersizliği korur", () => {
  assert.deepEqual(metindekiDoiler("https://doi.org/10.1000%2Fxyz123"), ["10.1000/xyz123"]);
  assert.deepEqual(metindekiDoiler("10.1000/B, 10.1000/a; 10.1000/b."), ["10.1000/B", "10.1000/a"]);
  assert.deepEqual(metindekiDoiler(""), []);
  // Künye karşılaştırması aynı kuralı küçük harfle kullanır.
  assert.equal(kunyeDoisi("(doi: 10.1000/ABC.123)."), "10.1000/abc.123");
  assert.equal(kunyeDoisi("https://ornek.com/makale"), null);
});
