// GEZİNME ve HESAP MENÜSÜ — KABUL (23.11.2026).
//
// Sol gezinmeden Ayarlar, hesap menüsünden dil seçici ve Asistan
// Kayıtları kalktı; menüye Ayarlar'ın hemen üstünde açılır "Kullanım"
// satırı eklendi. Sayılar Abonelik ve Kredi ekranıyla aynı kaynaklardan
// geliyor; sınırsız, tükenmiş ve verisi alınamayan hak AYRI gösteriliyor.
//
// Kullanım: node scripts/yerel-yigin/hesap-menusu-kabul.mjs http://localhost:3141 [görüntü-dizini]
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const UYG = process.argv[2] ?? "http://localhost:3141";
const GORSEL = process.argv[3] ?? null;
if (GORSEL) fs.mkdirSync(GORSEL, { recursive: true });
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8",
  }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, govde, yontem = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  return { durum: r.status, json: await r.json().catch(() => ({})) };
};
const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID ?? "yok"}) derlemesini çalıştırmıyor`);
    process.exit(2);
  }
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
  psql("select 1 from public.profiles limit 0");
} catch (e) {
  console.error("Ön koşul yok:", e.message);
  process.exit(2);
}

const sonuclar = [];
const PASS = (ad, not = "") => { sonuclar.push({ ad, durum: "PASS", not }); console.log(`PASS  ${ad}${not ? ` — ${not}` : ""}`); };
const FAIL = (ad, not) => { sonuclar.push({ ad, durum: "FAIL", not }); console.log(`FAIL  ${ad} — ${not}`); };
const esit = async (ad, fn, beklenen) => {
  try {
    const v = await fn();
    if (typeof beklenen === "function" ? beklenen(v) : v === beklenen) PASS(ad, String(v).slice(0, 140));
    else FAIL(ad, `beklenen ${typeof beklenen === "function" ? "(koşul)" : beklenen}, bulunan ${String(v).slice(0, 200)}`);
  } catch (e) { FAIL(ad, e.message.slice(0, 200)); }
};

/* ---------- Sentetik kullanıcılar: dört hak durumu ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const kullanicilar = {};
const kullaniciKur = async (anahtar, { rol = "client", kurum = null } = {}) => {
  const adres = `menu-${anahtar}-${ek}@yerel.test`;
  const parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
  const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: `Menü ${anahtar}` } });
  if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
  const id = yeni.json.id;
  await auth(`/admin/users/${id}`, { password: parola }, "PUT");
  psql(`update public.profiles set role = ${q(rol)}, organization_id = ${kurum ? q(kurum) : "null"}, full_name = ${q(`Menü ${anahtar}`)} where id = ${q(id)}`);
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  kullanicilar[anahtar] = { id, adres, parola };
  return id;
};
await kullaniciKur("sayili");
const tukendiId = await kullaniciKur("tukendi");
psql(`insert into public.ai_bireysel_kredi_hesabi (user_id, donem, aylik_kalan, ek_bakiye)
      values (${q(tukendiId)}, date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date, 0, 0)
      on conflict (user_id) do update set aylik_kalan = 0, ek_bakiye = 0,
        donem = date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date`);
await kullaniciKur("sinirsiz", { rol: "system_admin" });
/* Senkronlanmamış kurum: hak hiç bildirilmemiş → "Bilgi alınamadı". */
const KURUM = psql(`insert into public.organizations (name) values ('Menü Kabul Kurumu ${ek}') returning id`).split("\n")[0];
psql(`update public.organizations set synced_at = null, ai_credit_limit = null where id = ${q(KURUM)}`);
await kullaniciKur("bilinmiyor", { kurum: KURUM });

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async (anahtar, { g = 1440, y = 900, tema = "light", dil = "tr", dokunma = false } = {}) => {
  const k = kullanicilar[anahtar];
  psql(`update public.profiles set arayuz_dili = ${q(dil)} where id = ${q(k.id)}`);
  const ctx = await tarayici.newContext({
    viewport: { width: g, height: y }, colorScheme: tema, locale: "tr-TR",
    ...(dokunma ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  await ctx.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await ctx.newPage();
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', k.adres);
  await s.fill('input[name="password"]', k.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  await s.waitForLoadState("networkidle").catch(() => {});
  return { ctx, s };
};
/* Görünen menü: masaüstünde kenar çubuğundaki, telefonda üstteki. */
const menuSec = (s) => s.locator(".os-kullanici:visible").first();
const menuAc = async (s) => {
  const m = menuSec(s);
  if (!(await m.evaluate((el) => el.open))) await m.locator("summary").first().click();
  await s.waitForTimeout(350);
  return m;
};
const menuOku = async (s) =>
  await s.evaluate(() => {
    const acik = [...document.querySelectorAll(".os-kullanici")].find((d) => d.open && d.getBoundingClientRect().width > 0);
    if (!acik) return null;
    const menu = acik.querySelector(".os-kullanici-menu");
    const kutu = menu.getBoundingClientRect();
    const kullanim = acik.querySelector(".os-kullanici-kullanim");
    return {
      metin: menu.innerText.replace(/\n+/g, " · "),
      baglantilar: [...menu.querySelectorAll(".os-kullanici-baglantilar a")].map((a) => a.innerText.trim()),
      dilSecici: menu.querySelectorAll(".os-kullanici-gorunum, .dil-secici").length,
      kullanimVar: Boolean(kullanim),
      kullanimAcik: Boolean(kullanim?.open),
      kullanimOzet: kullanim?.querySelector(".os-kullanici-kullanim-ozet")?.innerText.trim() ?? "",
      haklar: [...(kullanim?.querySelectorAll(".os-kullanici-hak li") ?? [])].map((li) => ({
        ad: li.querySelector(".os-kullanici-hak-ad")?.innerText.trim() ?? "",
        deger: li.querySelector(".os-kullanici-hak-deger")?.innerText.trim() ?? "",
        durum: li.querySelector(".os-kullanici-hak-deger")?.getAttribute("data-durum") ?? "",
        yenilenme: li.querySelector("small")?.innerText.trim() ?? "",
      })),
      /* Kullanım satırı Ayarlar bağlantısının HEMEN üstünde mi? */
      kullanimUstte: (() => {
        const ayar = [...menu.querySelectorAll("a")].find((a) => /Ayarlar|Settings/.test(a.innerText));
        return Boolean(kullanim && ayar && kullanim.getBoundingClientRect().bottom <= ayar.getBoundingClientRect().top + 1);
      })(),
      ekranIcinde: kutu.top >= -1 && kutu.left >= -1 && kutu.bottom <= window.innerHeight + 1 && kutu.right <= window.innerWidth + 1,
      kutu: `${Math.round(kutu.top)}-${Math.round(kutu.bottom)}/${window.innerHeight}`,
    };
  });

try {
  /* ================= H1: masaüstü, sayılı hak ================= */
  {
    const { ctx, s } = await oturum("sayili");
    await esit("H1a sol gezinmede Ayarlar yok, hesap menüsünde var", async () => {
      const gezinmede = await s.locator(".os-gezinme-ayar").count();
      const m = await menuAc(s);
      const menude = await m.locator(".os-kullanici-baglantilar a", { hasText: "Ayarlar" }).count();
      return `gezinme:${gezinmede} menu:${menude}`;
    }, "gezinme:0 menu:1");

    await esit("H1b menüde dil seçici yok; dil sağ üstte ve çalışıyor", async () => {
      const k = await menuOku(s);
      const ustte = await s.locator(".ust-dil:visible").count();
      await s.keyboard.press("Escape");
      await s.locator(".ust-dil > summary").click();
      await s.locator(".ust-dil-menu button", { hasText: "English" }).click();
      await s.waitForTimeout(1200);
      /* Dil gerçekten değişti mi: üst çubuktaki düğmenin kendi etiketi
         ve gezinmenin metni birlikte. */
      const etiket = (await s.locator(".ust-dil > summary").innerText()).trim();
      const gezinme = await s.locator(".os-gezinme").first().innerText();
      const ingilizce = etiket.includes("EN") || /Home|My works|Sources/.test(gezinme);
      await s.locator(".ust-dil > summary").click();
      await s.locator(".ust-dil-menu button", { hasText: "Türkçe" }).click();
      await s.waitForTimeout(1200);
      const geriDondu = (await s.locator(".ust-dil > summary").innerText()).includes("TR");
      return `menuDil:${k.dilSecici} ustDil:${ustte} degisti:${ingilizce} geri:${geriDondu}`;
    }, "menuDil:0 ustDil:1 degisti:true geri:true");

    await esit("H1c Kullanım satırı Ayarlar'ın üstünde, aynı menüde açılıp kapanıyor", async () => {
      await menuAc(s);
      const once = await menuOku(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const acik = await menuOku(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const kapali = await menuOku(s);
      return [
        `ustte:${once.kullanimUstte}`,
        `basta:${once.kullanimAcik}`,
        `acildi:${acik.kullanimAcik}`,
        `kapandi:${kapali.kullanimAcik}`,
        /* Menünün kendisi açık kaldı: sayfa değişmedi. */
        `menuAcik:${kapali !== null}`,
      ].join(" ");
    }, "ustte:true basta:false acildi:true kapandi:false menuAcik:true");

    await esit("H1d kalan hak Abonelik ve Kredi ekranıyla tutarlı", async () => {
      await menuAc(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const k = await menuOku(s);
      /* Menüdeki ilk sayı KALAN hak. */
      const menuKalan = (k.haklar[0]?.deger ?? "").match(/[\d.]+/)?.[0]?.replace(/\D/g, "") ?? "";
      await s.goto(`${UYG}/dashboard/abonelik`, { waitUntil: "domcontentloaded" });
      await s.waitForLoadState("networkidle").catch(() => {});
      const ekran = (await s.locator("main").innerText()).replace(/\n+/g, " ");
      /* Ekrandaki "Kullanılabilir kredi" = aylık kalan + satın alınan
         bakiye; menüdeki kalan da aynı toplam. */
      const eslesme = ekran.match(/Kullanılabilir kredi\s*([\d.]+)/);
      const ekranKalan = eslesme ? eslesme[1].replace(/\D/g, "") : "";
      return `menu:${menuKalan} ekran:${ekranKalan} ayni:${ekranKalan.length > 0 && menuKalan === ekranKalan}`;
    }, (v) => /ayni:true/.test(v));

    await esit("H1e menü ekran dışına taşmıyor", async () => {
      await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
      await menuAc(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const k = await menuOku(s);
      return `icinde:${k.ekranIcinde} kutu:${k.kutu}`;
    }, (v) => /icinde:true/.test(v));

    await esit("H1f klavye: menü, Kullanım ve Ayarlar klavyeyle kullanılabiliyor", async () => {
      await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
      const ozet = s.locator(".os-kullanici:visible > summary");
      await ozet.focus();
      await s.keyboard.press("Enter");
      await s.waitForTimeout(300);
      const acildi = await menuSec(s).evaluate((el) => el.open);
      const kullanimOzet = s.locator(".os-kullanici:visible .os-kullanici-kullanim summary");
      await kullanimOzet.focus();
      const odakli = await s.evaluate(() => document.activeElement?.className ?? "");
      await s.keyboard.press("Enter");
      await s.waitForTimeout(250);
      const kullanimAcik = await s.locator(".os-kullanici:visible .os-kullanici-kullanim").evaluate((el) => el.open);
      const ayar = s.locator(".os-kullanici:visible .os-kullanici-baglantilar a", { hasText: "Ayarlar" });
      await ayar.focus();
      const ayarOdak = await ayar.evaluate((el) => el === document.activeElement);
      return `menu:${acildi} odak:${odakli.includes("os-kullanici-kullanim") || odakli === ""} kullanim:${kullanimAcik} ayarOdak:${ayarOdak}`;
    }, (v) => /menu:true/.test(v) && /kullanim:true ayarOdak:true/.test(v));

    await esit("H1g 'Abonelik ve Kredi' bağlantısı menüde ve çalışıyor", async () => {
      await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
      await menuAc(s);
      const bag = s.locator(".os-kullanici:visible .os-kullanici-baglantilar a", { hasText: "Abonelik ve Kredi" });
      const sayi = await bag.count();
      await bag.first().click();
      await s.waitForURL(/abonelik/, { timeout: 20000 });
      return `baglanti:${sayi} adres:${s.url().includes("/dashboard/abonelik")}`;
    }, "baglanti:1 adres:true");
    if (GORSEL) {
      await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
      await menuAc(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(300);
      await s.screenshot({ path: path.join(GORSEL, "menu-sayili-1440-light.png") });
    }
    await ctx.close();
  }

  /* ================= H2: öteki hak durumları ================= */
  for (const [anahtar, beklenen] of [["tukendi", "tukendi"], ["sinirsiz", "sinirsiz"], ["bilinmiyor", "bilinmiyor"]]) {
    const { ctx, s } = await oturum(anahtar);
    await esit(`H2-${anahtar} hak durumu ayrı gösteriliyor`, async () => {
      await menuAc(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const k = await menuOku(s);
      const hak = k.haklar[0];
      return `durum:${hak?.durum} deger:${hak?.deger} sifirYazmiyor:${!/^0 /.test(hak?.deger ?? "")}`;
    }, (v) => new RegExp(`durum:${beklenen} `).test(v) && /sifirYazmiyor:true/.test(v) === (beklenen !== "tukendi" ? true : true));

    if (anahtar === "sinirsiz") {
      await esit("H2-sinirsiz menüde 'Asistan Kayıtları' yok", async () => {
        const k = await menuOku(s);
        return `menude:${/Asistan Kayıtları|Assistant Logs/.test(k.metin)}`;
      }, "menude:false");
    }
    await ctx.close();
  }

  /* ================= H3: telefon, dokunma, tema ================= */
  for (const [tema, dil] of [["light", "tr"], ["dark", "en"]]) {
    const { ctx, s } = await oturum("sayili", { g: 390, y: 844, tema, dil, dokunma: true });
    const ad = `390-${tema}-${dil}`;
    await esit(`H3a-${ad} telefonda menü dokunmayla açılıyor, Kullanım ve Ayarlar erişilebilir`, async () => {
      const ozet = s.locator(".os-kullanici:visible > summary");
      const kutu = await ozet.boundingBox();
      await s.touchscreen.tap(Math.round(kutu.x + kutu.width / 2), Math.round(kutu.y + kutu.height / 2));
      await s.waitForTimeout(400);
      const kullanimOzet = s.locator(".os-kullanici:visible .os-kullanici-kullanim summary");
      const kk = await kullanimOzet.boundingBox();
      await s.touchscreen.tap(Math.round(kk.x + kk.width / 2), Math.round(kk.y + kk.height / 2));
      await s.waitForTimeout(300);
      const k = await menuOku(s);
      const ayar = s.locator(".os-kullanici:visible .os-kullanici-baglantilar a", { hasText: dil === "tr" ? "Ayarlar" : "Settings" });
      const ayarKutu = await ayar.boundingBox();
      return [
        `kullanimAcik:${k.kullanimAcik}`,
        `hak:${k.haklar.length > 0}`,
        `ayar:${Boolean(ayarKutu && ayarKutu.height >= 36)}`,
        `icinde:${k.ekranIcinde}`,
      ].join(" ");
    }, (v) => /kullanimAcik:true hak:true ayar:true icinde:true/.test(v));

    await esit(`H3b-${ad} telefonda dil seçici üst çubukta ve dokunulabilir`, async () => {
      await s.keyboard.press("Escape");
      await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
      const dilDugme = s.locator(".ust-dil > summary");
      const gorunur = await dilDugme.isVisible();
      const kutu = await dilDugme.boundingBox();
      await s.touchscreen.tap(Math.round(kutu.x + kutu.width / 2), Math.round(kutu.y + kutu.height / 2));
      await s.waitForTimeout(350);
      const secenek = await s.locator(".ust-dil-menu button").count();
      return `gorunur:${gorunur} yukseklik:${Math.round(kutu.height)} secenek:${secenek}`;
    }, (v) => /gorunur:true/.test(v) && /secenek:2/.test(v) && Number(v.match(/yukseklik:(\d+)/)[1]) >= 32);
    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, `menu-${ad}.png`) });
    await ctx.close();
  }

  /* Koyu tema, masaüstü: karşıtlık ve taşma. */
  {
    const { ctx, s } = await oturum("sayili", { tema: "dark" });
    await esit("H3c masaüstü koyu temada menü okunur ve taşmıyor", async () => {
      await menuAc(s);
      await s.locator(".os-kullanici:visible .os-kullanici-kullanim summary").click();
      await s.waitForTimeout(250);
      const k = await menuOku(s);
      const karsitlik = await s.locator(".os-kullanici:visible .os-kullanici-hak-deger").first().evaluate((el) => {
        const lum = (c) => {
          const [x, y, w] = c.match(/\d+/g).slice(0, 3).map((n) => {
            const s2 = Number(n) / 255;
            return s2 <= 0.03928 ? s2 / 12.92 : ((s2 + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * x + 0.7152 * y + 0.0722 * w;
        };
        const zemin = getComputedStyle(el.closest(".os-kullanici-menu")).backgroundColor;
        const a = lum(getComputedStyle(el).color);
        const b = lum(zemin);
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
      });
      return `icinde:${k.ekranIcinde} karsitlik:${karsitlik}`;
    }, (v) => /icinde:true/.test(v) && Number(v.match(/karsitlik:([\d.]+)/)[1]) >= 4.5);
    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, "menu-sayili-1440-dark.png") });
    await ctx.close();
  }
} catch (e) {
  FAIL("kabul koşusu", `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}`);
} finally {
  await tarayici.close();
  for (const k of Object.values(kullanicilar)) {
    psql(`delete from public.ai_bireysel_kredi_hesabi where user_id = ${q(k.id)}`);
    await auth(`/admin/users/${k.id}`, {}, "DELETE");
  }
  psql(`delete from public.organizations where id = ${q(KURUM)}`);
}

const gecen = sonuclar.filter((x) => x.durum === "PASS").length;
const dusen = sonuclar.length - gecen;
console.log(`\n${gecen} PASS · ${dusen} FAIL`);
for (const x of sonuclar.filter((y) => y.durum === "FAIL")) console.log(` - ${x.ad}: ${x.not}`);
fs.mkdirSync(path.join(KOK, "scripts/yerel-yigin/sonuclar"), { recursive: true });
fs.writeFileSync(
  path.join(KOK, "scripts/yerel-yigin/sonuclar/hesap-menusu-kabul.json"),
  `${JSON.stringify({ tarih: new Date().toISOString(), head: HEAD, buildId: BUILD_ID, uygulama: UYG, gecen, dusen, sonuclar }, null, 2)}\n`,
);
process.exit(dusen ? 1 : 0);
