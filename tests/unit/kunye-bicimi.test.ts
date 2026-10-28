// "Kaynak ekle" penceresinin ürettiği künye ve metin içi atıf.
//
// Yeni bir stil eklenip burası unutulduğunda hata sessizdir: pencere
// çalışmaya APA biçiminde künye yazar, öğrenci de doğru sanır.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { authorLabel, eksikAlanlar, formatInTextCitation, formatReferenceParts, sayfaEtiketi, type CitableSource, type CitationStyle } from "@/lib/citation-format";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";

const kitap: CitableSource = {
  title: "Osmanlı'da Şehir Kültürü",
  authors: "Yılmaz, Ahmet",
  year: "2020",
  source_type: "book",
  publisher: "İletişim Yayınları",
  doi_or_url: null,
  container_title: null,
  volume: null,
  issue: null,
  pages: null,
};

const makale: CitableSource = {
  ...kitap,
  title: "Metinlerarasılık",
  source_type: "article",
  container_title: "Edebiyat Dergisi",
  volume: "12",
  issue: "3",
  pages: "45-60",
  publisher: null,
};

const metin = (source: CitableSource, stil: CitationStyle) =>
  formatReferenceParts(source, stil, 1)
    .map((parca) => parca.text)
    .join("");

describe("MLA künye üretimi", () => {
  test("kitap: Yazar. Başlık. Yayınevi, Yıl.", () => {
    assert.equal(metin(kitap, "mla"), "Yılmaz, Ahmet. Osmanlı'da Şehir Kültürü. İletişim Yayınları, 2020.");
  });

  test("makale: başlık tırnakta, dergi italik, cilt/sayı/sayfa MLA sırasında", () => {
    assert.equal(
      metin(makale, "mla"),
      "Yılmaz, Ahmet. “Metinlerarasılık.” Edebiyat Dergisi, c. 12, sy. 3, 2020, ss. 45-60.",
    );
  });

  test("metin içi atıfta yıl her zaman var, sayfa uydurulmaz: '(Yılmaz 2020)'", () => {
    // Eskiden "(Yılmaz)"; kurum sahibinin geri bildirimi: yıl hepsinde
    // olsun, isteyen siler. Sayfayı yalnızca alıntıyı yapan bilir.
    assert.equal(formatInTextCitation(kitap, "mla", 1), "(Yılmaz 2020)");
  });

  test("her stilin kendi biçimi var: hiçbiri APA çıktısına düşmüyor", () => {
    const ciktilar = STIL_SECENEKLERI.map((secenek) => metin(makale, secenek.deger as CitationStyle));
    assert.equal(new Set(ciktilar).size, STIL_SECENEKLERI.length);
  });
});

describe("atıfta sayfa, erişim tarihi ve eksik bilgi", () => {
  test("sayfa yazılırsa her stilde atıfa girer; aralık 'ss.'", () => {
    assert.equal(formatInTextCitation(kitap, "apa7", 1, { sayfa: "14" }), "(Yılmaz, 2020, s. 14)");
    assert.equal(formatInTextCitation(kitap, "apa7", 1, { sayfa: "14-16" }), "(Yılmaz, 2020, ss. 14-16)");
    assert.equal(formatInTextCitation(kitap, "chicago", 1, { sayfa: "s. 14" }), "(Yılmaz 2020, s. 14)");
    assert.equal(formatInTextCitation(kitap, "ieee", 3, { sayfa: "7" }), "[3, s. 7]");
    assert.equal(formatInTextCitation(kitap, "vancouver", 3), "(3)");
    assert.equal(sayfaEtiketi("  "), null);
  });

  test("internet kaynağına erişim tarihi eklenir, diğerlerine eklenmez", () => {
    const site: CitableSource = { ...kitap, source_type: "website", doi_or_url: "https://tuik.gov.tr/x", publisher: null };
    const yaz = (k: CitableSource) => formatReferenceParts(k, "apa7", 1, { erisimTarihi: "26.10.2026" }).map((p) => p.text).join("");
    assert.match(yaz(site), /\(Erişim tarihi: 26\.10\.2026\)$/);
    assert.doesNotMatch(yaz(kitap), /Erişim tarihi/);
  });

  test("eksik alanlar türe göre söylenir", () => {
    assert.deepEqual(eksikAlanlar(kitap), []);
    assert.deepEqual(eksikAlanlar({ ...makale, issue: null, doi_or_url: null }), ["sayı", "DOI"]);
    assert.deepEqual(eksikAlanlar({ ...kitap, authors: null, year: "" }), ["yazar", "yıl"]);
  });
});

describe("İngilizce atıf ve künye (28.10.2026)", () => {
  const kaynak = {
    title: "Writing well",
    authors: "Smith, J., & Jones, K.",
    year: null,
    source_type: "chapter",
    doi_or_url: null,
    container_title: "Handbook",
    pages: "10-20",
    publisher: "Academic Press",
  };
  test("metin içi atıf: APA '&', n.d., pp.", () => {
    assert.equal(formatInTextCitation(kaynak, "apa7", 1, { sayfa: "14-16" }, "en"), "(Smith & Jones, n.d., pp. 14-16)");
    assert.equal(formatInTextCitation(kaynak, "chicago", 1, {}, "en"), "(Smith and Jones n.d.)");
    assert.equal(formatInTextCitation(kaynak, "apa7", 1, { sayfa: "14" }), "(Smith ve Jones, t.y., s. 14)");
    assert.equal(authorLabel({ ...kaynak, authors: "A, B.; C, D.; E, F." }, "en"), "A et al.");
  });
  test("künye ve eksik alanlar", () => {
    const metin = formatReferenceParts(kaynak, "apa7", 1, {}, "en").map((p) => p.text).join("");
    assert.equal(metin, "Smith, J., & Jones, K. (n.d.). Writing well. In Handbook (pp. 10-20). Academic Press.");
    assert.deepEqual(eksikAlanlar(kaynak, "en"), ["year"]);
    assert.deepEqual(eksikAlanlar(kaynak), ["yıl"]);
  });
});
