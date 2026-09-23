import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";

const satir = (ek: Partial<KrediSatiri> = {}): KrediSatiri => ({
  kullanilan_karakter: 0,
  limit_kredi: 500,
  aylik_kalan: 500,
  ek_bakiye: 0,
  bildirildi: true,
  ic_ekip: false,
  ...ek,
});

describe("kredi özeti", () => {
  test("hak bildirilmiş kurumda sayılar gösterilir", () => {
    const ozet = krediOzeti(satir({ kullanilan_karakter: 120_000, aylik_kalan: 380, ek_bakiye: 200 }));
    assert.equal(ozet.goster, true);
    if (!ozet.goster) return;
    assert.equal(ozet.kullanilanKredi, 120);
    assert.equal(ozet.aylikKalan, 380);
    assert.equal(ozet.ekBakiye, 200);
    assert.equal(ozet.toplam, 580);
    assert.equal(ozet.oran, 24);
    assert.equal(ozet.tukendi, false);
  });

  /*
    "Okunamadı" ile "hakkın yok" aynı şey değil. Sayıyı üretemediğimizde
    kart hiç çizilmiyor; "0 kredi" yazmak ikisini aynı gösterirdi.
  */
  test("satır okunamazsa kart çizilmez", () => {
    assert.equal(krediOzeti(null).goster, false);
    assert.equal(krediOzeti(undefined).goster, false);
  });

  test("iç ekibe kota gösterilmez: hiçbir koşulda engellenmiyorlar", () => {
    assert.equal(krediOzeti(satir({ ic_ekip: true })).goster, false);
  });

  /*
    Hak bildirilmemişse kapı da açık (lib/ai/kredi-karari.ts). Gösterilecek
    bir sayı yok; bireysel abonede ve ArvoOS kurumu hiç yansıtmadığında
    böyle oluyor.
  */
  test("hak bildirilmemişse kart çizilmez", () => {
    assert.equal(krediOzeti(satir({ bildirildi: false })).goster, false);
    assert.equal(krediOzeti(satir({ limit_kredi: null })).goster, false);
  });

  test("limit 0 net bir cevaptır: gösterilir ve tükenmiş sayılır", () => {
    const ozet = krediOzeti(satir({ limit_kredi: 0, aylik_kalan: 0 }));
    assert.equal(ozet.goster, true);
    if (!ozet.goster) return;
    assert.equal(ozet.oran, 100);
    assert.equal(ozet.tukendi, true);
  });

  test("satın alınmış bakiye varken tükenmiş sayılmaz", () => {
    const ozet = krediOzeti(satir({ aylik_kalan: 0, ek_bakiye: 50 }));
    assert.equal(ozet.goster, true);
    if (!ozet.goster) return;
    assert.equal(ozet.tukendi, false);
    assert.equal(ozet.toplam, 50);
  });

  test("oran 100'ü aşmaz", () => {
    const ozet = krediOzeti(satir({ limit_kredi: 100, kullanilan_karakter: 900_000, aylik_kalan: 0 }));
    assert.equal(ozet.goster, true);
    if (!ozet.goster) return;
    assert.equal(ozet.oran, 100);
  });

  test("eksi değerler sıfıra çekilir", () => {
    const ozet = krediOzeti(satir({ aylik_kalan: -5, ek_bakiye: -3 }));
    assert.equal(ozet.goster, true);
    if (!ozet.goster) return;
    assert.equal(ozet.toplam, 0);
  });
});
