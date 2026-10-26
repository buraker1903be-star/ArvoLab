import assert from "node:assert/strict";
import test from "node:test";
import { aranacakMi, baslikPdfteGeciyor, kunyeAnahtari, pdfAdaylari, pdfDosyaAdi, pdfMi, tekilAdlar } from "@/lib/kaynak-pdf";

const PESARAN =
  "Pesaran, M. H., Shin, Y., & Smith, R. J. (2001). Bounds testing approaches to the analysis of level relationships. Journal of Applied Econometrics, 16(3), 289–326. https://doi.org/10.1002/jae.616";

test("künye anahtarı noktalama, boşluk ve bağlantıdan etkilenmez; Türkçe harf korunur", () => {
  assert.equal(kunyeAnahtari("Yılmaz,  A. (2020). IŞIK."), kunyeAnahtari("yılmaz a 2020 ışık"));
  assert.equal(kunyeAnahtari(PESARAN).includes("doi"), false);
});

test("PDF imzası: %PDF- ilk 1 KB içinde; HTML giriş sayfası PDF sayılmaz", () => {
  const enc = new TextEncoder();
  assert.equal(pdfMi(enc.encode("%PDF-1.7\n...")), true);
  assert.equal(pdfMi(enc.encode("\n\n%PDF-1.4")), true);
  assert.equal(pdfMi(enc.encode("<!DOCTYPE html><title>Sign in</title>")), false);
  assert.equal(pdfMi(new Uint8Array(0)), false);
});

test("PDF adayları güven sırasıyla, tekrarsız; http(s) olmayanlar atılır", () => {
  const adaylar = pdfAdaylari({
    best_oa_location: { pdf_url: "https://a.org/x.pdf" },
    oa_locations: [{ pdf_url: "https://a.org/x.pdf" }, { pdf_url: "https://b.org/y.pdf" }, { pdf_url: null }],
    open_access: { oa_url: "ftp://c.org/z" },
  });
  assert.deepEqual(adaylar, ["https://a.org/x.pdf", "https://b.org/y.pdf"]);
  assert.deepEqual(pdfAdaylari(null), []);
});

test("dizinde kaydı olmayan künye için PDF aranmaz; DOI yoksa aranmaz", () => {
  assert.equal(aranacakMi("not_found", "10.1/x"), false);
  assert.equal(aranacakMi("verified", null), false);
  assert.equal(aranacakMi("possible_match", "10.1/x"), true);
});

test("dosya adı Soyad_Yıl_Başlık, ASCII; aynı adlar numaralanır", () => {
  assert.equal(pdfDosyaAdi(PESARAN), "Pesaran_2001_Bounds-testing-approaches-to-the-analysis.pdf");
  assert.equal(pdfDosyaAdi("Çelik, Ş. (2019). Öğretmen özyeterliği."), "Celik_2019_Ogretmen-ozyeterligi.pdf");
  assert.deepEqual(tekilAdlar(["a.pdf", "a.pdf", "b.pdf"]), ["a.pdf", "a-2.pdf", "b.pdf"]);
});

test("yüklenen PDF künyenin başlığını taşıyor mu", () => {
  assert.equal(baslikPdfteGeciyor(PESARAN, "Journal ... BOUNDS TESTING APPROACHES TO THE ANALYSIS OF LEVEL RELATIONSHIPS ..."), true);
  assert.equal(baslikPdfteGeciyor(PESARAN, "Introductory Econometrics: A Modern Approach"), false);
});
