import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { belgeAdresiMi, belgeBaglantisiSec } from "@/lib/belge-baglantisi";

const TABAN = "https://fbe.gazi.edu.tr/view/page/157656/tez-yazim-kilavuzu";
const bag = (href: string, metin = "Bağlantı") => `<a href="${href}">${metin}</a>`;

describe("belge adresi mi", () => {
  test("pdf ve docx belge sayılır", () => {
    assert.equal(belgeAdresiMi("https://webupload.gazi.edu.tr/a/tez.pdf"), true);
    assert.equal(belgeAdresiMi("https://webupload.gazi.edu.tr/a/tez.docx"), true);
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
    const html = `${bag("https://webupload.gazi.edu.tr/tez-yazim-kilavuzu.docx", "Şablon")}${bag("https://webupload.gazi.edu.tr/tez-yazim-kilavuzu.pdf", "Kılavuz")}`;
    assert.match(belgeBaglantisiSec(html, TABAN) ?? "", /\.pdf$/);
  });

  test("Türkçe sürüm İngilizceye tercih edilir", () => {
    // Kurallar Türkçe metinden çıkarılıyor (lib/guideline-scan.ts).
    const html = `${bag("https://webupload.gazi.edu.tr/ingilizce_tez_kilavuzu.pdf", "English")}${bag("https://webupload.gazi.edu.tr/turkce_tez_kilavuzu.pdf", "Türkçe")}`;
    assert.match(belgeBaglantisiSec(html, TABAN) ?? "", /turkce/);
  });

  test("form ve dilekçe hiçbir koşulda seçilmez", () => {
    // Kılavuz sayfasında kılavuzun yanında başka belgeler de durur; yanlış
    // belgeden çıkarılan kural, kuralsızlıktan kötüdür.
    assert.equal(belgeBaglantisiSec(bag("https://webupload.gazi.edu.tr/danisman-degisiklik-formu.pdf", "Form"), TABAN), null);
    assert.equal(belgeBaglantisiSec(bag("https://webupload.gazi.edu.tr/tez-basvuru-dilekcesi.pdf", "Dilekçe"), TABAN), null);
  });

  test("ipucu taşımayan belge de aday olur", () => {
    /*
      Gerçek örnek: Abdullah Gül Üniversitesi sosyal bilimler enstitüsünün
      kılavuzu "AGU_Social_Sciences_Institute_Gr - 2025.docx" adıyla
      duruyor — dosya adında ne "tez" ne "kılavuz" var. İpucu zorunluyken
      bu kılavuz tamamen kaçırılıyordu.
    */
    // Taban da AGÜ'nün kendi sayfası: gerçek taramada öyle olurdu.
    const taban = "https://sbe-tr.agu.edu.tr/tez-yazim-kilavuzu";
    const html = bag("https://sbe-tr.agu.edu.tr/uploads/docs/AGU_Social_Sciences_Institute_Gr%20-%202025.docx", "Guidelines");
    assert.match(belgeBaglantisiSec(html, taban) ?? "", /AGU_Social_Sciences/);
  });

  test("ipuçlu belge, ipucusuza tercih edilir", () => {
    const html = `${bag("https://webupload.gazi.edu.tr/belge.pdf", "Belge")}${bag("https://webupload.gazi.edu.tr/tez-yazim-kilavuzu.pdf", "Kılavuz")}`;
    assert.match(belgeBaglantisiSec(html, TABAN) ?? "", /tez-yazim-kilavuzu/);
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

  /*
    Belge AYNI kurumun alan adında olmalı. Üniversiteler birbirinin
    kılavuzunu örnek olarak bağlıyor; o bağlantıya inilseydi B
    üniversitesinin kılavuzu A'nınki olarak kaydedilir ve öğrencinin tezine
    BAŞKA bir kurumun biçim kuralları dayatılırdı.
  */
  test("başka üniversitenin belgesi alınmaz", () => {
    const html = bag("https://sbe.baskaunv.edu.tr/tez-yazim-kilavuzu.pdf", "Örnek kılavuz");
    assert.equal(belgeBaglantisiSec(html, TABAN), null);
  });

  test("aynı kurumun BAŞKA alt alan adı alınır", () => {
    // Kılavuz çoğu kez ayrı sunucuda: fbe.gazi.edu.tr → webupload.gazi.edu.tr
    const html = bag("https://webupload.gazi.edu.tr/tez-yazim-kilavuzu.pdf", "Kılavuz");
    assert.equal(belgeBaglantisiSec(html, TABAN), "https://webupload.gazi.edu.tr/tez-yazim-kilavuzu.pdf");
  });

  test("kendi alan adı ile başkasınınki arasında doğru olan seçilir", () => {
    const html = `${bag("https://sbe.baskaunv.edu.tr/tez-yazim-kilavuzu.pdf", "Örnek kılavuz")}${bag("https://gazi.edu.tr/tez-yazim-kilavuzu.pdf", "Kılavuz")}`;
    assert.equal(belgeBaglantisiSec(html, TABAN), "https://gazi.edu.tr/tez-yazim-kilavuzu.pdf");
  });
});
