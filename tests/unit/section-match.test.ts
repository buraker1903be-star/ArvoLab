import assert from "node:assert/strict";
import test from "node:test";
import { headingMatchesSection, normalizeHeading } from "@/lib/section-match";

/*
  Başlık ↔ kılavuz bölümü eşleştirmesi. Sunucudaki uygunluk kontrolü,
  editördeki bölüm listesi ve başlık numaralandırması aynı kuralı
  kullanıyor; burada bir kayma üç yerde birden görünür.

  Türkçe büyük harf dönüşümü bu kod tabanında kanıtlanmış bir tuzak:
  26.09.2026'da kılavuz tarayıcısında "İ" ile "i"nin eşleşmediği ortaya
  çıktı ve büyük harfle yazılmış başlıklar hiç görülmüyordu.
*/
test("başlık eşleştirme", async (t) => {
  await t.test("büyük/küçük harf ve Türkçe I/İ farkı gözetilmiyor", () => {
    assert.ok(headingMatchesSection("giriş", "GİRİŞ"));
    assert.ok(headingMatchesSection("GİRİŞ", "Giriş"));
    assert.ok(headingMatchesSection("Bulgular", "BULGULAR"));
    /*
      Noktasız ı ve noktalı i aynı harfe indirgenir: kılavuzlar başlıkları
      hem "TARTIŞMA" hem "Tartışma" yazıyor ve tr-TR büyük harfte i→İ,
      ı→I oluyor. İkisi tek harfe indirgenmezse bu çift hiç eşleşmezdi.
    */
    assert.ok(headingMatchesSection("TARTIŞMA", "Tartışma"));
    assert.ok(headingMatchesSection("İÇİNDEKİLER", "İçindekiler"));
    // Ş ≠ S: indirgeme yalnızca I/İ için, başka harfleri birbirine karıştırmıyor.
    assert.equal(headingMatchesSection("TARTISMA", "Tartışma"), false);
  });

  await t.test("baştaki numaralandırma atılıyor", () => {
    assert.ok(headingMatchesSection("1. Giriş", "Giriş"));
    assert.ok(headingMatchesSection("1.1. Amaç", "Amaç"));
    // Sondaki nokta isteğe bağlı: "2.3 Örneklem" de "2.3. Örneklem" de aynı bölüm.
    assert.ok(headingMatchesSection("2.3 Örneklem", "Örneklem"));
    assert.ok(headingMatchesSection("1) Giriş", "Giriş"));
    /*
      Baştaki her rakam öbeği atılıyor, yıl bile olsa: "2023 Bulgular"
      kılavuzun "Bulgular" bölümü sayılır. Bilerek geniş — başlığını
      numaralandıran öğrenciyi "bölüm eksik" diye uyarmak, gereğinden
      fazla eşleşmekten kötü. lib/heading-numbering.ts'teki MANUAL_NUMBER
      bundan DAHA dar (yıl saymaz); orada soru "kullanıcı elle numara mı
      yazmış", burada "bu başlık o bölüm mü".
    */
    assert.ok(headingMatchesSection("2023 Bulgular", "Bulgular"));
    assert.ok(headingMatchesSection("IV. Bulgular", "Bulgular"));
  });

  await t.test("bölüm önekleri atılıyor", () => {
    assert.ok(headingMatchesSection("BİRİNCİ BÖLÜM: GİRİŞ", "Giriş"));
    assert.ok(headingMatchesSection("İKİNCİ BÖLÜM YÖNTEM", "Yöntem"));
    assert.ok(headingMatchesSection("BÖLÜM 2 – Yöntem", "Yöntem"));
    assert.ok(headingMatchesSection("BEŞİNCİ BÖLÜM: SONUÇ", "Sonuç"));
  });

  await t.test("sondaki noktalama gözetilmiyor", () => {
    assert.ok(headingMatchesSection("Kaynakça:", "Kaynakça"));
    assert.ok(headingMatchesSection("SONUÇ.", "Sonuç"));
  });

  await t.test("cümle başlık sayılmıyor", () => {
    // Başlığın TAMAMI eşleşmeli; yoksa gövde metni bölüm sanılır.
    assert.equal(headingMatchesSection("Bulgular tartışıldı.", "Bulgular"), false);
    assert.equal(headingMatchesSection("Giriş bölümünde", "Giriş"), false);
  });

  await t.test("boş bölüm adı hiçbir şeyle eşleşmiyor", () => {
    // Aksi halde boş bir zorunlu bölüm kaydı her başlıkla eşleşir ve
    // "kılavuza uygun" sonucunu sahte biçimde doğrular.
    assert.equal(headingMatchesSection("Giriş", ""), false);
    assert.equal(headingMatchesSection("", ""), false);
    assert.equal(headingMatchesSection("1.", "  "), false);
  });

  await t.test("iç boşluklar tekleniyor", () => {
    assert.equal(normalizeHeading("  SİMGELER   VE    KISALTMALAR  "), "SIMGELER VE KISALTMALAR");
  });
});
