import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { duzeltmeOzetCumlesi, eksikKaynakcaGirdileri, hazirDuzeltmeler, type KutuphaneKaynagi } from "@/lib/atif/hazir-duzeltme";

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

describe("eksik bilgi tamamlanmıyor, söyleniyor", () => {
  test("cildi ve sayfası olmayan kayıt düzeltme değil eksik listesi veriyor", () => {
    const eksik = kaynak({ id: "k4", title: "Sınıf yönetiminin temelleri", volume: null, pages: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [{ raw: "Yılmaz A 2020 Sınıf yönetiminin temelleri Eğitim Dergisi" }],
      kaynaklar: [eksik],
      stil: "apa7",
    });
    assert.deepEqual(ozet.duzeltmeler, []);
    assert.equal(ozet.eksikler.length, 1);
    assert.deepEqual(ozet.eksikler[0].alanlar, ["cilt", "sayfa aralığı"]);
    assert.equal(ozet.eksikler[0].kaynakId, "k4");
  });

  test("belirsizlik ötekileri engellemiyor", () => {
    const eksikKayit = kaynak({ id: "k4", title: "Sınıf yönetiminin temelleri", volume: null, pages: null });
    const ozet = hazirDuzeltmeler({
      kunyeler: [
        { raw: "Yılmaz A 2020 Öğrenme stilleri ve akademik başarı Eğitim Dergisi" },
        { raw: "Yılmaz A 2020 Sınıf yönetiminin temelleri Eğitim Dergisi" },
        { raw: "Kaya, C. (2021). Hiç bilinmeyen çalışma. Başka Dergi." },
      ],
      kaynaklar: [OGRENME, eksikKayit],
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
      duzeltmeler: [{ anahtar: "a", ham: "x", yeni: "y", parcalar: [{ text: "y" }], kaynakId: "k", sebepler: [], ozelKural: false }],
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
