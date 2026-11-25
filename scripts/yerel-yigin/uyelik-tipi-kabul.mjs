// ÜYELİK TİPİ KABULÜ (25.11.2026).
//
// Hesap sekmesindeki "Rol / Üye-Öğrenci" satırı "Üyelik tipi" ile
// değişti; etiket sol navigasyonla AYNI doğrulanmış abonelik verisinden
// geliyor (lib/uyelik-tipi.ts: plan kodu + katalogdaki ad). Plan bilgisi
// yoksa satır gizli. Kurum adı yalnızca panelde kayıtlı kurum seçimi
// varsa yazılıyor. Rol ve yetki kontrolleri değişmedi.
//
// Kullanım: node scripts/yerel-yigin/uyelik-tipi-kabul.mjs <uygulama> [görüntü-dizini]
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
async function kullaniciKur({ etiket, tamAd, kurum, rol }) {
  const adres = `${etiket}-${ek}@yerel.test`;
  const parola = `Uy7!${crypto.randomBytes(9).toString("base64url")}`;
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: tamAd } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  await auth(`/admin/users/${y.j.id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(y.j.id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  psql(`update public.profiles set full_name = ${q(tamAd)}${kurum ? `, organization_id = ${q(kurum)}` : ""}${rol ? `, role = ${q(rol)}::public.user_role` : ""} where id = ${q(y.j.id)}`);
  return { adres, parola, id: y.j.id };
}
const KURUM = psql(`insert into public.organizations (name, license_status, synced_at, current_period_end)
  values (${q(`Uyelik Universitesi ${ek}`)}, 'active', now(), now() + interval '200 days') returning id`).split("\n")[0];

/* BUGÜNKÜ katalog: plan adı ve kodu YOK → üyelik satırı gizli. */
const BOS = await kullaniciKur({ etiket: "uy-bos", tamAd: "Plansiz Uye", kurum: null });
/* DOLU katalog: ArvoOS ad ve plan kodu bildiriyor → "Pro". */
const DOLU = await kullaniciKur({ etiket: "ayar-katalog", tamAd: "Planli Uye", kurum: null });
/* Panelde KAYITLI kurum seçimi olan kullanıcı. */
const KURUMLU = await kullaniciKur({ etiket: "uy-kurum", tamAd: "Kurum Uyesi", kurum: KURUM });

const SEKMELER = ["Hesap", "Güvenlik", "Tercihler", "Abonelik", "Veriler"];
const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(56)} ${ayrinti}`);
};
const ayni = (a, b) => Math.abs(a - b) <= 1;
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { deviceScaleFactor: 2 }) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png` }); };
  const giris = async (k) => {
    await ctx.clearCookies();
    await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
    await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
    await s.fill('input[name="email"]', k.adres);
    await s.fill('input[name="password"]', k.parola);
    await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
    await s.goto(`${UYG}/dashboard`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
  };
  const ayarlariAc = async () => {
    await s.locator("details.os-kullanici summary").filter({ visible: true }).first().click();
    await s.locator('.os-kullanici-menu a[href="/dashboard/settings"]').filter({ visible: true }).first().click();
    await s.waitForSelector(".drawer-root.open .ayarlar-pencere", { timeout: 25000 });
    await s.waitForTimeout(900);
  };
  /* Sol navigasyondaki (ya da üst çubuktaki) ad altı etiketi. */
  const navEtiketi = () => s.evaluate(() => {
    const kimlik = [...document.querySelectorAll(".os-kullanici-kimlik, .os-kullanici-bas")]
      .find((e) => e.getClientRects().length > 0);
    return kimlik ? (kimlik.querySelector("small")?.textContent?.trim() ?? null) : null;
  });
  const hesapSatirlari = () => s.evaluate(() => {
    const kok = document.querySelector(".drawer-root.open .ayarlar-pencere") ?? document;
    const liste = kok.querySelector(".ayarlar-bilgiler");
    if (!liste) return { var: false, satirlar: [] };
    return { var: true, satirlar: [...liste.querySelectorAll("div")].map((d) => ({
      etiket: d.querySelector("dt")?.textContent?.trim() ?? "", deger: d.querySelector("dd")?.textContent?.trim() ?? "" })) };
  });

  /* ---- U · Plan bilgisi YOKSA satır gizli (bugünkü ArvoOS) ---- */
  try {
    await giris(BOS);
    const nav = await navEtiketi();
    await ayarlariAc();
    const h = await hesapSatirlari();
    const rolYazisi = await s.evaluate(() => /(^|\s)Rol(\s|:)/.test(document.querySelector(".drawer-root.open .ayarlar-pencere")?.innerText ?? ""));
    yaz("U1 · Plan bilgisi yoksa üyelik satırı YOK", EKRAN, TEMA,
        !h.satirlar.some((r) => /Üyelik/.test(r.etiket)), `satırlar=${JSON.stringify(h.satirlar)}`);
    yaz("U2 · 'Rol' satırı kalktı", EKRAN, TEMA, !rolYazisi, `rolMetni=${rolYazisi}`);
    yaz("U3 · Kurum seçimi yoksa kurum satırı YOK", EKRAN, TEMA,
        !h.satirlar.some((r) => /Kurum/.test(r.etiket)), `liste=${h.var}`);
    yaz("U4 · Navigasyonda da etiket yok (rol yazmıyor)", EKRAN, TEMA, !nav, `nav="${nav ?? ""}"`);
    await resim("uyelik-bos-hesap");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("U · plansız kullanıcı", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- D · Katalog ad ve plan kodu bildiriyorsa "Pro" ---- */
  try {
    await giris(DOLU);
    const nav = await navEtiketi();
    await ayarlariAc();
    const h = await hesapSatirlari();
    const uyelik = h.satirlar.find((r) => /Üyelik tipi/.test(r.etiket));
    yaz("D1 · Hesap'ta 'Üyelik tipi' satırı ve plan adı", EKRAN, TEMA, uyelik?.deger === "Pro",
        `satır=${JSON.stringify(uyelik ?? null)}`);
    yaz("D2 · Navigasyon AYNI etiketi gösteriyor", EKRAN, TEMA, nav === "Pro", `nav="${nav ?? ""}"`);
    yaz("D3 · İki ekran aynı kaynaktan (etiketler eşit)", EKRAN, TEMA, nav === uyelik?.deger,
        `nav="${nav}" hesap="${uyelik?.deger}"`);
    await resim("uyelik-dolu-hesap");

    /* ---- O · #153: sabit ölçüler ve içerik kaydırması (regresyon) ---- */
    const olc = () => s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const r = kok.querySelector("section.drawer").getBoundingClientRect();
      const kabi = kok.querySelector(".drawer-body");
      const govde = kok.querySelector(".ayarlar-govde");
      return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10,
        g: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
        kapKayiyor: kabi.scrollHeight - kabi.clientHeight > 1,
        govdeVar: Boolean(govde) };
    });
    const olcumler = {};
    for (const sek of SEKMELER) {
      await s.locator(".ayarlar-sekme", { hasText: new RegExp(`^${sek}$`) }).first().click();
      await s.waitForTimeout(400);
      olcumler[sek] = await olc();
    }
    const ilk = olcumler[SEKMELER[0]];
    const sapan = SEKMELER.filter((sek) => {
      const k = olcumler[sek];
      return !(ayni(k.x, ilk.x) && ayni(k.y, ilk.y) && ayni(k.g, ilk.g) && ayni(k.h, ilk.h));
    });
    yaz("O1 · #153: beş sekmede dış ölçüler ve konum aynı", EKRAN, TEMA, sapan.length === 0,
        `${ilk.g}×${ilk.h}@${ilk.x},${ilk.y}` + (sapan.length ? ` sapan=[${sapan.join(", ")}]` : ""));
    yaz("O2 · #153: yalnızca içerik alanı kayıyor", EKRAN, TEMA,
        SEKMELER.every((sek) => !olcumler[sek].kapKayiyor && olcumler[sek].govdeVar), "dış kap kaymıyor");
    const ulasilmayan = [];
    for (const sek of SEKMELER) {
      await s.locator(".ayarlar-sekme", { hasText: new RegExp(`^${sek}$`) }).first().click();
      await s.waitForTimeout(380);
      const d = await s.evaluate(() => {
        const govde = document.querySelector(".drawer-root.open .ayarlar-govde");
        govde.scrollTop = govde.scrollHeight;
        const panel = [...govde.querySelectorAll(".ayarlar-panel")].find((p) => !p.hidden);
        const son = panel ? panel.children[panel.children.length - 1] : null;
        if (!son) return { yok: true };
        const r = son.getBoundingClientRect(), gg = govde.getBoundingClientRect();
        return { yok: false, gorunur: r.bottom <= gg.bottom + 2 && r.top < gg.bottom, fark: Math.round(r.bottom - gg.bottom) };
      });
      if (d.yok || !d.gorunur) ulasilmayan.push(`${sek}(${d.yok ? "panel yok" : `+${d.fark}px`})`);
    }
    yaz("O3 · #153: son içerik satırına kaydırarak ulaşılıyor", EKRAN, TEMA, ulasilmayan.length === 0,
        ulasilmayan.length ? `ulaşılamayan=[${ulasilmayan.join(", ")}]` : "beş sekmede de son satır görünür");
    await resim("uyelik-son-satir");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("D/O · planlı kullanıcı", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- K · Panelde kayıtlı kurum seçimi varsa kurum satırı ---- */
  try {
    await giris(KURUMLU);
    await ayarlariAc();
    const h = await hesapSatirlari();
    const kurum = h.satirlar.find((r) => /Kurum/.test(r.etiket));
    yaz("K1 · Kayıtlı kurum seçimi varsa kurum adı yazıyor", EKRAN, TEMA,
        Boolean(kurum && /Uyelik Universitesi/.test(kurum.deger)), `satır=${JSON.stringify(kurum ?? null)}`);
    /* Kurum üyesinin planı kurumun; katalog boş, üyelik satırı yok. */
    yaz("K2 · Kurum üyesinde üyelik satırı yok (plan kurumun)", EKRAN, TEMA,
        !h.satirlar.some((r) => /Üyelik/.test(r.etiket)), `satırlar=${JSON.stringify(h.satirlar)}`);
    await resim("uyelik-kurum-hesap");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("K · kurumlu kullanıcı", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  await ctx.close();
}
await tarayici.close();
if (GORSEL) fs.writeFileSync(`${GORSEL}/uyelik-tipi.json`, JSON.stringify(sonuclar, null, 1));
const gec = sonuclar.filter((r) => r.gecti).length;
console.log(`\n${sonuclar.length} kontrol · ${gec} geçti · ${sonuclar.length - gec} kaldı`);
process.exit(gec === sonuclar.length ? 0 : 1);
