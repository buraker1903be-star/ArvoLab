import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { BillingPlan } from "@/lib/billing-plan";
import { uyelikTipi } from "@/lib/uyelik-tipi";

const plan = (p: Partial<BillingPlan>): BillingPlan => ({ code: null, interval: null, price: null, ad: null, kredi: null, ...p });
const KATALOG = [
  plan({ code: "standart-ay", ad: "Standart", interval: "month", price: 14900 }),
  plan({ code: "pro-ay", ad: "Pro", interval: "month", price: 39900 }),
];

describe("uyelikTipi", () => {
  test("kod ve ad varsa planın adı", () => {
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "pro-ay" }), "Pro");
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "standart-ay" }), "Standart");
  });

  test("PLAN KODU yoksa null (bugünkü ArvoOS)", () => {
    /* Kod bilinmeden hangi planda olunduğu söylenemez; satır çizilmez. */
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: null }), null);
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "" }), null);
  });

  test("katalog AD bildirmiyorsa null", () => {
    const adsiz = [plan({ code: "arvolab-aylik", interval: "month", price: 14900 })];
    assert.equal(uyelikTipi({ plans: adsiz, planKodu: "arvolab-aylik" }), null);
  });

  test("kod katalogda yoksa ad UYDURULMAZ", () => {
    /* Katalogda olmayan bir koda ad vermek, kullanıcıya ödemediği bir
       planı göstermek olurdu. */
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "bilinmeyen" }), null);
  });

  test("boş katalog ve boşluktan ibaret ad", () => {
    assert.equal(uyelikTipi({ plans: [], planKodu: "pro-ay" }), null);
    assert.equal(uyelikTipi({ plans: [plan({ code: "a", ad: "   " })], planKodu: "a" }), null);
  });

  test("ad kırpılıyor", () => {
    assert.equal(uyelikTipi({ plans: [plan({ code: "a", ad: "  Plus " })], planKodu: "a" }), "Plus");
  });
});
