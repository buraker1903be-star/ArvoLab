// PR #112 yayını canlı kontrolü (test düzeneği, uygulama kodu DEĞİL).
// Sentetik test hesabıyla SALT OKUMA: form gönderilmez, AI istemi gönderilmez,
// koyu tema hesap ayarıyla değil tarayıcı öykünmesiyle (colorScheme) sınanır.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/home/user/arvolab-tasarim/package.json");
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = "https://lab.arvo-os.com";
const H = JSON.parse(fs.readFileSync(process.env.HESAP_DOSYASI, "utf8")); // { adres, parola } — dosya depoda DEĞİL
const PROJE = JSON.parse(fs.readFileSync(`${D}iz.json`, "utf8")).calisma;
const W = `/dashboard/editor/${PROJE}/write`;
const DURUMLAR = [
  { ad: "d1440", viewport: { width: 1440, height: 900 } },
  { ad: "d1280", viewport: { width: 1280, height: 800 } },
  { ad: "t390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const b = await chromium.launch();
const sonuc = [];
const yaz = () => fs.writeFileSync(`${D}sonuc.json`, JSON.stringify(sonuc, null, 2));

// Tek giriş, oturum durumu tekrar kullanılır (giriş hız sınırına takılmamak için).
const STATE = `${D}oturum.json`;
if (!fs.existsSync(STATE)) {
  const c = await b.newContext({ baseURL: URL0 });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage();
  await s.goto("/"); await s.fill('input[name="email"]', H.adres); await s.fill('input[name="password"]', H.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  await c.storageState({ path: STATE }); await c.close();
}

const tasmaYok = (s) => s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const kutu = (s, sel) => s.locator(sel).first().boundingBox().catch(() => null);
const icinde = (k, vp) => !!k && k.x >= -1 && k.y >= -1 && k.x + k.width <= vp.width + 1 && k.y + k.height <= vp.height + 1;

for (const dur of DURUMLAR) for (const tema of ["light", "dark"]) {
  const ad = `${dur.ad}-${tema}`;
  const c = await b.newContext({ baseURL: URL0, storageState: STATE, viewport: dur.viewport, isMobile: !!dur.isMobile, hasTouch: !!dur.hasTouch, colorScheme: tema, deviceScaleFactor: 1 });
  const s = await c.newPage();
  const hata = [], sunucu = [], eylem = [];
  s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  s.on("response", (r) => { if (r.status() >= 500) sunucu.push(`${r.status()} ${r.url().slice(0, 100)}`); });
  // Server action (POST + next-action) sayısı: salt okuma iddiasının kanıtı.
  s.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) eylem.push(r.url().slice(0, 100)); });
  const k = { ad };
  const adim = async (n, fn) => { try { k[n] = await fn(); } catch (e) { k[n] = { HATA: String(e.message).split("\n")[0] }; await s.screenshot({ path: `${D}hata-${ad}-${n}.png` }).catch(() => {}); } };

  await adim("ana", async () => {
    await s.goto("/dashboard"); await s.waitForLoadState("networkidle").catch(() => {});
    await s.screenshot({ path: `${D}${ad}-ana.png` });
    const tetik = s.getByRole("button", { name: /^Yeni çalışma$/ }).first();
    return { yeniCalismaGorunur: await tetik.isVisible(), tasmaYok: await tasmaYok(s),
      tema: await s.evaluate(() => ({ dataTheme: document.documentElement.getAttribute("data-theme"), bg: getComputedStyle(document.body).backgroundColor })) };
  });

  await adim("yeniCalisma", async () => {
    await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click();
    const form = s.locator(".yeni-calisma-formu"); await form.waitFor({ state: "visible", timeout: 10000 });
    await s.screenshot({ path: `${D}${ad}-yeni-calisma.png` });
    const dugmeler = await s.evaluate(() => [...document.querySelectorAll(".yeni-calisma-formu .pencere-dugmeler button")].map((x) => { const r = x.getBoundingClientRect(); return { v: x.value, x: Math.round(r.x), y: Math.round(r.y) }; }));
    const dom = dugmeler.map((d) => d.v);
    const gorsel = [...dugmeler].sort((a, b2) => (a.y - b2.y) || (a.x - b2.x)).map((d) => d.v);
    // Klavye sırası: düğmelerden önceki son odaklanabilir alandan Tab, Tab; sonra Shift+Tab.
    await s.evaluate(() => { const f = document.querySelector(".yeni-calisma-formu"); const hepsi = [...f.querySelectorAll("input,select,textarea,button")].filter((e) => !e.disabled && e.offsetParent); const ilk = f.querySelector(".pencere-dugmeler button"); const i = hepsi.indexOf(ilk); hepsi[i - 1].focus(); });
    const aktif = () => s.evaluate(() => document.activeElement?.value || document.activeElement?.name || document.activeElement?.tagName);
    await s.keyboard.press("Tab"); const t1 = await aktif(); await s.keyboard.press("Tab"); const t2 = await aktif();
    await s.keyboard.press("Shift+Tab"); const g1 = await aktif();
    const pozitifTabindex = await s.evaluate(() => [...document.querySelectorAll("[tabindex]")].filter((e) => Number(e.getAttribute("tabindex")) > 0).length);
    await s.keyboard.press("Escape"); await s.waitForTimeout(500);
    return { dom, gorsel, tab: [t1, t2], shiftTab: g1, pozitifTabindex, escKapatti: !(await form.isVisible().catch(() => false)) };
  });

  await adim("editor", async () => {
    await s.goto(W); await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
    await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 800 }).catch(() => {});
    await s.waitForTimeout(800); await s.screenshot({ path: `${D}${ad}-editor.png` });
    return { tasmaYok: await tasmaYok(s), belge: await kutu(s, ".ProseMirror") };
  });

  await adim("pdf", async () => {
    await s.goto(`${W}?sol=kaynaklar&sag=pdf`); await s.locator(".kaynak-pdf-paneli").first().waitFor({ state: "visible", timeout: 60000 });
    await s.waitForTimeout(2500); await s.screenshot({ path: `${D}${ad}-pdf.png` });
    const p = await kutu(s, ".kaynak-pdf-paneli"); const bel = await kutu(s, ".ProseMirror");
    const cekmece = await s.locator(".kaynak-pdf-cekmece-ipucu").first().isVisible().catch(() => false);
    const guven = await s.evaluate(() => { const e = [...document.querySelectorAll(".kaynak-pdf-paneli *")].find((x) => /doğrulan|güven/i.test(x.textContent || "") && x.children.length === 0 && x.offsetParent); if (!e) return null; const r = e.getBoundingClientRect(); return { metin: e.textContent.trim().slice(0, 60), alt: Math.round(r.bottom), gorunur: r.bottom <= innerHeight + 1 && r.top >= 0 }; });
    const ortusme = !!(p && bel && !cekmece && dur.viewport.width >= 1200) ? (bel.x + bel.width > p.x + 1) : null;
    // Esc: odak belgedeyken. Yan yana yerleşimde PDF açık kalabilir; çekmece/yaprakta kapanması beklenir.
    await s.locator(".ProseMirror").first().click({ position: { x: 20, y: 10 } }).catch(() => {});
    await s.keyboard.press("Escape"); await s.waitForTimeout(800);
    return { panel: p, belge: bel, cekmece, guven, belgeyleOrtusme: ortusme, tasmaYok: await tasmaYok(s), escSonrasiPdfAcik: await s.locator(".kaynak-pdf-paneli").first().isVisible().catch(() => false), adres: new URL(s.url()).search };
  });

  await adim("ai", async () => {
    await s.goto(`${W}?sag=ai`); await s.locator(".yazim-paneli").first().waitFor({ state: "visible", timeout: 60000 });
    await s.waitForTimeout(1200); await s.screenshot({ path: `${D}${ad}-ai.png` });
    const vp = s.viewportSize();
    const istem = await kutu(s, ".yazim-paneli .yazim-girdi textarea");
    const kapat = await kutu(s, '.yazim-paneli button[aria-label="Paneli kapat"]');
    const sonuc2 = { istem, istemGorunur: icinde(istem, vp), kapatGorunur: icinde(kapat, vp), tasmaYok: await tasmaYok(s) };
    // Yaz, GÖNDERME, sil. Gerçek AI çağrısı yok.
    const ta = s.locator(".yazim-paneli .yazim-girdi textarea").first();
    await ta.click(); await ta.fill("canli kontrol - gonderilmeyecek");
    if (dur.isMobile) { // Klavye benzetimi: görünen alan 844 → 500
      await s.setViewportSize({ width: vp.width, height: 500 }); await s.waitForTimeout(800);
      const k2 = await kutu(s, ".yazim-paneli .yazim-girdi textarea");
      sonuc2.klavyede = { istem: k2, gorunur: icinde(k2, { width: vp.width, height: 500 }) };
      await s.screenshot({ path: `${D}${ad}-ai-klavye.png` });
      await s.setViewportSize(vp); await s.waitForTimeout(500);
    }
    await ta.fill("");
    await ta.focus(); await s.keyboard.press("Escape"); await s.waitForTimeout(800);
    sonuc2.escSonrasiPanelAcik = await s.locator(".yazim-paneli").first().isVisible().catch(() => false);
    sonuc2.adres = new URL(s.url()).search;
    return sonuc2;
  });

  if (!dur.isMobile && tema === "light") await adim("odakModuEsc", async () => {
    await s.goto(W); await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
    const odakMi = () => s.evaluate(() => document.querySelector(".manuscript-layout")?.hasAttribute("data-odak"));
    const menu = async () => { await s.getByRole("button", { name: /^Bul, odak modu/ }).first().click(); await s.waitForTimeout(200); };
    await menu(); await s.getByRole("button", { name: /^Odak modu/ }).first().click(); await s.waitForTimeout(400);
    const acildi = await odakMi();
    await menu(); await s.getByRole("button", { name: /^Klavye kısayolları/ }).first().click();
    await s.locator(".drawer-root.open").waitFor({ timeout: 5000 });
    await s.keyboard.press("Escape"); await s.waitForTimeout(500);
    const pencereKapandi = (await s.locator(".drawer-root.open").count()) === 0; const halaOdak = await odakMi();
    await s.keyboard.press("Escape"); await s.waitForTimeout(400);
    return { acildi, ilkEsc: { pencereKapandi, odakSurdu: halaOdak }, ikinciEscCikti: !(await odakMi()) };
  });

  k.sayfaHatalari = hata; k.sunucu5xx = sunucu; k.sunucuEylemleri = eylem;
  sonuc.push(k); yaz(); console.log(JSON.stringify(k));
  await c.close();
}
await b.close();
