import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EN_KISA_SIFRE, DOGRULAMA_BAGLANTISI_SANIYE, baglantiSuresiMetni, sifreUzunlukHatasi } from "../../lib/kimlik-kurallari";
import { ZAYIF_SIFRE_NEDENLERI, sifreHatasi, zayifSifreNedenleri } from "../../lib/sifre-hatasi";
import { inviteEmail, resetPasswordEmail, signUpConfirmEmail } from "../../lib/email/auth-emails";

/*
  G1-C A0–A2 (11.11.2026): şifre en az uzunluğu, zayıf şifre nedenleri ve
  doğrulama bağlantısı süresi.

  Gerçek Supabase'in ne zaman hangi nedeni döndürdüğü burada SINANMIYOR
  (ağsız birim testi). Hata nesnesinin biçimi @supabase/auth-js 2.112.1'den
  okundu: updateUser, "weak_password" kodunda AuthWeakPasswordError atıyor
  ve nedenleri `reasons` dizisinde taşıyor (lib/fetch.js, lib/errors.js).
  Aşağıdaki nesneler o biçimin taklidi; kütüphanenin sınıfı içe aktarılmaz
  (tests/unit Supabase'e dokunmaz).
*/

const oku = (yol: string) => fs.readFileSync(yol, "utf8");

/* ---------- A2: en az uzunluk ---------- */

test("en az şifre uzunluğu 12", () => {
  assert.equal(EN_KISA_SIFRE, 12);
});

test("sınır: 11 karakter reddedilir, 12 ve 13 geçer", () => {
  assert.notEqual(sifreUzunlukHatasi("a".repeat(11)), null);
  assert.equal(sifreUzunlukHatasi("a".repeat(12)), null);
  assert.equal(sifreUzunlukHatasi("a".repeat(13)), null);
  assert.notEqual(sifreUzunlukHatasi(""), null);
  // Eski sınır (8) artık yetmez.
  assert.notEqual(sifreUzunlukHatasi("a".repeat(8)), null);
});

test("uzunluk hatası iki dilde ve eşiği yazar", () => {
  const m = sifreUzunlukHatasi("kisa");
  assert.ok(m);
  assert.equal(m.tr, "Şifre en az 12 karakter olmalı.");
  assert.equal(m.en, "Password must be at least 12 characters.");
});

test("uzunluk tarayıcının minLength'iyle aynı birimle ölçülür (UTF-16)", () => {
  // Türkçe harf tek birim: 12 "ş" geçer, 11 geçmez. Supabase baytı sayar ve
  // UTF-8 baytı hiçbir zaman UTF-16 biriminden az değildir.
  assert.equal(sifreUzunlukHatasi("ş".repeat(12)), null);
  assert.notEqual(sifreUzunlukHatasi("ş".repeat(11)), null);
  assert.ok(Buffer.byteLength("ş".repeat(12), "utf8") >= 12);
});

test("sunucu, form ve metinler aynı sabiti kullanır; eski 8 hiçbir yerde kalmadı", () => {
  const auth = oku("app/actions/auth.ts");
  assert.doesNotMatch(auth, /MIN_PASSWORD_LENGTH/);
  assert.match(auth, /import \{ sifreUzunlukHatasi \} from "@\/lib\/kimlik-kurallari";/);
  assert.match(auth, /const uzunlukHatasi = sifreUzunlukHatasi\(password\);/);

  const form = oku("app/dashboard/settings/password-form.tsx");
  assert.doesNotMatch(form, /minLength=\{\d+\}/);
  // İki görünümde ikişer kutu (şifre + tekrar).
  assert.equal((form.match(/minLength=\{EN_KISA_SIFRE\}/g) ?? []).length, 4);
  assert.match(form, /import \{ EN_KISA_SIFRE \} from "@\/lib\/kimlik-kurallari";/);

  for (const yol of ["app/reset-password/page.tsx", "app/dashboard/settings/page.tsx"]) {
    const kaynak = oku(yol);
    assert.doesNotMatch(kaynak, /\b8 karakter|\b8 characters/, yol);
    assert.match(kaynak, /\$\{EN_KISA_SIFRE\}/, yol);
  }
});

test("ilk şifre, kurtarma ve Ayarlar aynı kuraldan geçer (tek uygulama yolu)", () => {
  const auth = oku("app/actions/auth.ts");
  // Uzunluk denetimi yalnızca applyNewPassword'de; üç akış da oraya iner.
  assert.equal((auth.match(/sifreUzunlukHatasi\(/g) ?? []).length, 1);
  assert.match(auth, /export async function resetPassword[\s\S]*?applyNewPassword\(formData, "sifirlama"\)/);
  assert.match(auth, /export async function changePassword[\s\S]*?applyNewPassword\(formData, "ayarlar"\)/);
  // Kayıt rastgele, saklanmayan bir şifreyle açılır; yeni eşiğin çok üstünde ve karakter türlerini karşılar.
  const kayit = auth.match(/password: `\$\{randomBytes\((\d+)\)\.toString\("base64url"\)\}aA1!`/);
  assert.ok(kayit, "kayıttaki rastgele şifre kalıbı değişti");
  assert.ok(Math.ceil((Number(kayit[1]) * 4) / 3) + 4 > EN_KISA_SIFRE);
});

/* ---------- A1: zayıf şifre nedenleri ---------- */

const zayif = (reasons: unknown) => ({ name: "AuthWeakPasswordError", code: "weak_password", status: 422, message: "x", reasons });

test("nedenler yalnızca bilinen üç değerden, sabit sırayla alınır", () => {
  assert.deepEqual([...ZAYIF_SIFRE_NEDENLERI], ["length", "characters", "pwned"]);
  assert.deepEqual(zayifSifreNedenleri(zayif(["pwned", "length"])), ["length", "pwned"]);
  assert.deepEqual(zayifSifreNedenleri(zayif(["characters"])), ["characters"]);
  assert.deepEqual(zayifSifreNedenleri(zayif(["min_length", "bilinmeyen", 7, null])), []);
  assert.deepEqual(zayifSifreNedenleri(zayif("length")), []);
  assert.deepEqual(zayifSifreNedenleri(zayif(undefined)), []);
  assert.deepEqual(zayifSifreNedenleri({ code: "weak_password" }), []);
  assert.deepEqual(zayifSifreNedenleri(null), []);
  assert.deepEqual(zayifSifreNedenleri(undefined), []);
  assert.deepEqual(zayifSifreNedenleri("weak_password"), []);
});

test("length: en az uzunluğu söyler", () => {
  const m = sifreHatasi("weak_password", "sifirlama", ["length"]);
  assert.match(m.tr, /en az 12 karakter/);
  assert.match(m.en, /at least 12 characters/);
  assert.doesNotMatch(m.tr, /sızıntı|sembol/);
});

test("characters: karakter türlerini söyler", () => {
  const m = sifreHatasi("weak_password", "ayarlar", ["characters"]);
  assert.match(m.tr, /karakter türlerini/);
  assert.match(m.en, /character types/);
  assert.doesNotMatch(m.tr, /sızıntı|en az 12/);
});

test("pwned: veri sızıntısını söyler, sembol eklemeyi önermez", () => {
  const m = sifreHatasi("weak_password", "sifirlama", ["pwned"]);
  assert.match(m.tr, /veri sızıntısında/);
  assert.match(m.en, /data breach/);
  assert.doesNotMatch(m.tr, /sembol/);
});

test("birden çok neden: hepsi, sabit sırayla", () => {
  const m = sifreHatasi("weak_password", "sifirlama", ["pwned", "length"]);
  assert.ok(m.tr.indexOf("en az 12") < m.tr.indexOf("sızıntı"));
  assert.ok(m.en.indexOf("at least 12") < m.en.indexOf("breach"));
});

test("neden yoksa ya da tanınmıyorsa güvenli genel metin", () => {
  const genel = sifreHatasi("weak_password", "sifirlama");
  assert.match(genel.tr, /güvenlik koşullarını karşılamıyor/);
  assert.ok(genel.en.length > 0);
  // Tip dışı bir değer çağırana sızsa bile metne girmez.
  assert.deepEqual(sifreHatasi("weak_password", "sifirlama", ["bilinmeyen" as never]), genel);
  // Eskiden her zayıf şifrede "harf, rakam ve sembolleri birlikte kullanın" yazıyordu.
  assert.doesNotMatch(genel.tr, /sembol/);
});

test("nedenler yalnızca weak_password'ü etkiler; öteki kodlar ve bağlamlar değişmez", () => {
  for (const kod of ["same_password", "reauthentication_needed", undefined, "bilinmeyen"]) {
    for (const baglam of ["sifirlama", "ayarlar"] as const) {
      assert.deepEqual(sifreHatasi(kod, baglam, ["pwned"]), sifreHatasi(kod, baglam), `${String(kod)} ${baglam}`);
    }
  }
  assert.deepEqual(sifreHatasi("weak_password", "sifirlama", ["pwned"]), sifreHatasi("weak_password", "ayarlar", ["pwned"]));
});

test("zayıf şifre hatası: yalnızca neden adları okunur, günlüğe şifre ya da hata iletisi girmez", () => {
  const auth = oku("app/actions/auth.ts");
  assert.match(auth, /sifreHatasi\(error\.code, baglam, zayifSifreNedenleri\(error\)\)/);
  assert.match(auth, /console\.error\("\[sifre\] güncellenemedi", error\.code, error\.status\);/);
  // Yalnızca şifre uygulama yolu: öteki işlemlerin (kayıt, sıfırlama isteği) günlükleri bu aşamanın kapsamı dışında.
  const uygula = auth.slice(auth.indexOf("async function applyNewPassword("), auth.indexOf("async function yerelOturumuKapat("));
  assert.ok(uygula.length > 0);
  assert.equal((uygula.match(/console\.\w+\(/g) ?? []).length, 1);
  assert.doesNotMatch(uygula, /console\.\w+\([^)]*(password|passwordConfirm|error\.message|error\.reasons|nedenler)/);
});

/* ---------- A0: doğrulama bağlantısı süresi ---------- */

test("bağlantı süresi Supabase Test ayarının aynası: 3600 saniye = 1 saat", () => {
  assert.equal(DOGRULAMA_BAGLANTISI_SANIYE, 3600);
  assert.deepEqual(baglantiSuresiMetni(), { tr: "1 saat", en: "1 hour" });
  assert.deepEqual(baglantiSuresiMetni(7200), { tr: "2 saat", en: "2 hours" });
  assert.deepEqual(baglantiSuresiMetni(86400), { tr: "24 saat", en: "24 hours" });
  assert.deepEqual(baglantiSuresiMetni(1800), { tr: "30 dakika", en: "30 minutes" });
  assert.deepEqual(baglantiSuresiMetni(60), { tr: "1 dakika", en: "1 minute" });
});

const BAGLANTI = "https://ornek.invalid/auth/confirm?token_hash=x";
const epostalar = {
  kurtarma: (dil: "tr" | "en") => resetPasswordEmail(BAGLANTI, dil).html,
  davet: (dil: "tr" | "en") => inviteEmail(BAGLANTI, "Ayşe", dil).html,
  kayit: (dil: "tr" | "en") => signUpConfirmEmail(BAGLANTI, 3, dil).html,
};

test("kurtarma, davet ve kayıt e-postası 1 saat yazar; 24 saat hiçbirinde yok", () => {
  for (const [ad, uret] of Object.entries(epostalar)) {
    const tr = uret("tr");
    const en = uret("en");
    assert.match(tr, /Bağlantı 1 saat geçerlidir\./, `${ad} tr`);
    assert.match(en, /The link is valid for 1 hour\./, `${ad} en`);
    assert.doesNotMatch(tr, /24 saat/, `${ad} tr`);
    assert.doesNotMatch(en, /24 hours/, `${ad} en`);
  }
});

test("kurtarma e-postasının metni korundu (yalnızca süre kaynağı değişti)", () => {
  assert.match(epostalar.kurtarma("tr"), /Bağlantı 1 saat geçerlidir\. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez\./);
  assert.match(epostalar.kurtarma("en"), /The link is valid for 1 hour\. If you did not make this request, you can ignore this email; your password will not change\./);
});

test("kayıt ekranı süreyi aynı kaynaktan yazar; elle yazılmış süre yok", () => {
  const form = oku("app/kayit/kayit-formu.tsx");
  // Kullanıcıya giden metinde (yorumda eski davranış anlatılabilir).
  assert.doesNotMatch(form, /24 saat geçerli|valid for 24 hours/);
  assert.match(form, /Bağlantı \$\{baglantiSuresiMetni\(\)\.tr\} geçerli/);
  assert.match(form, /The link is valid for \$\{baglantiSuresiMetni\(\)\.en\}/);
  const eposta = oku("lib/email/auth-emails.ts");
  assert.doesNotMatch(eposta, /(Bağlantı|valid for) \d+ (saat|hour)/);
});

test("bağlantı üretme ve doğrulama mantığı değişmedi", () => {
  const auth = oku("app/actions/auth.ts");
  // Süre yalnızca METİN: kural modülü bağlantı üretmez, doğrulamaz, süreyi Supabase'e iletmez.
  assert.doesNotMatch(oku("lib/kimlik-kurallari.ts"), /generateLink|verifyOtp|otp_exp|expires|import .*supabase/i);
  assert.equal((auth.match(/admin\.auth\.admin\.generateLink\(/g) ?? []).length, 2);
});

/* ---------- Son doğrulama (11.11.2026) ---------- */

test("neden listesi kurulu @supabase/auth-js ile aynı; 'min_length' yalnızca belge örneğinde", () => {
  /*
    Kütüphanenin KAYNAK METNİ okunur (içe aktarılmaz, ağ yok). Kanıt:
    types.ts'teki çalışma zamanı listesi ['length', 'characters', 'pwned'];
    fetch.ts sunucunun dizisini dönüştürmeden geçiriyor. 'min_length' yalnızca
    errors.ts'teki bir JSDoc örneğinde geçiyor ve tipe bile uymuyor. Bu yüzden
    desteklenmiyor: gelirse genel metne düşer (yukarıdaki test). Kütüphane
    yükseltmesinde liste değişirse bu test kırmızıya döner.
  */
  const kaynak = oku("node_modules/@supabase/auth-js/src/lib/types.ts");
  const liste = kaynak.match(/const WeakPasswordReasons = \[([^\]]*)\] as const/);
  assert.ok(liste, "WeakPasswordReasons tanımı bulunamadı");
  const degerler = [...liste[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // Sıra önemli: deepEqual bir tip daraltması (asserts) yapar; ardından "min_length" derlenmez.
  assert.ok(!degerler.includes("min_length"));
  assert.deepEqual(degerler, [...ZAYIF_SIFRE_NEDENLERI]);
  const hatalar = oku("node_modules/@supabase/auth-js/src/lib/errors.ts");
  for (const satir of hatalar.split("\n").filter((s) => s.includes("min_length"))) {
    assert.match(satir.trim(), /^\*/, `min_length belge yorumu dışında geçiyor: ${satir}`);
  }
});

test("üç ekran da 12 karakter kuralından geçer: ilk şifre, kurtarma, Ayarlar", () => {
  // İlk şifre (?ilk=1) ve kurtarma AYNI sayfa: tek şifre formu, sunucu işlemi resetPassword.
  const sifirlama = oku("app/reset-password/page.tsx");
  assert.match(sifirlama, /<PasswordForm action=\{resetPassword\} variant="login"/);
  assert.equal((sifirlama.match(/<PasswordForm /g) ?? []).length, 1);
  assert.doesNotMatch(sifirlama, /type="password"/);
  // Ayarlar: tek şifre formu, sunucu işlemi changePassword.
  const ayarlar = oku("app/dashboard/settings/page.tsx");
  assert.match(ayarlar, /<PasswordForm action=\{changePassword\} variant="panel"/);
  assert.equal((ayarlar.match(/<PasswordForm /g) ?? []).length, 1);
  assert.doesNotMatch(ayarlar, /type="password"/);

  // Formun iki görünümü de iki kutusunda aynı sabiti kullanır.
  const form = oku("app/dashboard/settings/password-form.tsx");
  const login = form.slice(form.indexOf('if (variant === "login")'), form.indexOf('className="project-form-grid"'));
  const panel = form.slice(form.indexOf('className="project-form-grid"'));
  for (const [ad, parca] of [["login", login], ["panel", panel]] as const) {
    assert.equal((parca.match(/type="password"/g) ?? []).length, 2, ad);
    assert.equal((parca.match(/minLength=\{EN_KISA_SIFRE\}/g) ?? []).length, 2, ad);
  }

  // Sunucu: iki işlem de denetimi yapan tek yola iner (tarayıcı denetimi atlatılsa bile).
  const auth = oku("app/actions/auth.ts");
  const uygula = auth.slice(auth.indexOf("async function applyNewPassword("), auth.indexOf("async function yerelOturumuKapat("));
  assert.ok(uygula.indexOf("sifreUzunlukHatasi(password)") < uygula.indexOf("updateUser("), "uzunluk, Supabase çağrısından ÖNCE denetlenmeli");
});
