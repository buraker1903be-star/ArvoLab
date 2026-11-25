import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { BillingPlan } from "@/lib/billing-plan";
import { planKartlari, satisHazir, SATIS_METINLERI } from "@/lib/plan-satis";

const plan = (p: Partial<BillingPlan>): BillingPlan =>
  ({ code: null, interval: null, price: null, ad: null, kredi: null, avantajlar: [], ...p });

const TAM = [
  plan({ code: "standart-ay", ad: "Standart", interval: "month", price: 14900, kredi: 1000, avantajlar: ["1 çalışma"] }),
  plan({ code: "plus-ay", ad: "Plus", interval: "month", price: 24900, kredi: 2500, avantajlar: ["5 çalışma", "Literatür taraması"] }),
  plan({ code: "pro-ay", ad: "Pro", interval: "month", price: 39900, kredi: 6000, avantajlar: ["Sınırsız çalışma", "Öncelikli destek"] }),
];

describe("planKartlari", () => {
  test("tam katalogda üç kart, krediye göre artan", () => {
    const k = planKartlari(TAM);
    assert.deepEqual(k.map((x) => x.ad), ["Standart", "Plus", "Pro"]);
    assert.deepEqual(k.map((x) => x.kredi), [1000, 2500, 6000]);
    assert.equal(k[2].kod, "pro-ay");
    assert.deepEqual(k[1].avantajlar, ["5 çalışma", "Literatür taraması"]);
  });

  test("katalog sırası ne olursa olsun kartlar artan sırada", () => {
    const k = planKartlari([TAM[2], TAM[0], TAM[1]]);
    assert.deepEqual(k.map((x) => x.ad), ["Standart", "Plus", "Pro"]);
  });

  test("satış metni ve düğme plan adından eşleşiyor", () => {
    const k = planKartlari(TAM);
    assert.equal(k[0].metin.tr, SATIS_METINLERI.standart.metin.tr);
    assert.equal(k[2].dugme.tr, "Pro'yu seç");
  });
});

describe("planKartlari: eksik katalogda bölüm AÇILMAZ", () => {
  /* Fiyatı ya da kapsamı bilinmeyen bir plana "seç" dedirtmek,
     müşteriye ne aldığını söylememek olurdu. */
  const eksikOlan = (degis: Partial<BillingPlan>) => [TAM[0], TAM[1], plan({ ...TAM[2], ...degis })];

  test("plan adı yoksa", () => assert.deepEqual(planKartlari(eksikOlan({ ad: null })), []));
  test("fiyat yoksa", () => assert.deepEqual(planKartlari(eksikOlan({ price: null })), []));
  test("dönem yoksa", () => assert.deepEqual(planKartlari(eksikOlan({ interval: null })), []));
  test("dahil kredi yoksa", () => assert.deepEqual(planKartlari(eksikOlan({ kredi: null })), []));
  test("avantaj listesi boşsa", () => assert.deepEqual(planKartlari(eksikOlan({ avantajlar: [] })), []));
  test("kod yoksa", () => assert.deepEqual(planKartlari(eksikOlan({ code: null })), []));

  test("üçten az plan", () => {
    assert.deepEqual(planKartlari([TAM[0], TAM[1]]), []);
    assert.deepEqual(planKartlari([]), []);
  });

  test("tanımadığımız ad: kendi cümlemizi iliştirmiyoruz", () => {
    const yabanci = [TAM[0], TAM[1], plan({ ...TAM[2], ad: "Enterprise" })];
    assert.deepEqual(planKartlari(yabanci), []);
  });

  test("aynı kod iki kez sayılmaz", () => {
    const tekrar = [TAM[0], TAM[1], plan({ ...TAM[1], ad: "Pro" })];
    assert.deepEqual(planKartlari(tekrar), []);
  });

  test("bugünkü ArvoOS (adsız, kredisiz, avantajsız) kapalı", () => {
    const bugun = [
      plan({ code: "arvolab-aylik", interval: "month", price: 14900 }),
      plan({ code: "arvolab-yillik", interval: "year", price: 149000 }),
    ];
    assert.equal(satisHazir(bugun), false);
  });

  test("satisHazir tam katalogda açık", () => assert.equal(satisHazir(TAM), true));
});

describe("planKartlari: kademe başına tek kart", () => {
  /* Katalog her kademenin aylık ve yıllık sürümünü ayrı plan olarak
     bildiriyor; üç kartlı ekranda kademe başına bir tane olmalı. */
  const IKI_DONEM = [
    ...TAM,
    plan({ code: "standart-yil", ad: "Standart", interval: "year", price: 149000, kredi: 1000, avantajlar: ["1 çalışma"] }),
    plan({ code: "pro-yil", ad: "Pro", interval: "year", price: 399000, kredi: 6000, avantajlar: ["Sınırsız çalışma"] }),
  ];

  test("beş plan, üç kart", () => {
    const k = planKartlari(IKI_DONEM);
    assert.equal(k.length, 3);
    assert.deepEqual(k.map((x) => x.ad), ["Standart", "Plus", "Pro"]);
  });

  test("aylık yeğleniyor", () => {
    const k = planKartlari(IKI_DONEM);
    assert.deepEqual(k.map((x) => x.donem), ["month", "month", "month"]);
    assert.deepEqual(k.map((x) => x.kod), ["standart-ay", "plus-ay", "pro-ay"]);
  });

  test("katalog önce yıllığı verse de aylık seçilir", () => {
    const k = planKartlari([IKI_DONEM[3], IKI_DONEM[4], TAM[0], TAM[1], TAM[2]]);
    assert.deepEqual(k.map((x) => x.kod), ["standart-ay", "plus-ay", "pro-ay"]);
  });

  test("aylığı olmayan kademede yıllık alınır", () => {
    const yalnizYillik = [TAM[0], TAM[1], plan({ code: "pro-yil", ad: "Pro", interval: "year", price: 399000, kredi: 6000, avantajlar: ["Sınırsız"] })];
    const k = planKartlari(yalnizYillik);
    assert.equal(k.length, 3);
    assert.equal(k[2].donem, "year");
  });

  test("iki kademe varsa bölüm açılmaz", () => {
    assert.deepEqual(planKartlari([TAM[0], TAM[1], IKI_DONEM[3]]), []);
  });
});
