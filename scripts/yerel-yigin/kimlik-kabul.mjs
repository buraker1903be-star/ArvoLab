// RELEASE CLOSURE 03 / G1: kimlik doğrulama kabulü — gerçek Next (next dev) +
// gerçek GoTrue + PostgreSQL (yerel yığın, scripts/yerel-yigin). Yalnızca
// 127.0.0.1 ve sentetik `@yerel.test` hesapları; gerçek bir Supabase
// projesine bağlanmaz. Şifreler bu betikte üretilir, hiçbir yere yazılmaz.
//
// Kullanım:
//   scripts/yerel-yigin/kur.sh && node scripts/yerel-yigin/gecit.mjs &
//   (next dev yığına bağlı, bkz. README) && node scripts/yerel-yigin/kimlik-kabul.mjs http://localhost:3124
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const UYGULAMA = process.argv[2] ?? "http://localhost:3124";
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const CIKTI = process.env.KIMLIK_CIKTI ?? new URL("./sonuclar/", import.meta.url).pathname;

if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(UYGULAMA)) {
  console.error("ÖN KOŞUL: uygulama adresi yalnızca localhost olabilir");
  process.exit(2);
}

const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const ANON = imzala({ role: "anon" });
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();

async function auth(yol, { yontem = "POST", govde, belirtec = ANON, apikey = ANON } = {}) {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem,
    headers: { apikey, Authorization: `Bearer ${belirtec}`, "Content-Type": "application/json" },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const metin = await r.text();
  let json = null;
  try {
    json = JSON.parse(metin);
  } catch {
    /* boş gövde */
  }
  return { durum: r.status, json };
}
const yonetici = (yol, govde) => auth(yol, { govde, belirtec: SERVIS, apikey: SERVIS });

// Ön koşullar
for (const [ad, adres] of [["gecit", `${GECIT}/auth/v1/health`], ["uygulama", `${UYGULAMA}/`]]) {
  const ok = await fetch(adres).then((r) => r.status < 500).catch(() => false);
  if (!ok) {
    console.error(`ÖN KOŞUL YOK: ${ad} (${adres})`);
    process.exit(2);
  }
}

const sonuclar = [];
const kayit = (kimlik, ad, beklenen, gozlenen, gecti) => {
  sonuclar.push({ kimlik, ad, beklenen, gozlenen, sonuc: gecti ? "PASS" : "FAIL" });
  console.log(`${gecti ? "PASS" : "FAIL"}  ${kimlik}  ${ad}\n      beklenen: ${beklenen}\n      gözlenen: ${gozlenen}`);
};
/* Bir senaryo çökerse (ör. eski kodda alan yok) FAIL yazılır, sıradaki senaryo koşar. */
async function senaryo(etiket, fn) {
  try {
    await fn();
  } catch (hata) {
    kayit(etiket, "senaryo tamamlanamadı", "senaryo koşar", String(hata?.message ?? hata).split("\n")[0].slice(0, 200), false);
  }
}
const ek = crypto.randomBytes(3).toString("hex");
const eposta = (ad) => `${ad}-${ek}@yerel.test`;
// Kurala uyan, yaygın olmayan şifreler (her koşuda yeni).
const sifre = () => `Kq7!${crypto.randomBytes(9).toString("base64url")}`;

/*
  Mevcut (onaylı, şifreli) kullanıcı. Şifre ONAYDAN SONRA konur: G1
  tetikleyicisi (20261106184046) onay anında, onaydan önce konmuş şifreyi
  siler; GoTrue yönetici "email_confirm: true + password" ile açarken de
  onayı ayrı bir güncellemeyle yazıyor ve şifre düşüyor (yerelde gözlendi).
*/
async function kullaniciAc(adres, parola) {
  const r = await yonetici("/admin/users", { email: adres, email_confirm: true });
  if (r.durum >= 300) throw new Error(`kullanıcı açılamadı: ${r.durum}`);
  const g = await auth(`/admin/users/${r.json.id}`, { yontem: "PUT", govde: { password: parola }, belirtec: SERVIS, apikey: SERVIS });
  if (g.durum >= 300) throw new Error(`şifre konamadı: ${g.durum}`);
  sozlesmeOnayla(r.json.id);
  return r.json.id;
}
// Kullanım sözleşmesi penceresi panelin üstünü kaplar; bu kabulün konusu değil (yalnızca yerel veritabanına onay satırı).
const SOZLESME_SURUMU = fs.readFileSync(new URL("../../lib/sozlesme/kullanim-sozlesmesi.ts", import.meta.url), "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
function sozlesmeOnayla(id) {
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi) values ('${id}', 'kullanim_sozlesmesi', '${SOZLESME_SURUMU}', 'tr', '${"0".repeat(64)}', 'giris', true)`);
}
async function baglanti(tur, adres, parola) {
  // "signup" türü GoTrue'da şifre ister; uygulama da kaydı rastgele, saklanmayan bir şifreyle açıyor (app/actions/auth.ts).
  const r = await yonetici("/admin/generate_link", { type: tur, email: adres, ...(parola ? { password: parola } : {}) });
  if (r.durum >= 300) throw new Error(`bağlantı üretilemedi (${tur}): ${r.durum} ${JSON.stringify(r.json)}`);
  return r.json.hashed_token ?? r.json.properties?.hashed_token;
}
// Uygulamanın dışında açılmış "başka cihaz" oturumu (GoTrue şifre izni).
async function baskaCihaz(adres, parola) {
  const r = await auth("/token?grant_type=password", { govde: { email: adres, password: parola } });
  return r.durum === 200 ? { erisim: r.json.access_token, yenileme: r.json.refresh_token } : null;
}
async function oturumDurumu(o) {
  const kullanici = await auth("/user", { yontem: "GET", belirtec: o.erisim });
  const yenile = await auth("/token?grant_type=refresh_token", { govde: { refresh_token: o.yenileme } });
  return { kullanici: kullanici.durum, yenile: yenile.durum, kod: yenile.json?.error_code ?? yenile.json?.code ?? "" };
}
const sifreGecerli = async (adres, parola) => (await auth("/token?grant_type=password", { govde: { email: adres, password: parola } })).durum === 200;

const tarayici = await chromium.launch();
const yeniBaglam = (secenek = {}) => tarayici.newContext({ baseURL: UYGULAMA, ...secenek });

async function girisYap(sayfa, adres, parola) {
  await sayfa.goto("/");
  await sayfa.fill('input[name="email"]', adres);
  await sayfa.fill('input[name="password"]', parola);
  await Promise.all([sayfa.waitForURL(/\/dashboard/, { timeout: 30000 }), sayfa.press('input[name="password"]', "Enter")]);
}
async function baglantiyiAc(sayfa, belirtec, tur, next = "/reset-password") {
  await sayfa.goto(`/auth/confirm?token_hash=${encodeURIComponent(belirtec)}&type=${tur}&next=${encodeURIComponent(next)}`);
  await sayfa.waitForURL(/\/auth\/dogrula/);
  await Promise.all([sayfa.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 30000 }), sayfa.click('form[action="/auth/confirm"] button[type="submit"]')]);
}
// Tarayıcı denetimini (minLength/setCustomValidity) devre dışı bırakıp formu doğrudan gönderir: sunucu kendi denetimini yapmalı.
async function sunucuyaGonder(sayfa, kok, alanlar) {
  await sayfa.evaluate(
    ({ kok, alanlar }) => {
      const form = document.querySelector(kok);
      form.noValidate = true;
      for (const [ad, deger] of Object.entries(alanlar)) {
        const kutu = form.querySelector(`[name="${ad}"]`);
        kutu.removeAttribute("minlength");
        kutu.value = deger;
        kutu.setCustomValidity("");
      }
    },
    { kok, alanlar },
  );
  await sayfa.locator(`${kok} button[type="submit"]`).click();
}
async function sifreCekmecesiniAc(sayfa) {
  await sayfa.goto("/dashboard/settings");
  await sayfa.getByRole("button", { name: /^(Değiştir|Change)$/ }).first().click();
  await sayfa.waitForSelector('input[name="currentPassword"]');
}
const bekleMetin = async (sayfa, desen, sure = 15000) => {
  try {
    await sayfa.waitForFunction((k) => new RegExp(k.s, k.f).test(document.body.innerText), { s: desen.source, f: desen.flags }, { timeout: sure });
    return true;
  } catch {
    return false;
  }
};
/*
  Sunucu işlemini PANEL DIŞINDAKİ bir yoldan (/reset-password) çağırır —
  istemcinin gönderdiğiyle aynı biçimde (Next-Action başlığı + React'in
  FormData kodlaması: "_<id>_<alan>" alanları kök "0"dan ÖNCE). Proxy'nin ilk
  şifre kapısı yalnızca /dashboard yollarına bakıyor; bu yol oradan geçmez.
*/
async function eylemiBaskaYoldanCagir(eylem, onay, cerez) {
  const fd = new FormData();
  fd.set("_1_onay", onay);
  fd.set("0", JSON.stringify(["$K1"]));
  return fetch(`${UYGULAMA}/reset-password`, { method: "POST", body: fd, headers: { cookie: cerez, origin: UYGULAMA, "Next-Action": eylem, Accept: "text/x-component" }, redirect: "manual" });
}
const profilSilmeTalebi = (id) => psql(`select coalesce(silme_talebi_at::text,'') from public.profiles where id='${id}'`);
const sifreVarMi = (id) => psql(`select coalesce(encrypted_password,'') <> '' from auth.users where id='${id}'`) === "t";

try {
  /* ---------- K1 mevcut kullanıcı (10 karakterlik eski şifre) kilitlenmez ---------- */
  await senaryo("K1", async () => {
    const adres = eposta("mevcut");
    const eski = "eskisifre1"; // 10 karakter: yeni politikanın altında, G1-D'de geçerliydi
    const id = await kullaniciAc(adres, eski);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await girisYap(s, adres, eski);
    await s.goto("/dashboard/settings");
    const yol = new URL(s.url()).pathname;
    kayit("K1", "Mevcut kullanıcı (12 altı eski şifre) giriş yapar, kapıya takılmaz", "/dashboard/settings açılır", yol, yol === "/dashboard/settings" && sifreVarMi(id));
    await b.close();
  });

  /* ---------- K2–K5 Ayarlar: mevcut şifre, 12 karakter, diğer oturumlar ---------- */
  await senaryo("K2–K5", async () => {
    const adres = eposta("ayarlar");
    const eski = sifre();
    const yeni = sifre();
    await kullaniciAc(adres, eski);
    const b = await yeniBaglam({ viewport: { width: 1440, height: 900 } });
    const s = await b.newPage();
    await girisYap(s, adres, eski);
    const digerCihaz = await baskaCihaz(adres, eski); // giriş öteki oturumları kapattıktan SONRA açılıyor

    // K2 yanlış mevcut şifre
    await sifreCekmecesiniAc(s);
    await s.fill('input[name="currentPassword"]', "yanlis-sifre-123456");
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await s.locator('form[data-sifre-formu="ayarlar"] button[type="submit"]').click();
    const k2 = await bekleMetin(s, /Mevcut şifre yanlış/);
    kayit("K2", "Yanlış mevcut şifre reddedilir, şifre değişmez", "'Mevcut şifre yanlış.' + eski şifre geçerli", `mesaj=${k2}, eski geçerli=${await sifreGecerli(adres, eski)}`, k2 && (await sifreGecerli(adres, eski)) && !(await sifreGecerli(adres, yeni)));

    // K3 12 karakter altı: tarayıcı engeller, sunucu da reddeder
    await sifreCekmecesiniAc(s);
    await s.fill('input[name="currentPassword"]', eski);
    await s.fill('input[name="password"]', "Kq7!mZ2xab1"); // 11 karakter
    const tarayiciMesaji = await s.locator('input[name="password"]').evaluate((k) => k.validationMessage);
    await sunucuyaGonder(s, 'form[data-sifre-formu="ayarlar"]', { currentPassword: eski, password: "Kq7!mZ2xab1", passwordConfirm: "Kq7!mZ2xab1" });
    const k3 = await bekleMetin(s, /en az 12 karakter/);
    kayit("K3", "12 karakter altı: tarayıcı uyarır, sunucu da reddeder", "tarayıcı mesajı dolu + sunucu 'en az 12'", `tarayıcı='${tarayiciMesaji.slice(0, 40)}', sunucu=${k3}`, Boolean(tarayiciMesaji) && k3 && (await sifreGecerli(adres, eski)));

    // K4 doğru mevcut şifre → değişir, bu oturum kalır, öteki cihaz düşer
    await sifreCekmecesiniAc(s);
    await s.fill('input[name="currentPassword"]', eski);
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await s.locator('form[data-sifre-formu="ayarlar"] button[type="submit"]').click();
    const k4 = await bekleMetin(s, /Şifreniz güncellendi/);
    const oncekiDurum = digerCihaz ? await oturumDurumu(digerCihaz) : null;
    await s.goto("/dashboard/settings");
    const buOturum = new URL(s.url()).pathname === "/dashboard/settings";
    kayit(
      "K4",
      "Doğru mevcut şifre: şifre değişir, bu oturum açık kalır, diğer cihaz oturumu geçersiz",
      "başarı + yeni şifre geçerli + eski geçersiz + öteki oturum /user 401/403, yenileme 400",
      `başarı=${k4}, yeni=${await sifreGecerli(adres, yeni)}, eski=${await sifreGecerli(adres, eski)}, bu oturum=${buOturum}, öteki=${JSON.stringify(oncekiDurum)}`,
      k4 && (await sifreGecerli(adres, yeni)) && !(await sifreGecerli(adres, eski)) && buOturum && oncekiDurum && oncekiDurum.kullanici >= 401 && oncekiDurum.yenile >= 400,
    );

    // K5 yeniden giriş yeni şifreyle
    const b2 = await yeniBaglam();
    const s2 = await b2.newPage();
    let k5 = true;
    try {
      await girisYap(s2, adres, yeni);
    } catch {
      k5 = false;
    }
    kayit("K5", "Yeni şifreyle yeniden giriş", "/dashboard", s2.url(), k5);
    await b2.close();
    await b.close();
  });

  /* ---------- K6 şifreyle açılmış oturum /reset-password'ten mevcut şifresiz değiştiremez ---------- */
  await senaryo("K6", async () => {
    const adres = eposta("atlatma");
    const eski = sifre();
    const yeni = sifre();
    await kullaniciAc(adres, eski);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await girisYap(s, adres, eski);
    await s.goto("/reset-password");
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await s.locator('form.os5-kimlik-formu button[type="submit"]').click();
    const red = await bekleMetin(s, /yalnızca e-postadaki bağlantıyla/);
    kayit("K6", "Şifre oturumu, kurtarma sayfasından mevcut şifresiz değiştiremez (atlatma kapalı)", "ret metni + eski şifre geçerli", `ret=${red}, eski=${await sifreGecerli(adres, eski)}, yeni=${await sifreGecerli(adres, yeni)}`, red && (await sifreGecerli(adres, eski)) && !(await sifreGecerli(adres, yeni)));
    await b.close();
  });

  /* ---------- K7 şifre kurtarma: bağlantı → yeni şifre → öteki oturum düşer ---------- */
  await senaryo("K7", async () => {
    const adres = eposta("kurtarma");
    const eski = sifre();
    const yeni = sifre();
    await kullaniciAc(adres, eski);
    const digerCihaz = await baskaCihaz(adres, eski);
    const belirtec = await baglanti("recovery", adres);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await baglantiyiAc(s, belirtec, "recovery");
    const sayfa = new URL(s.url()).pathname;
    // 11 karakter sunucuya zorla
    await sunucuyaGonder(s, "form.os5-kimlik-formu", { password: "Kq7!mZ2xab1", passwordConfirm: "Kq7!mZ2xab1" });
    const kisaRed = await bekleMetin(s, /en az 12 karakter/);
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await Promise.all([s.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null), s.locator('form.os5-kimlik-formu button[type="submit"]').click()]);
    const panel = new URL(s.url()).pathname.startsWith("/dashboard");
    const oteki = digerCihaz ? await oturumDurumu(digerCihaz) : null;
    kayit(
      "K7",
      "Şifre kurtarma: bağlantı /reset-password'e iner, 12 altı reddedilir, yeni şifre kaydedilir, öteki oturum düşer",
      "sayfa=/reset-password, kısa red, panel, yeni geçerli, eski geçersiz, öteki oturum geçersiz",
      `sayfa=${sayfa}, kısa red=${kisaRed}, panel=${panel}, yeni=${await sifreGecerli(adres, yeni)}, eski=${await sifreGecerli(adres, eski)}, öteki=${JSON.stringify(oteki)}`,
      sayfa === "/reset-password" && kisaRed && panel && (await sifreGecerli(adres, yeni)) && !(await sifreGecerli(adres, eski)) && oteki && oteki.kullanici >= 401 && oteki.yenile >= 400,
    );
    await b.close();
  });

  /* ---------- K8–K10 davetli kullanıcı: şifre belirlemeden içeri giremez ---------- */
  let silmeEylemi = null;
  await senaryo("K8–K10", async () => {
    // Atlatma denemesi için hesap silme işleminin kimliği, şifreli bir kullanıcının Ayarlar sayfasından alınır.
    const adres = eposta("kimlik-kaynagi");
    const parola = sifre();
    const id = await kullaniciAc(adres, parola);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await girisYap(s, adres, parola);
    await s.goto("/dashboard/settings");
    // İşlem kimliği derlemenin işlem haritasından (next dev: .next/dev/server, next build: .next/server).
    const harita = [".next/dev/server/server-reference-manifest.json", ".next/server/server-reference-manifest.json"].find((y) => fs.existsSync(y));
    const dugumler = harita ? JSON.parse(fs.readFileSync(harita, "utf8")).node : {};
    const adaylar = Object.entries(dugumler)
      .filter(([, v]) => v.exportedName === "hesapSilmeTalebi" && String(v.filename).endsWith("app/actions/hesap.ts"))
      .map(([k]) => k);
    // Kontrol: şifreli kullanıcı aynı yoldan (sayfadan bağımsız POST) silme talebi açabiliyor mu? Saldırı yolunun gerçek olduğunu kanıtlar.
    for (const aday of adaylar) {
      const cerez = (await b.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      await eylemiBaskaYoldanCagir(aday, adres, cerez);
      if (profilSilmeTalebi(id)) {
        silmeEylemi = aday;
        break;
      }
    }
    kayit("K8a", "Kontrol: hesap silme işlemi panel dışı bir yoldan (Next-Action, /reset-password) çağrılabiliyor — saldırı yolu gerçek", "şifreli kullanıcıda silme talebi yazılır", `eylem bulundu=${Boolean(silmeEylemi)}`, Boolean(silmeEylemi));
    await b.close();
  });
  await senaryo("K8–K10 davetli", async () => {
    const adres = eposta("davetli");
    const belirtec = await baglanti("invite", adres);
    const id = psql(`select id from auth.users where email='${adres}'`);
    sozlesmeOnayla(id);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await baglantiyiAc(s, belirtec, "invite");
    const ilkSayfa = new URL(s.url()).pathname;
    await s.goto("/dashboard");
    const kapi = new URL(s.url());
    await s.goto("/dashboard/settings");
    const kapi2 = new URL(s.url());
    kayit(
      "K8",
      "Davetli: bağlantıdan sonra şifre sayfası; panel yolları ilk şifreye yönlenir",
      "/reset-password, /dashboard ve /dashboard/settings → /reset-password?ilk=1",
      `ilk=${ilkSayfa}, dashboard→${kapi.pathname}${kapi.search}, settings→${kapi2.pathname}${kapi2.search}`,
      ilkSayfa === "/reset-password" && kapi.pathname === "/reset-password" && kapi.searchParams.get("ilk") === "1" && kapi2.pathname === "/reset-password",
    );

    // K9 sunucu tarafı: kapıyı atlatmak için hesap silme işlemi /reset-password'e POST edilir
    if (silmeEylemi) {
      const cerez = (await b.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const r = await eylemiBaskaYoldanCagir(silmeEylemi, adres, cerez);
      const yazildi = profilSilmeTalebi(id);
      kayit("K9", "Davetli (şifresiz): sunucu işlemi panel dışından çağrılsa da hesap silinemez", "silme_talebi_at boş", `http=${r.status}, silme_talebi_at='${yazildi}'`, yazildi === "");
    } else {
      kayit("K9", "Davetli: sunucu tarafı kapı", "kontrol eylemi bulunmalı", "K8a eylemi bulamadı — sınanamadı", false);
    }

    // K10 ilk şifre belirleme
    const yeni = sifre();
    await s.goto("/reset-password?ilk=1");
    await sunucuyaGonder(s, "form.os5-kimlik-formu", { password: "kisa-sifre1", passwordConfirm: "kisa-sifre1" });
    const kisa = await bekleMetin(s, /en az 12 karakter/);
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await Promise.all([s.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null), s.locator('form.os5-kimlik-formu button[type="submit"]').click()]);
    await s.goto("/dashboard/settings");
    const sonra = new URL(s.url()).pathname;
    kayit(
      "K10",
      "Davetli ilk şifreyi belirler (12 altı reddedilir), sonra panel açılır",
      "kısa red + şifre kaydı + /dashboard/settings",
      `kısa red=${kisa}, şifre var=${sifreVarMi(id)}, yeni giriş=${await sifreGecerli(adres, yeni)}, sonra=${sonra}`,
      kisa && sifreVarMi(id) && (await sifreGecerli(adres, yeni)) && sonra === "/dashboard/settings",
    );
    await b.close();
  });

  /* ---------- K11 kendi kaydolan kullanıcı: kayıt şifre almaz, doğrulamadan sonra ilk şifre ---------- */
  await senaryo("K11", async () => {
    const adres = eposta("kayit");
    const b = await yeniBaglam();
    const s = await b.newPage();
    await s.goto("/kayit");
    const sifreAlani = await s.locator('input[name="password"]').count();
    // Kayıt, uygulamanın kendi akışıyla değil yönetici bağlantısıyla (e-posta gönderimi yerelde yok) açılır.
    const belirtec = await baglanti("signup", adres, sifre()).catch((h) => (console.error(String(h)), null));
    let sayfa = "";
    if (belirtec) {
      await baglantiyiAc(s, belirtec, "signup", "/reset-password?ilk=1");
      await s.goto("/dashboard");
      sayfa = `${new URL(s.url()).pathname}${new URL(s.url()).search}`;
    }
    kayit("K11", "Kayıt formu şifre istemez; doğrulanan yeni kullanıcı panele değil ilk şifreye gider", "şifre alanı yok + /reset-password?ilk=1", `şifre alanı=${sifreAlani}, panel denemesi→${sayfa}`, sifreAlani === 0 && sayfa === "/reset-password?ilk=1");
    await b.close();
  });

  /* ---------- K13 yönetici API'si: şifre + onay tek istekte (panelde "Create user + Auto Confirm") ---------- */
  // G1 tetikleyicisi bu şifreyi siler (bilerek; gerekçe tests/db/eposta-onayi-kimlik.test.mjs). Kullanıcı kilitlenmemeli: kurtarmayla şifresini belirler.
  await senaryo("K13", async () => {
    const adres = eposta("yonetici");
    const verilen = sifre();
    const yeni = sifre();
    const r = await yonetici("/admin/users", { email: adres, password: verilen, email_confirm: true });
    sozlesmeOnayla(r.json.id);
    const verilenGecerli = await sifreGecerli(adres, verilen);
    const belirtec = await baglanti("recovery", adres);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await baglantiyiAc(s, belirtec, "recovery");
    await s.fill('input[name="password"]', yeni);
    await s.fill('input[name="passwordConfirm"]', yeni);
    await Promise.all([s.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null), s.locator('form.os5-kimlik-formu button[type="submit"]').click()]);
    kayit(
      "K13",
      "Yöneticinin tek istekte şifreli+onaylı açtığı hesap: verilen şifre geçersiz (G1), kurtarmayla şifre belirlenip girilir (kilitlenme yok)",
      "verilen şifre geçersiz + kurtarma sonrası panel + yeni şifre geçerli",
      `verilen geçerli=${verilenGecerli}, panel=${new URL(s.url()).pathname}, yeni=${await sifreGecerli(adres, yeni)}`,
      !verilenGecerli && new URL(s.url()).pathname.startsWith("/dashboard") && (await sifreGecerli(adres, yeni)),
    );
    await b.close();
  });

  /* ---------- K14 ArvoOS üyesi: şifresiz, magic link ile girer, kapıya takılmaz, kuruma bağlanır ---------- */
  await senaryo("K14", async () => {
    const adres = eposta("arvoos");
    const kurum = crypto.randomUUID();
    psql(`insert into public.organizations (id, name) values ('${kurum}', 'kimlik-kabul')`);
    psql(`insert into public.arvoos_members (email, organization_id, full_name) values ('${adres}', '${kurum}', 'Sentetik Üye')`);
    // ArvoOS'un yaptığı gibi (arvoos/lib/arvolab.ts): şifresiz, onaylı hesap + magic link.
    const r = await yonetici("/admin/users", { email: adres, email_confirm: true });
    sozlesmeOnayla(r.json.id);
    const belirtec = await baglanti("magiclink", adres);
    const b = await yeniBaglam();
    const s = await b.newPage();
    await baglantiyiAc(s, belirtec, "magiclink", "/dashboard");
    await s.goto("/dashboard/settings");
    const yol = new URL(s.url()).pathname;
    const bagli = psql(`select coalesce(organization_id::text,'') from public.profiles where id='${r.json.id}'`) === kurum;
    kayit("K14", "ArvoOS üyesi (şifresiz, magic link) panele girer, ilk şifreye yönlenmez, kuruma bağlı", "/dashboard/settings + şifresiz + kurum bağı", `yol=${yol}, şifre var=${sifreVarMi(r.json.id)}, kurum bağlı=${bagli}`, yol === "/dashboard/settings" && !sifreVarMi(r.json.id) && bagli);
    await b.close();
  });

  /* ---------- K12 görünüm: telefon ve masaüstü ---------- */
  await senaryo("K12", async () => {
    fs.mkdirSync(CIKTI, { recursive: true });
    const adres = eposta("gorunum");
    const parola = sifre();
    await kullaniciAc(adres, parola);
    const olcumler = [];
    for (const [ad, secenek] of [
      ["telefon", devices["iPhone 13"]],
      ["masaustu", { viewport: { width: 1440, height: 900 } }],
    ]) {
      const b = await yeniBaglam(secenek);
      const s = await b.newPage();
      await girisYap(s, adres, parola);
      await sifreCekmecesiniAc(s);
      const alanlar = await s.evaluate(() =>
        ["currentPassword", "password", "passwordConfirm"].map((n) => {
          const k = document.querySelector(`input[name="${n}"]`);
          const r = k.getBoundingClientRect();
          return { n, w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), gorunur: r.width > 0 && r.height >= 32 && r.left >= 0 && r.right <= window.innerWidth + 1 };
        }),
      );
      const tasma = await s.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await s.waitForTimeout(800); // çekmecenin açılış geçişi bitsin
      await s.screenshot({ path: `${CIKTI}/kimlik-ayarlar-${ad}.png` });
      const belirtec = await baglanti("recovery", adres);
      const b2 = await yeniBaglam(secenek);
      const s2 = await b2.newPage();
      await baglantiyiAc(s2, belirtec, "recovery");
      const tasma2 = await s2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await s2.screenshot({ path: `${CIKTI}/kimlik-sifirlama-${ad}.png`, fullPage: true });
      olcumler.push({ ad, alanlar: alanlar.every((a) => a.gorunur), olcu: alanlar.map((a) => `${a.n}:${a.w}x${a.h}@${a.l}-${a.r}`).join(" "), tasma, tasma2 });
      await b.close();
      await b2.close();
    }
    kayit("K12", "Telefon ve masaüstü: üç şifre alanı görünür, yatay taşma yok (Ayarlar + sıfırlama)", "alanlar görünür, taşma yok", JSON.stringify(olcumler), olcumler.every((o) => o.alanlar && !o.tasma && !o.tasma2));
  });
} finally {
  await tarayici.close();
}

const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
fs.mkdirSync(CIKTI, { recursive: true });
fs.writeFileSync(`${CIKTI}/kimlik-kabul.json`, `${JSON.stringify(sonuclar.map((s) => ({ ...s, gozlenen: s.gozlenen.replaceAll(ek, "<ek>") })), null, 2)}\n`);
process.exit(fail ? 1 : 0);
