import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { dosyaUygun } from "@/app/dashboard/_components/dosya-birakma";

/*
  Bırakılan dosya <input accept> süzgecinden GEÇMEZ: accept yalnızca
  dosya seçiciyi süzer. Denetim bu yüzden kodda; testi de burada.
*/
const dosya = (ad: string, tur = ""): File => ({ name: ad, type: tur, size: 1 }) as File;

describe("dosyaUygun", () => {
  test("uzantıdan kabul", () => {
    assert.equal(dosyaUygun(dosya("kilavuz.pdf"), [".pdf"]), true);
    assert.equal(dosyaUygun(dosya("kaynaklar.ris"), [".ris", ".bib"]), true);
    assert.equal(dosyaUygun(dosya("veri.xlsx"), [".xlsx", ".csv"]), true);
  });

  test("MIME türünden kabul", () => {
    assert.equal(dosyaUygun(dosya("belge", "application/pdf"), ["application/pdf"]), true);
    assert.equal(dosyaUygun(dosya("resim", "image/png"), ["image/*"]), true);
  });

  test("uymayan dosya REDDEDİLİR", () => {
    /* Sürüklenen .exe ya da .docx, PDF bekleyen alana düşmemeli:
       eskiden hiç denetlenmiyordu çünkü bırakma hiç çalışmıyordu. */
    assert.equal(dosyaUygun(dosya("virus.exe"), [".pdf"]), false);
    assert.equal(dosyaUygun(dosya("tez.docx"), [".pdf", "application/pdf"]), false);
    assert.equal(dosyaUygun(dosya("veri.json"), [".xlsx", ".csv", ".tsv", ".txt"]), false);
  });

  test("büyük/küçük harf ve Türkçe ad", () => {
    assert.equal(dosyaUygun(dosya("KILAVUZ.PDF"), [".pdf"]), true);
    assert.equal(dosyaUygun(dosya("Çalışma Kılavuzu.Pdf"), [".pdf"]), true);
  });

  test("boş kabul listesi her şeyi geçirir", () => {
    assert.equal(dosyaUygun(dosya("x.bin"), []), true);
  });

  test("uzantısı başka yerde geçen ad yanıltmaz", () => {
    /* "rapor.pdf.exe" PDF DEĞİL: yalnızca son uzantı sayılır. */
    assert.equal(dosyaUygun(dosya("rapor.pdf.exe"), [".pdf"]), false);
  });
});
