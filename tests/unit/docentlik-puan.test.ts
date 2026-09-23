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
