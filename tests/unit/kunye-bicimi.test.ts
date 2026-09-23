// "Kaynak ekle" penceresinin ürettiği künye ve metin içi atıf.
//
// Yeni bir stil eklenip burası unutulduğunda hata sessizdir: pencere
// çalışmaya APA biçiminde künye yazar, öğrenci de doğru sanır.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatInTextCitation, formatReferenceParts, type CitableSource, type CitationStyle } from "@/lib/citation-format";
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

  test("metin içi atıf sayfa uydurmaz: '(Yılmaz)'", () => {
    // Sayfa numarasını yalnızca alıntıyı yapan bilir; uydurmak yanlış
    // sayfa yazmaktır.
    assert.equal(formatInTextCitation(kitap, "mla", 1), "(Yılmaz)");
  });

  test("her stilin kendi biçimi var: hiçbiri APA çıktısına düşmüyor", () => {
    const ciktilar = STIL_SECENEKLERI.map((secenek) => metin(makale, secenek.deger as CitationStyle));
    assert.equal(new Set(ciktilar).size, STIL_SECENEKLERI.length);
  });
});
