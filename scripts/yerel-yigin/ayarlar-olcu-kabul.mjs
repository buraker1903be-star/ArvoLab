// AYARLAR PENCERESİNİN DIŞ ÖLÇÜLERİ (24.11.2026).
//
// Pencerenin yüksekliği içeriğe göre kuruluyordu: Hesap'tan Güvenlik'e
// geçince kutu kısalıyor, ortalandığı için yukarı–aşağı da kayıyordu.
// Kullanıcı sekmeye basınca pencere altından kaçıyordu. Ölçülen: aynı
// ekranda beş sekmede AYNI genişlik, yükseklik ve konum; başlık ve
// sekme şeridinin yerinde kalması; yalnızca içerik alanının kayması;
// son içerik satırına kaydırarak ulaşılabilmesi.
//
// Kullanım: node scripts/yerel-yigin/ayarlar-olcu-kabul.mjs <uygulama> [görüntü-dizini]
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
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const g = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "yerel", iat: 1763200000, exp: 2079000000, role: "service_role" })}`;
const SERVIS = `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
const psql = (sql) => execFileSync("psql", ["-h","127.0.0.1","-p","56432","-U","postgres","-At","-v","ON_ERROR_STOP=1","-c",sql],
  { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, gv, m = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, { method: m,
    headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" }, body: JSON.stringify(gv) });
  return { d: r.status, j: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(`${KOK}/.next/BUILD_ID`) ? fs.readFileSync(`${KOK}/.next/BUILD_ID`, "utf8").trim() : null;
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) throw new Error(`BUILD_ID (${BUILD_ID ?? "yok"}) sunulan sayfada yok`);
} catch (e) { console.error("Ön koşul yok:", e.message); process.exit(2); }

const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `olcu-${ek}@yerel.test`;
const parola = `Ol7!${crypto.randomBytes(9).toString("base64url")}`;
{
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Olcu Denegi" } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  await auth(`/admin/users/${y.j.id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(y.j.id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
}

const SEKMELER = ["Hesap", "Güvenlik", "Tercihler", "Abonelik", "Veriler"];
const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(58)} ${ayrinti}`);
};
/* Alt piksel farkları (ölçek, yuvarlama) kusur değil; 1 px eşiği. */
const ayni = (a, b) => Math.abs(a - b) <= 1;
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { deviceScaleFactor: 2 }) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png` }); };
  try {
    await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
    await s.fill('input[name="email"]', adres);
    await s.fill('input[name="password"]', parola);
    await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
    await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    await s.locator("details.os-kullanici summary").filter({ visible: true }).first().click();
    await s.locator('.os-kullanici-menu a[href="/dashboard/settings"]').filter({ visible: true }).first().click();
    await s.waitForSelector(".drawer-root.open .ayarlar-pencere", { timeout: 25000 });
    await s.waitForTimeout(900);

    const olc = () => s.evaluate(() => {
      const yuvarla = (r) => ({ x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10,
        g: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
      const kok = document.querySelector(".drawer-root.open");
      const kutu = kok.querySelector("section.drawer");
      const baslik = kok.querySelector(".drawer-header");
      const kapat = kok.querySelector(".drawer-close");
      const serit = kok.querySelector(".ayarlar-sekme-serit");
      const govde = kok.querySelector(".ayarlar-govde");
      const kabi = kok.querySelector(".drawer-body");
      return {
        kutu: yuvarla(kutu.getBoundingClientRect()),
        baslik: yuvarla(baslik.getBoundingClientRect()),
        kapat: yuvarla(kapat.getBoundingClientRect()),
        serit: yuvarla(serit.getBoundingClientRect()),
        /* Kaydırma YALNIZCA içerik alanında olmalı: dış kabın
           scrollHeight'i clientHeight'ine eşit kalmalı. */
        kapKayiyor: kabi.scrollHeight - kabi.clientHeight > 1,
        govdeKaydirilabilir: govde.scrollHeight - govde.clientHeight > 1,
      };
    });

    const olcumler = {};
    for (const sek of SEKMELER) {
      await s.locator(".ayarlar-sekme", { hasText: new RegExp(`^${sek}$`) }).first().click();
      await s.waitForTimeout(450);
      olcumler[sek] = await olc();
      if (sek === "Hesap" || sek === "Veriler") await resim(`ayarlar-${sek.toLowerCase()}`);
    }

    const ilk = olcumler[SEKMELER[0]].kutu;
    const sapan = SEKMELER.filter((sek) => {
      const k = olcumler[sek].kutu;
      return !(ayni(k.x, ilk.x) && ayni(k.y, ilk.y) && ayni(k.g, ilk.g) && ayni(k.h, ilk.h));
    });
    yaz("O1 · Beş sekmede dış ölçüler ve konum aynı", EKRAN, TEMA, sapan.length === 0,
        `ilk=${ilk.g}×${ilk.h}@${ilk.x},${ilk.y}` + (sapan.length ? ` sapan=[${sapan.map((x) => `${x}:${olcumler[x].kutu.g}×${olcumler[x].kutu.h}@${olcumler[x].kutu.x},${olcumler[x].kutu.y}`).join(" ")}]` : ""));

    const bIlk = olcumler[SEKMELER[0]].baslik, kIlk = olcumler[SEKMELER[0]].kapat, sIlk = olcumler[SEKMELER[0]].serit;
    const sabitDurmuyor = SEKMELER.filter((sek) => {
      const o = olcumler[sek];
      return !(ayni(o.baslik.y, bIlk.y) && ayni(o.baslik.h, bIlk.h) &&
               ayni(o.kapat.x, kIlk.x) && ayni(o.kapat.y, kIlk.y) &&
               ayni(o.serit.y, sIlk.y) && ayni(o.serit.h, sIlk.h));
    });
    yaz("O2 · Başlık, kapatma düğmesi ve sekme şeridi sabit", EKRAN, TEMA, sabitDurmuyor.length === 0,
        `başlıkY=${bIlk.y} kapat=${kIlk.x},${kIlk.y} şeritY=${sIlk.y}` + (sabitDurmuyor.length ? ` sapan=[${sabitDurmuyor.join(", ")}]` : ""));

    const kapKayan = SEKMELER.filter((sek) => olcumler[sek].kapKayiyor);
    yaz("O3 · Yalnızca içerik alanı kayıyor (dış kap kaymıyor)", EKRAN, TEMA, kapKayan.length === 0,
        kapKayan.length ? `kap kayan sekmeler=[${kapKayan.join(", ")}]` : "dış kap hiçbir sekmede kaymıyor");

    /* Mobilde pencere kullanılabilir ekran alanını aşmamalı. */
    if (mobil) {
      const tasma = await s.evaluate(() => {
        const k = document.querySelector(".drawer-root.open section.drawer").getBoundingClientRect();
        return { h: Math.round(k.height), ekran: window.innerHeight, alt: Math.round(k.bottom), ust: Math.round(k.top) };
      });
      yaz("O4 · Mobilde pencere ekranı aşmıyor", EKRAN, TEMA,
          tasma.h <= tasma.ekran + 1 && tasma.ust >= -1 && tasma.alt <= tasma.ekran + 1,
          `pencere=${tasma.h} ekran=${tasma.ekran} üst=${tasma.ust} alt=${tasma.alt}`);
    }

    /* SON İÇERİK SATIRINA KAYDIRARAK ULAŞILABİLİYOR MU? Her sekmede
       gövde sona kaydırılıp son öğenin görünür alanda olduğu ölçülüyor.
       Kaydırma gerekmeyen (kısa) sekmede zaten görünür olmalı. */
    const ulasilmayan = [];
    for (const sek of SEKMELER) {
      await s.locator(".ayarlar-sekme", { hasText: new RegExp(`^${sek}$`) }).first().click();
      await s.waitForTimeout(400);
      const d = await s.evaluate(() => {
        const govde = document.querySelector(".drawer-root.open .ayarlar-govde");
        govde.scrollTop = govde.scrollHeight;
        const panel = [...govde.querySelectorAll(".ayarlar-panel")].find((p) => !p.hidden);
        const sonlar = panel ? [...panel.children] : [];
        const son = sonlar[sonlar.length - 1];
        if (!son) return { yok: true };
        const r = son.getBoundingClientRect();
        const g = govde.getBoundingClientRect();
        /* Son öğenin ALTI gövdenin görünür alanının içinde kalmalı. */
        return { yok: false, altFark: Math.round(r.bottom - g.bottom), gorunur: r.bottom <= g.bottom + 2 && r.top < g.bottom };
      });
      if (d.yok || !d.gorunur) ulasilmayan.push(`${sek}(${d.yok ? "panel yok" : `alt+${d.altFark}px`})`);
    }
    yaz("O5 · Her sekmede son içerik satırına kaydırarak ulaşılıyor", EKRAN, TEMA, ulasilmayan.length === 0,
        ulasilmayan.length ? `ulaşılamayan=[${ulasilmayan.join(", ")}]` : "beş sekmede de son satır görünür");
    await resim("ayarlar-son-satir");
  } catch (e) {
    yaz("O · ayarlar ölçüleri", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 80)}`);
  }
  await ctx.close();
}
await tarayici.close();
if (GORSEL) fs.writeFileSync(`${GORSEL}/ayarlar-olcu.json`, JSON.stringify(sonuclar, null, 1));
const gec = sonuclar.filter((r) => r.gecti).length;
console.log(`\n${sonuclar.length} kontrol · ${gec} geçti · ${sonuclar.length - gec} kaldı`);
process.exit(gec === sonuclar.length ? 0 : 1);
