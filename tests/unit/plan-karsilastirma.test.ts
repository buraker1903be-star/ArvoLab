import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { BillingPlan } from "@/lib/billing-plan";
import type { KrediPaketi } from "@/lib/kredi-paketleri";
import {
  donemler,
  donemPlanlari,
  enYuksekPaket,
  karsilastirmaHazir,
  katalogEksikleri,
  planSatirlari,
  yuzKrediFiyati,
} from "@/lib/plan-karsilastirma";

const plan = (p: Partial<BillingPlan>): BillingPlan => ({
  code: null,
  interval: null,
  price: null,
  ad: null,
  kredi: null,
  ...p,
});
const paket = (kod: string, kredi: number, fiyat: number): KrediPaketi => ({ kod, ad: `${kredi} kredi`, kredi, fiyat });

describe("planSatirlari: mevcut plan yalnızca KODLA işaretlenir", () => {
  const planlar = [
    plan({ code: "standart", interval: "month", price: 14900, ad: "Standart", kredi: 1000 }),
    plan({ code: "plus", interval: "month", price: 24900, ad: "Plus", kredi: 2500 }),
  ];

  test("kullanıcının planı işaretlenir", () => {
    const satirlar = planSatirlari(planlar, "plus");
    assert.deepEqual(satirlar.map((s) => s.mevcut), [false, true]);
    assert.equal(satirlar[1].ad, "Plus");
    assert.equal(satirlar[1].kredi, 2500);
  });

  test("kod bilinmiyorsa HİÇBİRİ işaretlenmez", () => {
    /* Yanlış planı "Mevcut plan" diye işaretlemek, kullanıcıya ödemediği
       bir planı ödüyormuş gibi göstermekti. */
    assert.deepEqual(planSatirlari(planlar, null).map((s) => s.mevcut), [false, false]);
    assert.deepEqual(planSatirlari(planlar, "bilinmeyen").map((s) => s.mevcut), [false, false]);
  });

  test("katalog ad ve kredi vermiyorsa null kalır, uydurulmaz", () => {
    const [satir] = planSatirlari([plan({ code: "a", interval: "month", price: 100 })], "a");
    assert.equal(satir.ad, null);
    assert.equal(satir.kredi, null);
    assert.equal(satir.mevcut, true);
  });
});

describe("donemler ve donemPlanlari", () => {
  test("katalogdaki dönemler sabit sırayla", () => {
    const planlar = [plan({ interval: "year" }), plan({ interval: "month" })];
    assert.deepEqual(donemler(planlar), ["month", "year"]);
  });

  test("tek dönem varsa tek döner (seçici çizilmez)", () => {
    assert.deepEqual(donemler([plan({ interval: "month" }), plan({ interval: "month" })]), ["month"]);
    assert.deepEqual(donemler([plan({ interval: null })]), []);
  });

  test("dönemi bilinmeyen plan her dönemde görünür", () => {
    const planlar = [plan({ code: "a", interval: "month" }), plan({ code: "b", interval: "year" }), plan({ code: "c", interval: null })];
    assert.deepEqual(donemPlanlari(planlar, "month").map((p) => p.code), ["a", "c"]);
    assert.deepEqual(donemPlanlari(planlar, "year").map((p) => p.code), ["b", "c"]);
    assert.deepEqual(donemPlanlari(planlar, null).map((p) => p.code), ["a", "b", "c"]);
  });
});

describe("yuzKrediFiyati", () => {
  test("100 kredi başına kuruş", () => {
    assert.equal(yuzKrediFiyati(paket("a", 250, 12500)), 5000);
    assert.equal(yuzKrediFiyati(paket("b", 1000, 40000)), 4000);
  });
  test("yuvarlama tamsayıya", () => {
    assert.equal(yuzKrediFiyati(paket("c", 300, 10000)), 3333);
  });
});

describe("enYuksekPaket", () => {
  test("en çok kredi taşıyan paket", () => {
    assert.equal(enYuksekPaket([paket("a", 250, 12500), paket("b", 1000, 40000), paket("c", 500, 22500)]), "b");
  });
  test("boş listede null", () => {
    assert.equal(enYuksekPaket([]), null);
  });
});

describe("katalogEksikleri: ekranın '—' yazdığı yerler", () => {
  test("plan hiç yoksa", () => {
    assert.deepEqual(katalogEksikleri([]), { planYok: true, adYok: false, krediYok: false, fiyatYok: false });
  });

  test("ad ve kredi gelmiyorsa işaretlenir", () => {
    const eksik = katalogEksikleri([plan({ code: "a", interval: "month", price: 14900 })]);
    assert.equal(eksik.adYok, true);
    assert.equal(eksik.krediYok, true);
    assert.equal(eksik.fiyatYok, false);
    assert.equal(eksik.planYok, false);
  });

  test("biri bile ad taşıyorsa eksik sayılmaz", () => {
    const eksik = katalogEksikleri([plan({ code: "a", ad: "Standart" }), plan({ code: "b" })]);
    assert.equal(eksik.adYok, false);
  });

  test("fiyatı olmayan katalog işaretlenir", () => {
    assert.equal(katalogEksikleri([plan({ code: "a", interval: "month" })]).fiyatYok, true);
  });
});

describe("karsilastirmaHazir: pencere ancak katalog doluysa açılır", () => {
  test("iki adlı, fiyatlı ve kodlu plan → hazır", () => {
    assert.equal(
      karsilastirmaHazir([
        plan({ code: "standart", ad: "Standart", price: 14900, interval: "month" }),
        plan({ code: "plus", ad: "Plus", price: 24900, interval: "month" }),
      ]),
      true,
    );
  });

  test("ADSIZ plan listesi hazır DEĞİL (bugünkü ArvoOS)", () => {
    /* Adsız sütunlarla karşılaştırma çizmek, müşteriye var olmayan bir
       plan seçimi sunmaktı: hangi planda olduğunu ve neyi kapsadığını
       bilemezdi. */
    assert.equal(
      karsilastirmaHazir([
        plan({ code: "aylik", price: 14900, interval: "month" }),
        plan({ code: "yillik", price: 149000, interval: "year" }),
      ]),
      false,
    );
  });

  test("tek plan hazır değil, fiyatsız plan sayılmaz", () => {
    assert.equal(karsilastirmaHazir([plan({ code: "a", ad: "Standart", price: 14900 })]), false);
    assert.equal(
      karsilastirmaHazir([plan({ code: "a", ad: "Standart" }), plan({ code: "b", ad: "Plus" })]),
      false,
    );
  });

  test("aynı kod iki kez sayılmaz", () => {
    assert.equal(
      karsilastirmaHazir([
        plan({ code: "a", ad: "Standart", price: 14900, interval: "month" }),
        plan({ code: "a", ad: "Standart", price: 149000, interval: "year" }),
      ]),
      false,
    );
  });

  test("boş katalog hazır değil", () => {
    assert.equal(karsilastirmaHazir([]), false);
  });
});
