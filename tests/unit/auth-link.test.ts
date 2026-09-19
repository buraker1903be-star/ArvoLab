import { test } from "node:test";
import assert from "node:assert/strict";
import { authConfirmLink, safeConfirmNext } from "../../lib/auth-link";

test("e-posta bağlantısı doğrudan /auth/confirm'e token_hash ile gider", () => {
  const url = new URL(authConfirmLink("https://arvolab.com", "abc123", "recovery"));
  assert.equal(url.origin + url.pathname, "https://arvolab.com/auth/confirm");
  assert.equal(url.searchParams.get("token_hash"), "abc123");
  assert.equal(url.searchParams.get("type"), "recovery");
  assert.equal(url.searchParams.get("next"), "/reset-password");
  assert.equal(new URL(authConfirmLink("https://arvolab.com", "t", "invite")).searchParams.get("type"), "invite");
});

test("dönüş yalnızca panel yolları; dış alan adına çözülen biçimler reddedilir", () => {
  assert.equal(safeConfirmNext("/reset-password"), "/reset-password");
  assert.equal(safeConfirmNext("/dashboard/editor?x=1"), "/dashboard/editor?x=1");
  for (const kotu of ["/\\evil.example", "/%5Cevil.example", "/%09/evil.example", "//evil.example", "https://evil.example", "/dashboardx", "/share/abc", null]) {
    assert.equal(safeConfirmNext(kotu), "/dashboard", String(kotu));
  }
  // Reddedilenlerin gerçekten dışarı çıkabildiğini sabitle (eski denetim bunları geçiriyordu).
  assert.equal(new URL("/\\evil.example", "https://arvolab.com").host, "evil.example");
});
