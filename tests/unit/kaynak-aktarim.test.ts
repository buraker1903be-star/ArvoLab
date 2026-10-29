import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bibtexOku, bibtexYaz, doiAyikla, kaynakAnahtari, kaynakcaMetni, kaynakDosyasiOku, risOku, risYaz } from "@/lib/kaynak-aktarim";

/* Zotero ve Mendeley'in gerçek dışa aktarma biçimiyle (alan sırası, boşluklar, BOM). */
const RIS = `﻿TY  - JOUR
TI  - Öğretmen adaylarının dijital okuryazarlık düzeyleri
AU  - Yılmaz, Ahmet
AU  - Demir, Ayşe Betül
T2  - Eğitim ve Bilim
PY  - 2021
DA  - 2021/03/15
VL  - 46
IS  - 205
SP  - 101
EP  - 120
DO  - 10.15390/EB.2021.9876
ER  - 

TY  - BOOK
TI  - Bilimsel araştırma yöntemleri
AU  - Büyüköztürk, Şener
PY  - 2020
PB  - Pegem Akademi
ER  - 

TY  - THES
TI  - Bir doktora tezi
AU  - Kaya, Deniz
PY  - 2019
PB  - Hacettepe Üniversitesi
ER  - 

TY  - JOUR
AU  - Başlıksız, Kayıt
ER  - 
`;

const BIB = `@comment{jabref}
@article{yilmaz2021,
  title = {{\\"O}{\\u g}retmen adaylar{\\i}n{\\i}n dijital okuryazarl{\\i}k d{\\"u}zeyleri},
  author = {Y{\\i}lmaz, Ahmet and Ay{\\c s}e Betül Demir},
  journal = "Eğitim ve Bilim",
  year = 2021,
  volume = {46}, number = {205},
  pages = {101--120},
  doi = {https://doi.org/10.15390/EB.2021.9876}
}
@incollection{kaya2019,
  title = {Bölüm başlığı},
  author = {Kaya, Deniz},
  booktitle = {Editörlü Kitap},
  publisher = {Anı Yayıncılık},
  year = {2019},
  pages = {10-30}
}`;

describe("içe aktarma", () => {
  test("RIS: tür, yazarlar APA biçiminde, sayfa aralığı, DOI; başlıksız kayıt atlanır", () => {
    const k = risOku(RIS);
    assert.equal(k.length, 3);
    assert.deepEqual(k[0], {
      title: "Öğretmen adaylarının dijital okuryazarlık düzeyleri",
      authors: "Yılmaz, A., & Demir, A. B.",
      year: "2021",
      sourceType: "article",
      doiOrUrl: "10.15390/EB.2021.9876",
      containerTitle: "Eğitim ve Bilim",
      volume: "46",
      issue: "205",
      pages: "101-120",
      publisher: null,
    });
    assert.deepEqual([k[1].sourceType, k[1].publisher, k[1].authors], ["book", "Pegem Akademi", "Büyüköztürk, Ş."]);
    assert.deepEqual([k[2].sourceType, k[2].publisher], ["thesis", "Hacettepe Üniversitesi"]);
  });

  test("BibTeX: LaTeX aksanları, iç içe parantez, 'Ad Soyad' yazar, DOI bağlantısı, bölüm", () => {
    const k = bibtexOku(BIB);
    assert.equal(k.length, 2);
    assert.equal(k[0].title, "Öğretmen adaylarının dijital okuryazarlık düzeyleri");
    assert.equal(k[0].authors, "Yılmaz, A., & Demir, A. B.");
    assert.deepEqual([k[0].year, k[0].containerTitle, k[0].volume, k[0].issue, k[0].pages, k[0].doiOrUrl], ["2021", "Eğitim ve Bilim", "46", "205", "101-120", "10.15390/EB.2021.9876"]);
    assert.deepEqual([k[1].sourceType, k[1].containerTitle, k[1].publisher], ["chapter", "Editörlü Kitap", "Anı Yayıncılık"]);
  });

  test("biçim dosya adından ya da içerikten seçilir", () => {
    assert.equal(kaynakDosyasiOku("kutuphane.txt", RIS).bicim, "ris");
    assert.equal(kaynakDosyasiOku("x.bib", BIB).bicim, "bibtex");
    assert.deepEqual(kaynakDosyasiOku("notlar.txt", "rastgele metin"), { bicim: null, kayitlar: [] });
  });

  test("aynı kaynak: DOI büyük/küçük harf ve bağlantı farkı; DOI yoksa başlık + yıl", () => {
    assert.equal(kaynakAnahtari({ title: "A", year: "2020", doiOrUrl: "10.1000/ABC" }), kaynakAnahtari({ title: "B", year: null, doi_or_url: "https://doi.org/10.1000/abc" }));
    assert.equal(kaynakAnahtari({ title: "Dijital Okuryazarlık!", year: "2020" }), kaynakAnahtari({ title: "dijital okuryazarlık", year: "2020" }));
    assert.notEqual(kaynakAnahtari({ title: "X", year: "2020" }), kaynakAnahtari({ title: "X", year: "2021" }));
  });
});

test("DOI ayıklama: bağlantı, doi: öneki, sondaki noktalama, tekrar", () => {
  const metin = `Bkz. https://doi.org/10.1000/xyz123. ve doi:10.1037/0003-066X.59.1.29, ayrıca (10.1000/XYZ123) ile 10.5555/abc`;
  assert.deepEqual(doiAyikla(metin), ["10.1000/xyz123", "10.1037/0003-066X.59.1.29", "10.5555/abc"]);
});

describe("dışa aktarma", () => {
  const kaynaklar = risOku(RIS).map((t) => ({
    title: t.title, authors: t.authors, year: t.year, source_type: t.sourceType, doi_or_url: t.doiOrUrl,
    container_title: t.containerTitle, volume: t.volume, issue: t.issue, pages: t.pages, publisher: t.publisher,
  }));

  test("RIS yaz → oku aynı künyeyi verir", () => {
    const geri = risOku(risYaz(kaynaklar));
    assert.equal(geri.length, 3);
    assert.deepEqual([geri[0].title, geri[0].authors, geri[0].pages, geri[0].doiOrUrl, geri[0].containerTitle], [kaynaklar[0].title, kaynaklar[0].authors, "101-120", "10.15390/EB.2021.9876", "Eğitim ve Bilim"]);
  });

  test("BibTeX yaz → oku; anahtarlar ASCII ve benzersiz", () => {
    const metin = bibtexYaz([...kaynaklar, kaynaklar[0]]);
    assert.match(metin, /@article\{Yilmaz2021,/);
    assert.match(metin, /@article\{Yilmaz2021a,/);
    const geri = bibtexOku(metin);
    assert.equal(geri.length, 4);
    assert.equal(geri[0].authors, "Yılmaz, A., & Demir, A. B.");
    assert.equal(geri[2].publisher, "Hacettepe Üniversitesi");
  });

  test("APA kaynakçası Türkçe alfabeyle sıralı, italik HTML'de", () => {
    const { metin, html } = kaynakcaMetni(kaynaklar, "apa7");
    const satirlar = metin.split("\n");
    assert.deepEqual(satirlar.map((s) => s.split(",")[0]), ["Büyüköztürk", "Kaya", "Yılmaz"]);
    assert.match(html, /<i>Eğitim ve Bilim<\/i>/);
    /* Sayısal stilde verilen sıra korunur. */
    assert.match(kaynakcaMetni(kaynaklar, "ieee").metin.split("\n")[0], /^\[1\] A\. Yılmaz/);
  });
});

describe("kurum yazarı (28.10.2026)", () => {
  test("RIS'te kurum adı kişi gibi bölünmez", () => {
    // Eskiden: "Bakanlığı, M. E."
    const [k] = risOku("TY  - RPRT\nAU  - Milli Eğitim Bakanlığı\nTI  - Rapor\nPY  - 2023\nER  - \n");
    assert.equal(k.authors, "Milli Eğitim Bakanlığı");
  });

  test("kısaltma kurum, üç sözcüklü kişi adı kişi", () => {
    const [k] = risOku("TY  - JOUR\nAU  - TÜİK\nAU  - Ahmet Faruk Yılmaz\nTI  - X\nER  - \n");
    assert.equal(k.authors, "TÜİK, & Yılmaz, A. F.");
  });

  test("BibTeX'te çift süslü parantez kurumdur", () => {
    // Zotero'nun yazımı; eskiden "Organization, W. H."
    const [k] = bibtexOku("@report{a, author = {{World Health Organization} and Demir, Ayşe}, title = {Rapor}, year = {2020}}");
    assert.equal(k.authors, "World Health Organization, & Demir, A.");
  });
});

describe("İngilizce kaynakça metni (28.10.2026)", () => {
  test("tarihsiz kaynak n.d. ile yazılıyor", () => {
    const k = { title: "Writing well", authors: "Smith, J.", year: null, source_type: "book", doi_or_url: null, publisher: "Academic Press" };
    assert.equal(kaynakcaMetni([k], "apa7", {}, "en").metin, "Smith, J. (n.d.). Writing well. Academic Press.");
    assert.equal(kaynakcaMetni([k], "apa7").metin, "Smith, J. (t.y.). Writing well. Academic Press.");
  });
});
