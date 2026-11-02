import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  bitenler,
  bitisPenceresi,
  BITIS_BILDIRIMI_GUNU,
  hatirlatilacaklar,
  hatirlatmaPenceresi,
  HATIRLATMA_GUNU,
  TEK_SEFERDE,
  type AbonelikSatiri,
} from "@/lib/deneme-hatirlatma";

const SIMDI = Date.UTC(2026, 8, 24, 9, 0, 0);
const GUN = 24 * 60 * 60 * 1000;
const satir = (ek: Partial<AbonelikSatiri> & { user_id: string }): AbonelikSatiri => ({
  status: "trialing",
  trial_ends_at: new Date(SIMDI + 0.5 * GUN).toISOString(),
  deneme_hatirlatildi_at: null,
  ...ek,
});

describe("deneme hatırlatması", () => {
  test("eşik içindeki abone seçilir; bitiş anı da döner", () => {
    const bitis = new Date(SIMDI + 0.4 * GUN).toISOString();
    const sonuc = hatirlatilacaklar([satir({ user_id: "a", trial_ends_at: bitis })], SIMDI);
    assert.deepEqual(sonuc, [{ userId: "a", kalanGun: 1, bitis }]);
  });

  /*
    02.11.2026: deneme 3 güne indi. Hatırlatma 3 gün kala olsaydı, kayıttan
    hemen sonraki ilk turda giderdi. Artık yalnızca son 24 saatte.
  */
  test("3 günlük denemede kayıttan hemen sonra hatırlatma gitmez, son günde gider", () => {
    const yeniKayit = satir({ user_id: "a", trial_ends_at: new Date(SIMDI + 3 * GUN).toISOString() });
    assert.deepEqual(hatirlatilacaklar([yeniKayit], SIMDI), []);
    const sonGun = satir({ user_id: "b", trial_ends_at: new Date(SIMDI + 23 * 60 * 60 * 1000).toISOString() });
    assert.equal(hatirlatilacaklar([sonGun], SIMDI)[0]?.userId, "b");
  });

  test("eşiğin dışındaki abone seçilmez", () => {
    const uzak = satir({ user_id: "a", trial_ends_at: new Date(SIMDI + (HATIRLATMA_GUNU + 1) * GUN).toISOString() });
    assert.deepEqual(hatirlatilacaklar([uzak], SIMDI), []);
  });

  test("süresi dolmuşa 'bitiyor' denmez", () => {
    // Geç kalmış uyarı yanlış bilgidir; bitmiş aboneliği ürün zaten söylüyor.
    const dolmus = satir({ user_id: "a", trial_ends_at: new Date(SIMDI - GUN).toISOString() });
    assert.deepEqual(hatirlatilacaklar([dolmus], SIMDI), []);
  });

  test("bir kez hatırlatılan bir daha hatırlatılmaz", () => {
    const gonderilmis = satir({ user_id: "a", deneme_hatirlatildi_at: new Date(SIMDI - GUN).toISOString() });
    assert.deepEqual(hatirlatilacaklar([gonderilmis], SIMDI), []);
  });

  test("deneme dışındaki durumlar atlanır", () => {
    assert.deepEqual(hatirlatilacaklar([satir({ user_id: "a", status: "active" })], SIMDI), []);
    assert.deepEqual(hatirlatilacaklar([satir({ user_id: "a", status: "suspended" })], SIMDI), []);
  });

  test("bozuk tarih sessizce atlanır", () => {
    assert.deepEqual(hatirlatilacaklar([satir({ user_id: "a", trial_ends_at: "yarın" })], SIMDI), []);
    assert.deepEqual(hatirlatilacaklar([satir({ user_id: "a", trial_ends_at: null })], SIMDI), []);
  });

  test("sınıra takılırsa en acil olanlar kalır", () => {
    // Sıra rastgele olsaydı, bitişine bir gün kalan kişi elenip bitişine
    // üç gün kalan kişiye uyarı giderdi.
    const cok = Array.from({ length: TEK_SEFERDE + 10 }, (_, i) =>
      satir({ user_id: `k${i}`, trial_ends_at: new Date(SIMDI + (0.01 + i * 0.004) * GUN).toISOString() }));
    const sonuc = hatirlatilacaklar([...cok].reverse(), SIMDI);
    assert.equal(sonuc.length, TEK_SEFERDE);
    assert.equal(sonuc[0].userId, "k0");
  });
});

describe("hatırlatma penceresi", () => {
  test("alt sınır şimdi, üst sınır bitişe HATIRLATMA_GUNU kalan an", () => {
    const { altSinir, ustSinir } = hatirlatmaPenceresi(SIMDI);
    assert.equal(altSinir, new Date(SIMDI).toISOString());
    assert.equal(ustSinir, new Date(SIMDI + HATIRLATMA_GUNU * GUN).toISOString());
  });

  /*
    Asıl korunan şey: sorgu "bitişe en yakın TEK_SEFERDE satır" alıyor ve
    süresi dolmuş satırlar ('trialing' kalıp bir daha uğramayanlar) hep en
    yakındır. Alt sınır olmasaydı pencere onlarla dolar, hatırlatma hiç
    kimseye gitmez ve uç nokta "aday: 0" diyerek sorunu gizlerdi.
  */
  test("süresi dolmuş satırlar pencerenin altında kalır", () => {
    const bitmis = new Date(SIMDI - 30 * GUN).toISOString();
    const { altSinir } = hatirlatmaPenceresi(SIMDI);
    assert.ok(bitmis < altSinir, "Bitmiş deneme alt sınırın altında olmalı");
  });

  test("bitişi tam pencerede olan içeride kalır", () => {
    const yarin = new Date(SIMDI + HATIRLATMA_GUNU * GUN).toISOString();
    const { altSinir, ustSinir } = hatirlatmaPenceresi(SIMDI);
    assert.ok(yarin > altSinir && yarin <= ustSinir);
  });
});

describe("deneme bitti bildirimi", () => {
  test("biten ve bildirilmemiş abone seçilir", () => {
    const bitis = new Date(SIMDI - 2 * 60 * 60 * 1000).toISOString();
    assert.deepEqual(bitenler([satir({ user_id: "a", trial_ends_at: bitis })], SIMDI), [{ userId: "a", bitis }]);
  });

  test("henüz bitmemiş, bildirilmiş, eski ya da deneme dışı olan seçilmez", () => {
    const satirlar = [
      satir({ user_id: "bitmedi", trial_ends_at: new Date(SIMDI + 60_000).toISOString() }),
      satir({ user_id: "bildirildi", trial_ends_at: new Date(SIMDI - GUN).toISOString(), deneme_bitti_bildirildi_at: new Date(SIMDI).toISOString() }),
      satir({ user_id: "eski", trial_ends_at: new Date(SIMDI - (BITIS_BILDIRIMI_GUNU + 1) * GUN).toISOString() }),
      satir({ user_id: "odedi", status: "active", trial_ends_at: new Date(SIMDI - GUN).toISOString() }),
    ];
    assert.deepEqual(bitenler(satirlar, SIMDI), []);
  });

  /* Bitiş öncesi hatırlatmanın işareti bitiş bildirimini engellemez: ayrı iki olay. */
  test("hatırlatma almış kişiye de bitiş bildirimi gider", () => {
    const s = satir({ user_id: "a", trial_ends_at: new Date(SIMDI - 60_000).toISOString(), deneme_hatirlatildi_at: new Date(SIMDI - GUN).toISOString() });
    assert.equal(bitenler([s], SIMDI).length, 1);
  });

  test("pencere: son BITIS_BILDIRIMI_GUNU gün", () => {
    const { altSinir, ustSinir } = bitisPenceresi(SIMDI);
    assert.equal(ustSinir, new Date(SIMDI).toISOString());
    assert.equal(altSinir, new Date(SIMDI - BITIS_BILDIRIMI_GUNU * GUN).toISOString());
  });
});
