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

import { etkinHedefler, faaliyetDonemi, hedefDurumlari } from "@/lib/docentlik-ozeti";

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
    const { toplamHedef, grupHedefleri } = hedefDurumlari(etkinHedefler(hedefler, null), 72.5, [
      { grup: "Makaleler", toplam: 25 },
      { grup: "Atıflar", toplam: 30 },
    ]);
    assert.deepEqual([toplamHedef?.hedef, toplamHedef?.eksik], [100, 27.5]);
    assert.deepEqual(grupHedefleri.map((g) => [g.grup, g.eksik]), [["Makaleler", 15], ["Atıflar", 0]]);
  });

  test("hiç faaliyeti olmayan grubun hedefi tam eksik", () => {
    const { grupHedefleri } = hedefDurumlari([{ organization_id: null, grup: "Projeler", asgari_puan: 20 }], 0, []);
    assert.deepEqual([grupHedefleri[0].mevcut, grupHedefleri[0].eksik], [0, 20]);
  });

  test("dönem: aynı gün 'sonra' sayılmaz, tarihsiz bilinmiyor", () => {
    assert.equal(faaliyetDonemi("2024-05-02", "2024-05-01"), "sonra");
    assert.equal(faaliyetDonemi("2024-05-01", "2024-05-01"), "once");
    assert.equal(faaliyetDonemi("2019-01-01", "2024-05-01"), "once");
    assert.equal(faaliyetDonemi(null, "2024-05-01"), "bilinmiyor");
    assert.equal(faaliyetDonemi("2024-05-02", null), "bilinmiyor");
  });
});
