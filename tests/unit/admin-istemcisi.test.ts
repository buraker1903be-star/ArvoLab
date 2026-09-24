import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";

/*
  Niyet: yardımcı yollarda (hız sayacı) yönetim istemcisi kurulamıyorsa
  kullanıcı ENGELLENMEMELİ. Bu niyet iki yerde `if (!admin) …` diye
  yazılmıştı ama createAdminClient() null dönmüyor, hata fırlatıyor —
  yani anahtar eksik olsaydı o yollar sessizce sayacı atlamak yerine
  tamamen düşerdi. Test o farkı sabitliyor.
*/
const ANAHTARLAR = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const yedek = Object.fromEntries(ANAHTARLAR.map((ad) => [ad, process.env[ad]]));

afterEach(() => {
  for (const ad of ANAHTARLAR) {
    if (yedek[ad] === undefined) delete process.env[ad];
    else process.env[ad] = yedek[ad];
  }
});

describe("yönetim istemcisi", () => {
  test("anahtar yoksa null döner, hata fırlatmaz", () => {
    for (const ad of ANAHTARLAR) delete process.env[ad];
    assert.equal(adminIstemcisiVarsa(), null);
  });

  test("anahtar varsa istemci döner", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ornek.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    assert.notEqual(adminIstemcisiVarsa(), null);
  });
});
