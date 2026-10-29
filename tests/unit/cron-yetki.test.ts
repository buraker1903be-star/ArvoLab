import { test } from "node:test";
import assert from "node:assert/strict";
import { cronYetkiliMi } from "@/lib/cron-yetki";

const istek = (yetki?: string) => new Request("https://x/api/cron/a", { headers: yetki ? { authorization: yetki } : {} });

test("cron yetkisi: yalnızca doğru sır geçer, sır tanımsızsa hiçbir şey geçmez", () => {
  const eski = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "gizli-123";
    assert.equal(cronYetkiliMi(istek("Bearer gizli-123")), true);
    assert.equal(cronYetkiliMi(istek("Bearer gizli-12")), false);
    assert.equal(cronYetkiliMi(istek("Bearer gizli-1234")), false);
    assert.equal(cronYetkiliMi(istek()), false);
    delete process.env.CRON_SECRET;
    assert.equal(cronYetkiliMi(istek("Bearer ")), false);
    assert.equal(cronYetkiliMi(istek("Bearer undefined")), false);
  } finally {
    if (eski === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = eski;
  }
});
