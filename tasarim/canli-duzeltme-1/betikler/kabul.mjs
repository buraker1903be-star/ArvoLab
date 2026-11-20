// Canlı deneme düzeltmeleri kabulü (20.11.2026). YEREL, SENTETİK veri (tasarim/tek-deneyim/betikler/tohum.mjs).
// Ölçülen: (1) İncele paneli aç → kapat → tekrar aç (fare ve klavye, odak taşınması, kâğıt/araç çubuğuyla çakışmama),
// (2) yazarken belge çevresinde odak halkası yok; imleç, seçim ve araç çubuğu klavye halkası duruyor,
// (3) Word çıktısı: başlıksız belgede İÇİNDEKİLER yok, başlıklı belgede var. Gerçek kullanıcı verisine dokunmaz.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const URL0 = process.argv[2] ?? "http://localhost:3150";
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const D = new URL(".", import.meta.url).pathname;
const G = `${D}../gorseller`; fs.mkdirSync(G, { recursive: true });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const ek = Date.now().toString(36).slice(-5);
const sonuc = []; const kayit = (ad, gecti, ayrinti) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };
const b = await chromium.launch();

async function baglam(genislik = 1440) {
  const c = await b.newContext({ baseURL: URL0, viewport: { width: genislik, height: 900 } });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await s.goto("/"); await s.fill('input[name="email"]', T.hesaplar.bireysel.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hata };
}
async function yeniCalisma(s, baslik) {
  await s.goto("/dashboard/editor"); await s.waitForLoadState("networkidle").catch(() => {});
  await s.locator("button:visible", { hasText: /^\s*Yeni çalışma\s*$/ }).first().click();
  const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible" });
  await f.locator('input[name="title"]').fill(baslik);
  await Promise.all([s.waitForURL(/\/dashboard\/editor\/[0-9a-f-]{36}\/write/, { timeout: 60000 }), f.locator('button[value="yaz"]').click()]);
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  return s.url().match(/editor\/([0-9a-f-]{36})/)[1];
}
const kaydedildi = async (id, parca) => { for (let i = 0; i < 30; i++) { if (psql(`select count(*) from public.project_manuscripts where project_id='${id}' and plain_text like '%${parca}%'`) === "1") return true; await new Promise((r) => setTimeout(r, 1000)); } return false; };
const kesisir = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const odaktaki = (s) => s.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}.${(e.className || "").toString().slice(0, 40)}|${e.getAttribute("aria-label") ?? ""}` : null; });
const panelGorunur = (s) => s.locator(".manuscript-outline").first().isVisible();

// 1) İncele paneli: aç → kapat → tekrar aç, iki genişlikte
for (const genislik of [1440, 1280]) {
  const { c, s, hata } = await baglam(genislik);
  const id = await yeniCalisma(s, `DZ1-PANEL-${genislik}-${ek}`);
  await s.evaluate(() => { try { localStorage.removeItem("arvolab:inceleme-paneli"); } catch {} });
  await s.reload(); await s.locator(".ProseMirror").first().waitFor();
  const dugme = s.locator(".inceleme-ac-dugme");
  const ilkGorunur = await dugme.isVisible();
  const dk = await dugme.boundingBox();
  const kagit = await s.locator(".manuscript-editor-shell").first().boundingBox();
  const aracta = await dugme.evaluate((e) => Boolean(e.closest(".manuscript-araclar")));
  const tasma = await s.locator(".manuscript-araclar").first().evaluate((e) => e.scrollWidth - e.clientWidth);
  const ad = await dugme.getAttribute("aria-label");
  await s.screenshot({ path: `${G}/panel-kapali-${genislik}.png` });
  await dugme.click(); await s.waitForTimeout(300);
  const acildi = await panelGorunur(s); const dugmeGitti = !(await dugme.isVisible());
  const odak1 = await odaktaki(s);
  await s.screenshot({ path: `${G}/panel-acik-${genislik}.png` });
  await s.locator(".manuscript-outline .inceleme-bas button").click(); await s.waitForTimeout(300);
  const kapandi = !(await panelGorunur(s)); const dugmeGeldi = await dugme.isVisible();
  const odak2 = await odaktaki(s);
  // klavyeyle tekrar aç (odak düğmede)
  await s.keyboard.press("Enter"); await s.waitForTimeout(300);
  const klavyeyleAcildi = await panelGorunur(s);
  // yeniden yüklemede tercih korunuyor
  await s.reload(); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(300);
  const yenilemedeAcik = await panelGorunur(s);
  kayit(`${genislik}px: İncele kapalıyken araç çubuğunun sağ ucunda görünür düğme; kâğıtla çakışmıyor, çubuk taşmıyor, erişilebilir ad`, ilkGorunur && aracta && !kesisir(dk, kagit) && tasma <= 1 && /İncele/.test(ad ?? ""), { ilkGorunur, aracta, dk, kagit, tasma, ad });
  kayit(`${genislik}px: aç → kapat → tekrar aç (fare ve Enter); odak panele ve geri düğmeye taşınıyor; tercih yenilemede korunuyor`,
    acildi && dugmeGitti && /İnceleme panelini kapat/.test(odak1 ?? "") && kapandi && dugmeGeldi && /inceleme-ac-dugme/.test(odak2 ?? "") && klavyeyleAcildi && yenilemedeAcik && hata.length === 0,
    { acildi, dugmeGitti, odak1, kapandi, dugmeGeldi, odak2, klavyeyleAcildi, yenilemedeAcik, hata });
  await c.close();
}

// 2) Yazarken çerçeve yok; imleç, seçim, araç çubuğu klavye halkası duruyor
{
  const { c, s, hata } = await baglam(1440);
  const id = await yeniCalisma(s, `DZ1-CERCEVE-${ek}`);
  const pm = s.locator(".ProseMirror").first();
  await pm.click(); await s.keyboard.type(`Cerceve denemesi ${ek}`);
  const durum = await s.evaluate(() => {
    const e = document.querySelector(".ProseMirror"); const cs = getComputedStyle(e); const sel = getSelection();
    return { odakta: document.activeElement === e, outline: cs.outlineStyle, outlineGenislik: cs.outlineWidth, golge: cs.boxShadow, imlecKapali: sel.isCollapsed, imlecIcinde: e.contains(sel.anchorNode), caret: cs.caretColor };
  });
  await s.screenshot({ path: `${G}/yazarken-cerceve-yok.png` });
  await s.keyboard.press("Shift+Home");
  const secim = await s.evaluate(() => ({ metin: getSelection().toString(), renk: getComputedStyle(document.querySelector(".ProseMirror p"), "::selection").backgroundColor }));
  await s.screenshot({ path: `${G}/yazarken-secim.png` });
  // Araç çubuğu: klavyeyle bir düğmeye gelinince halka görünür
  await s.locator(".manuscript-araclar button").first().focus();
  await s.keyboard.press("Tab"); await s.keyboard.press("Shift+Tab");
  const arac = await s.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { araclarda: Boolean(e.closest(".manuscript-araclar")), fv: e.matches(":focus-visible"), outline: `${cs.outlineStyle} ${cs.outlineWidth}`, golge: cs.boxShadow }; });
  await s.screenshot({ path: `${G}/arac-cubugu-klavye-odagi.png` });
  const kayitTamam = await kaydedildi(id, `Cerceve denemesi ${ek}`);
  kayit("yazarken belge alanında odak halkası yok (outline none, gölge yok)", durum.odakta && durum.outline === "none" && durum.golge === "none", durum);
  kayit("metin imleci belgede, yazılan metin kaydedildi", durum.imlecKapali && durum.imlecIcinde && kayitTamam, { ...durum, kayitTamam });
  kayit("normal metin seçimi çalışıyor ve seçim rengi duruyor", secim.metin.includes("Cerceve denemesi") && secim.renk !== "rgba(0, 0, 0, 0)", secim);
  kayit("araç çubuğu düğmesinin klavye odak halkası duruyor", arac.araclarda && arac.fv && (arac.outline !== "none 0px" || arac.golge !== "none"), arac);
  if (hata.length) kayit("sayfa hatası yok", false, { hata });
  await c.close();
}

// 3) Word çıktısı: başlıksız belgede İÇİNDEKİLER yok, başlıklı belgede var (içindekiler açık)
async function wordIndir(s) {
  await s.locator("button:visible", { hasText: /^\s*Dışa aktar\s*$/ }).first().click();
  const [indirme] = await Promise.all([s.waitForEvent("download", { timeout: 60000 }).catch(() => null), s.locator("button.arac-menu-oge:visible", { hasText: "Word (.docx)" }).first().click()]);
  if (!indirme) return null;
  return execFileSync("unzip", ["-p", await indirme.path(), "word/document.xml"], { encoding: "utf8" });
}
{
  const { c, s, hata } = await baglam(1440);
  const id1 = await yeniCalisma(s, `DZ1-BASLIKSIZ-${ek}`);
  await s.locator(".ProseMirror").first().click(); await s.keyboard.type(`Basliksiz metin ${ek}`);
  await kaydedildi(id1, `Basliksiz metin ${ek}`);
  psql(`update public.project_manuscripts set include_toc = true where project_id='${id1}'`);
  await s.reload(); await s.locator(".ProseMirror").first().waitFor();
  const xml1 = await wordIndir(s);
  const id2 = await yeniCalisma(s, `DZ1-BASLIKLI-${ek}`);
  await s.locator(".ProseMirror").first().click();
  await s.locator(".manuscript-araclar button", { hasText: /^H1$/ }).first().click();
  await s.keyboard.type("Giriş"); await s.keyboard.press("Enter"); await s.keyboard.type(`Baslikli metin ${ek}`);
  await kaydedildi(id2, `Baslikli metin ${ek}`);
  psql(`update public.project_manuscripts set include_toc = true where project_id='${id2}'`);
  await s.reload(); await s.locator(".ProseMirror").first().waitFor();
  const xml2 = await wordIndir(s);
  kayit("Word: başlıksız belgede (içindekiler açık) İÇİNDEKİLER başlığı ve alanı yok, metin var", xml1 && !xml1.includes("İÇİNDEKİLER") && !/TOC \\[ho]/.test(xml1) && xml1.includes(`Basliksiz metin ${ek}`), { indi: Boolean(xml1) });
  kayit("Word: başlıklı belgede İÇİNDEKİLER ve başlık satırı korunuyor", xml2 && xml2.includes("İÇİNDEKİLER") && /TOC \\[ho]/.test(xml2) && xml2.split("Giriş").length >= 3, { indi: Boolean(xml2) });
  if (hata.length) kayit("sayfa hatası yok", false, { hata });
  await c.close();
}

await b.close();
fs.writeFileSync(`${D}../kabul-sonucu.json`, JSON.stringify(sonuc, null, 2));
console.log(`\nTOPLAM ${sonuc.filter((x) => x.gecti).length}/${sonuc.length}`);
