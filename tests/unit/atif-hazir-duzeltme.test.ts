import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { duzeltmeOzetCumlesi, eksikKaynakcaGirdileri, hazirDuzeltmeler, type KutuphaneKaynagi } from "@/lib/atif/hazir-duzeltme";
import type { OrnekKunye } from "@/lib/kilavuz-ornek-kunyeler";

/*
  Hazır düzeltmenin tek kuralı: KÜNYE UYDURULMAZ. Bu dosya üç şeyi
  sabitler — doğru eşleşmede künye stile göre yeniden yazılıyor, belirsiz
  eşleşmede hiçbir şey sunulmuyor, eksik bilgili kayıt düzeltme değil
  "şu bilgi gerekli" listesi üretiyor.
*/

const kaynak = (ek: Partial<KutuphaneKaynagi> & { id: string; title: string }): KutuphaneKaynagi =>
  ({
    authors: "Yılmaz, A.",
    year: "2020",
    container_title: "Eğitim Dergisi",
    volume: "12",
    issue: "3",
    pages: "45-60",
    publisher: null,
    publication_place: null,
    doi_or_url: "https://doi.org/10.5555/x",
    source_type: "article",
    ...ek,
  }) as unknown as KutuphaneKaynagi;

const OGRENME = kaynak({ id: "k1", title: "Öğrenme stilleri ve akademik başarı" });
const MOTIVASYON = kaynak({ id: "k2", title: "Motivasyonun sınıf içi rolü", authors: "Demir, B.", year: "2019", volume: "8", issue: "1", pages: "10-25" });

describe("doğru eşleşmede künye stile göre yeniden yazılıyor", () => {
  test("bozuk APA künyesi düzeltiliyor", () => {
    const ozet = hazirDuzeltmeler({
      /* Yıl parantezsiz, dergi adı italiksiz, sayfa eksik noktalamalı. */
      kunyeler: [{ raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi 12 3 45-60", issues: [{ message: "Yıl parantez içinde bulunamadı" }] }],
      kaynaklar: [OGRENME],
      stil: "apa7",
    });
    assert.equal(ozet.duzeltmeler.length, 1);
    const d = ozet.duzeltmeler[0];
    assert.match(d.yeni, /^Yılmaz, A\. \(2020\)\./);
    assert.match(d.yeni, /Öğrenme stilleri ve akademik başarı/);
    assert.deepEqual(d.sebepler, ["Yıl parantez içinde bulunamadı"]);
    assert.equal(d.kaynakId, "k1");
    assert.equal(ozet.eksikler.length, 0);
  });

  test("aynı künye başka stilde başka düzeltme veriyor", () => {
    const bozuk = [{ raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi 12 3 45-60" }];
    const apa = hazirDuzeltmeler({ kunyeler: bozuk, kaynaklar: [OGRENME], stil: "apa7" }).duzeltmeler[0].yeni;
    const ieee = hazirDuzeltmeler({ kunyeler: bozuk, kaynaklar: [OGRENME], stil: "ieee" }).duzeltmeler[0].yeni;
    assert.notEqual(apa, ieee);
    /* Numara stilinde künye kaynakçadaki SIRA numarasıyla başlar. */
    assert.match(ieee, /^\[1\]/);
  });

  test("numara stilinde ikinci künye [2] ile başlıyor", () => {
    const ozet = hazirDuzeltmeler({
      kunyeler: [
        { raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" },
        { raw: "Demir B 2019 Motivasyonun sınıf içi rolü Eğitim Dergisi" },
      ],
      kaynaklar: [OGRENME, MOTIVASYON],
      stil: "vancouver",
    });
    assert.equal(ozet.duzeltmeler.length, 2);
    assert.match(ozet.duzeltmeler[0].yeni, /^1\./);
    assert.match(ozet.duzeltmeler[1].yeni, /^2\./);
  });

  test("zaten doğru yazılmış künye için düzeltme sunulmuyor", () => {
    const dogru = hazirDuzeltmeler({ kunyeler: [{ raw: "x" }], kaynaklar: [OGRENME], stil: "apa7" });
    /* Önce doğru hâlini üret, sonra onu girdi yap. */
    const yeni = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı" }],
      kaynaklar: [OGRENME],
      stil: "apa7",
    }).duzeltmeler[0].yeni;
    const ikinci = hazirDuzeltmeler({ kunyeler: [{ raw: yeni }], kaynaklar: [OGRENME], stil: "apa7" });
    assert.equal(dogru.duzeltmeler.length, 0, "eşleşmeyen künye düzeltme üretmemeli");
    assert.equal(ikinci.duzeltmeler.length, 0, "doğru künye yeniden düzeltilmemeli");
  });
});

describe("künye uydurulmuyor", () => {
  test("kütüphanede karşılığı olmayan künye eşleşmeyene gidiyor", () => {
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Kaya, C. (2021). Bambaşka bir çalışma. Başka Dergi, 1(1), 1-9." }],
      kaynaklar: [OGRENME, MOTIVASYON],
      stil: "apa7",
    });
    assert.deepEqual(ozet.duzeltmeler, []);
    assert.equal(ozet.eslesmeyen.length, 1);
  });

  test("iki kayıt birden uyuyorsa düzeltme YOK", () => {
    const ikiz = kaynak({ id: "k3", title: "Öğrenme stilleri ve akademik başarı" });
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" }],
      kaynaklar: [OGRENME, ikiz],
      stil: "apa7",
    });
    assert.deepEqual(ozet.duzeltmeler, []);
    assert.equal(ozet.eslesmeyen.length, 1);
  });

  test("yılı tutmayan kayıt eşleşmiyor", () => {
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 1998 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" }],
      kaynaklar: [OGRENME],
      stil: "apa7",
    });
    assert.deepEqual(ozet.duzeltmeler, []);
  });
});

describe("eksik bilgi: yalnızca ŞART olan alan engelliyor", () => {
  /*
    Eskiden eksik olan HER alan düzeltmeyi engelliyordu: DOI'si olmayan
    bir dergi makalesi Vancouver'da da IEEE'de de düzeltilemiyordu —
    oysa bu stiller DOI istemiyor. Künyenin yazılabilmesi için şart
    olmayan alan artık engel değil, NOT.
  */
  const DOISIZ = kaynak({ id: "k5", title: "Motivasyonun sınıf içi rolü", doi_or_url: null });

  test("DOI eksikse düzeltme SUNULUYOR ve künyeye DOI yazılmıyor", () => {
    for (const stil of ["vancouver", "ieee", "apa7", "chicago"]) {
      const ozet = hazirDuzeltmeler({
        kunyeler: [{ raw: "Yılmaz A 2020 Motivasyonun sınıf içi rolü Eğitim Dergisi" }],
        kaynaklar: [DOISIZ],
        stil,
      });
      assert.equal(ozet.duzeltmeler.length, 1, `${stil}: düzeltme sunulmalı`);
      assert.deepEqual(ozet.eksikler, [], `${stil}: DOI engel sayılmamalı`);
      const d = ozet.duzeltmeler[0];
      assert.ok(!/doi\.org|https?:\/\//.test(d.yeni), `${stil}: künyeye DOI uydurulmuş: ${d.yeni}`);
      assert.deepEqual(d.eksikNotu, ["DOI"], `${stil}: eksik alan not olarak söylenmeli`);
    }
  });

  test("cilt ve sayfa eksikse de düzeltme sunuluyor, not olarak yazılıyor", () => {
    const eksik = kaynak({ id: "k4", title: "Sınıf yönetiminin temelleri", volume: null, pages: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Sınıf yönetiminin temelleri Eğitim Dergisi" }],
      kaynaklar: [eksik],
      stil: "apa7",
    });
    assert.equal(ozet.duzeltmeler.length, 1);
    assert.deepEqual(ozet.eksikler, []);
    assert.deepEqual(ozet.duzeltmeler[0].eksikNotu, ["cilt", "sayfa aralığı"]);
  });

  test("DERGİ ADI eksikse engelliyor: künye o olmadan yanlış olurdu", () => {
    const dergisiz = kaynak({ id: "k6", title: "Dergisi bilinmeyen çalışma", container_title: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Dergisi bilinmeyen çalışma" }],
      kaynaklar: [dergisiz],
      stil: "apa7",
    });
    assert.deepEqual(ozet.duzeltmeler, []);
    assert.equal(ozet.eksikler.length, 1);
    assert.deepEqual(ozet.eksikler[0].alanlar, ["dergi adı"]);
  });

  test("yazarı ya da yılı olmayan kayıt engelliyor", () => {
    for (const [ek, beklenen] of [[{ authors: null }, "yazar"], [{ year: null }, "yıl"]] as const) {
      const bozuk = kaynak({ id: "k7", title: "Yazarsız ya da yılsız çalışma", ...ek });
      const ozet = hazirDuzeltmeler({
        kunyeler: [{ raw: "Yılmaz A 2020 Yazarsız ya da yılsız çalışma Eğitim Dergisi" }],
        kaynaklar: [bozuk],
        stil: "apa7",
      });
      assert.ok(ozet.eksikler[0]?.alanlar.includes(beklenen), `${beklenen} engellemeli: ${JSON.stringify(ozet)}`);
    }
  });

  test("doğrulanmış kılavuz kuralı DOI isterse engel olur", () => {
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Motivasyonun sınıf içi rolü Eğitim Dergisi" }],
      kaynaklar: [DOISIZ],
      stil: "vancouver",
      kilavuzZorunlulari: ["doi"],
    });
    assert.deepEqual(ozet.duzeltmeler, []);
    assert.deepEqual(ozet.eksikler[0].alanlar, ["DOI"]);
  });

  test("belirsizlik ötekileri engellemiyor", () => {
    const dergisiz = kaynak({ id: "k6", title: "Dergisi bilinmeyen çalışma", container_title: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [
        { raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" },
        { raw: "Yılmaz A 2020 Dergisi bilinmeyen çalışma" },
        { raw: "Kaya, C. (2021). Hiç bilinmeyen çalışma. Başka Dergi." },
      ],
      kaynaklar: [OGRENME, dergisiz],
      stil: "apa7",
    });
    assert.equal(ozet.duzeltmeler.length, 1, "düzeltilebilen künye sunulmalı");
    assert.equal(ozet.eksikler.length, 1);
    assert.equal(ozet.eslesmeyen.length, 1);
  });
});

describe("özet cümlesi", () => {
  test("sayıyı ve eksikleri iki dilde yazıyor", () => {
    const cumle = duzeltmeOzetCumlesi({
      duzeltmeler: [{ anahtar: "a", ham: "x", yeni: "y", parcalar: [{ text: "y" }], kaynakId: "k", sebepler: [], ozelKural: false, eksikNotu: [] }],
      eksikler: [{ anahtar: "b", ham: "z", kaynakId: "k2", alanlar: ["cilt"] }],
      eslesmeyen: [],
    });
    assert.match(cumle.tr, /1 kaynakça düzeltmesi hazır\./);
    assert.match(cumle.tr, /1 kaynakta künye bilgisi eksik/);
    assert.match(cumle.en, /1 reference fix ready\./);
  });
});

describe("kaynakçada olmayan ama metinde anılan kaynaklar", () => {
  const atif = (raw: string, authorKey: string, year: string | null) => ({ raw, authorKey, year });

  test("metinde anılan, kaynakçada olmayan kaynak listeleniyor", () => {
    const eksik = eksikKaynakcaGirdileri({
      atiflar: [atif("(Demir, 2019)", "demir", "2019")],
      kunyeler: [{ raw: "Yilmaz, A. (2020). Öğrenme stilleri ve akademik başarı. Eğitim Dergisi." }],
      kaynaklar: [OGRENME, MOTIVASYON],
    });
    assert.deepEqual(eksik.map((k) => k.id), ["k2"]);
  });

  test("kaynakçada zaten duran kaynak listelenmiyor", () => {
    const eksik = eksikKaynakcaGirdileri({
      atiflar: [atif("(Yılmaz, 2020)", "yılmaz", "2020")],
      kunyeler: [{ raw: "Yilmaz, A. (2020). Öğrenme stilleri ve akademik başarı. Eğitim Dergisi, 12(3), 45-60." }],
      kaynaklar: [OGRENME],
    });
    assert.deepEqual(eksik, []);
  });

  test("yılı tutmayan atıf kaynağı getirmiyor", () => {
    const eksik = eksikKaynakcaGirdileri({
      atiflar: [atif("(Demir, 2001)", "demir", "2001")],
      kunyeler: [],
      kaynaklar: [MOTIVASYON],
    });
    assert.deepEqual(eksik, []);
  });

  test("metinde hiç atıf yoksa liste boş", () => {
    assert.deepEqual(eksikKaynakcaGirdileri({ atiflar: [], kunyeler: [], kaynaklar: [OGRENME] }), []);
  });

  /* Numara ve MLA stillerinde atıfta yıl yok; yazar eşleşmesi yeterli. */
  test("atıfta yıl yoksa yazar eşleşmesi yetiyor", () => {
    const eksik = eksikKaynakcaGirdileri({
      atiflar: [atif("(Demir 45)", "demir", null)],
      kunyeler: [],
      kaynaklar: [MOTIVASYON],
    });
    assert.deepEqual(eksik.map((k) => k.id), ["k2"]);
  });
});

describe("kılavuzun özel kuralı doğrulanamayan künye işaretleniyor", () => {
  test("internet kaynağı ozelKural taşıyor, makale taşımıyor", () => {
    const site = kaynak({ id: "k9", title: "Istatistik yillik verileri sayfasi", source_type: "website", container_title: null, volume: null, issue: null, pages: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [
        { raw: "TUIK 2020 Istatistik yillik verileri sayfasi" },
        { raw: "Yilmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" },
      ],
      kaynaklar: [site, OGRENME],
      stil: "apa7",
    });
    const site_ = ozet.duzeltmeler.find((d) => d.kaynakId === "k9");
    const makale = ozet.duzeltmeler.find((d) => d.kaynakId === "k1");
    assert.equal(site_?.ozelKural, true, "internet kaynağı işaretlenmeli");
    assert.equal(makale?.ozelKural, false, "makale işaretlenmemeli");
    /* İşaret düzeltmeyi ENGELLEMİYOR: öğrenci yine uygulayabilmeli. */
    assert.ok(site_?.yeni && site_.yeni.length > 10);
  });
});

describe("kılavuzdaki internet örnekleri düzeltmeye bağlanıyor", () => {
  const ORNEKLER = [
    { metin: "Türkiye İstatistik Kurumu. (2023). Nüfus verileri. https://www.tuik.gov.tr/x", tur: "kurumsal-sayfa" as const, kesin: true, bolum: "İNTERNET KAYNAKLARI", sayfa: 12 },
    { metin: "Sağlık Bakanlığı. (2022). Yıllık sağlık raporu. https://saglik.gov.tr/rapor", tur: "cevrimici-rapor" as const, kesin: true, bolum: "İNTERNET KAYNAKLARI", sayfa: 12 },
  ];
  const site = (ek: Partial<KutuphaneKaynagi> & { id: string; title: string }) =>
    kaynak({ source_type: "website", container_title: null, volume: null, issue: null, pages: null, doi_or_url: "https://ornek.gov.tr/x", ...ek });

  test("türü kesin olan kaynağa uygun örnek ÖNERİLİYOR", () => {
    const kurumsal = site({ id: "w1", title: "Nufus istatistikleri sayfasi", authors: "Türkiye İstatistik Kurumu" });
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "TUIK 2020 Nufus istatistikleri sayfasi" }],
      kaynaklar: [kurumsal],
      stil: "apa7",
      internetOrnekleri: ORNEKLER,
    });
    const d = ozet.duzeltmeler[0];
    const oneri = d.ornekDurumu?.secenekler.find((x) => x.ornek.metin === d.ornekDurumu?.oneri);
    assert.equal(oneri?.ornek.tur, "kurumsal-sayfa");
    assert.equal(oneri?.ornek.bolum, "İNTERNET KAYNAKLARI");
    assert.equal(d.ornekDurumu?.secenekler.length, 2);
  });

  test("türü belirsizse öneri YOK, iki seçenek de sunuluyor", () => {
    const belirsiz = site({ id: "w2", title: "Bir blog yazisi", authors: "Yılmaz, A." });
    const d = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yilmaz A 2020 Bir blog yazisi" }],
      kaynaklar: [belirsiz],
      stil: "apa7",
      internetOrnekleri: ORNEKLER,
    }).duzeltmeler[0];
    assert.equal(d.ornekDurumu?.oneri, null);
    assert.equal(d.ornekDurumu?.secenekler.length, 2);
  });

  test("kılavuzda örnek yoksa ornekDurumu hiç yok (bugünkü uyarı kalır)", () => {
    const d = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yilmaz A 2020 Bir blog yazisi" }],
      kaynaklar: [site({ id: "w3", title: "Bir blog yazisi" })],
      stil: "apa7",
    }).duzeltmeler[0];
    assert.equal(d.ozelKural, true);
    assert.equal(d.ornekDurumu, undefined);
  });

  test("internet dışı kaynakta örnek sorulmuyor", () => {
    const d = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yilmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" }],
      kaynaklar: [OGRENME],
      stil: "apa7",
      internetOrnekleri: ORNEKLER,
    }).duzeltmeler[0];
    assert.equal(d.ozelKural, false);
    assert.equal(d.ornekDurumu, undefined);
  });

  /* Seçim bekleyen künye ötekileri ENGELLEMEZ: ikisi de listede. */
  test("seçim bekleyen künye öteki düzeltmeleri engellemiyor", () => {
    const ozet = hazirDuzeltmeler({
      kunyeler: [
        { raw: "Yilmaz A 2020 Bir blog yazisi" },
        { raw: "Yilmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" },
      ],
      kaynaklar: [site({ id: "w2", title: "Bir blog yazisi" }), OGRENME],
      stil: "apa7",
      internetOrnekleri: ORNEKLER,
    });
    assert.equal(ozet.duzeltmeler.length, 2);
    assert.equal(ozet.duzeltmeler.filter((d) => d.ornekDurumu && !d.ornekDurumu.oneri).length, 1);
    assert.equal(ozet.duzeltmeler.filter((d) => !d.ozelKural).length, 1);
  });
});

describe("örneğin kuralı yalnızca o künyenin önizlemesine uygulanıyor", () => {
  const ONEKLI = { metin: "Sağlık Bakanlığı. (2022). Yıllık rapor. Erişim adresi: https://saglik.gov.tr/r", tur: "cevrimici-rapor" as const, kesin: true, bolum: "İNTERNET", sayfa: null };
  const CIPLAK = { metin: "Türkiye İstatistik Kurumu. (2023). Nüfus verileri. https://www.tuik.gov.tr/x", tur: "kurumsal-sayfa" as const, kesin: true, bolum: "İNTERNET", sayfa: null };
  const OKUNAMAZ = { metin: "Millî Eğitim Bakanlığı. (2021). Veriler, https://meb.gov.tr/v adresinden alınmıştır.", tur: "kurumsal-sayfa" as const, kesin: true, bolum: "İNTERNET", sayfa: null };
  const site = kaynak({ id: "w5", title: "Bir blog yazisi", source_type: "website", container_title: null, volume: null, issue: null, pages: null, doi_or_url: "https://ornek.com/yazi" });
  const ozet = (ornekler: OrnekKunye[]) =>
    hazirDuzeltmeler({
      kunyeler: [{ raw: "Yilmaz A 2020 Bir blog yazisi" }],
      kaynaklar: [site],
      stil: "apa7",
      internetOrnekleri: ornekler,
    }).duzeltmeler[0];

  test("önekli örnek künyeye uygulanıyor; örnekten BİLGİ taşınmıyor", () => {
    const secenek = ozet([ONEKLI, CIPLAK]).ornekDurumu!.secenekler.find((x) => x.ornek === ONEKLI)!;
    assert.equal(secenek.kuralUygulandi, true);
    assert.match(secenek.yeni!, /Erişim adresi: https:\/\/ornek\.com\/yazi/);
    /* Örneğin kendi yazarı, yılı ve adresi künyeye GİRMEMELİ. */
    assert.ok(!/Sağlık Bakanlığı|saglik\.gov\.tr|2022/.test(secenek.yeni!), secenek.yeni!);
  });

  test("çıplak adres kuralı künyeyi değiştirmiyor ama kural uygulanmış sayılıyor", () => {
    const secenek = ozet([ONEKLI, CIPLAK]).ornekDurumu!.secenekler.find((x) => x.ornek === CIPLAK)!;
    assert.equal(secenek.kuralUygulandi, true);
    assert.ok(!/Erişim adresi:/.test(secenek.yeni!), secenek.yeni!);
  });

  test("kuralı okunamayan örnek yalnızca karşılaştırma: yeni künye YOK", () => {
    const secenek = ozet([OKUNAMAZ]).ornekDurumu!.secenekler[0];
    assert.equal(secenek.kuralUygulandi, false);
    assert.equal(secenek.yeni, null);
    assert.deepEqual(secenek.gerekenBilgi, []);
  });

  test("erişim tarihi isteyen kural, kayıt yoksa uygulanmıyor ve gereken bilgi söyleniyor", () => {
    const tarihli = { ...ONEKLI, metin: `${ONEKLI.metin} (Erişim tarihi: 01.02.2022)` };
    const secenek = ozet([tarihli]).ornekDurumu!.secenekler[0];
    assert.equal(secenek.kuralUygulandi, false);
    assert.equal(secenek.yeni, null);
    assert.deepEqual(secenek.gerekenBilgi, ["erişim tarihi"]);
  });

  /* Erişim tarihi kayıtlı değil: künyeye "bugün" yazılmaz, eksik olduğu söylenir. */
  test("internet künyesine uydurma erişim tarihi yazılmıyor", () => {
    const d = ozet([CIPLAK]);
    assert.ok(!/Erişim tarihi/.test(d.yeni), d.yeni);
    assert.ok(d.eksikNotu.includes("erişim tarihi"), JSON.stringify(d.eksikNotu));
  });
});
