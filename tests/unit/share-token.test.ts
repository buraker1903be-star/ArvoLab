import assert from "node:assert/strict";
import test from "node:test";
import { generateShareToken, hashShareToken, isShareTokenFormat } from "@/lib/share-token";

/*
  Paylaşım belirteci ArvoLab'ın değişmezlerinden: veritabanında HAM tutulmaz,
  yalnızca SHA-256 özeti yazılır ve belirtecin kendisi bir kez gösterilir
  (AGENTS.md). Modülün hiç testi yoktu; özeti "kısayol olsun" diye
  kaldırmak ya da belirteci kısaltmak tek satırlık bir değişiklik.
*/
test("paylaşım belirteci", async (t) => {
  await t.test("üretilen belirteç 43 karakter base64url", () => {
    // 32 bayt → base64url'de dolgusuz 43 karakter.
    for (let i = 0; i < 20; i += 1) {
      const { token } = generateShareToken();
      assert.equal(token.length, 43);
      assert.ok(isShareTokenFormat(token), `biçim dışı: ${token}`);
    }
  });

  await t.test("üretilen özet belirtecin özetidir, belirtecin kendisi değil", () => {
    const { token, hash } = generateShareToken();
    assert.equal(hash, hashShareToken(token));
    assert.notEqual(hash, token, "özet yerine belirtecin kendisi dönmemeli");
    assert.match(hash, /^[0-9a-f]{64}$/, "SHA-256 onaltılık 64 karakter");
    assert.ok(!hash.includes(token), "özet belirteci içermemeli");
  });

  await t.test("iki belirteç aynı çıkmıyor", () => {
    const kume = new Set(Array.from({ length: 200 }, () => generateShareToken().token));
    assert.equal(kume.size, 200);
  });

  await t.test("özet kararlı ve girdiye duyarlı", () => {
    assert.equal(hashShareToken("abc"), hashShareToken("abc"));
    assert.notEqual(hashShareToken("abc"), hashShareToken("abd"));
  });

  await t.test("biçim denetimi uzunluk ve alfabeyi zorluyor", () => {
    const gecerli = generateShareToken().token;
    assert.equal(isShareTokenFormat(gecerli.slice(0, 42)), false, "kısa");
    assert.equal(isShareTokenFormat(`${gecerli}x`), false, "uzun");
    assert.equal(isShareTokenFormat(""), false);
    // base64url alfabesi dışı: +, /, = ve nokta kabul edilmemeli.
    assert.equal(isShareTokenFormat(`${gecerli.slice(0, 42)}+`), false);
    assert.equal(isShareTokenFormat(`${gecerli.slice(0, 42)}/`), false);
    assert.equal(isShareTokenFormat(`${gecerli.slice(0, 42)}.`), false);
    // Yol geçişi denemesi biçimden geçmemeli (adres parçası olarak geliyor).
    assert.equal(isShareTokenFormat("../../etc/passwd"), false);
  });
});
