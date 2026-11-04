import assert from "node:assert/strict";
import test from "node:test";
import { ayniKokenMi } from "@/lib/istek-koken";
import { ADRES_SINIRI, girisAnahtarlari, girisKilitliMi } from "@/lib/giris-siniri";

/* Phase 2 (04.11.2026): /auth/confirm POST'u başka siteden gelirse oturum açmamalı (giriş CSRF'i). */
test("aynı köken kabul, başka site reddedilir", () => {
  const host = "lab.arvo-os.com";
  assert.equal(ayniKokenMi({ secFetchSite: "same-origin", origin: "https://lab.arvo-os.com", host }), true);
  assert.equal(ayniKokenMi({ secFetchSite: "cross-site", origin: "https://kotu.example", host }), false);
  assert.equal(ayniKokenMi({ secFetchSite: "same-site", origin: "https://diger.arvo-os.com", host }), false);
  assert.equal(ayniKokenMi({ secFetchSite: null, origin: "https://kotu.example", host }), false);
  assert.equal(ayniKokenMi({ secFetchSite: null, origin: "null", host }), false);
});

test("başlıksız eski tarayıcı kapıda kalmaz", () => {
  assert.equal(ayniKokenMi({ secFetchSite: null, origin: null, host: "lab.arvo-os.com" }), true);
});

/* Phase 2: girişte yalnızca hatalı denemeler sayılır; pencere 15 dakika. */
test("sınıra ulaşan sayaç pencere içinde kilitler, pencere geçince açar", () => {
  const simdi = Date.parse("2026-11-04T10:00:00Z");
  const satir = (dk: number, n: number) => ({ count: n, window_start: new Date(simdi - dk * 60_000).toISOString() });
  assert.equal(girisKilitliMi(satir(5, ADRES_SINIRI), ADRES_SINIRI, simdi), true);
  assert.equal(girisKilitliMi(satir(5, ADRES_SINIRI - 1), ADRES_SINIRI, simdi), false);
  assert.equal(girisKilitliMi(satir(16, ADRES_SINIRI + 5), ADRES_SINIRI, simdi), false);
  assert.equal(girisKilitliMi(null, ADRES_SINIRI, simdi), false);
  assert.equal(girisKilitliMi({ count: 99, window_start: "bozuk" }, ADRES_SINIRI, simdi), false);
});

test("adres anahtarı büyük/küçük harf ve boşluktan bağımsız", () => {
  assert.equal(girisAnahtarlari(" Ali@X.co ", "1.2.3.4").adres, girisAnahtarlari("ali@x.co", "5.6.7.8").adres);
});
