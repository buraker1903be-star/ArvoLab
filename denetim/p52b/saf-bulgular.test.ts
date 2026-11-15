/*
  P52b DENETİMİ — saf fonksiyon bulgularının yeniden üretimi (üretim kodu DEĞİŞMEDİ).
  Her test "bugünkü davranış"ı sabitler; beklenen davranış yorumda. Düzeltme
  turunda bu testler ters çevrilir (önce FAIL, sonra PASS kanıtı).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { pdfMi } from "@/lib/kaynak-pdf";
import { isPrivateAddress } from "@/lib/safe-official-fetch";

const enc = (s: string) => new TextEncoder().encode(s);

test("B-PDF-1: başında HTML olan ve ilk 1 KB'de '%PDF-' metni geçen yanıt bugün PDF sayılıyor", () => {
  const html = enc(`<!doctype html><html><body><p>Örnek dosya biçimi: %PDF-1.7 ile başlar.</p></body></html>`);
  assert.equal(pdfMi(html), true); // BUGÜN: true (beklenen: false — imza 0. bayttan başlamalı ya da yalnızca boşluk/BOM önünde)
});

test("B-PDF-2: '%PDF-' ile başlayıp gövdesi bozuk / %%EOF'suz dosya bugün PDF sayılıyor", () => {
  const sahte = enc("%PDF-1.4\n<html>bu bir giriş sayfası</html>");
  assert.equal(pdfMi(sahte), true); // BUGÜN: true (beklenen: yapı denetimi — %%EOF ve xref/obj işareti)
});

test("B-SSRF-1: NAT64 (64:ff9b::/96) ve 6to4 (2002::/16) önekleri iç IPv4'e çıkabildiği hâlde genel sayılıyor", () => {
  assert.equal(isPrivateAddress("64:ff9b::7f00:1"), false); // 127.0.0.1'in NAT64 karşılığı — BUGÜN: false (beklenen: true)
  assert.equal(isPrivateAddress("64:ff9b::a9fe:a9fe"), false); // 169.254.169.254 — BUGÜN: false
  assert.equal(isPrivateAddress("2002:7f00:1::1"), false); // 6to4 127.0.0.1 — BUGÜN: false
});

test("kontrol: mevcut korumalar yerinde (regresyon tabanı)", () => {
  assert.equal(pdfMi(enc("<!doctype html><html>giriş</html>")), false);
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("100.64.0.1"), true);
});
