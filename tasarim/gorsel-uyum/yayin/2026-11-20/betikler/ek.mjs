// Ek canlı kontrol: yeni çalışma penceresi (görünür tetik, form GÖNDERİLMEZ) ve PDF çekmecesi Esc (1220 px).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/home/user/arvolab-tasarim/package.json");
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = "https://lab.arvo-os.com";
const PROJE = JSON.parse(fs.readFileSync(`${D}iz.json`, "utf8")).calisma;
const W = `/dashboard/editor/${PROJE}/write`;
const b = await chromium.launch();
const out = [];
const DURUMLAR = [
  { ad: "d1440", viewport: { width: 1440, height: 900 } },
  { ad: "d1280", viewport: { width: 1280, height: 800 } },
  { ad: "t390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
for (const dur of DURUMLAR) for (const tema of ["light", "dark"]) {
  const c = await b.newContext({ baseURL: URL0, storageState: `${D}oturum.json`, viewport: dur.viewport, isMobile: !!dur.isMobile, hasTouch: !!dur.hasTouch, colorScheme: tema });
  const s = await c.newPage(); const hata = []; const eylem = [];
  s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  s.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) eylem.push(1); });
  const k = { ad: `${dur.ad}-${tema}` };
  try {
    await s.goto("/dashboard"); await s.waitForLoadState("networkidle").catch(() => {});
    const tetik = s.locator("a:visible, button:visible").filter({ hasText: /^\s*Yeni çalışma\s*$/ }).first();
    k.tetikGorunur = await tetik.isVisible();
    const eylemOnce = eylem.length;
    await tetik.click();
    const form = s.locator(".yeni-calisma-formu"); await form.waitFor({ state: "visible", timeout: 10000 });
    await s.waitForTimeout(500); await s.screenshot({ path: `${D}${k.ad}-yeni-calisma.png` });
    const dug = await s.evaluate(() => [...document.querySelectorAll(".yeni-calisma-formu .pencere-dugmeler button")].map((x) => { const r = x.getBoundingClientRect(); return { v: x.value, x: Math.round(r.x), y: Math.round(r.y) }; }));
    k.dom = dug.map((d) => d.v); k.gorsel = [...dug].sort((a, c2) => (a.y - c2.y) || (a.x - c2.x)).map((d) => d.v);
    await s.evaluate(() => { const f = document.querySelector(".yeni-calisma-formu"); const h = [...f.querySelectorAll("input,select,textarea,button")].filter((e) => !e.disabled && e.offsetParent); const i = h.indexOf(f.querySelector(".pencere-dugmeler button")); h[i - 1].focus(); });
    const aktif = () => s.evaluate(() => document.activeElement?.value || document.activeElement?.name || document.activeElement?.tagName);
    k.oncekiAlan = await aktif();
    await s.keyboard.press("Tab"); const t1 = await aktif(); await s.keyboard.press("Tab"); const t2 = await aktif();
    await s.keyboard.press("Shift+Tab"); const g1 = await aktif(); await s.keyboard.press("Shift+Tab"); const g2 = await aktif();
    k.tab = [t1, t2]; k.shiftTab = [g1, g2];
    k.pozitifTabindex = await s.evaluate(() => [...document.querySelectorAll("[tabindex]")].filter((e) => Number(e.getAttribute("tabindex")) > 0).length);
    await s.keyboard.press("Escape"); await s.waitForTimeout(600);
    k.escKapatti = !(await form.isVisible().catch(() => false));
    k.formGonderilmedi = eylem.length === eylemOnce;
  } catch (e) { k.HATA = String(e.message).split("\n")[0]; await s.screenshot({ path: `${D}hata-ek-${k.ad}.png` }).catch(() => {}); }
  k.sayfaHatalari = hata; out.push(k); console.log(JSON.stringify(k)); await c.close();
}
if (!process.env.YALNIZ_FORM) {
// PDF çekmecesi (1220 px): tasarımda Esc yalnızca çekmeceyi kapatır.
for (const tema of ["light", "dark"]) {
  const c = await b.newContext({ baseURL: URL0, storageState: `${D}oturum.json`, viewport: { width: 1220, height: 800 }, colorScheme: tema });
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  const k = { ad: `d1220-${tema}-pdf-cekmece` };
  try {
    await s.goto(`${W}?sol=kaynaklar&sag=pdf`); await s.locator(".kaynak-pdf-paneli").first().waitFor({ state: "visible", timeout: 60000 });
    await s.waitForTimeout(2000); await s.screenshot({ path: `${D}${k.ad}.png` });
    k.cekmece = await s.evaluate(() => !!document.querySelector("[data-sag-cekmece]"));
    k.ipucu = await s.locator(".kaynak-pdf-cekmece-ipucu").first().isVisible().catch(() => false);
    await s.locator(".ProseMirror").first().click({ position: { x: 20, y: 10 } });
    await s.keyboard.press("Escape"); await s.waitForTimeout(900);
    k.escSonrasiPdfAcik = await s.locator(".kaynak-pdf-paneli").first().isVisible().catch(() => false);
    k.adres = new URL(s.url()).search;
  } catch (e) { k.HATA = String(e.message).split("\n")[0]; }
  k.sayfaHatalari = hata; out.push(k); console.log(JSON.stringify(k)); await c.close();
}
}
fs.writeFileSync(`${D}sonuc-ek${process.env.YALNIZ_FORM ? "-form" : ""}.json`, JSON.stringify(out, null, 2));
await b.close();
