import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/*
  GİRİŞ AİLESİ (Signature OS, 05.11.2026). Beş sayfa yalnızca GÖRÜNÜŞ
  olarak yenilendi; bu test yeniden tasarımın akışlara dokunmadığını
  sabitler: her sayfa hâlâ aynı sunucu işlemini çağırıyor, doğrulama
  sayfası belirteci yalnızca form gönderilince harcıyor, kayıt formu
  sözleşmeyi okumadan işaretletmiyor. Ortak kabuk (kimlik-kabugu.tsx)
  hiçbir oturum ya da yönlendirme kararı vermemeli: o kararlar proxy.ts
  ve app/actions/auth.ts'te; kabuğa sızan bir karar beş sayfayı birden
  etkiler.
*/
const oku = (yol: string) => fs.readFileSync(yol, "utf8");

const SAYFALAR = ["app/page.tsx", "app/kayit/page.tsx", "app/forgot-password/page.tsx", "app/reset-password/page.tsx", "app/auth/dogrula/page.tsx"];

test("beş giriş sayfası da ortak kabuğu kullanır", () => {
  for (const yol of SAYFALAR) assert.match(oku(yol), /<KimlikKabugu[\s>]/, yol);
});

test("kabuk yalnızca görünüş: oturum, yönlendirme ya da Supabase yok", () => {
  const kabuk = oku("app/_components/kimlik-kabugu.tsx");
  for (const yasak of ["redirect(", "supabase", "getUser", "cookies(", "notFound("]) {
    assert.ok(!kabuk.includes(yasak), `kabukta ${yasak} olmamalı`);
  }
});

test("her ekran aynı sunucu işlemine bağlı", () => {
  assert.match(oku("app/_components/giris-formu.tsx"), /action=\{login\}/);
  assert.match(oku("app/kayit/kayit-formu.tsx"), /signUp\(_onceki, formData\)/);
  assert.match(oku("app/forgot-password/page.tsx"), /action=\{requestPasswordReset\}/);
  assert.match(oku("app/_components/sifre-sifirlama-penceresi.tsx"), /useActionState\(sifreSifirlamaIste/);
  assert.match(oku("app/reset-password/page.tsx"), /action=\{resetPassword\}/);
});

test("doğrulama sayfası belirteci yalnızca POST ile /auth/confirm'e gönderir", () => {
  const sayfa = oku("app/auth/dogrula/page.tsx");
  assert.match(sayfa, /<form method="post" action="\/auth\/confirm">/);
  assert.match(sayfa, /safeConfirmNext\(/);
});

test("giriş sayfası yalnızca /dashboard altına geri döner ve hata metinleri yerinde", () => {
  const sayfa = oku("app/page.tsx");
  assert.match(sayfa, /params\.next\?\.startsWith\("\/dashboard"\)/);
  for (const anahtar of ["missing-credentials", "invalid-credentials", "too-many-attempts", "email-not-confirmed", "link-invalid", "signup-link-invalid", "recovery-link-invalid", "session-missing"]) {
    assert.ok(sayfa.includes(`"${anahtar}"`), anahtar);
  }
});

test("kayıt: sözleşme okunmadan işaretlenmez, okundu bilgisi sunucuya gider", () => {
  const form = oku("app/kayit/kayit-formu.tsx");
  assert.match(form, /if \(!okundu\) \{\s*e\.preventDefault\(\);\s*setOkuyor\(true\);/);
  assert.match(form, /name="sozlesmeOkundu" value=\{okundu \? "1" : ""\}/);
});

/*
  Arvo AI cümlesi (05.11.2026). Eskiden giriş sayfası "Asistan metninizi
  yazmaz, denetler" diyordu; yazım asistanı 03.11.2026'dan beri sohbette
  taslak yazıyor. Değişmeyen söz: ekleme kararı kullanıcının.
*/
test("giriş sayfası Arvo AI'ı güncel anlatır, iki dilde de ekleme kararı kullanıcıda", () => {
  const sayfa = oku("app/page.tsx");
  assert.ok(!sayfa.includes(`tr: "Asistan metninizi yazmaz`), "eski cümle kalmamalı");
  assert.ok(!sayfa.includes(`en: "The assistant reviews your text`), "eski İngilizce cümle kalmamalı");
  assert.ok(sayfa.includes("Önerileri belgenize ekleme kararı size aittir."));
  assert.ok(sayfa.includes("The decision to add its suggestions to your document is yours."));
});

test("telefon biçimi özelliklerin hiçbirini düşürmez: iki liste de aynı diziden", () => {
  const sayfa = oku("app/page.tsx");
  assert.equal((sayfa.match(/OZELLIKLER\.map\(/g) ?? []).length, 2);
  assert.match(sayfa, /<details>\s*<summary>/);
});

/*
  Doğrulama hatası metinleri (05.11.2026): kayıt bağlantısı şifre
  sıfırlamayı değil yeni doğrulama bağlantısını söyler; genel metin
  türü varsaymaz. Ayrı bir "yeniden gönder" işlevi olmadığı için hiçbir
  metin olmayan bir düğmeyi tarif etmez.
*/
test("doğrulama hataları türe göre, genel metin türü varsaymaz", () => {
  const sayfa = oku("app/page.tsx");
  const metin = (anahtar: string) => {
    const i = sayfa.indexOf(`"${anahtar}": {`);
    assert.ok(i >= 0, anahtar);
    return sayfa.slice(i, sayfa.indexOf("},", i));
  };
  assert.ok(!/şifre sıfırlama|password reset/i.test(metin("link-invalid")), "genel metin sıfırlama demez");
  assert.match(metin("signup-link-invalid"), /Yeni bir doğrulama bağlantısı/);
  assert.match(metin("signup-link-invalid"), /new verification link/);
  assert.match(metin("recovery-link-invalid"), /yeni bir sıfırlama bağlantısı/);
  assert.match(metin("recovery-link-invalid"), /new reset link/);
  const rota = oku("app/auth/confirm/route.ts");
  assert.match(rota, /const hata = tokenHash \? dogrulamaHataKodu\(type\) : "link-invalid";/);
  // Köken reddi ve PKCE dalı genel kalır.
  assert.equal((rota.match(/"\/\?error=link-invalid"/g) ?? []).length, 2);
});

test("hoş geldiniz e-postası Arvo AI'ı güncel anlatır, iki dilde", () => {
  const eposta = oku("lib/email/auth-emails.ts");
  assert.ok(!eposta.includes("<p ${NOT}>ArvoLab metninizi sizin yerinize yazmaz"));
  assert.ok(!eposta.includes("<p ${NOT}>ArvoLab does not write your text for you"));
  assert.ok(eposta.includes("Oluşturulan içerikleri değerlendirme ve çalışmanıza ekleme kararı size aittir."));
  assert.ok(eposta.includes("The decision to evaluate generated content and add it to your work is yours."));
});
