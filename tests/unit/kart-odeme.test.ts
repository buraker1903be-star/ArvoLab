import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  istemciIpsi,
  kartDurumuOku,
  kartHataAnahtari,
  KART_HATALARI,
  kartNumarasiTemizle,
  kartOdemesiOku,
  odemeDonusuDurumu,
  sonKullanmaYillari,
} from "@/lib/kart-odeme";
import { kartOturumuOku, kartOturumuYaz } from "@/lib/kart-oturumu";

const ODEME = {
  paymentUrl: "https://www.paytr.com/odeme",
  merchantOid: "ARV123abc",
  amount: 34900,
  title: "ArvoLab aboneliği",
  fields: { merchant_id: "1", merchant_oid: "ARV123abc", paytr_token: "imza", user_phone: "05550000000", taksit: 0, "kötü ad": "x" },
  utoken: null,
  consentText: "Kartınız PayTR'de saklanır.",
};

describe("kart ödemesi yanıtı", () => {
  test("geçerli yanıt okunur; sayı alanlar metne çevrilir, tanınmayan alan adı atılır", () => {
    const o = kartOdemesiOku(ODEME)!;
    assert.equal(o.merchantOid, "ARV123abc");
    assert.equal(o.fields.taksit, "0");
    assert.equal(o.fields["kötü ad"], undefined);
    assert.equal(o.utoken, null);
  });

  test("https olmayan adres, geçersiz sipariş no ya da tutar: hiç okunmaz", () => {
    assert.equal(kartOdemesiOku({ ...ODEME, paymentUrl: "http://www.paytr.com/odeme" }), null);
    assert.equal(kartOdemesiOku({ ...ODEME, paymentUrl: "javascript:alert(1)" }), null);
    assert.equal(kartOdemesiOku({ ...ODEME, merchantOid: "ARV-1/../x" }), null);
    assert.equal(kartOdemesiOku({ ...ODEME, amount: 0 }), null);
    assert.equal(kartOdemesiOku({ ...ODEME, amount: 12.5 }), null);
    assert.equal(kartOdemesiOku({ ...ODEME, fields: null }), null);
    assert.equal(kartOdemesiOku(null), null);
  });

  /* Onay adresteki numaraya yazılıyor; PayTR'ye başka numara giderse karar başka ödemeye düşerdi. */
  test("formdaki sipariş numarası yanıttakinden farklıysa reddedilir", () => {
    assert.equal(kartOdemesiOku({ ...ODEME, fields: { ...ODEME.fields, merchant_oid: "BASKA" } }), null);
  });
});

describe("kart durumu", () => {
  test("okunamayan kart satırı atılır, onay ayrıntısı eksikse otomatik yenileme gösterilmez", () => {
    const d = kartDurumuOku({
      cards: [
        { id: "k1", last4: "4242", bank: "X Bank", scheme: "VISA", expMonth: "1", expYear: "29" },
        { id: "k2", last4: "42" },
        { id: "k 3", last4: "1111" },
        null,
      ],
      autoRenew: { active: true, cardId: "k1", lastError: null, consentAt: "2026-10-28T10:00:00Z" },
    })!;
    assert.deepEqual(d.cards.map((k) => k.id), ["k1"]);
    assert.equal(d.autoRenew?.active, true);
    assert.equal(kartDurumuOku({ cards: [], autoRenew: { active: true } })?.autoRenew, null);
  });

  /* "Kayıtlı kartınız yok" ile "okunamadı" ayrı: liste yoksa null. */
  test("kart listesi yoksa null, boş liste değil", () => {
    assert.equal(kartDurumuOku({ autoRenew: null }), null);
    assert.equal(kartDurumuOku(null), null);
    assert.deepEqual(kartDurumuOku({ cards: [], autoRenew: null }), { cards: [], autoRenew: null });
  });
});

describe("yardımcılar", () => {
  test("IP: x-forwarded-for'un ilk değeri, yoksa x-real-ip; uzun ya da biçimsiz değer atılır", () => {
    assert.equal(istemciIpsi("85.1.2.3, 10.0.0.1", "9.9.9.9"), "85.1.2.3");
    assert.equal(istemciIpsi(null, " 2001:db8::1 "), "2001:db8::1");
    assert.equal(istemciIpsi("bilinmiyor", null), null);
    assert.equal(istemciIpsi("1".repeat(40), null), null);
    assert.equal(istemciIpsi(null, null), null);
  });

  test("son kullanma yılı iki haneli, 12 yıl; yüzyıl dönümünde sıfırla başlar", () => {
    const yillar = sonKullanmaYillari(2026);
    assert.equal(yillar.length, 12);
    assert.equal(yillar[0], "26");
    assert.equal(yillar[11], "37");
    assert.deepEqual(sonKullanmaYillari(2099).slice(0, 2), ["99", "00"]);
  });

  test("kart numarasındaki boşluklar silinir", () => {
    assert.equal(kartNumarasiTemizle("4242 4242 4242 4242"), "4242424242424242");
  });

  test("hata kodu bilinen bir anahtara iner; bilinmeyen kod genel uyarıya", () => {
    for (const kod of ["fee_not_set", "organization_license", "invalid_email", "invalid_ip", "card_storage_disabled", "payments_unavailable", null, "<script>"]) {
      assert.ok(KART_HATALARI[kartHataAnahtari(kod)], String(kod));
    }
    assert.equal(kartHataAnahtari("payments_unavailable"), "kart");
  });

  test("ödeme dönüşünde yalnızca 'tamam' başarı sayılır", () => {
    assert.equal(odemeDonusuDurumu("tamam"), "tamam");
    assert.equal(odemeDonusuDurumu("hata"), "hata");
    assert.equal(odemeDonusuDurumu("Kartınız reddedildi"), "hata");
    assert.equal(odemeDonusuDurumu(null), "hata");
  });
});

describe("ödeme oturumu çerezi", () => {
  const odeme = kartOdemesiOku(ODEME)!;
  test("aynı kullanıcı ve sipariş numarasıyla geri okunur", () => {
    const deger = kartOturumuYaz("u1", odeme);
    assert.deepEqual(kartOturumuOku(deger, "ARV123abc", "u1"), odeme);
  });

  /* Ortak bilgisayarda başkasının açtığı ödeme sayfası gösterilmemeli. */
  test("başka kullanıcı, başka sipariş ya da bozuk değer: null", () => {
    const deger = kartOturumuYaz("u1", odeme);
    assert.equal(kartOturumuOku(deger, "ARV123abc", "u2"), null);
    assert.equal(kartOturumuOku(deger, "BASKA", "u1"), null);
    assert.equal(kartOturumuOku("bozuk!!", "ARV123abc", "u1"), null);
    assert.equal(kartOturumuOku(undefined, "ARV123abc", "u1"), null);
  });
});
