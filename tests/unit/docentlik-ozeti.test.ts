import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GRUPSUZ, kriterGruplari, puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";

const k = (puan: number, grup: string | null) => ({ computed_points: puan, criteria: { category_group: grup } });

describe("doçentlik özeti", () => {
  test("gruplar toplamı tutar, en çok puan getiren önce, grupsuzlar 'Diğer'de", () => {
    const { toplam, gruplar } = puanGruplari([k(20, "Makaleler"), k(10, "Atıflar"), k(15, "Makaleler"), k(5, null), k(0.1, " "), k(0.2, "Atıflar")]);
    assert.equal(toplam, 50.3);
    assert.deepEqual(gruplar.map((g) => [g.grup, g.toplam, g.kayitlar.length]), [
      ["Makaleler", 35, 2],
      ["Atıflar", 10.2, 2],
      [GRUPSUZ, 5.1, 2],
    ]);
    assert.equal(gruplar.reduce((t, g) => t + g.toplam, 0).toFixed(6), toplam.toFixed(6));
    assert.equal(gruplar[0].pay, 70);
  });

  test("boş liste sıfır; kriterler grup ve doğal kod sırasıyla", () => {
    assert.deepEqual(puanGruplari([]), { toplam: 0, gruplar: [] });
    const sirali = kriterGruplari([
      { code: "A10", category_group: "Makaleler" },
      { code: "A2", category_group: "Makaleler" },
      { code: "X1", category_group: null },
      { code: "B1", category_group: "Atıflar" },
    ]);
    assert.deepEqual(sirali.map((g) => [g.grup, g.kriterler.map((c) => c.code)]), [
      ["Atıflar", ["B1"]],
      ["Makaleler", ["A2", "A10"]],
      [GRUPSUZ, ["X1"]],
    ]);
    assert.equal(puanYazisi(12.5), "12,5");
    assert.equal(puanYazisi(20), "20");
  });
});

import { etkinHedefler, faaliyetDonemi, hedefDurumlari, tavanUygula } from "@/lib/docentlik-ozeti";

describe("doçentlik hedefleri ve dönem", () => {
  const KURUM = "k1";
  const hedefler = [
    { organization_id: null, grup: null, asgari_puan: 100 },
    { organization_id: null, grup: "Makaleler", asgari_puan: 40 },
    { organization_id: KURUM, grup: null, asgari_puan: 120 },
    { organization_id: "baska", grup: "Atıflar", asgari_puan: 99 },
    { organization_id: null, grup: "Atıflar", asgari_puan: 10 },
  ];

  test("kurum hedefi aynı gruptaki genel hedefin yerine geçer; başka kurumunki sayılmaz", () => {
    const etkin = etkinHedefler(hedefler, KURUM);
    assert.equal(etkin.find((h) => !h.grup)?.asgari_puan, 120);
    assert.equal(etkin.find((h) => h.grup === "Atıflar")?.asgari_puan, 10);
    assert.equal(etkin.length, 3);
    assert.equal(etkinHedefler(hedefler, null).find((h) => !h.grup)?.asgari_puan, 100);
  });

  test("eksik puan sıfırın altına inmez; en çok eksiği olan grup önce", () => {
    const { toplamHedefleri, grupHedefleri } = hedefDurumlari(etkinHedefler(hedefler, null), {
      toplam: 72.5,
      gruplar: [
        { grup: "Makaleler", toplam: 25 },
        { grup: "Atıflar", toplam: 30 },
      ],
    });
    assert.deepEqual([toplamHedefleri[0]?.hedef, toplamHedefleri[0]?.eksik], [100, 27.5]);
    assert.deepEqual(grupHedefleri.map((g) => [g.grup, g.eksik]), [["Makaleler", 15], ["Atıflar", 0]]);
  });

  test("hiç faaliyeti olmayan grubun hedefi tam eksik", () => {
    const { grupHedefleri } = hedefDurumlari([{ organization_id: null, grup: "Projeler", asgari_puan: 20 }], { toplam: 0, gruplar: [] });
    assert.deepEqual([grupHedefleri[0].mevcut, grupHedefleri[0].eksik], [0, 20]);
  });

  /*
    27.10.2026, Eğitim Bilimleri tablosu: "en fazla 10 puan" tavanı ve
    "en az 90 puanı doktora sonrası" şartı. Tavan uygulanmasaydı atıftan
    30 puanı olan aday toplamda 20 puan fazla görürdü.
  */
  test("tavan grubun sayılan puanını sınırlar; doktora sonrası asgari ayrı ölçülür", () => {
    const sinirlar = [
      { organization_id: "k", grup: null, asgari_puan: 100 },
      { organization_id: "k", grup: null, asgari_puan: 90, doktora_sonrasi: true },
      { organization_id: "k", grup: "Atıf", asgari_puan: null, azami_puan: 10 },
      { organization_id: "k", grup: "Atıf", asgari_puan: 5, doktora_sonrasi: true },
    ];
    const kayit = (puan: number, grup: string) => ({ computed_points: puan, criteria: { category_group: grup } });
    const tum = tavanUygula(puanGruplari([kayit(60, "Makale"), kayit(30, "Atıf")]), sinirlar);
    assert.equal(tum.ham, 90);
    assert.equal(tum.toplam, 70);
    assert.deepEqual(tum.gruplar.find((g) => g.grup === "Atıf"), { ...tum.gruplar.find((g) => g.grup === "Atıf"), ham: 30, toplam: 10, azami: 10 });

    const sonra = tavanUygula(puanGruplari([kayit(40, "Makale"), kayit(3, "Atıf")]), sinirlar);
    const { toplamHedefleri, grupHedefleri } = hedefDurumlari(sinirlar, tum, sonra);
    assert.deepEqual(toplamHedefleri.map((h) => [h.doktoraSonrasi, h.mevcut, h.eksik]), [[false, 70, 30], [true, 43, 47]]);
    assert.deepEqual(grupHedefleri.map((h) => [h.grup, h.doktoraSonrasi, h.eksik]), [["Atıf", true, 2]]);

    // Doktora tarihi bilinmiyor: doktora sonrası şartı ölçülmez, yanlış alarm verilmez.
    assert.deepEqual(hedefDurumlari(sinirlar, tum, null).toplamHedefleri.map((h) => h.doktoraSonrasi), [false]);
  });

  test("dönem: aynı gün 'sonra' sayılmaz, tarihsiz bilinmiyor", () => {
    assert.equal(faaliyetDonemi("2024-05-02", "2024-05-01"), "sonra");
    assert.equal(faaliyetDonemi("2024-05-01", "2024-05-01"), "once");
    assert.equal(faaliyetDonemi("2019-01-01", "2024-05-01"), "once");
    assert.equal(faaliyetDonemi(null, "2024-05-01"), "bilinmiyor");
    assert.equal(faaliyetDonemi("2024-05-02", null), "bilinmiyor");
  });
});

describe("temel alan", () => {
  test("alanın kendi hedefi 'bütün alanlar'dan, kurum hedefi genelden önce gelir", () => {
    const h = [
      { organization_id: null, temel_alan: null, grup: null, asgari_puan: 100 },
      { organization_id: "k", temel_alan: "Hukuk", grup: null, asgari_puan: 110 },
      { organization_id: "k", temel_alan: "Sağlık", grup: null, asgari_puan: 130 },
      { organization_id: "k", temel_alan: null, grup: "Atıf", asgari_puan: 5 },
    ];
    assert.equal(etkinHedefler(h, "k", "Hukuk").find((x) => !x.grup)?.asgari_puan, 110);
    assert.equal(etkinHedefler(h, "k", "Sağlık").find((x) => !x.grup)?.asgari_puan, 130);
    // Alan seçilmemiş: alana özel hedefler sayılmaz.
    assert.equal(etkinHedefler(h, "k", null).find((x) => !x.grup)?.asgari_puan, 100);
    assert.equal(etkinHedefler(h, "k", "Hukuk").find((x) => x.grup === "Atıf")?.asgari_puan, 5);
  });
});
