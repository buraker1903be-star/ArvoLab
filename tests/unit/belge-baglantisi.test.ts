import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { belgeAdresiMi, belgeBaglantisiSec } from "@/lib/belge-baglantisi";

const TABAN = "https://fbe.gazi.edu.tr/view/page/157656/tez-yazim-kilavuzu";
const bag = (href: string, metin = "Bağlantı") => `<a href="${href}">${metin}</a>`;

describe("belge adresi mi", () => {
  test("pdf ve docx belge sayılır", () => {
    assert.equal(belgeAdresiMi("https://x.edu.tr/a/tez.pdf"), true);
    assert.equal(belgeAdresiMi("https://x.edu.tr/a/tez.docx"), true);
  });

  test("html sayfası belge sayılmaz", () => {
    assert.equal(belgeAdresiMi(TABAN), false);
  });
});

describe("sayfadan kılavuz belgesi seçimi", () => {
  test("gerçek örnek: sayfa docx şablonuna iniyor", () => {
    /*
      Canlıda doğrulandı: site haritası HTML sayfasını veriyor, kılavuzun
      kendisi başka bir alt alan adındaki dosya. Sayfanın kendisi taranınca
      menü ve altbilgi metni çıkıyor, kural çıkarımı boş dönüyordu.
    */
    const html = `
      ${bag("https://webupload.gazi.edu.tr/upload/52/turkce_taslak_2023.docx", "Türkçe Tez Yazım Şablonu")}
      ${bag("https://www.facebook.com/sharer/sharer.php?u=x", "Paylaş")}
    `;
    assert.equal(
      belgeBaglantisiSec(html, TABAN),
      "https://webupload.gazi.edu.tr/upload/52/turkce_taslak_2023.docx",
    );
  });

  test("pdf, word şablonuna tercih edilir", () => {
    // Şablon çoğu zaman boş bir kapak taşır; kurallar PDF'tedir.
    const html = `${bag("https://x.edu.tr/tez-yazim-kilavuzu.docx", "Şablon")}${bag("https://x.edu.tr/tez-yazim-kilavuzu.pdf", "Kılavuz")}`;
    assert.match(belgeBaglantisiSec(html, TABAN) ?? "", /\.pdf$/);
  });

  test("Türkçe sürüm İngilizceye tercih edilir", () => {
    // Kurallar Türkçe metinden çıkarılıyor (lib/guideline-scan.ts).
    const html = `${bag("https://x.edu.tr/ingilizce_tez_kilavuzu.pdf", "English")}${bag("https://x.edu.tr/turkce_tez_kilavuzu.pdf", "Türkçe")}`;
    assert.match(belgeBaglantisiSec(html, TABAN) ?? "", /turkce/);
  });

  test("ipucu taşımayan belge seçilmez", () => {
    // Sayfadaki rastgele bir form kılavuz değildir; yanlış belgeden
    // çıkarılan kural, kuralsızlıktan kötüdür.
    assert.equal(belgeBaglantisiSec(bag("https://x.edu.tr/danisman-degisiklik-formu.pdf", "Form"), TABAN), null);
  });

  test("resmî olmayan alan adı alınmaz", () => {
    const html = bag("https://drive.google.com/tez-yazim-kilavuzu.pdf", "Tez Yazım Kılavuzu");
    assert.equal(belgeBaglantisiSec(html, TABAN), null);
  });

  test("göreli adres taban adrese göre çözülür", () => {
    const html = bag("/dosyalar/tez-yazim-kilavuzu.pdf", "Tez Yazım Kılavuzu");
    assert.equal(belgeBaglantisiSec(html, TABAN), "https://fbe.gazi.edu.tr/dosyalar/tez-yazim-kilavuzu.pdf");
  });

  test("belge yoksa null döner", () => {
    // Çağıran sayfanın kendisini kullanır: bazı kurumlar kuralları
    // doğrudan HTML olarak yayımlıyor.
    assert.equal(belgeBaglantisiSec("<p>Kurallar aşağıdadır.</p>", TABAN), null);
  });
});
