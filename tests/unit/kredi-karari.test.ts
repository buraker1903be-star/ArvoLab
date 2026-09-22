import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { krediKarari, krediye, UYARI_ORANI } from "@/lib/ai/kredi-karari";

const durum = (ekle: Partial<Parameters<typeof krediKarari>[0]> = {}) =>
  krediKarari({ kullanilanKarakter: 0, limitKredi: 100, aylikKalan: 100, ekBakiye: 0, bildirildi: true, icEkip: false, ...ekle });

describe("kredi kararı", () => {
  test("limitin altında engel de uyarı da yok", () => {
    const karar = durum({ kullanilanKarakter: 10_000 });
    assert.equal(karar.engel, null);
    assert.equal(karar.uyari, null);
    assert.equal(karar.kullanilanKredi, 10);
    assert.equal(karar.oran, 10);
  });

  test("%80'de uyarı çıkar ama çalışma sürer", () => {
    // Tek eşikle kullanıcı hiçbir uyarı almadan işin ortasında duvara
    // çarpıyordu; kurum da haberi ilk kez şikâyetle alıyordu.
    const karar = durum({ kullanilanKarakter: UYARI_ORANI * 1000, aylikKalan: 20 });
    assert.equal(karar.engel, null);
    assert.match(karar.uyari ?? "", /%80/);
  });

  test("hak dolunca engellenir", () => {
    const karar = durum({ kullanilanKarakter: 100_000, aylikKalan: 0 });
    assert.match(karar.engel ?? "", /bitti/);
  });

  test("satın alınmış bakiyesi olan engellenmez", () => {
    /*
      Karar KALANA bakıyor, tüketime değil: yalnızca "tüketim > limit"
      deseydik, ek kredi almış müşteri parasını ödediği halde kapıda
      durdurulurdu.
    */
    const karar = durum({ kullanilanKarakter: 100_000, aylikKalan: 0, ekBakiye: 50 });
    assert.equal(karar.engel, null);
    // "Krediniz bitmek üzere" de denmiyor: bitmiyor, parayla aldığı
    // kısma geçiyor.
    assert.equal(karar.uyari, null);
  });

  test("başlanan dilim tam kredi sayılır", () => {
    // 1 karakterlik çalışma da bir dilim açıyor; maliyeti sıfır değil.
    assert.equal(krediye(1), 1);
    assert.equal(krediye(1000), 1);
    assert.equal(krediye(1001), 2);
    assert.equal(krediye(0), 0);
  });

  test("limit bildirilmemişse kimse engellenmez", () => {
    /*
      Sütun yeni; yansıtma başlamadan önce her kurum "0 kredi" görünürdü.
      Bu bir cevap değil, cevabın henüz gelmemiş olması.
    */
    assert.equal(durum({ kullanilanKarakter: 9_999_999, limitKredi: null, aylikKalan: 0 }).engel, null);
    assert.equal(durum({ kullanilanKarakter: 9_999_999, bildirildi: false, aylikKalan: 0 }).engel, null);
  });

  test("limit 0 net bir hayırdır, bildirilmemişle karıştırılmaz", () => {
    // Biri "hak tanımlanmadı", diğeri "hak yok".
    assert.match(durum({ limitKredi: 0, aylikKalan: 0 }).engel ?? "", /tanımlı değil/);
  });

  test("iç ekip hiçbir koşulda engellenmez", () => {
    // Ürünü denerken kendi kotamıza takılmak, ürünü denememek demek.
    const karar = durum({ kullanilanKarakter: 9_999_999, aylikKalan: 0, icEkip: true });
    assert.equal(karar.engel, null);
    assert.equal(karar.uyari, null);
  });
});
