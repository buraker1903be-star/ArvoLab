import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { KURTARMA_YOLU, YENIDEN_DOGRULAMA_NEDENI, sifreHatasi } from "../../lib/sifre-hatasi";

/*
  R1 — İLK ŞİFRE EKRANINDA KİLİTLENME (G1 Aşama 8.3, 10.11.2026).

  "Secure password change" açıkken yakın tarihli olmayan oturum şifre
  belirleyemiyor (reauthentication_needed). Şifresi henüz olmayan
  kullanıcı bu ekranda kalıyordu: çıkış düğmesi yoktu, "/" ve
  "/forgot-password" onu panele, panelin kapısı yine buraya gönderiyordu.

  Gerçek GoTrue'nun bu kodu ne zaman döndürdüğü ve signOut({scope:"local"})
  davranışı burada SINANMIYOR (tarayıcısız, ağsız birim testi). Burada
  sabitlenen: hata metni, çıkışın yalnızca kullanıcının düğmesiyle ve
  yalnızca bu cihazda olması, kapının ve "oturum açıkken kurtarma yok"
  kuralının yerinde durması.
*/
const oku = (yol: string) => fs.readFileSync(yol, "utf8");

/** Bir fonksiyon gövdesini (adından sonraki ilk dengeli süslü parantez bloğunu) döndürür. */
function govde(kaynak: string, ad: string): string {
  const i = kaynak.search(new RegExp(`(async )?function ${ad}\\(`));
  assert.ok(i >= 0, `${ad} bulunamadı`);
  const bas = kaynak.indexOf("{", kaynak.indexOf(")", i));
  let derinlik = 0;
  for (let j = bas; j < kaynak.length; j++) {
    if (kaynak[j] === "{") derinlik++;
    else if (kaynak[j] === "}" && --derinlik === 0) return kaynak.slice(bas, j + 1);
  }
  throw new Error(`${ad} gövdesi kapanmıyor`);
}

const AUTH = oku("app/actions/auth.ts");
const PROXY = oku("proxy.ts");
const SIFIRLAMA_SAYFASI = oku("app/reset-password/page.tsx");
const UNUTTUM_SAYFASI = oku("app/forgot-password/page.tsx");

test("reauthentication_needed: sıfırlama/ilk şifre ekranında yeni doğrulama bağlantısına yönlendirir", () => {
  const m = sifreHatasi("reauthentication_needed", "sifirlama");
  assert.match(m.tr, /doğrulama bağlantısı/);
  assert.match(m.en, /verification link/);
  // Şifresi olmayan kullanıcı şifreyle giriş yapamaz: "yeniden giriş yapın" demek onu çıkmaza sokar.
  assert.doesNotMatch(m.tr, /giriş yap/);
  assert.doesNotMatch(m.en, /sign in again/);
});

test("reauthentication_needed: Ayarlar'da (şifresi olan kullanıcı) eski yönerge korunur", () => {
  const m = sifreHatasi("reauthentication_needed", "ayarlar");
  assert.match(m.tr, /çıkış yapıp yeniden giriş/);
  assert.match(m.en, /sign out, sign in again/);
});

test("öteki kodlar iki bağlamda aynı metni verir; boş metin yok", () => {
  for (const kod of ["same_password", "weak_password", undefined, "bilinmeyen"]) {
    assert.deepEqual(sifreHatasi(kod, "sifirlama"), sifreHatasi(kod, "ayarlar"), String(kod));
    const m = sifreHatasi(kod, "sifirlama");
    assert.ok(m.tr.length > 0 && m.en.length > 0);
  }
  assert.notDeepEqual(sifreHatasi("same_password", "sifirlama"), sifreHatasi(undefined, "sifirlama"));
});

test("kurtarma yolu sabit bir iç yol (açık yönlendirme yok)", () => {
  assert.equal(KURTARMA_YOLU, `/forgot-password?neden=${YENIDEN_DOGRULAMA_NEDENI}`);
  assert.ok(KURTARMA_YOLU.startsWith("/") && !KURTARMA_YOLU.startsWith("//"));
  assert.doesNotMatch(KURTARMA_YOLU, /[\\@:]/);
});

test("şifre güncellemesi bağlamı doğru geçirir: sıfırlama 'sifirlama', Ayarlar 'ayarlar'", () => {
  assert.match(govde(AUTH, "resetPassword"), /applyNewPassword\(formData, "sifirlama"\)/);
  assert.match(govde(AUTH, "changePassword"), /applyNewPassword\(formData, "ayarlar"\)/);
  // Başarı yolu değişmedi: çerez yazılır, sıfırlama panele gider.
  const uygula = govde(AUTH, "applyNewPassword");
  assert.match(uygula, /updateUser\(\{ password \}\)/);
  assert.match(uygula, /set\(SIFRE_VAR_CEREZI, user\.id/);
  assert.match(uygula, /if \(!user\)/);
  assert.match(govde(AUTH, "resetPassword"), /redirect\("\/dashboard"\)/);
});

test("hata alınınca oturum kendiliğinden kapanmaz ve hata nesnesi günlüğe yazılmaz", () => {
  const uygula = govde(AUTH, "applyNewPassword");
  assert.doesNotMatch(uygula, /signOut|yerelOturumuKapat|redirect\(/);
  assert.doesNotMatch(uygula, /console\.\w+\(error\)/);
  // G1-C A1: zayıf şifre nedenleri de geçer; yalnızca tanınan neden adları (lib/sifre-hatasi.ts).
  assert.match(uygula, /sifreHatasi\(error\.code, baglam, zayifSifreNedenleri\(error\)\)/);
});

test("çıkış ve kurtarma yalnızca bu cihazın oturumunu kapatır (öteki oturumlar korunur)", () => {
  const kapat = govde(AUTH, "yerelOturumuKapat");
  const cagrilar = kapat.match(/signOut\([^)]*\)/g) ?? [];
  assert.deepEqual(cagrilar, ['signOut({ scope: "local" })']);
  assert.doesNotMatch(kapat, /global|others/);
  assert.doesNotMatch(kapat, /console\.\w+\(error\)/);
  for (const ad of ["ilkSifredenCik", "yeniDogrulamaIste"]) {
    const g = govde(AUTH, ad);
    assert.match(g, /await yerelOturumuKapat\(formData\)/, ad);
    assert.doesNotMatch(g, /signOut/, `${ad} doğrudan signOut çağırmamalı`);
  }
  // Panelin genel çıkışı bilerek değişmedi.
  assert.match(govde(AUTH, "logout"), /signOut\(\);/);
});

test("yönlendirmeler sabit: kullanıcıdan hedef alınmaz", () => {
  assert.match(govde(AUTH, "ilkSifredenCik"), /redirect\("\/"\)/);
  assert.match(govde(AUTH, "yeniDogrulamaIste"), /redirect\(KURTARMA_YOLU\)/);
  const kapat = govde(AUTH, "yerelOturumuKapat");
  for (const y of kapat.match(/redirect\([^;]*\);/g) ?? []) {
    // formData yalnızca "1" ile KARŞILAŞTIRILIR; değeri hedefe yazılmaz.
    assert.match(y, /^redirect\(formData\.get\("ilk"\) === "1" \? "\/reset-password\?ilk=1&cikis=hata" : "\/reset-password\?cikis=hata"\);$/, y);
  }
  for (const ad of ["ilkSifredenCik", "yeniDogrulamaIste", "yerelOturumuKapat"]) {
    assert.doesNotMatch(govde(AUTH, ad), /redirect\([^)]*(next|returnTo|redirectTo|\$\{)/, ad);
  }
});

test("ilk şifre ekranında iki düğme var ve yalnızca form gönderilince çalışır", () => {
  assert.match(SIFIRLAMA_SAYFASI, /<form action=\{yeniDogrulamaIste\}>/);
  assert.match(SIFIRLAMA_SAYFASI, /<form action=\{ilkSifredenCik\}>/);
  assert.equal((SIFIRLAMA_SAYFASI.match(/<button type="submit"/g) ?? []).length, 2);
  assert.match(SIFIRLAMA_SAYFASI, /Çıkış yap/);
  assert.match(SIFIRLAMA_SAYFASI, /Yeni doğrulama bağlantısı iste/);
  // Kendiliğinden çağrı yok: sayfa açılınca ya da hata gelince oturum kapanmaz.
  assert.doesNotMatch(SIFIRLAMA_SAYFASI, /(yeniDogrulamaIste|ilkSifredenCik)\(/);
  assert.doesNotMatch(SIFIRLAMA_SAYFASI, /useEffect|redirect\(|signOut/);
  // Sorgu metni yansıtılmaz; yalnızca tanınan değer.
  assert.match(SIFIRLAMA_SAYFASI, /sorgu\.cikis === "hata"/);
  assert.doesNotMatch(SIFIRLAMA_SAYFASI, /\{sorgu\.cikis\}/);
});

test("kurtarma ekranı nedeni beyaz listeden okur, metni yansıtmaz", () => {
  assert.match(UNUTTUM_SAYFASI, /params\.neden === YENIDEN_DOGRULAMA_NEDENI/);
  assert.doesNotMatch(UNUTTUM_SAYFASI, /\{params\.neden\}/);
  assert.match(UNUTTUM_SAYFASI, /action=\{requestPasswordReset\}/);
});

test("kurtarma ekranına oturum kapanmadan geçilemez; ilk şifre kapısı yerinde", () => {
  // Oturumu olan /forgot-password'den panele gider (oradan da kapıya): kurtarma yolu yalnızca çıkıştan sonra.
  assert.match(PROXY, /const SIGNED_OUT_ONLY_PATHS = \["\/", "\/forgot-password"\];/);
  assert.match(PROXY, /if \(user && SIGNED_OUT_ONLY_PATHS\.includes\(pathname\)\)/);
  // İlk şifre ekranı oturum ister ve kapının hedefidir; "yalnızca çıkışta" listesine girerse ekran açılmaz.
  assert.match(PROXY, /if \(!user && pathname === "\/reset-password"\)/);
  assert.match(PROXY, /if \(ilkSifreGerekli\(ilkSifre\)\) return redirectTo\("\/reset-password", \{ ilk: "1" \}\);/);
  assert.match(PROXY, /if \(user && pathname\.startsWith\("\/dashboard"\) && request\.cookies\.get\(SIFRE_VAR_CEREZI\)\?\.value !== user\.id\)/);
});
