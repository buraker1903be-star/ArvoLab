import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EN_KISA_SIFRE, EN_UZUN_SIFRE, SIFRE_BAYT_SINIRI, SIFRE_ESLESMEDI, DOGRULAMA_BAGLANTISI_SANIYE, baglantiSuresiMetni, sifreKuraliHatasi } from "../../lib/kimlik-kurallari";
import { YAYGIN_SIFRE_LISTESI, YAYGIN_SIFRE_SAYISI, tekKarakterTekrariMi, yayginSifreMi } from "../../lib/yaygin-sifreler";
import { ZAYIF_SIFRE_NEDENLERI, sifreHatasi, zayifSifreNedenleri } from "../../lib/sifre-hatasi";
import { inviteEmail, resetPasswordEmail, signUpConfirmEmail } from "../../lib/email/auth-emails";

/*
  G1-C A0–A2 (11.11.2026) ve G1-D D1 (11.11.2026): şifre politikası, zayıf
  şifre nedenleri ve doğrulama bağlantısı süresi. D1'de ürün kararıyla en az
  uzunluk 12'den 8'e indi; en fazla 64 karakter, 72 bayt ve yaygın şifre
  denetimi eklendi.

  Gerçek Supabase'in ne zaman hangi nedeni döndürdüğü burada SINANMIYOR
  (ağsız birim testi). Hata nesnesinin biçimi @supabase/auth-js 2.112.1'den
  okundu: updateUser, "weak_password" kodunda AuthWeakPasswordError atıyor
  ve nedenleri `reasons` dizisinde taşıyor (lib/fetch.js, lib/errors.js).
  Aşağıdaki nesneler o biçimin taklidi; kütüphanenin sınıfı içe aktarılmaz
  (tests/unit Supabase'e dokunmaz).
*/

const oku = (yol: string) => fs.readFileSync(yol, "utf8");
/* Yaygın listede olmayan, kurala uyan bir şifre üretir (n karakter). */
const guclu = (n: number) => "Kq7!mZ2x".repeat(Math.ceil(n / 8)).slice(0, n);

/* ---------- D1: şifre politikası ---------- */

test("politika: en az 8, en fazla 64 karakter, 72 bayt", () => {
  assert.equal(EN_KISA_SIFRE, 8);
  assert.equal(EN_UZUN_SIFRE, 64);
  assert.equal(SIFRE_BAYT_SINIRI, 72);
});

test("sınır: 7 reddedilir, 8 kabul edilir", () => {
  assert.deepEqual(sifreKuraliHatasi(guclu(7)), { tr: "Şifre en az 8 karakter olmalı.", en: "Password must be at least 8 characters." });
  assert.equal(sifreKuraliHatasi(guclu(8)), null);
  assert.notEqual(sifreKuraliHatasi(""), null);
});

test("sınır: 64 kabul edilir, 65 reddedilir", () => {
  assert.equal(sifreKuraliHatasi(guclu(64)), null);
  assert.deepEqual(sifreKuraliHatasi(guclu(65)), { tr: "Şifre en fazla 64 karakter olabilir.", en: "Password can be at most 64 characters." });
});

test("büyük harf, rakam ya da sembol zorunlu değil", () => {
  assert.equal(sifreKuraliHatasi("gunesli bir sabah"), null);
  assert.equal(sifreKuraliHatasi("kirmizibalkon"), null);
});

test("72 bayt: Türkçe harfler iki bayt; sınır nedeniyle birlikte söylenir", () => {
  // Tekrar olmayan Türkçe harf dizisi (tek karakter tekrarı "yaygın" sayılır, burada sınanan o değil).
  // 36 Türkçe harf = 72 bayt (sınırda, kabul); 37 harf = 74 bayt (yalnızca 37 karakter olsa da ret).
  const tr36 = "çğışöü".repeat(6);
  assert.equal(tr36.length, 36);
  assert.equal(new TextEncoder().encode(tr36).length, 72);
  assert.equal(sifreKuraliHatasi(tr36), null);
  const m = sifreKuraliHatasi(tr36 + "ç");
  assert.ok(m);
  assert.match(m.tr, /en fazla 72 bayt/);
  assert.match(m.tr, /Türkçe harfler/);
  assert.match(m.en, /at most 72 bytes/);
  // 64 karakter sınırının içinde ama bayt sınırının dışında: 34 ASCII + 30 "ğ" = 64 karakter, 94 bayt.
  const karisik = "a".repeat(34) + "ğ".repeat(30);
  assert.equal(karisik.length, 64);
  assert.match(sifreKuraliHatasi(karisik)?.tr ?? "", /72 bayt/);
  // ASCII'de 64 karakter 64 bayt: tam desteklenir.
  assert.equal(new TextEncoder().encode(guclu(64)).length, 64);
});

test("uzunluk tarayıcının minLength'iyle aynı birimle ölçülür (UTF-16)", () => {
  // Türkçe harf tek birim sayılır: 8 Türkçe harf (16 bayt) geçer, 7 geçmez.
  assert.equal(sifreKuraliHatasi("çğışöüçğ"), null);
  assert.deepEqual(sifreKuraliHatasi("çğışöüç")?.tr, "Şifre en az 8 karakter olmalı.");
});

test("yaygın şifreler reddedilir; büyük/küçük harf ve Türkçe İ/I farkı kurtarmaz", () => {
  for (const s of ["12345678", "password", "Password1", "PASSWORD123", "qwerty123", "sifre123", "ŞİFRE123", "Galatasaray", "ADMIN123"]) {
    assert.ok(yayginSifreMi(s), s);
    assert.deepEqual(sifreKuraliHatasi(s), { tr: "Bu şifre çok yaygın ve kolay tahmin edilir; başka bir şifre seçin.", en: "This password is too common and easy to guess; choose a different one." }, s);
  }
  for (const s of [guclu(8), "kirmizibalkon", "password-ama-uzun-ve-ozel"]) assert.equal(yayginSifreMi(s), false, s);
});

test("tek karakter tekrarı: ayrı kural, ayrı mesaj (\"yaygın\" denmez)", () => {
  const TEKRAR = { tr: "Şifre tek bir karakterin tekrarından oluşamaz.", en: "The password cannot be a single character repeated." };
  // Gerçek testteki durum: kırpılmış 64 "A" (eskiden "çok yaygın" deniyordu).
  for (const s of ["aaaaaaaa", "A".repeat(64), "11111111", "çççççççç", "        "]) {
    assert.ok(tekKarakterTekrariMi(s), JSON.stringify(s));
    assert.deepEqual(sifreKuraliHatasi(s), TEKRAR, JSON.stringify(s));
  }
  for (const s of ["A".repeat(63) + "Z", "aaaaaaab", guclu(8)]) assert.equal(tekKarakterTekrariMi(s), false, s);
  // 64 "A" + "Z" (65 karakter) artık "en fazla 64" der: asıl neden uzunluk.
  assert.match(sifreKuraliHatasi("A".repeat(64) + "Z")?.tr ?? "", /en fazla 64/);
  // Yaygın liste tekrarı artık kendi saymıyor.
  assert.equal(yayginSifreMi("aaaaaaaa"), false);
});

test("65 ve 73 karakter: tamamı değerlendirilir, uzunluk nedeniyle reddedilir", () => {
  const s65 = guclu(65);
  const s73 = guclu(73);
  assert.equal(s65.length, 65);
  assert.equal(s73.length, 73);
  for (const s of [s65, s73]) assert.deepEqual(sifreKuraliHatasi(s), { tr: "Şifre en fazla 64 karakter olabilir.", en: "Password can be at most 64 characters." });
  // İlk 64 karakteri geçerli: kural kırpılmış hâli değil, girilenin tamamını değerlendiriyor.
  assert.equal(sifreKuraliHatasi(s73.slice(0, 64)), null);
});

test("şifre eşleşmeme metni tek kaynakta; sunucu ve form aynı metni kullanır", () => {
  assert.deepEqual(SIFRE_ESLESMEDI, { tr: "Şifreler eşleşmiyor.", en: "The passwords do not match." });
  const auth = oku("app/actions/auth.ts");
  assert.match(auth, /if \(password !== passwordConfirm\) \{\s*return \{ error: t\(SIFRE_ESLESMEDI\) \};/);
  assert.doesNotMatch(auth, /"Şifreler eşleşmiyor\."/);
  const form = oku("app/dashboard/settings/password-form.tsx");
  assert.match(form, /tekrar\.setCustomValidity\(tekrar\.value && tekrar\.value !== sifre\.value \? t\(SIFRE_ESLESMEDI\) : ""\)/);
  // Şifre kutusu değişince de eşleşme yeniden hesaplanır (önce tekrar, sonra şifre düzeltilirse eski mesaj kalmasın).
  assert.match(form, /const sifreDenetle[\s\S]*?eslesmeyiDenetle\(kutu\.form\);/);
});

test("yaygın liste: her eleman en az 8 karakter (kısası zaten uzunluktan düşer) ve tekrar yok", () => {
  assert.ok(YAYGIN_SIFRE_LISTESI.length >= 50);
  for (const s of YAYGIN_SIFRE_LISTESI) assert.ok(s.length >= EN_KISA_SIFRE, s);
  assert.ok(YAYGIN_SIFRE_SAYISI <= YAYGIN_SIFRE_LISTESI.length);
});

test("kural sırası: kısa → uzun → bayt → tekrar → yaygın", () => {
  assert.match(sifreKuraliHatasi("1234567")?.tr ?? "", /en az 8/); // hem kısa hem yaygın görünümlü: kısa söylenir
  assert.match(sifreKuraliHatasi("a".repeat(65))?.tr ?? "", /en fazla 64/); // hem uzun hem tekrar: uzun söylenir
});

test("sunucu, form ve metinler aynı kuralı kullanır; elle yazılmış sayı yok", () => {
  const auth = oku("app/actions/auth.ts");
  assert.doesNotMatch(auth, /MIN_PASSWORD_LENGTH|sifreUzunlukHatasi/);
  assert.match(auth, /import \{ SIFRE_ESLESMEDI, sifreKuraliHatasi \} from "@\/lib\/kimlik-kurallari";/);
  assert.match(auth, /const kuralHatasi = sifreKuraliHatasi\(password\);/);
  // Sonuç KULLANILMALI: hesaplanıp bir kenara bırakılan denetim hiçbir şeyi engellemez.
  assert.match(auth, /if \(kuralHatasi\) return \{ error: t\(kuralHatasi\) \};/);

  const form = oku("app/dashboard/settings/password-form.tsx");
  assert.doesNotMatch(form, /minLength=\{\d+\}/);
  // maxLength YOK: tarayıcı fazlasını sessizce kırpıyordu (G1-D). 64 sınırı kural fonksiyonuyla söyleniyor.
  assert.doesNotMatch(form, /maxLength=\{/);
  // İki görünümde ikişer kutu: şifre kutuları kural denetimi, tekrar kutuları eşleşme denetimi.
  assert.equal((form.match(/name="password" type="password" autoComplete="new-password" minLength=\{EN_KISA_SIFRE\} onInput=\{sifreDenetle\} required/g) ?? []).length, 2);
  assert.equal((form.match(/name="passwordConfirm" type="password" autoComplete="new-password" minLength=\{EN_KISA_SIFRE\} onInput=\{tekrarDenetle\} required/g) ?? []).length, 2);
  assert.match(form, /sifreKuraliHatasi\(kutu\.value\)/);
  assert.match(form, /setCustomValidity/);

  for (const yol of ["app/reset-password/page.tsx", "app/dashboard/settings/page.tsx"]) {
    const kaynak = oku(yol);
    assert.doesNotMatch(kaynak, /\b(8|12|64) karakter|\b(8|12|64) characters/, yol);
    assert.match(kaynak, /\$\{EN_KISA_SIFRE\}–\$\{EN_UZUN_SIFRE\}/, yol);
  }
});

test("ilk şifre, kurtarma ve Ayarlar aynı kuraldan geçer (tek uygulama yolu)", () => {
  const auth = oku("app/actions/auth.ts");
  // Kural denetimi yalnızca applyNewPassword'de; üç akış da oraya iner.
  assert.equal((auth.match(/sifreKuraliHatasi\(/g) ?? []).length, 1);
  assert.match(auth, /export async function resetPassword[\s\S]*?applyNewPassword\(formData, "sifirlama"\)/);
  assert.match(auth, /export async function changePassword[\s\S]*?applyNewPassword\(formData, "ayarlar"\)/);
  // Kayıt rastgele, saklanmayan bir şifreyle açılır: kural fonksiyonundan geçmez, ama 64/72 sınırını da aşmamalı
  // (Supabase 72 bayttan uzununu reddeder). base64url(32 bayt) = 43 karakter + "aA1!" = 47 ASCII.
  const kayit = auth.match(/password: `\$\{randomBytes\((\d+)\)\.toString\("base64url"\)\}aA1!`/);
  assert.ok(kayit, "kayıttaki rastgele şifre kalıbı değişti");
  const uzunluk = Math.ceil((Number(kayit[1]) * 4) / 3) + 4;
  assert.ok(uzunluk >= EN_KISA_SIFRE && uzunluk <= EN_UZUN_SIFRE && uzunluk <= SIFRE_BAYT_SINIRI);
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
  assert.match(m.tr, /en az 8 karakter/);
  assert.match(m.en, /at least 8 characters/);
  assert.doesNotMatch(m.tr, /sızıntı|sembol/);
});

test("characters: karakter türlerini söyler", () => {
  const m = sifreHatasi("weak_password", "ayarlar", ["characters"]);
  assert.match(m.tr, /karakter türlerini/);
  assert.match(m.en, /character types/);
  assert.doesNotMatch(m.tr, /sızıntı|en az 8/);
});

test("pwned: veri sızıntısını söyler, sembol eklemeyi önermez", () => {
  const m = sifreHatasi("weak_password", "sifirlama", ["pwned"]);
  assert.match(m.tr, /veri sızıntısında/);
  assert.match(m.en, /data breach/);
  assert.doesNotMatch(m.tr, /sembol/);
});

test("birden çok neden: hepsi, sabit sırayla", () => {
  const m = sifreHatasi("weak_password", "sifirlama", ["pwned", "length"]);
  assert.ok(m.tr.indexOf("en az 8") < m.tr.indexOf("sızıntı"));
  assert.ok(m.en.indexOf("at least 8") < m.en.indexOf("breach"));
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

test("üç ekran da aynı şifre kuralından geçer: ilk şifre, kurtarma, Ayarlar", () => {
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
  assert.ok(uygula.indexOf("sifreKuraliHatasi(password)") < uygula.indexOf("updateUser("), "şifre kuralı, Supabase çağrısından ÖNCE denetlenmeli");
});
