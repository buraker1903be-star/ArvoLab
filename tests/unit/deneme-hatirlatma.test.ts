import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
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
  trial_ends_at: new Date(SIMDI + 2 * GUN).toISOString(),
  deneme_hatirlatildi_at: null,
  ...ek,
});

describe("deneme hatırlatması", () => {
  test("eşik içindeki abone seçilir, kalan gün yukarı yuvarlanır", () => {
    const sonuc = hatirlatilacaklar([satir({ user_id: "a", trial_ends_at: new Date(SIMDI + 1.2 * GUN).toISOString() })], SIMDI);
    assert.deepEqual(sonuc, [{ userId: "a", kalanGun: 2 }]);
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
      satir({ user_id: `k${i}`, trial_ends_at: new Date(SIMDI + (0.1 + i * 0.01) * GUN).toISOString() }));
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
    const yarin = new Date(SIMDI + 1 * GUN).toISOString();
    const { altSinir, ustSinir } = hatirlatmaPenceresi(SIMDI);
    assert.ok(yarin > altSinir && yarin <= ustSinir);
  });
});
