import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { internetOrnekKunyeleri, kaynakInternetTuru, onerilenOrnek, ornekTuru } from "@/lib/kilavuz-ornek-kunyeler";

/*
  Örnek UYDURULMAZ, TÜR EMİN DEĞİLSE SÖYLENMEZ. Bu dosya ikisini
  sabitler: dönen metin kılavuzda birebir geçer, kuralı anlatan cümle
  örnek sayılmaz ve belirsiz türde öneri yapılmaz.
*/

const KILAVUZ = [
  "T.C. ÖRNEK ÜNİVERSİTESİ",
  "TEZ YAZIM KILAVUZU",
  "",
  "4. KAYNAK GÖSTERME",
  "Kaynaklar yazar soyadına göre alfabetik sırayla yazılır.",
  "",
  "4.3 İNTERNET KAYNAKLARI",
  "İnternet kaynakları aşağıdaki biçimde yazılır:",
  "Örnek: Türkiye İstatistik Kurumu. (2023). Adrese dayalı nüfus kayıt sistemi sonuçları. https://www.tuik.gov.tr/adnks",
  "Örnek: Dünya Sağlık Örgütü. (2022). Küresel tüberküloz raporu 2022 (Rapor No. 14). Erişim adresi: https://www.who.int/tb-2022",
  "",
  "4.4 GÖRSEL KAYNAKLAR",
  "Görseller için kaynak altta belirtilir.",
].join("\n");

describe("internetOrnekKunyeleri", () => {
  test("iki örnek de bulunuyor ve metinleri BİREBİR", () => {
    const ornekler = internetOrnekKunyeleri(KILAVUZ);
    assert.equal(ornekler.length, 2);
    assert.ok(KILAVUZ.includes(ornekler[0].metin), `örnek kılavuzda geçmiyor: ${ornekler[0].metin}`);
    assert.ok(KILAVUZ.includes(ornekler[1].metin), `örnek kılavuzda geçmiyor: ${ornekler[1].metin}`);
    /* "Örnek:" öneki künyenin parçası değil. */
    assert.ok(!/^Örnek/.test(ornekler[0].metin));
  });

  test("her örnek bölümüyle geliyor", () => {
    for (const o of internetOrnekKunyeleri(KILAVUZ)) assert.equal(o.bolum, "İNTERNET KAYNAKLARI");
  });

  test("kuralı anlatan cümle örnek sayılmıyor", () => {
    const metinler = internetOrnekKunyeleri(KILAVUZ).map((o) => o.metin);
    assert.ok(!metinler.some((m) => /biçimde yazılır/.test(m)), metinler.join(" | "));
    assert.ok(!metinler.some((m) => /alfabetik sırayla/.test(m)), metinler.join(" | "));
  });

  test("türler ayrışıyor: kurumsal sayfa ve çevrimiçi rapor", () => {
    const [ilk, ikinci] = internetOrnekKunyeleri(KILAVUZ);
    assert.deepEqual({ tur: ilk.tur, kesin: ilk.kesin }, { tur: "kurumsal-sayfa", kesin: true });
    assert.deepEqual({ tur: ikinci.tur, kesin: ikinci.kesin }, { tur: "cevrimici-rapor", kesin: true });
  });

  test("sayfa ayracı varsa sayfa veriliyor, yoksa null", () => {
    assert.equal(internetOrnekKunyeleri(KILAVUZ)[0].sayfa, null);
    const sayfali = `Kapak\n\f4.3 İNTERNET KAYNAKLARI\nTürkiye İstatistik Kurumu. (2023). Nüfus verileri. https://www.tuik.gov.tr/x`;
    assert.equal(internetOrnekKunyeleri(sayfali)[0].sayfa, 2);
  });

  test("aynı örnek iki kez yazılıysa bir kez dönüyor", () => {
    const satir = "Türkiye İstatistik Kurumu. (2023). Nüfus verileri. https://www.tuik.gov.tr/x";
    assert.equal(internetOrnekKunyeleri(`4.3 İNTERNET\n${satir}\n${satir}`).length, 1);
  });

  test("internet işareti ya da yılı olmayan satır örnek değil", () => {
    const metin = [
      "4.3 İNTERNET KAYNAKLARI",
      "Yılmaz, Ahmet. (2020). Basılı bir kitap adı burada. İstanbul: Yayınevi.",
      "Bir kurumun adresi https://ornek.gov.tr biçiminde verilebilir ve çok uzun sürer.",
    ].join("\n");
    assert.deepEqual(internetOrnekKunyeleri(metin), []);
  });

  test("örneksiz kılavuzda boş dizi", () => {
    assert.deepEqual(internetOrnekKunyeleri("4. KAYNAK GÖSTERME\nKaynaklar alfabetik sıralanır."), []);
    assert.deepEqual(internetOrnekKunyeleri(""), []);
  });
});

describe("tür belirleme", () => {
  test("rapor işareti rapora, kurum işareti kurumsal sayfaya", () => {
    assert.equal(ornekTuru("Dünya Sağlık Örgütü. Küresel tüberküloz raporu.").tur, "cevrimici-rapor");
    assert.equal(ornekTuru("Türkiye İstatistik Kurumu. Nüfus sayfası.").tur, "kurumsal-sayfa");
  });

  test("işaret yoksa tür KESİN DEĞİL", () => {
    const t = ornekTuru("Yılmaz, A. (2021). Bir blog yazısı. https://ornek.com/yazi");
    assert.equal(t.tur, "genel-internet");
    assert.equal(t.kesin, false);
  });

  test("kaynağın türü kendi alanlarından okunuyor", () => {
    assert.equal(kaynakInternetTuru({ title: "Yıllık faaliyet raporu 2023" }).tur, "cevrimici-rapor");
    assert.equal(kaynakInternetTuru({ authors: "Türkiye İstatistik Kurumu", title: "Nüfus verileri" }).tur, "kurumsal-sayfa");
    assert.equal(kaynakInternetTuru({ title: "Bir blog yazısı" }).kesin, false);
  });
});

describe("öneri yalnızca EMİN olunduğunda", () => {
  const ornekler = internetOrnekKunyeleri(KILAVUZ);

  test("tek örnek varsa o önerilir (karşılaştıracak bir şey yok)", () => {
    assert.equal(onerilenOrnek([ornekler[0]], { title: "Ne olduğu belirsiz" })?.tur, "kurumsal-sayfa");
  });

  test("türü kesin eşleşen tek örnek önerilir", () => {
    assert.equal(onerilenOrnek(ornekler, { authors: "Sağlık Bakanlığı", title: "Aşı takvimi sayfası" })?.tur, "kurumsal-sayfa");
    assert.equal(onerilenOrnek(ornekler, { title: "Ulusal tüberküloz raporu 2023" })?.tur, "cevrimici-rapor");
  });

  test("kaynağın türü belirsizse öneri YOK", () => {
    assert.equal(onerilenOrnek(ornekler, { title: "Bir blog yazısı", doi_or_url: "https://ornek.com" }), null);
  });

  test("iki örnek aynı türdeyse öneri YOK", () => {
    const ikiRapor = [
      { ...ornekler[1] },
      { ...ornekler[1], metin: "Kalkınma Ajansı. (2021). Bölgesel rapor. https://ornek.gov.tr/rapor" },
    ];
    assert.equal(onerilenOrnek(ikiRapor, { title: "Yıllık rapor 2023" }), null);
  });

  test("örnek yoksa null", () => {
    assert.equal(onerilenOrnek([], { title: "Herhangi" }), null);
  });
});
