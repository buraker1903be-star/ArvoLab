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
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "pro-ay", durum: "active" }), "Pro");
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "standart-ay", durum: "active" }), "Standart");
  });

  test("PLAN KODU yoksa null (bugünkü ArvoOS)", () => {
    /* Kod bilinmeden hangi planda olunduğu söylenemez; satır çizilmez. */
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: null, durum: "active" }), null);
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "", durum: "active" }), null);
  });

  test("katalog AD bildirmiyorsa null", () => {
    const adsiz = [plan({ code: "arvolab-aylik", interval: "month", price: 14900 })];
    assert.equal(uyelikTipi({ plans: adsiz, planKodu: "arvolab-aylik", durum: "active" }), null);
  });

  test("kod katalogda yoksa ad UYDURULMAZ", () => {
    /* Katalogda olmayan bir koda ad vermek, kullanıcıya ödemediği bir
       planı göstermek olurdu. */
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "bilinmeyen", durum: "active" }), null);
  });

  test("boş katalog ve boşluktan ibaret ad", () => {
    assert.equal(uyelikTipi({ plans: [], planKodu: "pro-ay", durum: "active" }), null);
    assert.equal(uyelikTipi({ plans: [plan({ code: "a", ad: "   " })], planKodu: "a", durum: "active" }), null);
  });

  test("ad kırpılıyor", () => {
    assert.equal(uyelikTipi({ plans: [plan({ code: "a", ad: "  Plus " })], planKodu: "a", durum: "active" }), "Plus");
  });
});

describe("uyelikTipi: ücretli etiket yalnızca ABONELİK ETKİNKEN", () => {
  /* Köprü denemedeki aboneye de plan kodu bildirebiliyor; ekranda aynı
     anda "Deneme süresi" ve "Pro" yazıyordu — kullanıcı ödemediği bir
     üyeliğin adını kendi hesabında görüyordu. */
  test("denemede etiket YOK", () => {
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "pro-ay", durum: "trialing" }), null);
  });

  test("ödemesi gecikmiş, iptal, bilinmeyen ve ulaşılamayanda etiket YOK", () => {
    for (const durum of ["past_due", "canceled", "unknown", "unreachable", "unsynced", ""]) {
      assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "pro-ay", durum }), null, durum);
    }
  });

  test("etkin abonelikte etiket var", () => {
    assert.equal(uyelikTipi({ plans: KATALOG, planKodu: "pro-ay", durum: "active" }), "Pro");
  });
});
