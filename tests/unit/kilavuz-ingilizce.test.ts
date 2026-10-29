import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cmOlarak, ingilizceBelgeMi, ingilizceKenarBosluklari, ingilizceKurallar, ingilizceOzetKurallari } from "@/lib/kilavuz-ingilizce";
import { extractFormattingRules, onerilenBolumler } from "@/lib/guideline-scan";

/*
  Gerçek İngilizce tez kılavuzlarının tipik cümleleri (ABD lisansüstü
  okulları ve İngiltere üniversiteleri). Eskiden bu metinlerden yalnızca
  yazı tipi çıkıyordu (TARAYICI_SURUMU 8).
*/
const ABD = `THESIS AND DISSERTATION FORMATTING GUIDE
The Graduate School requires that all theses and dissertations follow the formatting rules below. The student is responsible for the format of the document and should consult the advisor.
Margins: The left margin must be 1.5 inches to allow for binding. The top, bottom and right margins must be 1 inch.
Font: Use Times New Roman. Chapter titles may be 14 point; the body text must be 12-point font.
Spacing: The text must be double-spaced, except for block quotations, footnotes and the bibliography, which are single-spaced.
Indent the first line of each paragraph 0.5 inch. Text should be left-aligned.
Each chapter must begin on a new page. Chapter titles should be in all capital letters.
Page numbers should be centered at the bottom of the page, 0.5 inch from the edge.
The abstract must not exceed 350 words. Include 3 to 5 keywords below the abstract.
The bibliography uses a hanging indent of 0.5 inch and APA style.
ABSTRACT
ACKNOWLEDGMENTS
TABLE OF CONTENTS
LIST OF TABLES
CHAPTER 1 INTRODUCTION
CHAPTER 2 LITERATURE REVIEW
CHAPTER 3 METHODOLOGY
CHAPTER 4 RESULTS
CHAPTER 5 DISCUSSION
CHAPTER 6 CONCLUSION
REFERENCES
APPENDICES
The student must submit the final copy to the Graduate School and the committee should approve it. All pages of the document are counted and the title page is page i.`;

const INGILTERE = `Presentation of research theses
Theses should be printed on A4 paper with margins of 2.5 cm on all sides, and the text should be one-and-a-half spaced and fully justified. Use a 12 pt font for the main text of the thesis.
Each new paragraph should be indented. The abstract should be between 200 and 300 words. The candidate must ensure that the thesis is bound and that the work is the candidate's own and that the word limit is respected and that it is approved by the supervisor and the examiners of the university and of the department.`;

describe("İngilizce kılavuz", () => {
  test("dil tespiti İngilizce belgeyi ayırır, Türkçeyi ayırmaz", () => {
    assert.equal(ingilizceBelgeMi(ABD), true);
    assert.equal(
      ingilizceBelgeMi("Tez metni 12 punto ve 1,5 satır aralığı ile yazılmalıdır. Kenar boşlukları üst 3 cm, alt 2,5 cm olmalıdır. ".repeat(10)),
      false,
    );
  });

  test("ölçü dönüşümü: inç, kesir ve sözle yazılmış sayı", () => {
    assert.equal(cmOlarak("1", "inch"), 2.54);
    assert.equal(cmOlarak("1 1/2", "inches"), 3.81);
    assert.equal(cmOlarak("1/2", '"'), 1.27);
    assert.equal(cmOlarak("one", "inch"), 2.54);
    assert.equal(cmOlarak("2.5", "cm"), 2.5);
  });

  test("kenar boşlukları: genel ölçü ve kenara özel ölçü", () => {
    assert.deepEqual(ingilizceKenarBosluklari(ABD).bosluklar, { top: 2.54, bottom: 2.54, left: 3.81, right: 2.54 });
    assert.deepEqual(ingilizceKenarBosluklari(INGILTERE).bosluklar, { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 });
    // Sayfa numarasının kenara uzaklığı kenar boşluğu değil.
    assert.deepEqual(ingilizceKenarBosluklari("Page numbers at the top, 0.5 inch from the edge.").bosluklar, {});
  });

  test("gövde ölçüsü başlığın kuralını almaz, satır aralığı sözden okunur", () => {
    const k = ingilizceKurallar(ABD.replace(/\s+/g, " "));
    assert.equal(k.punto, 12);
    assert.equal(k.satirAraligi, 2);
    assert.equal(k.girintiCm, 1.27);
    assert.equal(k.bolumYeniSayfa, true);
    assert.equal(k.bolumBuyukHarf, true);
    assert.equal(k.yasla, false, "left-aligned yaslama değil");
    assert.equal(k.asiliCm, 1.27);
    assert.equal(ingilizceKurallar(INGILTERE.replace(/\s+/g, " ")).satirAraligi, 1.5);
    assert.equal(ingilizceKurallar(INGILTERE.replace(/\s+/g, " ")).yasla, true);
  });

  test("özet ve anahtar kelime sınırları", () => {
    assert.deepEqual(ingilizceOzetKurallari(ABD.replace(/\s+/g, " ")), { abstract_max_words: 350, keywords_min: 3, keywords_max: 5 });
    assert.deepEqual(ingilizceOzetKurallari(INGILTERE.replace(/\s+/g, " ")), { abstract_min_words: 200, abstract_max_words: 300 });
  });

  test("bölümler: CHAPTER önekiyle, iki yazım tek bölüm", () => {
    assert.deepEqual(onerilenBolumler(ABD, true), [
      "Abstract", "Acknowledgments", "Table of Contents", "List of Tables", "Introduction", "Literature Review",
      "Methodology", "Results", "Discussion", "Conclusion", "References", "Appendices",
    ]);
  });

  test("tarayıcı İngilizce belgeden tam kural kümesi çıkarır", () => {
    const sonuc = extractFormattingRules(ABD, 12, true, true);
    assert.deepEqual(sonuc.suggestedRules.margins_cm, { top: 2.54, bottom: 2.54, left: 3.81, right: 2.54 });
    assert.equal(sonuc.suggestedRules.font_family, "Times New Roman");
    assert.equal(sonuc.suggestedRules.font_size_pt, 12);
    assert.equal(sonuc.suggestedRules.line_spacing, 2);
    assert.equal(sonuc.suggestedRules.paragraph_indent_cm, 1.27);
    assert.equal(sonuc.suggestedRules.show_page_numbers, true);
    assert.equal(sonuc.confidence, 1);
  });

  test("Türkçe belgede İngilizce kalıplar devreye girmez", () => {
    const turkce = "Tez metni 12 punto yazılır. Margins: 1 inch on all sides. The text must be double-spaced.";
    const sonuc = extractFormattingRules(turkce, 0, false, false);
    assert.equal(sonuc.suggestedRules.margins_cm, undefined);
    assert.equal(sonuc.suggestedRules.line_spacing, undefined);
  });
});
