// AUTH A1 (18.11.2026): şifre kuralları uygulamanın DIŞINDAN, doğrudan Auth
// API'siyle aşılabiliyor mu? Uygulama yok; yalnızca gerçek GoTrue (yerel
// yığın, scripts/yerel-yigin/kur.sh) ve sentetik `@yerel.test` hesapları.
//
// Neden ayrı bir kabul: Ayarlar'daki mevcut şifre sorusu (app/actions/auth.ts)
// yalnızca uygulamanın sunucu işlemindeydi. Oturum belirteci tarayıcıda;
// oturumu ele geçiren biri `PUT /auth/v1/user {password}` isteğini uygulamaya
// uğramadan atıp mevcut şifreyi bilmeden yenisini koyabiliyordu. Sunucudaki
// denetim bu yüzden tek başına koruma değil; kuralı GoTrue uygulamalı
// ("Require current password when updating"). Bu betik istenen davranışı
// sınar: o ayar kapalıyken A2 FAIL verir (açık), açıkken hepsi PASS.
//
// Kullanım:
//   MEVCUT_SIFRE_ZORUNLU=true scripts/yerel-yigin/kur.sh && node scripts/yerel-yigin/gecit.mjs &
//   node scripts/yerel-yigin/sifre-api-kabul.mjs
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
import crypto from "node:crypto";
import fs from "node:fs";

const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const CIKTI = process.env.KIMLIK_CIKTI ?? new URL("./sonuclar/", import.meta.url).pathname;

const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const ANON = imzala({ role: "anon" });
const SERVIS = imzala({ role: "service_role" });

async function auth(yol, { yontem = "POST", govde, belirtec = ANON, apikey = ANON } = {}) {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem,
    headers: { apikey, Authorization: `Bearer ${belirtec}`, "Content-Type": "application/json" },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const json = await r.json().catch(() => null);
  return { durum: r.status, kod: json?.error_code ?? json?.code ?? "", json };
}
const yonetici = (yol, govde, yontem = "POST") => auth(yol, { yontem, govde, belirtec: SERVIS, apikey: SERVIS });

const saglik = await fetch(`${GECIT}/auth/v1/health`).then((r) => r.json()).catch(() => null);
if (!saglik?.version) {
  console.error(`ÖN KOŞUL YOK: GoTrue (${GECIT}/auth/v1/health)`);
  process.exit(2);
}

const sonuclar = [];
const kayit = (kimlik, ad, beklenen, gozlenen, gecti) => {
  sonuclar.push({ kimlik, ad, beklenen, gozlenen, sonuc: gecti ? "PASS" : "FAIL" });
  console.log(`${gecti ? "PASS" : "FAIL"}  ${kimlik}  ${ad}\n      beklenen: ${beklenen}\n      gözlenen: ${gozlenen}`);
};
const ozet = (r) => (r.durum === 200 ? "200" : `${r.durum} ${r.kod}`.trim());
const ek = crypto.randomBytes(3).toString("hex");
const eposta = (ad) => `a1-${ad}-${ek}@yerel.test`;
const sifre = () => `Kq7!${crypto.randomBytes(9).toString("base64url")}`;

// Şifre ONAYDAN SONRA konur: onay tetikleyicisi (20261106184046) onaydan önce konmuş şifreyi siler.
async function sifreliKullanici(adres, parola) {
  const r = await yonetici("/admin/users", { email: adres, email_confirm: true });
  if (r.durum >= 300) throw new Error(`kullanıcı açılamadı: ${r.durum}`);
  const g = await yonetici(`/admin/users/${r.json.id}`, { password: parola }, "PUT");
  if (g.durum >= 300) throw new Error(`şifre konamadı: ${g.durum}`);
}
const oturum = async (adres, parola) => (await auth("/token?grant_type=password", { govde: { email: adres, password: parola } })).json;
const yenile = async (o) => (await auth("/token?grant_type=refresh_token", { govde: { refresh_token: o.refresh_token } })).durum;
const girer = async (adres, parola) => (await auth("/token?grant_type=password", { govde: { email: adres, password: parola } })).durum === 200;
const sifreKoy = (o, govde) => auth("/user", { yontem: "PUT", belirtec: o.access_token, govde });
// E-postadaki bağlantının açtığı oturum: uygulama da token_hash'i /verify ile çözüyor (app/auth/confirm).
async function baglantiOturumu(tur, adres, parola) {
  const g = await yonetici("/admin/generate_link", { type: tur, email: adres, ...(parola ? { password: parola } : {}) });
  if (g.durum >= 300) throw new Error(`bağlantı üretilemedi (${tur}): ${g.durum}`);
  const v = await auth("/verify", { govde: { type: tur, token_hash: g.json.hashed_token ?? g.json.properties?.hashed_token } });
  if (v.durum !== 200) throw new Error(`bağlantı doğrulanamadı (${tur}): ${v.durum} ${v.kod}`);
  return v.json;
}

/* ---------- A: şifreli kullanıcı, oturumu açık (ele geçirilmiş olabilir) ---------- */
const a = eposta("sifreli"), eski = sifre(), yeni = sifre();
await sifreliKullanici(a, eski);
const birinci = await oturum(a, eski), ikinci = await oturum(a, eski);

let r = await sifreKoy(birinci, { password: "Kq7!abc" });
kayit("A1", "7 karakterlik şifre Auth API'sinde de reddedilir", "422 weak_password", ozet(r), r.durum === 422 && r.kod === "weak_password");

r = await sifreKoy(birinci, { password: yeni });
const eskiHala = await girer(a, eski);
kayit("A2", "mevcut şifre olmadan doğrudan PUT /user reddedilir", "400 current_password_required, şifre değişmez", `${ozet(r)}, eski şifre ${eskiHala ? "geçerli" : "GEÇERSİZ"}`, r.durum === 400 && r.kod === "current_password_required" && eskiHala);
const guncel = eskiHala ? eski : yeni; // A2 düşerse şifre değişmiştir; sonraki adımlar gerçek şifreyle sürer

r = await sifreKoy(birinci, { password: sifre(), current_password: "Yanlis-Kq7!x9" });
kayit("A3", "yanlış mevcut şifreyle reddedilir", "400 current_password_invalid", ozet(r), r.durum === 400 && r.kod === "current_password_invalid");

const sekiz = `Kq7!${crypto.randomBytes(3).toString("hex").slice(0, 4)}`; // tam 8 karakter
r = await sifreKoy(birinci, { password: sekiz, current_password: guncel });
kayit("A4", "8 karakter + doğru mevcut şifre kabul edilir", "200, yeni şifreyle giriş", `${ozet(r)}, giriş ${(await girer(a, sekiz)) ? "var" : "YOK"}`, r.durum === 200 && (await girer(a, sekiz)));

{ const d = await yenile(ikinci); kayit("A5", "şifre değişince öteki oturum kapanır", "yenileme 400", String(d), d === 400); }
{ const d = await yenile(birinci); kayit("A6", "değiştiren oturum açık kalır", "yenileme 200", String(d), d === 200); }

/* ---------- B: şifre sıfırlama (mevcut şifre bilinmiyor) ---------- */
const acik = await oturum(a, sekiz);
const kurtarma = await baglantiOturumu("recovery", a);
const sifirlanan = sifre();
r = await sifreKoy(kurtarma, { password: sifirlanan });
kayit("B1", "sıfırlama bağlantısının oturumu mevcut şifresiz şifre koyar", "200, yeni şifreyle giriş", `${ozet(r)}, giriş ${(await girer(a, sifirlanan)) ? "var" : "YOK"}`, r.durum === 200 && (await girer(a, sifirlanan)));
{ const d = await yenile(acik); kayit("B2", "sıfırlamadan sonra önceki oturum kapanır", "yenileme 400", String(d), d === 400); }

/* ---------- C: kayıt → e-posta onayı → ilk şifre (uygulamanın kayıt yolu) ---------- */
const c = eposta("ilk");
// Uygulama kaydı rastgele, saklanmayan bir şifreyle açıyor; onay tetikleyicisi onu siler (app/actions/auth.ts signUp).
const kayitOturumu = await baglantiOturumu("signup", c, `${crypto.randomBytes(32).toString("base64url")}aA1!`);
const ilk = sifre();
r = await sifreKoy(kayitOturumu, { password: ilk });
kayit("C1", "e-posta onayından sonra ilk şifre mevcut şifresiz konur", "200, ilk şifreyle giriş", `${ozet(r)}, giriş ${(await girer(c, ilk)) ? "var" : "YOK"}`, r.durum === 200 && (await girer(c, ilk)));
r = await sifreKoy(await oturum(c, ilk), { password: sifre() });
kayit("C2", "ilk şifreden sonra şifreyle açılan oturum mevcut şifre ister", "400 current_password_required", ozet(r), r.durum === 400 && r.kod === "current_password_required");

const sonuc = { tarih: new Date().toISOString(), gotrue: saglik.version, sonuclar };
fs.mkdirSync(CIKTI, { recursive: true });
fs.writeFileSync(`${CIKTI}/sifre-api-kabul.json`, JSON.stringify(sonuc, null, 2));
const dusen = sonuclar.filter((s) => s.sonuc === "FAIL").length;
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS (GoTrue ${saglik.version})`);
process.exit(dusen ? 1 : 0);
