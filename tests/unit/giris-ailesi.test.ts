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
  for (const anahtar of ["missing-credentials", "invalid-credentials", "too-many-attempts", "email-not-confirmed", "link-invalid", "session-missing"]) {
    assert.ok(sayfa.includes(`"${anahtar}"`), anahtar);
  }
});

test("kayıt: sözleşme okunmadan işaretlenmez, okundu bilgisi sunucuya gider", () => {
  const form = oku("app/kayit/kayit-formu.tsx");
  assert.match(form, /if \(!okundu\) \{\s*e\.preventDefault\(\);\s*setOkuyor\(true\);/);
  assert.match(form, /name="sozlesmeOkundu" value=\{okundu \? "1" : ""\}/);
});
