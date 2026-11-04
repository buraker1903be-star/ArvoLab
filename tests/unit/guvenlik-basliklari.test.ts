import assert from "node:assert/strict";
import test from "node:test";
import { guvenlikBasliklari, raporCsp } from "@/lib/guvenlik-basliklari";

/* Phase 2 (04.11.2026): güvenlik başlıkları. Eskiden hiç yoktu; panel başka bir sitede çerçeveye alınabiliyordu. */
const basliklar = (gelistirme = false) =>
  Object.fromEntries(guvenlikBasliklari({ supabaseUrl: "https://abc.supabase.co", gelistirme }).map((b) => [b.key, b.value]));

test("çerçeveye alınma her iki yolla da yasak", () => {
  const b = basliklar();
  assert.equal(b["X-Frame-Options"], "DENY");
  assert.match(b["Content-Security-Policy"], /frame-ancestors 'none'/);
});

test("zorlanan CSP betik ve bağlantıyı kısıtlamaz (yalnızca rapor katmanında)", () => {
  const zorlanan = basliklar()["Content-Security-Policy"];
  assert.doesNotMatch(zorlanan, /script-src|connect-src|form-action|default-src/);
});

test("rapor CSP'si Supabase'i (https ve wss) ve rapor adresini içerir", () => {
  const rapor = basliklar()["Content-Security-Policy-Report-Only"];
  assert.match(rapor, /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  assert.match(rapor, /report-uri \/api\/csp-raporu/);
});

test("unsafe-eval yalnızca geliştirmede", () => {
  assert.doesNotMatch(basliklar(false)["Content-Security-Policy-Report-Only"], /unsafe-eval/);
  assert.match(basliklar(true)["Content-Security-Policy-Report-Only"], /unsafe-eval/);
});

test("Supabase adresi yoksa ya da bozuksa politika yine kurulur", () => {
  assert.match(raporCsp({ gelistirme: false, raporAdresi: "/r" }), /connect-src 'self';/);
  assert.match(raporCsp({ supabaseUrl: "bozuk", gelistirme: false, raporAdresi: "/r" }), /connect-src 'self';/);
});

test("pano izni kısıtlanmıyor (kopyala düğmeleri), kamera ve mikrofon kapalı", () => {
  const izin = basliklar()["Permissions-Policy"];
  assert.doesNotMatch(izin, /clipboard/);
  assert.match(izin, /camera=\(\)/);
  assert.match(izin, /microphone=\(\)/);
});
