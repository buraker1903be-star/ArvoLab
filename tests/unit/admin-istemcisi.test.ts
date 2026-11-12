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
const ANAHTARLAR = [
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_ENV", "ARVOLAB_SUPABASE_ORTAMI", "ARVOLAB_URETIM_SUPABASE_REF", "ARVOLAB_TEST_SUPABASE_REF",
] as const;
const URETIM = "aaaaaaaaaaaaaaaaaaaa";
const TEST = "bbbbbbbbbbbbbbbbbbbb";
/* Aşama 1: yönetim istemcisi de ortam denetiminden geçer (lib/supabase/ortam-guvenligi.ts). */
const testOrtami = () => {
  delete process.env.VERCEL_ENV;
  process.env.ARVOLAB_SUPABASE_ORTAMI = "test";
  process.env.ARVOLAB_URETIM_SUPABASE_REF = URETIM;
  process.env.ARVOLAB_TEST_SUPABASE_REF = TEST;
};
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

  test("anahtar varsa ve ortam doğrulanırsa istemci döner", () => {
    testOrtami();
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST}.supabase.co`;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    assert.notEqual(adminIstemcisiVarsa(), null);
  });

  test("üretim dışında ÜRETİM projesine servis anahtarıyla bağlanılmaz (istemci yok; başka projeye geçilmez)", () => {
    testOrtami();
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${URETIM}.supabase.co`;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    assert.equal(adminIstemcisiVarsa(), null);
  });

  test("ortam yapılandırması eksikse (fail-closed) istemci yok", () => {
    for (const ad of ["ARVOLAB_SUPABASE_ORTAMI", "ARVOLAB_URETIM_SUPABASE_REF", "ARVOLAB_TEST_SUPABASE_REF", "VERCEL_ENV"]) delete process.env[ad];
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST}.supabase.co`;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    assert.equal(adminIstemcisiVarsa(), null);
  });

  test("JWT biçimli anahtar başka projeye aitse istemci yok", () => {
    testOrtami();
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST}.supabase.co`;
    process.env.SUPABASE_SECRET_KEY = `x.${Buffer.from(JSON.stringify({ ref: URETIM, role: "service_role" })).toString("base64url")}.y`;
    assert.equal(adminIstemcisiVarsa(), null);
  });
});
