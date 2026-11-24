// ODAK İADESİ, ESCAPE VE KAYDIRMA KİLİDİ KABULÜ (24.11.2026).
//
// Açılır ekran incelemesinin ilk uygulama turunu sabitler. Ölçtüğü üç şey:
//   A. Menüden açılan pencere kapanınca odak GÖRÜNÜR menü düğmesine döner.
//   B. Tetiksiz (adresten açılan) pencerede odak sayfada anlamlı bir hedefe
//      döner, gövdeye düşmez.
//   C. İç içe pencerede ilk Escape yalnızca en üsttekini kapatır; alttaki
//      açıkken kaydırma kilidi sürer ve odak alttaki pencereye döner; son
//      pencere kapanınca kilit kalkar.
// Ayrıca odak iadesi zaten çalışan yedi PanelDrawer örneği regresyon olarak
// yeniden koşulur: düzeltme onları bozmamalı.
//
// Kullanım: node scripts/yerel-yigin/odak-ve-esc-kabul.mjs <uygulama> [görüntü-dizini]
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
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const govdeli = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, role: "service_role" })}`;
const SERVIS = `${govdeli}.${crypto.createHmac("sha256", SIR).update(govdeli).digest("base64url")}`;
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8",
  }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, gv, m = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: m, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(gv),
  });
  return { d: r.status, j: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(`${KOK}/.next/BUILD_ID`) ? fs.readFileSync(`${KOK}/.next/BUILD_ID`, "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) throw new Error(`BUILD_ID (${BUILD_ID ?? "yok"}) sunulan sayfada yok`);
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit yanıt vermiyor");
} catch (e) { console.error("Ön koşul yok:", e.message); process.exit(2); }

/* ---------- Sentetik kullanıcı ve veri ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `odak-${ek}@yerel.test`, parola = `Od7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Odak Denegi" } });
if (yeni.d >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.j.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', 'Odak calismasi', 'apa7') returning id`).split("\n")[0];
for (const [baslik, yazar, yil] of [["Ogrenme stilleri", "Yilmaz, A.", 2020], ["Motivasyon", "Demir, B.", 2019]]) {
  psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, source_type, status)
    values (${q(KULLANICI)}, ${q(PROJE)}, ${q(baslik)}, ${q(yazar)}, ${yil}, 'Dergi', '8', '1', '10-25', 'article', 'used')`);
}
const DUZ = "Giris\nOgrenme stilleri (Yilmaz, 2020) ele alinir.";
const ICERIK = { type: "doc", content: [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
  { type: "paragraph", content: [{ type: "text", text: "Ogrenme stilleri (Yilmaz, 2020) ele alinir." }] },
] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
      values (${q(PROJE)}, ${q(JSON.stringify(ICERIK))}::jsonb, ${q(DUZ)}, 7, ${q(KULLANICI)})`);

/* ---------- Yardımcılar ---------- */
const sonuclar = [];
const yaz = (ad, ekran, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(5)} ${ad.padEnd(44)} ${ayrinti}`);
};
const odak = (s) => s.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY (kayıp)";
  const etiket = a.getAttribute("aria-label") ?? (a.textContent ?? "").trim().slice(0, 28);
  const gizli = a.getClientRects().length === 0;
  return `${a.tagName}${a.className ? "." + String(a.className).split(" ")[0] : ""}[${etiket}]${gizli ? " GİZLİ" : ""}`;
});
const acikPencere = (s) => s.locator(".drawer-root.open").count();
const kilitli = (s) => s.evaluate(() => document.documentElement.classList.contains("drawer-open"));

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturumAc = async (g, y) => {
  const ctx = await tarayici.newContext({ viewport: { width: g, height: y }, locale: "tr-TR", ...(g < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};
const git = async (s, yol) => {
  await s.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
};
const pencereBekle = async (s, sayi = 1) => {
  await s.waitForFunction((n) => document.querySelectorAll(".drawer-root.open").length === n, sayi, { timeout: 20000 });
  await s.waitForTimeout(350);
};
const resim = async (s, ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}.png` }); };

/* Her ölçüm kendi sayfasında: önceki senaryodan kalan odak sızmasın. */
for (const [EKRAN, YUK] of [[1440, 900], [390, 844]]) {
  const { ctx, s } = await oturumAc(EKRAN, YUK);

  /* ---- A · Menüden açılan üç Dialog ---- */
  for (const [ad, etiket] of [
    ["Kısayollar", "Klavye kısayolları"],
    ["Sürümler", "Sürüm geçmişi"],
    ["Paylaş", "Danışmana paylaş (salt okunur bağlantı)"],
  ]) {
    await git(s, `/dashboard/editor/${PROJE}/write`);
    try {
      await s.locator('button[aria-label^="Bul, odak modu"]').first().click();
      await s.locator(`.arac-menu-pencere button[aria-label="${etiket}"]`).click();
      await pencereBekle(s);
      if (ad === "Kısayollar") await resim(s, `A-${EKRAN}-kisayollar-acik`);
      await s.keyboard.press("Escape");
      await s.waitForTimeout(500);
      const o = await odak(s);
      const kapandi = (await acikPencere(s)) === 0;
      /* Beklenen hedef: menüyü açan GÖRÜNÜR "Belge" düğmesi. */
      const dogru = kapandi && /^BUTTON\.arac-menu-dugme\[Bul, odak modu/.test(o) && !o.includes("GİZLİ");
      yaz(`A · ${ad}: odak menü düğmesine döner`, EKRAN, dogru, `odak=${o} pencere=${kapandi ? "kapandı" : "AÇIK"}`);
    } catch (e) { yaz(`A · ${ad}: odak menü düğmesine döner`, EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`); }
  }

  /* ---- B · Tetiksiz, adresten açılan pencere ---- */
  await git(s, `/dashboard/editor/${PROJE}?kilavuz=1`);
  try {
    await pencereBekle(s);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
    const o = await odak(s);
    const kapandi = (await acikPencere(s)) === 0;
    const kilit = await kilitli(s);
    const dogru = kapandi && !kilit && !o.startsWith("BODY");
    yaz("B · Adresten açılan pencere: odak sayfada kalır", EKRAN, dogru, `odak=${o} kilit=${kilit}`);
  } catch (e) { yaz("B · Adresten açılan pencere: odak sayfada kalır", EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- C5 · Dialog katman sistemine katılıyor mu ----
     İç içe pencere bugün yalnızca PanelDrawer–PanelDrawer olarak
     ulaşılabiliyor (Literatür → Manuel kaynak ekle). Dialog'un aynı
     kurallara girdiği, katmanını yazıp yazmadığına bakılarak ölçülüyor:
     katman yoksa enUstPencere() onu göremez, yani Escape ve kaydırma
     kilidi onun için yanlış çalışır. */
  await git(s, `/dashboard/editor/${PROJE}/write`);
  try {
    await s.locator('button[aria-label^="Bul, odak modu"]').first().click();
    await s.locator('.arac-menu-pencere button[aria-label="Klavye kısayolları"]').click();
    await pencereBekle(s);
    const katman = await s.evaluate(() => document.querySelector(".drawer-root.open")?.dataset.katman ?? "(yok)");
    const kilit = await kilitli(s);
    yaz("C5 · Dialog katmanını yazar (Esc sırası için)", EKRAN, katman !== "(yok)", `data-katman=${katman} kilit=${kilit}`);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("C5 · Dialog katmanını yazar (Esc sırası için)", EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- B2 · Tetiksiz onay penceresi (ActionForm) ---- */
  await git(s, "/dashboard/settings");
  try {
    await s.locator('li.ayar-satir:has(b:text-is("Diğer cihazlar"))').locator("button").first().click();
    await pencereBekle(s);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
    const o = await odak(s);
    const dogru = (await acikPencere(s)) === 0 && !o.startsWith("BODY") && !o.includes("GİZLİ");
    yaz("B2 · Onay penceresi (tetiksiz): odak açan düğmeye döner", EKRAN, dogru, `odak=${o}`);
  } catch (e) { yaz("B2 · Onay penceresi (tetiksiz): odak açan düğmeye döner", EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- C · İç içe pencere: Literatür → Manuel kaynak ekle ---- */
  await git(s, `/dashboard/literature?calisma=${PROJE}`);
  try {
    await s.locator("details.kaynak-ekle summary").first().click();
    await s.locator(".kaynak-bul-tetik").first().click();
    await pencereBekle(s, 1);
    await s.locator("button", { hasText: /Manuel kaynak ekle/ }).first().click();
    await pencereBekle(s, 2);
    await resim(s, `C-${EKRAN}-ic-ice`);
    const ustKatman = await s.evaluate(() =>
      [...document.querySelectorAll(".drawer-root.open")].map((k) => k.dataset.katman ?? "-").join(","));

    await s.keyboard.press("Escape");
    await s.waitForTimeout(600);
    const kalan = await acikPencere(s);
    const kilitSurdu = await kilitli(s);
    const o1 = await odak(s);
    const icerde = await s.evaluate(() => {
      const a = document.activeElement;
      return Boolean(a && a.closest(".drawer-root.open"));
    });
    yaz("C1 · İlk Esc yalnızca üstteki pencereyi kapatır", EKRAN, kalan === 1, `kalan=${kalan} katmanlar=${ustKatman}`);
    yaz("C2 · Alttaki açıkken kaydırma kilidi sürer", EKRAN, kilitSurdu === true, `drawer-open=${kilitSurdu}`);
    yaz("C3 · Odak alttaki pencereye döner", EKRAN, icerde, `odak=${o1}`);

    await s.keyboard.press("Escape");
    await s.waitForTimeout(600);
    const son = await acikPencere(s);
    const kilitKalkti = (await kilitli(s)) === false;
    yaz("C4 · Son pencere kapanınca kaydırma geri gelir", EKRAN, son === 0 && kilitKalkti, `kalan=${son} drawer-open=${!kilitKalkti}`);
  } catch (e) {
    for (const n of ["C1 · İlk Esc yalnızca üstteki pencereyi kapatır", "C2 · Alttaki açıkken kaydırma kilidi sürer", "C3 · Odak alttaki pencereye döner", "C4 · Son pencere kapanınca kaydırma geri gelir"])
      yaz(n, EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- R · Regresyon: odak iadesi zaten çalışan yedi PanelDrawer ---- */
  const REGRESYON = [
    ["Hesabımı sil", "/dashboard/settings", async (p) => p.locator('li.ayar-satir:has(b:text-is("Hesabımı sil"))').locator("button").first().click()],
    ["Şifre değiştirme", "/dashboard/settings", async (p) => p.locator('li.ayar-satir:has(b:text-is("Şifre"))').locator("button").first().click()],
    ["Kaynak dışa aktarma", `/dashboard/literature?calisma=${PROJE}`, async (p) => p.locator("button", { hasText: /Dışa aktar/ }).first().click()],
    ["Kaynakça denetimi", `/dashboard/literature?calisma=${PROJE}&sekme=kaynakca`, async (p) => p.locator(".kaynakca-serit-eylem").first().click()],
    ["Belge yükle", `/dashboard/documents?calisma=${PROJE}`, async (p) => p.locator("button", { hasText: /Belge yükle/ }).first().click()],
    ["Yeni çalışma", "/dashboard/editor", async (p) => p.locator("button", { hasText: /Yeni çalışma/ }).first().click()],
    ["Manuel kaynak ekle (iç pencere)", `/dashboard/literature?calisma=${PROJE}`, async (p) => {
      await p.locator("details.kaynak-ekle summary").first().click();
      await p.locator(".kaynak-bul-tetik").first().click();
      await p.waitForTimeout(900);
      await p.locator("button", { hasText: /Manuel kaynak ekle/ }).first().click();
    }],
  ];
  for (const [ad, yol, ac] of REGRESYON) {
    await git(s, yol);
    try {
      const oncesi = await s.evaluate(() => document.activeElement?.tagName ?? "-");
      await ac(s);
      await s.waitForSelector(".drawer-root.open section.drawer", { state: "visible", timeout: 20000 });
      await s.waitForTimeout(400);
      await s.keyboard.press("Escape");
      await s.waitForTimeout(500);
      const o = await odak(s);
      /* Tetikli pencerede odak düğmenin kendisine dönmeli: görünür ve BODY değil. */
      const dogru = !o.startsWith("BODY") && !o.includes("GİZLİ");
      yaz(`R · ${ad}: odak tetiğe döner`, EKRAN, dogru, `öncesi=${oncesi} sonrası=${o}`);
    } catch (e) { yaz(`R · ${ad}: odak tetiğe döner`, EKRAN, false, `HATA ${String(e.message).slice(0, 70)}`); }
  }

  await ctx.close();
}
await tarayici.close();

const kaldi = sonuclar.filter((r) => !r.gecti);
if (GORSEL) fs.writeFileSync(`${GORSEL}/odak-kabul.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 1));
console.log(`\n${sonuclar.length} kontrol · ${sonuclar.length - kaldi.length} geçti · ${kaldi.length} kaldı · HEAD ${HEAD.slice(0, 7)}`);
process.exit(kaldi.length ? 1 : 0);
