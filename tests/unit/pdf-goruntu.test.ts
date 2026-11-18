import assert from "node:assert/strict";
import test from "node:test";
import { OLCEK_EN_AZ, OLCEK_EN_COK, olcekSinirla } from "@/lib/pdf-goruntu";

/* Yazım Stüdyosu: yakınlaştırma sınırları. Yan panel genişliği: calisma-alani-yerlesimi.test.ts. */

test("yakınlaştırma %50–%300 arasında kalır; sayı olmayan %100'e döner", () => {
  assert.equal(olcekSinirla(0.1), OLCEK_EN_AZ);
  assert.equal(olcekSinirla(10), OLCEK_EN_COK);
  assert.equal(olcekSinirla(1.234), 1.23);
  assert.equal(olcekSinirla(Number.NaN), 1);
  assert.equal(olcekSinirla(Number.POSITIVE_INFINITY), 1);
});
