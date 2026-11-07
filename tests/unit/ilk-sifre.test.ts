import { test } from "node:test";
import assert from "node:assert/strict";
import { ilkSifreGerekli, ilkSifreSorulmali } from "../../lib/ilk-sifre";
import { dogrulamaSonrasiYol } from "../../lib/auth-link";

/* G1 (07.11.2026): şifresiz kayıt/davet oturumu panelden önce şifre belirlemeli. */
test("kayıt, davet, kurtarma ve bilinmeyen yöntem sorgulanır", () => {
  for (const y of [["email/signup"], ["invite"], ["recovery"], [], ["bilinmeyen"], ["token_refresh"]]) assert.equal(ilkSifreSorulmali(y), true, y.join());
});

test("ArvoOS magic link ve şifreli giriş sorgulanmaz", () => {
  for (const y of [["otp"], ["magiclink"], ["password"], ["password", "totp"], ["oauth"]]) assert.equal(ilkSifreSorulmali(y), false, y.join());
  // Kayıt doğrulaması sonra şifreyle girilse bile ilk yöntem yazılıysa sorulur (şifre varsa kapı açılır).
  assert.equal(ilkSifreSorulmali(["password", "email/signup"]), true);
});

test("kapı yalnızca NET 'şifre yok'ta kapanır", () => {
  assert.equal(ilkSifreGerekli(["email/signup"], false), true);
  assert.equal(ilkSifreGerekli([], false), true);
  assert.equal(ilkSifreGerekli(["email/signup"], true), false);
  assert.equal(ilkSifreGerekli(["email/signup"], null), false); // okunamadı: kapı kapanmaz
  assert.equal(ilkSifreGerekli(["otp"], false), false); // ArvoOS üyesi bilerek şifresiz
});

test("PKCE sonrası: AMR eksik/bilinmiyorsa şifre durumuna göre", () => {
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", false), "/reset-password?ilk=1");
  assert.equal(dogrulamaSonrasiYol(["garip"], "/dashboard", false), "/reset-password?ilk=1");
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", true), "/dashboard");
  assert.equal(dogrulamaSonrasiYol([], "/dashboard", null), "/dashboard");
  assert.equal(dogrulamaSonrasiYol(["magiclink"], "/dashboard", false), "/dashboard");
});
