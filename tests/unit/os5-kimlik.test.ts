import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EN_KISA_SIFRE } from "@/lib/kayit";

/*
  Signature OS 5 / Phase 2: kimlik ekranları (giriş, kayıt, şifremi
  unuttum, yeni şifre, bağlantı onayı) yeni yerleşime geçti. Faz yalnızca
  SUNUM katmanını değiştirebilir (kurum sahibinin şartı, 12.11.2026); bu
  dosya Auth sözleşmesinin değişmediğini sabitliyor:
   - formlar aynı sunucu eylemlerine, aynı alan adlarıyla gidiyor;
   - şifre kuralı ve bağlantı süresi metni aynı;
   - eylemlerin yönlendirdiği her hata kodunun ekranda bir metni var;
   - yeni CSS yalnızca kimlik ekranlarına dokunuyor.
  Bileşenler React'e bağlı olduğu için kaynak metni okunuyor; görsel ve
  klavye kabulü tarayıcıda yapıldı (PR açıklaması).
*/

const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (metin: string) => metin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SAYFALAR = ["app/page.tsx", "app/kayit/page.tsx", "app/forgot-password/page.tsx", "app/reset-password/page.tsx", "app/auth/dogrula/page.tsx"];

describe("kimlik ekranları ortak yerleşimi kullanır", () => {
  for (const sayfa of SAYFALAR) {
    test(sayfa, () => {
      const kaynak = oku(sayfa);
      assert.match(kaynak, /<KimlikYerlesimi>/);
      assert.doesNotMatch(kaynak, /auth-simple-page|login-card|auth-theme-toggle/, "eski tek kart iskeleti kalmamalı");
    });
  }
  test("yerleşim sunum katmanıdır: Supabase, eylem ya da yönlendirme yok", () => {
    const kaynak = yorumsuz(oku("app/_components/kimlik/kimlik-yerlesimi.tsx"));
    assert.doesNotMatch(kaynak, /supabase|@\/app\/actions|redirect\(|cookies\(|headers\(/);
  });
  test("DOM'da form marka alanından önce (sekme ve ekran okuyucu sırası)", () => {
    const k = oku("app/_components/kimlik/kimlik-yerlesimi.tsx");
    assert.ok(k.indexOf('className="os5-kimlik-form"') < k.indexOf('className="os5-kimlik-marka"'));
    assert.match(oku("app/styles/os5-kimlik.css"), /\.os5-kimlik-marka \{\s*order: -1;/);
  });
  test("marka alanı lacivert: logo temadan bağımsız koyu varyant", () => {
    assert.match(oku("app/_components/kimlik/kimlik-yerlesimi.tsx"), /<ArvoLabLogosu[^>]*zemin="koyu"/);
    const logo = oku("app/_components/arvolab-logosu.tsx");
    assert.match(logo, /zemin === "koyu"[\s\S]*?src="\/arvolab-logo-koyu\.png"/);
  });
});

describe("formlar aynı eylemlere, aynı alan adlarıyla gidiyor", () => {
  test("giriş: login, email/password/next; kimlikler ve autocomplete aynı", () => {
    const k = oku("app/_components/giris-formu.tsx");
    assert.match(k, /action=\{login\}/);
    assert.match(k, /id="email"\s+name="email"\s+type="email"/);
    assert.match(k, /id="password"\s+name="password"/);
    assert.match(k, /autoComplete="current-password"/);
    assert.match(k, /name="next" value=\{next\}/);
  });
  test("şifre sıfırlama penceresi: girişteki adresi #email'den alır, eylem aynı", () => {
    const k = oku("app/_components/sifre-sifirlama-penceresi.tsx");
    assert.match(k, /useActionState\(sifreSifirlamaIste, BASLANGIC\)/);
    assert.match(k, /getElementById\("email"\)/);
    assert.match(k, /href="\/forgot-password"/);
  });
  test("şifre sıfırlama penceresinde autoFocus yok (odak iadesini bozuyordu)", () => {
    assert.doesNotMatch(yorumsuz(oku("app/_components/sifre-sifirlama-penceresi.tsx")), /autoFocus/);
  });
  test("şifremi unuttum sayfası: requestPasswordReset, email", () => {
    const k = oku("app/forgot-password/page.tsx");
    assert.match(k, /action=\{requestPasswordReset\}/);
    assert.match(k, /name="email"/);
  });
  test("bağlantı onayı: POST /auth/confirm, üç gizli alan, belirteç sayfada harcanmaz", () => {
    const k = oku("app/auth/dogrula/page.tsx");
    assert.match(k, /method="post" action="\/auth\/confirm"/);
    for (const alan of ["token_hash", "type", "next"]) assert.match(k, new RegExp(`type="hidden" name="${alan}"`));
    assert.match(k, /safeConfirmNext\(next \?\? null\)/);
    assert.doesNotMatch(yorumsuz(k), /verifyOtp|exchangeCode/);
  });
  test("kayıt: signUp ve bütün alan adları", () => {
    const k = oku("app/kayit/kayit-formu.tsx");
    assert.match(k, /signUp\(_onceki, formData\)/);
    for (const ad of ["fullName", "email", "phone", "password", "passwordRepeat", "sozlesme", "kvkk", "iletisim", "sozlesmeOkundu"]) {
      assert.match(k, new RegExp(`name="${ad}"`), `${ad} alanı`);
    }
    assert.match(k, /pattern="\\\+\?\[\\d\\s\(\)\.\\-\]\{10,20\}"/, "telefon deseni lib/kayit.ts ile aynı kalmalı");
  });
  test("kayıt: sözleşme okunmadan işaretlenmez (kontrollü kutu aynı)", () => {
    const k = oku("app/kayit/kayit-formu.tsx");
    assert.match(k, /if \(!okundu\) \{\s*e\.preventDefault\(\);\s*setOkuyor\(true\);/);
    assert.match(k, /disabled=\{!sona\}/);
  });
  test("yeni şifre: resetPassword, password/passwordConfirm", () => {
    assert.match(oku("app/reset-password/page.tsx"), /action=\{resetPassword\}/);
    const k = oku("app/dashboard/settings/password-form.tsx");
    assert.match(k, /id="password" name="password"/);
    assert.match(k, /id="passwordConfirm" name="passwordConfirm"/);
  });
});

describe("şifre kuralı ve bağlantı süresi değişmedi", () => {
  /*
    Bu faz kural değiştirmez. Kurum sahibinin talimatı "mevcut minimum 12
    karakter" diyordu; kodda kural 8 (lib/kayit.ts, app/actions/auth.ts —
    G1 dalları da 8). Kural BİLEREK olduğu gibi bırakıldı: değiştirmek bir
    Auth kararıdır, sunum fazının işi değil. Kural değişirse bu test de
    bilinçli olarak güncellenir.
  */
  test("kayıtta en kısa şifre 8 ve form aynı sabiti kullanıyor", () => {
    assert.equal(EN_KISA_SIFRE, 8);
    const k = oku("app/kayit/kayit-formu.tsx");
    assert.equal(k.match(/minLength=\{EN_KISA_SIFRE\}/g)?.length, 2);
  });
  test("sıfırlamada en kısa şifre 8 (sunucu) ve form aynı sınırı söylüyor", () => {
    assert.match(oku("app/actions/auth.ts"), /const MIN_PASSWORD_LENGTH = 8;/);
    const k = oku("app/dashboard/settings/password-form.tsx");
    assert.ok((k.match(/minLength=\{8\}/g)?.length ?? 0) >= 2);
    assert.match(oku("app/reset-password/page.tsx"), /En az 8 karakterlik/);
  });
  test("doğrulama bağlantısının süresi metinde 24 saat", () => {
    assert.match(oku("app/kayit/kayit-formu.tsx"), /Bağlantı 24 saat geçerli/);
  });
  test("ortak şifre bileşeni kural taşımıyor", () => {
    assert.doesNotMatch(oku("app/_components/ui/sifre-girdisi.tsx"), /minLength=\{|EN_KISA_SIFRE|MIN_PASSWORD/);
  });
});

describe("eylemlerin yönlendirdiği her hata kodunun ekranda metni var", () => {
  /*
    Bir kod haritadan düşerse kullanıcı hiçbir şey görmeden aynı ekrana
    döner ("giriş yapamıyorum ama hata da yok"). Yeniden yazılan sayfalarda
    haritaların kopyalanması gerekiyordu; bu test kopyanın eksiksiz olduğunu
    eylemlerin kendisinden türeterek sınar.
  */
  const kodlar = (yollar: string[], desen: RegExp) => new Set(yollar.flatMap((y) => [...oku(y).matchAll(desen)].map((m) => m[1])));
  const anaSayfaHaritalari = oku("app/page.tsx");

  test("giriş sayfası (/?error=…)", () => {
    const beklenen = kodlar(["app/actions/auth.ts", "app/actions/subscription.ts", "app/actions/kart-odeme.ts", "app/auth/confirm/route.ts"], /["'`]\/\?error=([a-z-]+)/g);
    assert.ok(beklenen.size >= 6);
    for (const kod of beklenen) assert.match(anaSayfaHaritalari, new RegExp(`"${kod}":`), `/?error=${kod} metinsiz`);
  });
  test("giriş sayfası (/?bilgi=…)", () => {
    const beklenen = kodlar(["app/actions/hesap.ts"], /\/\?bilgi=([a-z-]+)/g);
    assert.ok(beklenen.size >= 1);
    for (const kod of beklenen) assert.match(anaSayfaHaritalari, new RegExp(`"${kod}":`));
    assert.match(anaSayfaHaritalari, /\[BASKA_CIHAZ_BILGISI\]:/);
  });
  test("şifremi unuttum sayfası (?error=…)", () => {
    const beklenen = kodlar(["app/actions/auth.ts"], /\/forgot-password\?error=([a-z-]+)/g);
    const sayfa = oku("app/forgot-password/page.tsx");
    for (const kod of beklenen) assert.match(sayfa, new RegExp(`"${kod}":`));
    assert.match(sayfa, /params\.sent === "1"/);
  });
  test("hata kutusu kesinti (alert), bilgi kutusu duyuru (status)", () => {
    assert.match(anaSayfaHaritalari, /<Bildirim ton="hata" rol="alert">\s*\{t\(hata\)\}/);
    assert.match(anaSayfaHaritalari, /<Bildirim ton="uyari" rol="status">\s*\{t\(bilgi\)\}/);
  });
});

describe("kimlik CSS'i yalnızca kimlik ekranlarına dokunur", () => {
  const css = yorumsuz(oku("app/styles/os5-kimlik.css"));
  const seciciler = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(to|from|\d+%)$/.test(s));
  test("her seçici os5-kimlik sınıfına bağlı", () => {
    assert.ok(seciciler.length > 30);
    for (const s of seciciler) for (const parca of s.split(",")) assert.match(parca, /\.os5-kimlik/, `kimliğe bağlı olmayan seçici: ${parca.trim()}`);
  });
  test("ham renk yok, en küçük yazı 11 px", () => {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 11, `${m[1]}px`);
  });
  test("azaltılmış hareket karşılığı var", () => {
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
  test("404 sayfasının kuralları auth.css'te duruyor (bu fazın dışında)", () => {
    const auth = oku("app/styles/auth.css");
    for (const sinif of [".auth-simple-page", ".login-card", ".login-heading", ".login-kicker", ".login-button", ".auth-theme-toggle"]) assert.ok(auth.includes(sinif), sinif);
  });
});
