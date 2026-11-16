import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { amrKayitlari, sifirlamaKarari } from "../../lib/sifre-yetkisi";
import { DOGRULAMA_BAGLANTISI_SANIYE } from "../../lib/kimlik-kurallari";

/*
  RELEASE CLOSURE 03 (16.11.2026): mevcut şifre olmadan şifre değişikliği
  yalnızca e-postadaki bağlantıyla açılmış taze oturuma ya da henüz şifresi
  olmayan hesaba açık (lib/sifre-yetkisi.ts). Eskiden resetPassword her
  açık oturumu kabul ediyordu; şifreyle açılmış oturum Ayarlar'daki mevcut
  şifre denetimini bu işlemi doğrudan çağırarak atlatabiliyordu.
*/

const SIMDI = 1_800_000_000;
const yuk = (govde: object) => `x.${Buffer.from(JSON.stringify(govde)).toString("base64url")}.y`;

test("AMR: yöntem ve zaman okunur; bozuk/eksik kayıt atlanır", () => {
  assert.deepEqual(amrKayitlari(yuk({ amr: [{ method: "otp", timestamp: 5 }, { method: "password" }, "otp", { timestamp: 3 }] })), [{ method: "otp", timestamp: 5 }]);
  for (const kotu of [null, undefined, "", "abc", "a.!!!.b", yuk({}), yuk({ amr: "otp" })]) assert.deepEqual(amrKayitlari(kotu), []);
});

test("şifreyle açılmış oturum mevcut şifre olmadan değiştiremez", () => {
  assert.equal(sifirlamaKarari([{ method: "password", timestamp: SIMDI - 10 }], false, SIMDI), "yetkisiz");
  // ilk_sifre okunamadı: yetki "evet" sayılmaz.
  assert.equal(sifirlamaKarari([{ method: "password", timestamp: SIMDI - 10 }], null, SIMDI), "yetkisiz");
  assert.equal(sifirlamaKarari([], null, SIMDI), "yetkisiz");
});

test("bağlantıyla açılmış oturum: süre içinde izin, süre dolunca ret", () => {
  for (const method of ["otp", "recovery", "magiclink", "invite", "email/signup"]) {
    assert.equal(sifirlamaKarari([{ method, timestamp: SIMDI - 60 }], false, SIMDI), "izin", method);
    assert.equal(sifirlamaKarari([{ method, timestamp: SIMDI - DOGRULAMA_BAGLANTISI_SANIYE }], false, SIMDI), "izin", `${method} sınır`);
    assert.equal(sifirlamaKarari([{ method, timestamp: SIMDI - DOGRULAMA_BAGLANTISI_SANIYE - 1 }], false, SIMDI), "suresi-doldu", `${method} geç`);
  }
  // Saat kayması payı 60 sn; daha ilerideki damga kabul edilmez.
  assert.equal(sifirlamaKarari([{ method: "otp", timestamp: SIMDI + 30 }], false, SIMDI), "izin");
  assert.equal(sifirlamaKarari([{ method: "otp", timestamp: SIMDI + 3600 }], false, SIMDI), "suresi-doldu");
});

test("şifresi olmayan hesap (ilk şifre) süreden bağımsız izinli: kilitlenme yok", () => {
  assert.equal(sifirlamaKarari([{ method: "otp", timestamp: SIMDI - 30 * 86400 }], true, SIMDI), "izin");
  assert.equal(sifirlamaKarari([], true, SIMDI), "izin");
});

/* Sunucu sözleşmesi: kaynak metinden (tests/unit Next'e dokunmaz). */
const oku = (yol: string) => fs.readFileSync(yol, "utf8");
const auth = oku("app/actions/auth.ts");
const uygula = auth.slice(auth.indexOf("async function applyNewPassword("), auth.indexOf("/*\n  İLK ŞİFRE / SIFIRLAMA EKRANINDAN ÇIKIŞ"));

test("Ayarlar mevcut şifreyi Supabase'e karşı doğrular; adres formdan alınmaz", () => {
  assert.match(uygula, /if \(baglam === "ayarlar"\) \{[\s\S]*?mevcutSifreyiDogrula\(user, mevcut\)/);
  const dogrula = auth.slice(auth.indexOf("async function mevcutSifreyiDogrula("), auth.indexOf("async function applyNewPassword("));
  assert.match(dogrula, /const email = kullanici\.email\?\.trim\(\);/);
  assert.doesNotMatch(dogrula, /formData/);
  assert.match(dogrula, /createDogrulamaClient\(\)/);
  assert.match(dogrula, /data\.user\?\.id === kullanici\.id/);
  // Hatalı deneme girişle AYNI sayaca yazılır.
  assert.match(dogrula, /rate_limit_hit", \{ p_key: anahtar\.adres/);
  // Doğrulamanın oturumu kapatılır.
  assert.match(dogrula, /dogrulayici\.auth\.signOut\(\{ scope: "local" \}\)/);
});

test("kurtarma yolu sifirlamaKarari'ndan geçer ve karar updateUser'dan ÖNCE", () => {
  const karar = uygula.indexOf("sifirlamaKarari(");
  assert.ok(karar > 0);
  assert.ok(karar < uygula.indexOf("updateUser("));
  assert.ok(uygula.indexOf("mevcutSifreyiDogrula(") < uygula.indexOf("updateUser("));
});

test("başarılı değişiklikten sonra diğer oturumlar kapatılır", () => {
  const guncelle = uygula.indexOf("updateUser(");
  const digerleri = uygula.indexOf('signOut({ scope: "others" })');
  assert.ok(digerleri > guncelle, "diğer oturumlar şifre değiştikten SONRA kapatılmalı");
});

test("ilk şifre kapısı sunucu tarafında: getAuthContext ve kritik işlemler", () => {
  const korumalar = oku("lib/auth-guards.ts");
  assert.match(korumalar, /if \(await ilkSifreBekliyor\(supabase, user\.id\)\) return null;/);
  assert.match(oku("app/actions/hesap.ts"), /ilkSifreEngeli\(supabase, user\.id\)/);
  assert.match(oku("app/actions/kart-odeme.ts"), /ilkSifreEngeli\(supabase, user\.id\)/);
  assert.equal((oku("app/actions/subscription.ts").match(/ilkSifreEngeli\(supabase, user\.id\)/g) ?? []).length, 2);
  // Okunamayan durum kapıyı kapatmaz (mevcut kullanıcı kilitlenmez): karar ilkSifreGerekli'den.
  assert.match(korumalar, /return ilkSifreGerekli\(await ilkSifreDurumu\(supabase\)\);/);
});
