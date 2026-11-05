import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { describePlan, formatTry, normalizeInterval, normalizePlans, odenebilirPlanlar, planButtonLabel, planKoduKarari, type BillingPlan } from "../../lib/billing-plan";

describe("ArvoOS sözleşmesi", () => {
  /*
    ArvoOS'un gerçek yanıtı (app/api/bridge/subscription/route.ts): plan kodu
    göndermiyor, tutarı "monthlyFee" adıyla ve KURUŞ olarak veriyor
    (aynı değer PayTR'ye "amountKurus" diye gidiyor). Bu test iki deponun
    arasındaki sözleşmeyi sabitliyor — para burada.
  */
  test("gerçek yanıt aylık plana çevriliyor", () => {
    const [plan] = normalizePlans({ status: "trialing", trialEndsAt: null, monthlyFee: 14900 });
    assert.deepEqual(plan, { code: null, interval: "month", price: 14900 });
    assert.equal(describePlan(plan), "Aylık 149,00 ₺");
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

/*
  YANLIŞ TAHSİLAT ÖNLEMİ (05.11.2026). ArvoOS köprüsü bugün yalnızca aylık
  ücreti tahsil ediyor ve checkout'taki plan kodunu okumuyor. Ödeme düğmesi
  yalnızca aylık planlara çıkar; sunucu işlemi yıllık ve bilinmeyen kodu
  reddeder, kodsuz isteği (bugünkü akış) aynen geçirir.
*/
describe("ödenebilir planlar ve plan kodu kararı", () => {
  const aylik: BillingPlan = { code: "arvolab-aylik", interval: "month", price: 29_900 };
  const yillik: BillingPlan = { code: "arvolab-yillik", interval: "year", price: 299_000 };
  const donemsiz: BillingPlan = { code: "arvolab-ozel", interval: null, price: 10_000 };

  test("bugünkü canlı yanıt (yalnızca monthlyFee) tek bir ödenebilir aylık plan üretir", () => {
    const planlar = normalizePlans({ monthlyFee: 29_900 });
    assert.deepEqual(planlar, [{ code: null, interval: "month", price: 29_900 }]);
    assert.deepEqual(odenebilirPlanlar(planlar), planlar);
  });

  test("ödeme düğmesi yalnızca aylık plana çıkar; yıllık ve dönemi bilinmeyen gizlenir", () => {
    assert.deepEqual(odenebilirPlanlar([aylik, yillik, donemsiz]), [aylik]);
    assert.deepEqual(odenebilirPlanlar([yillik]), []);
  });

  test("geçerli aylık plan kodu: izin, kod DEĞİŞMEDEN geri döner", () => {
    assert.deepEqual(planKoduKarari("arvolab-aylik", [aylik, yillik]), { tur: "izin", kod: "arvolab-aylik" });
    assert.deepEqual(planKoduKarari("  arvolab-aylik  ", [aylik]), { tur: "izin", kod: "arvolab-aylik" });
  });

  test("yıllık plan kodu: ret (köprü yıllık tahsil etmiyor)", () => {
    assert.deepEqual(planKoduKarari("arvolab-yillik", [aylik, yillik]), { tur: "red", neden: "desteklenmeyen-donem" });
    assert.deepEqual(planKoduKarari("arvolab-ozel", [donemsiz]), { tur: "red", neden: "desteklenmeyen-donem" });
  });

  test("bilinmeyen plan kodu: ret; plan listesi okunamadıysa (boş) da ret", () => {
    assert.deepEqual(planKoduKarari("uydurma-plan", [aylik, yillik]), { tur: "red", neden: "bilinmeyen-plan" });
    assert.deepEqual(planKoduKarari("arvolab-aylik", []), { tur: "red", neden: "bilinmeyen-plan" });
  });

  test("eksik plan kodu: izin, kod null (bugünkü akış; istekte plan alanı yok)", () => {
    for (const kod of [null, undefined, "", "   "]) {
      assert.deepEqual(planKoduKarari(kod, [aylik, yillik]), { tur: "izin", kod: null });
    }
  });

  test("sunucu işlemi kararı köprü çağrısından ÖNCE uygular ve köprüye giden istek biçimi değişmedi", () => {
    const islem = fs.readFileSync("app/actions/subscription.ts", "utf8");
    const govde = islem.slice(islem.indexOf("export async function payArvolabSubscription"), islem.indexOf("export async function krediSatinAl"));
    assert.ok(govde.indexOf("planKoduKarari(") > 0 && govde.indexOf("planKoduKarari(") < govde.indexOf("startSubscriptionCheckout("));
    assert.match(govde, /if \(karar\.tur === "red"\) redirect\(/);
    assert.match(govde, /startSubscriptionCheckout\(\{ id: user\.id, email: user\.email, fullName: profile\?\.full_name \}, planCode\)/);
    // Köprü çağrısı: plan alanı yalnızca kod varken eklenir (05.11.2026 öncesiyle aynı).
    assert.ok(fs.readFileSync("lib/subscription.ts", "utf8").includes("...(planCode ? { plan: planCode } : {})"));
  });
});
