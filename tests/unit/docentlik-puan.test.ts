import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { korunanBirimPuan } from "../../lib/docentlik-puan";

const kayit = (birim: number, puan: number, kriter = "k1") => ({
  criteria_id: kriter,
  unit_count: birim,
  computed_points: puan,
});

describe("doçentlik düzenlemede birim puan", () => {
  test("kriter aynıysa kaydın kendi puanı korunur", () => {
    // Kriter bu arada 20'ye çıkmış olabilir; kayıt 12'den hesaplanmıştı.
    assert.equal(korunanBirimPuan(kayit(2, 24), "k1"), 12);
  });

  test("kriter değiştiyse türetilmez", () => {
    assert.equal(korunanBirimPuan(kayit(2, 24), "k2"), null);
  });

  test("ondalık kayması birikmiyor", () => {
    // 3 × 0.1 kayan noktada 0.30000000000000004; bölünce geri 0.1 gelmeli.
    assert.equal(korunanBirimPuan(kayit(3, 3 * 0.1), "k1"), 0.1);
  });

  test("sıfır birimli bozuk satırda bölme yapılmıyor", () => {
    assert.equal(korunanBirimPuan(kayit(0, 10), "k1"), null);
  });

  test("puanı sayı olmayan satır kritere bırakılıyor", () => {
    assert.equal(korunanBirimPuan(kayit(2, Number.NaN), "k1"), null);
  });

  /*
    0 puanlı kriter gerçek: "şart ama puansız" faaliyetler var. null ile
    karıştırılırsa kriterin güncel puanı çekilir ve kayıt sessizce
    fiyatlanır.
  */
  test("gerçekten sıfır puanlı kayıt null ile karışmıyor", () => {
    assert.equal(korunanBirimPuan(kayit(4, 0), "k1"), 0);
  });
});

import { paylasimKatsayisi, puanHesapla } from "@/lib/docentlik-puan";

describe("ortak yazarlık", () => {
  const kriter = { baslica_yazar_katsayisi: 0.8, diger_yazar_katsayisi: 0.5 };

  test("tek yazar ve katsayısız kriter tam puan alır", () => {
    assert.equal(paylasimKatsayisi(kriter, 1, false), 1);
    assert.equal(paylasimKatsayisi({ baslica_yazar_katsayisi: null, diger_yazar_katsayisi: null }, 4, false), 1);
    assert.equal(paylasimKatsayisi(null, 3, true), 1);
  });

  test("çok yazarlıda başlıca ve diğer yazar katsayısı", () => {
    assert.equal(paylasimKatsayisi(kriter, 3, true), 0.8);
    assert.equal(paylasimKatsayisi(kriter, 3, false), 0.5);
    assert.equal(puanHesapla(1, 20, 0.5), 10);
  });

  test("katsayılı kaydın birim puanı düzenlemede korunur", () => {
    assert.equal(korunanBirimPuan({ criteria_id: "a", unit_count: 2, computed_points: 16, paylasim_katsayisi: 0.8 }, "a"), 10);
    // Eski satır: katsayı yok, 1 sayılır.
    assert.equal(korunanBirimPuan({ criteria_id: "a", unit_count: 2, computed_points: 20 }, "a"), 10);
  });
});
