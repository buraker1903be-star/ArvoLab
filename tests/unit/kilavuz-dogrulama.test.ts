import assert from "node:assert/strict";
import test from "node:test";
import {
  DOGRULAMA_MESAJI,
  EN_COK_SAYFA,
  bicimOzeti,
  formaDoldur,
  formuDogrula,
  kurallariKur,
  type DogrulamaFormu,
} from "@/lib/kilavuz-dogrulama";

const form = (parca: Partial<DogrulamaFormu> = {}): DogrulamaFormu => ({
  atifStili: "apa7",
  zorunluBolumler: ["Giriş", "Yöntem"],
  enAzSayfa: 60,
  enCokSayfa: 120,
  ...parca,
});

test("kılavuz doğrulama", async (t) => {
  await t.test("çıkarımın saçma değerleri öğrenciye onaylatılmıyor", () => {
    /*
      Tanınmayan stil ve imkânsız sayfa sayısı BOŞ gösteriliyor.
      Onaylatmak, çıkarımın hatasını öğrencinin imzasıyla kurala
      çevirmek olurdu.
    */
    const doldurulmus = formaDoldur({ citationStyle: "harvard", minPages: 0, maxPages: 99999 });
    assert.equal(doldurulmus.atifStili, "");
    assert.equal(doldurulmus.enAzSayfa, null);
    assert.equal(doldurulmus.enCokSayfa, null);
  });

  await t.test("tanınan değerler olduğu gibi geliyor", () => {
    const doldurulmus = formaDoldur({
      citationStyle: "ieee",
      requiredSections: ["  Giriş ", "", "Bulgular"],
      minPages: 60,
      maxPages: 120,
    });
    assert.equal(doldurulmus.atifStili, "ieee");
    assert.deepEqual(doldurulmus.zorunluBolumler, ["Giriş", "Bulgular"]);
    assert.equal(doldurulmus.enAzSayfa, 60);
  });

  await t.test("sayfa aralığının boş olması hata DEĞİL", () => {
    /*
      Her kılavuz sayfa sınırı söylemiyor; uydurma bir sınır öğrenciye
      olmayan bir kuralı dayatmak olurdu.
    */
    assert.deepEqual(formuDogrula(form({ enAzSayfa: null, enCokSayfa: null })), []);
  });

  await t.test("saçma sayfa sayısı ve ters aralık reddediliyor", () => {
    assert.deepEqual(formuDogrula(form({ enAzSayfa: 0 })), ["sayfa-gecersiz"]);
    assert.deepEqual(formuDogrula(form({ enCokSayfa: EN_COK_SAYFA + 1 })), ["sayfa-gecersiz"]);
    assert.deepEqual(formuDogrula(form({ enAzSayfa: 10.5 })), ["sayfa-gecersiz"]);
    assert.deepEqual(formuDogrula(form({ enAzSayfa: 200, enCokSayfa: 100 })), ["sayfa-ters"]);
  });

  await t.test("stil ve bölüm zorunlu", () => {
    assert.deepEqual(formuDogrula(form({ atifStili: "" })), ["atif-stili-yok"]);
    assert.deepEqual(formuDogrula(form({ atifStili: "harvard" })), ["atif-stili-taninmiyor"]);
    assert.deepEqual(formuDogrula(form({ zorunluBolumler: ["  ", ""] })), ["bolum-yok"]);
  });

  await t.test("her hatanın kullanıcıya bir karşılığı var", () => {
    // Mesajsız bir hata kodu ekranda boş bir uyarıya dönüşürdü.
    for (const kod of ["atif-stili-yok", "atif-stili-taninmiyor", "bolum-yok", "sayfa-gecersiz", "sayfa-ters"] as const) {
      assert.ok(DOGRULAMA_MESAJI[kod]?.length > 10, kod);
    }
  });

  await t.test("kurallar katalogdakiyle aynı biçimde kuruluyor", () => {
    const kurallar = kurallariKur(form({ zorunluBolumler: [" Giriş ", "", "Sonuç"] }), {
      belgeBasligi: "Tez Yazım Kılavuzu",
      kaynakAdres: "https://ornek.edu.tr/kilavuz.pdf",
      hamCikarim: { a: 1 },
    });
    assert.equal(kurallar.citation_style, "apa7");
    assert.deepEqual(kurallar.required_sections, ["Giriş", "Sonuç"]);
    assert.equal(kurallar.min_pages, 60);
    assert.equal(kurallar.source_url, "https://ornek.edu.tr/kilavuz.pdf");
    // Ham çıkarım saklanıyor: onay kuyruğunda yönetici neyin okunduğunu görmeli.
    assert.deepEqual(kurallar.extracted_rules, { a: 1 });
  });
});

test("biçim özeti", async (t) => {
  await t.test("bulunan kurallar okunur cümlelere dönüyor", () => {
    const satirlar = bicimOzeti({
      margins: { top: 3, right: 2.5, bottom: 3, left: 3.5 },
      fontFamily: "Times New Roman",
      fontSizePt: 12,
      lineSpacing: 1.5,
      headingNumbering: true,
      chapterNewPage: true,
    });
    // Ondalık VİRGÜLLE: "2.5 cm" kılavuzun kendi yazımına yabancı duruyor.
    assert.ok(satirlar[0].includes("sağ 2,5"), satirlar[0]);
    assert.ok(satirlar.some((s) => s.includes("Times New Roman") && s.includes("12 punto")));
    assert.ok(satirlar.some((s) => s.includes("1,5")));
    assert.equal(satirlar.length, 5);
  });

  await t.test("hiçbir kural bulunamazsa BOŞ dönüyor", () => {
    /*
      Boş liste göstermek "bulundu ama yok" gibi durur; çağıran bunu
      görüp "biçim kuralı bulamadım" demeli.
    */
    assert.deepEqual(bicimOzeti({}), []);
  });

  await t.test("yarım kenar boşluğu yazılmıyor", () => {
    // Dört kenarın biri eksikse cümle yanlış olurdu.
    assert.deepEqual(bicimOzeti({ margins: { top: 3, right: 2.5 } }), []);
  });
});
