import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { denetimKapsami, kapsamKismiMi, uygulananlar, uygulanamayanlar, KAPSAM_ADI, type KapsamAnahtari } from "@/lib/atif/denetim-kapsami";
import { KATALOG_STILLERI, stilTanimi } from "@/lib/atif/stiller";

/*
  Kapsamın işi tek: "sorun bulunmadı" ile "bakılmadı"yı ayırmak. Bu dosya
  ikisinin karışmadığını sabitler — karıştığında ürün denetlemediği hâlde
  temiz rapor verir.
*/

const kapsam = (stil: string, metinVar = true) => denetimKapsami(stilTanimi(stil), { metinVar });
const durum = (stil: string, anahtar: KapsamAnahtari, metinVar = true) =>
  kapsam(stil, metinVar).find((s) => s.anahtar === anahtar)?.durum;

describe("yerleşik stillerde biçim gerçekten denetleniyor", () => {
  for (const id of KATALOG_STILLERI) {
    test(id, () => {
      assert.equal(durum(id, "yazarBicimi"), "uygulandi");
      assert.equal(durum(id, "baslik"), "uygulandi");
      assert.equal(kapsamKismiMi(kapsam(id)), false, "metin varken yerleşik stilde eksik kontrol olmamalı");
    });
  }
});

describe("CSL stilinde biçim denetlenmiyor ve bu SÖYLENİYOR", () => {
  /* csl:a → yazar-tarih, yılın yeri "esnek": künyeyi citeproc yazıyor. */
  test("yazar biçimi ve başlık uygulanamadı, gerekçesi yazılı", () => {
    const satirlar = kapsam("csl:a:nature");
    for (const anahtar of ["yazarBicimi", "baslik"] as const) {
      const satir = satirlar.find((s) => s.anahtar === anahtar)!;
      assert.equal(satir.durum, "uygulanamadi");
      assert.ok(satir.gerekce && satir.gerekce.tr.length > 20 && satir.gerekce.en.length > 20);
    }
    assert.equal(kapsamKismiMi(satirlar), true);
  });

  test("atıf–kaynakça eşleşmesi CSL yazar-tarihte yine uygulanıyor", () => {
    assert.equal(durum("csl:a:nature", "atifEslesmesi"), "uygulandi");
  });

  /* Numaralı CSL stilinde künye numarası okunuyor: biçim kısmen denetli. */
  test("numaralı CSL stilinde numaralandırma uygulanıyor", () => {
    assert.equal(durum("csl:k:ieee-ornek", "numaralandirma"), "uygulandi");
  });
});

describe("gerekmiyor ile uygulanamadı aynı şey değil", () => {
  test("numara stilinde adla eşleşme GEREKMİYOR (eksik denetim değil)", () => {
    assert.equal(durum("vancouver", "atifEslesmesi"), "gerekmiyor");
    assert.equal(kapsamKismiMi(kapsam("vancouver")), false);
  });

  test("yazar–tarih stilinde künye numarası gerekmiyor", () => {
    assert.equal(durum("apa7", "numaralandirma"), "gerekmiyor");
  });

  test("metin verilmediyse metne bakan kontroller UYGULANAMADI", () => {
    assert.equal(durum("apa7", "atifEslesmesi", false), "uygulanamadi");
    assert.equal(durum("apa7", "atifNoktalamasi", false), "uygulanamadi");
    assert.equal(kapsamKismiMi(kapsam("apa7", false)), true);
    /* Künye biçimi metinden bağımsız: metin yokken de denetleniyor. */
    assert.equal(durum("apa7", "yazarBicimi", false), "uygulandi");
  });
});

describe("Chicago'nun iki türü farklı kapsam veriyor", () => {
  test("Yazar–Tarih metin içi, Notlar–Kaynakça dipnot okur", () => {
    assert.equal(durum("chicago", "dipnotAtiflari"), "gerekmiyor");
    assert.equal(durum("chicago", "atifNoktalamasi"), "uygulandi");
    assert.equal(durum("chicago-notlar", "dipnotAtiflari"), "uygulandi");
    assert.equal(durum("chicago-notlar", "atifNoktalamasi"), "gerekmiyor");
  });
});

describe("kapsam listesinin kendisi", () => {
  test("her anahtarın iki dilde adı var", () => {
    for (const satir of kapsam("apa7")) {
      const ad = KAPSAM_ADI[satir.anahtar];
      assert.ok(ad.tr.length > 2 && ad.en.length > 2, satir.anahtar);
    }
  });

  test("uygulandı satırı gerekçe TAŞIMAZ; ötekiler taşır", () => {
    for (const satir of kapsam("csl:a:nature", false)) {
      if (satir.durum === "uygulandi") assert.equal(satir.gerekce, null, satir.anahtar);
      else assert.ok(satir.gerekce, satir.anahtar);
    }
  });

  test("uygulananlar ve uygulanamayanlar listeyi bölüyor", () => {
    const satirlar = kapsam("csl:a:nature", false);
    const toplam = uygulananlar(satirlar).length + uygulanamayanlar(satirlar).length;
    assert.ok(toplam > 0 && toplam <= satirlar.length);
  });
});
