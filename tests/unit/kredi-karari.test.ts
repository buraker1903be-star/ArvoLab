import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { krediKarari, krediye, KREDI_SAYFASI, UYARI_ORANI } from "@/lib/ai/kredi-karari";

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

  test("aylık hakkı 0 olan kurum satın aldığı krediyi kullanabilir", () => {
    // Eskiden limit 0 dalı bakiyeye hiç bakmıyordu: kredi alan kurum
    // "AI kredisi tanımlı değil" ile durduruluyordu.
    assert.equal(durum({ limitKredi: 0, aylikKalan: 0, ekBakiye: 500 }).engel, null);
  });

  test("iç ekip hiçbir koşulda engellenmez", () => {
    // Ürünü denerken kendi kotamıza takılmak, ürünü denememek demek.
    const karar = durum({ kullanilanKarakter: 9_999_999, aylikKalan: 0, icEkip: true });
    assert.equal(karar.engel, null);
    assert.equal(karar.uyari, null);
  });

  /*
    Adres mesajdan düşerse kullanıcı nereye gideceğini bilemez; mesajların
    hepsinde bulunduğu sabitleniyor. 28.10.2026'dan beri kurum da krediyi
    ArvoLab'ın Abonelik ve kredi sayfasından alıyor: mesaj ArvoOS
    paneline göndermemeli (eskiden app.arvo-os.com/panel/billing yazıyordu).
  */
  test("engel ve uyarı satın alma sayfasını taşır, ArvoOS paneline göndermez", () => {
    const engel = durum({ limitKredi: 10, aylikKalan: 0, ekBakiye: 0, kullanilanKarakter: 10_000 });
    assert.ok(engel.engel?.endsWith(KREDI_SAYFASI));
    const uyari = durum({ limitKredi: 10, aylikKalan: 2, ekBakiye: 0, kullanilanKarakter: 8_000 });
    assert.ok(uyari.uyari?.endsWith(KREDI_SAYFASI));
    const hakYok = durum({ limitKredi: 0 });
    assert.ok(hakYok.engel?.endsWith(KREDI_SAYFASI));
    for (const metin of [engel.engel, uyari.uyari, hakYok.engel]) {
      assert.doesNotMatch(metin ?? "", /ArvoOS|arvo-os\.com/);
    }
  });
});

describe("bireysel abone", () => {
  test("kredisi bitince kendi sayfasına yönlendirilir, kurum paneline değil", () => {
    // Bireysel abonenin girebileceği bir ArvoOS paneli yok.
    const karar = durum({ bireysel: true, limitKredi: 1000, kullanilanKarakter: 1_000_000, aylikKalan: 0 });
    assert.match(karar.engel ?? "", /AI krediniz bitti/);
    assert.ok(karar.engel?.includes(KREDI_SAYFASI));
    assert.doesNotMatch(karar.engel ?? "", /ArvoOS|arvo-os\.com/);
    assert.ok(!/[Kk]urum/.test(karar.engel ?? ""));
  });

  test("%80 uyarısı da kendi sayfasını söyler", () => {
    const karar = durum({ bireysel: true, limitKredi: 1000, kullanilanKarakter: 850_000, aylikKalan: 150 });
    assert.equal(karar.engel, null);
    assert.match(karar.uyari ?? "", /Aylık AI kredinizin %85/);
    assert.ok(karar.uyari?.includes(KREDI_SAYFASI));
  });

  test("satın aldığı bakiye varken durdurulmaz", () => {
    const karar = durum({ bireysel: true, limitKredi: 1000, kullanilanKarakter: 1_000_000, aylikKalan: 0, ekBakiye: 200 });
    assert.equal(karar.engel, null);
  });
});

describe("İngilizce", () => {
  test("bireysel abonede kredi bitti mesajı", () => {
    const karar = krediKarari(
      { kullanilanKarakter: 200_000, limitKredi: 100, aylikKalan: 0, ekBakiye: 0, bildirildi: true, icEkip: false, bireysel: true },
      "en",
    );
    assert.equal(karar.engel, "You're out of AI credits. Your monthly allowance renews at the start of the month; if you don't want to wait, you can buy extra credits on the Subscription and credits page: " + KREDI_SAYFASI);
  });

  test("uyarı İngilizce sayı biçimiyle", () => {
    const karar = krediKarari(
      { kullanilanKarakter: 1_700_000, limitKredi: 2000, aylikKalan: 300, ekBakiye: 0, bildirildi: true, icEkip: false },
      "en",
    );
    assert.match(karar.uyari ?? "", /^85% of your institution's AI credits have been used \(1,700\/2,000\)/);
    assert.ok(karar.uyari?.endsWith(KREDI_SAYFASI));
  });
});
