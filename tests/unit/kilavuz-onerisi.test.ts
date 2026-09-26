import assert from "node:assert/strict";
import test from "node:test";
import {
  eksikOlcuOnerileri,
  olcuEtiketleri,
  onerilebilirOlcu,
  onerilenDeger,
  yoneticiVarsayilanlari,
  YONETICI_VARSAYILANI,
} from "@/lib/kilavuz-onerisi";

const TAM = {
  font_size_pt: 12,
  line_spacing: 1.5,
  paragraph_indent_cm: 1.25,
  margins_cm: { top: 3, bottom: 2.5, left: 3.5, right: 2.5 },
};

const anahtarlari = (kurallar: unknown) => eksikOlcuOnerileri(kurallar).map((o) => o.anahtar);

test("eksik ölçü önerileri", async (t) => {
  await t.test("tam kayıtta öneri çıkmaz", () => {
    assert.deepEqual(anahtarlari(TAM), []);
  });

  await t.test("hiç kural yoksa dördü de önerilir", () => {
    assert.deepEqual(anahtarlari(null), ["font_size_pt", "line_spacing", "paragraph_indent_cm", "margins_cm"]);
  });

  await t.test("kılavuzun söylemediği tek ölçü önerilir", () => {
    // Amasya: belge gövdenin satır aralığını hiç yazmıyor.
    const { line_spacing: _atilan, ...eksik } = TAM;
    const oneriler = eksikOlcuOnerileri(eksik);
    assert.equal(oneriler.length, 1);
    assert.equal(oneriler[0].anahtar, "line_spacing");
    assert.equal(oneriler[0].deger, 1.5);
    assert.equal(oneriler[0].gosterim, "1,5", "ondalık ayracı Türkçe");
    assert.ok(oneriler[0].gerekce.length > 0, "değerin nereden geldiği yazmalı");
  });

  await t.test("boşluklar hep birlikte önerilir", () => {
    /*
      Tarayıcı dördünden biri makul değilse kümenin tamamını düşürüyor
      (üçü doğru biri saçma bir sayfa düzeni, hiç düzen olmamasından
      kötü). Öneri de yarım küme sunmamalı.
    */
    assert.deepEqual(anahtarlari({ ...TAM, margins_cm: { top: 3, left: 3.5 } }), ["margins_cm"]);
    assert.deepEqual(onerilenDeger("margins_cm"), { top: 3, bottom: 2.5, left: 3.5, right: 2.5 });
  });

  await t.test("aralık dışı değer, eksik sayılır", () => {
    // 29,7 cm gibi bir değer kayıtta kalmışsa öneri yine çıkmalı.
    assert.deepEqual(anahtarlari({ ...TAM, margins_cm: { ...TAM.margins_cm, top: 29.7 } }), ["margins_cm"]);
    assert.deepEqual(anahtarlari({ ...TAM, font_size_pt: 40 }), ["font_size_pt"]);
  });

  await t.test("elle doldurulmuş alan yeniden önerilmez", () => {
    // Değer yazıldıktan sonra kutu aynı öneriyi tekrar sunmamalı.
    const kurallar = { ...TAM, line_spacing: 1.5, [YONETICI_VARSAYILANI]: ["line_spacing"] };
    assert.deepEqual(anahtarlari(kurallar), []);
    assert.deepEqual(yoneticiVarsayilanlari(kurallar), ["line_spacing"]);
  });

  await t.test("izdeki tanınmayan değerler yok sayılır", () => {
    // İz kuralların içinde duruyor; dışarıdan yazılabilir bir alan.
    assert.deepEqual(yoneticiVarsayilanlari({ [YONETICI_VARSAYILANI]: ["line_spacing", "uydurma", 7] }), ["line_spacing"]);
    assert.deepEqual(yoneticiVarsayilanlari({ [YONETICI_VARSAYILANI]: "line_spacing" }), []);
  });

  await t.test("sunucuya gelen ölçü adı doğrulanıyor", () => {
    assert.equal(onerilebilirOlcu("line_spacing"), true);
    assert.equal(onerilebilirOlcu("citation_style"), false);
    assert.equal(onerilebilirOlcu(YONETICI_VARSAYILANI), false);
  });

  await t.test("etiketler okunur bir listeye çevriliyor", () => {
    assert.equal(olcuEtiketleri(["line_spacing", "margins_cm"]), "Satır aralığı, Kenar boşlukları");
  });
});
