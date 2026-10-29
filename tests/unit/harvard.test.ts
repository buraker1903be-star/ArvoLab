import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatInTextCitation, formatReferenceParts, type CitableSource } from "@/lib/citation-format";
import { kunyeAyristir } from "@/lib/atif/kunye";
import { atifCikarmaStili, STIL_SECENEKLERI, stilTanimi } from "@/lib/atif/stiller";
import { crossCheck, extractInTextCitations } from "@/lib/apa7";
import { atifSistemiSec } from "@/lib/atif-sistemi";

/* Harvard (Cite Them Right) — 29.10.2026'da eklendi; İngiltere/Avustralya öğrencileri APA seçiyordu. */
const makale: CitableSource = {
  title: "Feedback and learning in higher education",
  authors: "Smith, J., & Jones, A.",
  year: "2020",
  source_type: "article",
  doi_or_url: "10.1000/xyz",
  container_title: "Studies in Higher Education",
  volume: "45",
  issue: "3",
  pages: "45-67",
};
const kitap: CitableSource = { title: "Research methods", authors: "Brown, K.", year: "2019", source_type: "book", doi_or_url: null, publisher: "Sage" };
const metin = (parcalar: { text: string }[]) => parcalar.map((p) => p.text).join("");

describe("Harvard", () => {
  test("seçeneklerde ve tanımda var", () => {
    assert.ok(STIL_SECENEKLERI.some((s) => s.deger === "harvard"));
    assert.equal(stilTanimi("harvard").ad, "Harvard");
    assert.equal(atifCikarmaStili(stilTanimi("harvard")), "chicago");
  });

  test("metin içi atıf: virgül, 'and', üç yazara kadar hepsi", () => {
    assert.equal(formatInTextCitation(makale, "harvard", 1, {}, "en"), "(Smith and Jones, 2020)");
    assert.equal(formatInTextCitation(makale, "harvard", 1, { sayfa: "50" }, "en"), "(Smith and Jones, 2020, p. 50)");
    const uc = { ...makale, authors: "Smith, J.; Jones, A.; Brown, K." };
    assert.equal(formatInTextCitation(uc, "harvard", 1, {}, "en"), "(Smith, Jones and Brown, 2020)");
    const dort = { ...makale, authors: "Smith, J.; Jones, A.; Brown, K.; Lee, M." };
    assert.equal(formatInTextCitation(dort, "harvard", 1, {}, "en"), "(Smith et al., 2020)");
    assert.equal(formatInTextCitation(makale, "harvard", 1, {}, "tr"), "(Smith ve Jones, 2020)");
  });

  test("künye: yıldan sonra nokta yok, makale başlığı tek tırnakta", () => {
    assert.equal(
      metin(formatReferenceParts(makale, "harvard", 1, {}, "en")),
      "Smith, J. and Jones, A. (2020) ‘Feedback and learning in higher education’, Studies in Higher Education, 45(3), pp. 45-67. Available at: https://doi.org/10.1000/xyz",
    );
    const kitapParcalari = formatReferenceParts(kitap, "harvard", 1, {}, "en");
    assert.equal(metin(kitapParcalari), "Brown, K. (2019) Research methods. Sage.");
    assert.ok(kitapParcalari.some((p) => p.italic && p.text === "Research methods"));
  });

  test("kendi ürettiği künyeyi sorunsuz ayrıştırır", () => {
    const kunye = metin(formatReferenceParts(makale, "harvard", 1, {}, "en"));
    const sonuc = kunyeAyristir(kunye, "harvard", 1, "en");
    assert.equal(sonuc.year, "2020");
    assert.equal(sonuc.title, "Feedback and learning in higher education");
    assert.deepEqual(sonuc.authors, ["Smith, J.", "Jones, A."]);
    assert.deepEqual(sonuc.issues, []);
  });

  test("metindeki atıf künyeyle eşleşir (virgüllü ve virgülsüz)", () => {
    const kunyeler = [kunyeAyristir(metin(formatReferenceParts(makale, "harvard", 1, {}, "en")), "harvard", 1, "en")];
    for (const govde of ["As shown (Smith and Jones, 2020), feedback helps.", "As shown (Smith and Jones 2020), feedback helps."]) {
      const atiflar = extractInTextCitations(govde, { style: atifCikarmaStili(stilTanimi("harvard")) });
      assert.equal(atiflar.length, 1, govde);
      const capraz = crossCheck(atiflar, kunyeler, { yilaBak: true });
      assert.deepEqual(capraz.citationsWithoutReference, [], govde);
      assert.deepEqual(capraz.referencesWithoutCitation, [], govde);
    }
  });

  test("kılavuzdan tespit; üniversite adı sayılmaz", () => {
    assert.equal(atifSistemiSec("References must follow the Harvard referencing style. Use Harvard for all citations. Harvard examples are given below.")?.sistem, "harvard");
    assert.equal(atifSistemiSec("This guide is based on Harvard University practice. Use APA 7 throughout. APA examples follow. See the APA manual.")?.sistem, "apa7");
  });
});
