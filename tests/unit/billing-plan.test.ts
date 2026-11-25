import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { describePlan, formatTry, normalizeInterval, normalizePlans, planButtonLabel } from "../../lib/billing-plan";

describe("ArvoOS sözleşmesi", () => {
  /*
    ArvoOS'un gerçek yanıtı (app/api/bridge/subscription/route.ts): plan kodu
    göndermiyor, tutarı "monthlyFee" adıyla ve KURUŞ olarak veriyor
    (aynı değer PayTR'ye "amountKurus" diye gidiyor). Bu test iki deponun
    arasındaki sözleşmeyi sabitliyor — para burada.
  */
  test("gerçek yanıt aylık plana çevriliyor", () => {
    const [plan] = normalizePlans({ status: "trialing", trialEndsAt: null, monthlyFee: 14900 });
    /* ad ve kredi 24.11.2026'da, avantajlar 25.11.2026'da eklendi:
       ArvoOS göndermiyorsa NULL / boş dizi. Uydurma bir plan adı,
       kredi miktarı ya da avantaj yok. */
    assert.deepEqual(plan, { code: null, interval: "month", price: 14900, ad: null, kredi: null, avantajlar: [] });
    assert.equal(describePlan(plan), "Aylık 149,00 ₺");
  });

  test("plan adı ve dahil kredi KATALOGDAN okunuyor, uydurulmuyor", () => {
    const [zengin] = normalizePlans({ plans: [{ code: "pro", price: 29900, interval: "month", ad: "Pro", kredi: 5000 }] });
    assert.equal(zengin.ad, "Pro");
    assert.equal(zengin.kredi, 5000);
    /* İngilizce alan adları da okunuyor (köprü sürümleri ayrışabiliyor). */
    const [ing] = normalizePlans({ plans: [{ code: "plus", price: 19900, name: "Plus", monthlyCredits: "2500" }] });
    assert.equal(ing.ad, "Plus");
    assert.equal(ing.kredi, 2500);
    /* Boş ad ve sıfır/negatif kredi YOK sayılıyor: "" bir ad değil. */
    const [bos] = normalizePlans({ plans: [{ code: "x", price: 100, ad: "   ", kredi: 0 }] });
    assert.equal(bos.ad, null);
    assert.equal(bos.kredi, null);
  });

  test("ücret tanımsızsa plan gösterilmiyor", () => {
    assert.deepEqual(normalizePlans({ status: "active", monthlyFee: null }), []);
  });

  /*
    ArvoOS'ta ücret `numeric` sütunda; PostgREST numeric'i metin döndürüyor ve
    ArvoOS kendi kodunda Number() ile çeviriyor. O çevrim atlanırsa ArvoLab
    sessizce FİYATSIZ bir "Abone ol" düğmesi gösteriyordu.
  */
  test("metin olarak gelen tutar okunuyor", () => {
    assert.equal(normalizePlans({ monthlyFee: "14900" })[0].price, 14900);
    assert.equal(normalizePlans({ plans: [{ code: "a", price: "1490,50" }] })[0].price, 1491);
  });

  test("sayı olmayan tutar fiyat sayılmıyor", () => {
    // "149 TL" birimi belirsiz; fiyat diye göstermek yanlış tutar göstermektir.
    assert.equal(normalizePlans({ plans: [{ code: "a", price: "149 TL" }] })[0].price, null);
  });

  /* ArvoOS sıfır ücreti "tanımlanmamış" sayıyor (checkout 409 fee_not_set). */
  test("sıfır ücret plan fiyatı sayılmıyor", () => {
    assert.equal(normalizePlans({ plans: [{ code: "bedava", price: 0 }] })[0].price, null);
  });
});

describe("kullanılamaz plan gösterilmiyor", () => {
  /*
    Eskiden planCode kırpılmıyordu: { planCode: "" } geçerli plan sayılıyor ve
    müşteriye fiyatsız, dönemsiz, hiçbir şey söylemeyen bir "Abone ol" düğmesi
    çıkıyordu.
  */
  test("boş plan kodu plan saymıyor", () => {
    assert.deepEqual(normalizePlans({ plans: [{ planCode: "" }] }), []);
    assert.deepEqual(normalizePlans({ plans: [{ planCode: "   " }] }), []);
  });

  test("hiçbir alanı olmayan nesne elenir", () => {
    assert.deepEqual(normalizePlans({ plans: [{}, {}] }), []);
  });

  test("kod kırpılıyor", () => {
    assert.equal(normalizePlans({ plans: [{ planCode: "  yillik  ", price: 100 }] })[0].code, "yillik");
  });
});

describe("dönem adları", () => {
  test("Türkçe ve İngilizce yazımlar", () => {
    for (const ay of ["month", "monthly", "Aylık", "AYLIK", "ay"]) assert.equal(normalizeInterval(ay), "month");
    for (const yil of ["year", "yearly", "annual", "Yıllık", "YIL"]) assert.equal(normalizeInterval(yil), "year");
  });

  test("tanınmayan dönem null", () => {
    assert.equal(normalizeInterval("haftalık"), null);
    assert.equal(normalizeInterval(12), null);
  });
});

describe("gösterim", () => {
  test("tutar Türkçe yazımla ve simge sonda", () => {
    assert.equal(formatTry(149000), "1.490,00 ₺");
  });

  test("yıllık planda aylık karşılığı da yazılıyor", () => {
    assert.equal(
      describePlan({ code: "y", interval: "year", price: 149000 }),
      "Yıllık 1.490,00 ₺ · ayda 124,17 ₺",
    );
  });

  test("fiyat bilinmiyorsa uydurulmuyor", () => {
    assert.equal(describePlan({ code: "y", interval: "year", price: null }), "Yıllık");
    assert.equal(planButtonLabel({ code: "y", interval: "year", price: null }), "Yıllık abone ol");
  });
});
