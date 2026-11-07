import { test } from "node:test";
import assert from "node:assert/strict";
import { ilkSifreGerekli, ilkSifreSorulmali } from "../../lib/ilk-sifre";
import { dogrulamaSonrasiYol } from "../../lib/auth-link";

/*
  G1 (07.11.2026). Karar veride (ilk_sifre_gerekli); AMR yalnızca sorgudan
  kaçınmak için. Test'te token_hash doğrulamalarının hepsi AMR'ye "otp"
  yazıyordu: "otp" ArvoOS üyesi demek DEĞİL, sorgu yapılmalı.
*/
test("şifreyle açılmış oturum sorgulanmaz; otp ve bilinmeyen sorgulanır", () => {
  assert.equal(ilkSifreSorulmali(["password"]), false);
  assert.equal(ilkSifreSorulmali(["otp", "password"]), false);
  for (const y of [["otp"], ["email/signup"], ["invite"], ["magiclink"], [], ["bilinmeyen"]]) assert.equal(ilkSifreSorulmali(y), true, y.join());
});

test("kapı yalnızca NET 'gerekli'de kapanır", () => {
  assert.equal(ilkSifreGerekli(true), true);
  assert.equal(ilkSifreGerekli(false), false);
  assert.equal(ilkSifreGerekli(null), false); // okunamadı: kapı kapanmaz
});

test("PKCE sonrası: AMR eksik/bilinmiyorsa veritabanı kararına göre", () => {
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", true), "/reset-password?ilk=1");
  assert.equal(dogrulamaSonrasiYol(["otp"], "/dashboard", true), "/reset-password?ilk=1");
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", false), "/dashboard");
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", null), "/dashboard");
  assert.equal(dogrulamaSonrasiYol(["email/signup"], "/dashboard", false), "/reset-password?ilk=1");
});
