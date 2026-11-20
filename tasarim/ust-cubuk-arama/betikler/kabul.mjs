// M11 kabulü: üst çubukta arama kutusu yok; komut paleti Ctrl+K, hesap menüsü
// ve "Daha fazla" penceresinden açılıyor. Yerel yığın + `next start -p 3150`;
// tohum hesapları tasarim/tek-deneyim/betikler/tohum.json. Depo kökünden:
//   node tasarim/ust-cubuk-arama/betikler/kabul.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
// Playwright genel kurulumda: require ile çözülür (ESM import paket köküne bakıyor).
const { chromium, devices } = createRequire(import.meta.url)("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/ust-cubuk-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync("tasarim/tek-deneyim/betikler/tohum.json", "utf8"));
const KUL = T.hesaplar.bireysel;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };
const b = await chromium.launch();
async function baglam(secenek) {
  const c = await b.newContext({ baseURL: U, ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  await s.waitForLoadState("networkidle");
  return { c, s };
}
const paletAcik = (s) => s.evaluate(() => !!document.querySelector("dialog.os-palette")?.open);
const paletiKapat = async (s) => { await s.keyboard.press("Escape"); await s.waitForTimeout(200); };
// Üst çubukta arama/komut kutusu var mı: eski sınıf ya da "Ara" adlı bir düğme/girdi.
const ustCubukArama = (s) => s.evaluate(() => {
  const h = document.querySelector(".dashboard-header");
  const adaylar = [...h.querySelectorAll("button, input, [role=search]")].filter((e) => e.checkVisibility());
  return { eskiSinif: !!h.querySelector(".os-search"), aramaBenzeri: adaylar.map((e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim()).filter((m) => /ara|search|ctrl/i.test(m)) };
});

// ── Masaüstü 1440
{
  const { c, s } = await baglam({ viewport: { width: 1440, height: 900 } });
  const a = await ustCubukArama(s);
  kayit("masaüstü: üst çubukta arama kutusu yok", !a.eskiSinif && a.aramaBenzeri.length === 0, a);
  const yerlesim = await s.evaluate(() => { const h = document.querySelector(".dashboard-header").getBoundingClientRect(); const e = document.querySelector(".dashboard-header-actions").getBoundingClientRect(); return { sagBosluk: Math.round(h.right - e.right) }; });
  kayit("masaüstü: eylemler sağ kenarda", yerlesim.sagBosluk <= 40, yerlesim);
  await s.screenshot({ path: OUT + "masaustu-ana.png" });
  await s.keyboard.press("Control+k"); await s.waitForTimeout(300);
  kayit("masaüstü: Ctrl+K paleti açar", await paletAcik(s));
  await paletiKapat(s);
  kayit("masaüstü: Esc paleti kapatır", !(await paletAcik(s)));
  await s.locator("details.os-kullanici summary:visible").first().click();
  const giris = s.locator(".os-kullanici-komut:visible").first();
  kayit("masaüstü: hesap menüsünde Komut paleti girişi", await giris.isVisible());
  await s.screenshot({ path: OUT + "masaustu-hesap-menusu.png" });
  await giris.click(); await s.waitForTimeout(300);
  const menuAcik = await s.evaluate(() => [...document.querySelectorAll("details.os-kullanici")].some((d) => d.open));
  kayit("masaüstü: menüden palet açılır, menü kapanır", (await paletAcik(s)) && !menuAcik, { menuAcik });
  await s.screenshot({ path: OUT + "masaustu-palet.png" });
  await paletiKapat(s);
  // Editör: yuva başlığın yanında, eylemler kenarda; editör içinde Ctrl+K de paleti açar.
  const pr = await s.evaluate(async () => { const a = [...document.querySelectorAll('a[href*="/dashboard/editor/"]')][0]; return a?.getAttribute("href"); });
  if (pr) {
    await s.goto(pr.replace(/\/?$/, "").replace(/\/write$/, "") + "/write"); await s.waitForSelector(".ProseMirror", { timeout: 60000 }); await s.waitForTimeout(800);
    const y = await s.evaluate(() => { const h = document.querySelector(".dashboard-header").getBoundingClientRect(); const yuva = document.querySelector(".ust-cubuk-yuva").getBoundingClientRect(); const e = document.querySelector(".dashboard-header-actions").getBoundingClientRect(); return { yuvaGenislik: Math.round(yuva.width), yuvaSag: Math.round(yuva.right), eylemSol: Math.round(e.left), sagBosluk: Math.round(h.right - e.right), tekSatir: Math.round(h.height) }; });
    kayit("editör: yuva dolu, eylemler sağda, çakışma yok", y.yuvaGenislik > 0 && y.yuvaSag <= y.eylemSol && y.sagBosluk <= 40, y);
    await s.click(".ProseMirror"); await s.keyboard.press("Control+k"); await s.waitForTimeout(300);
    kayit("editör: Ctrl+K paleti açar", await paletAcik(s));
    await paletiKapat(s);
    await s.screenshot({ path: OUT + "masaustu-editor.png" });
  } else kayit("editör: çalışma bulunamadı (atlandı)", true, { atlandi: true });
  await c.close();
}
// ── Telefon
{
  const { c, s } = await baglam({ ...devices["iPhone 13"] });
  const a = await ustCubukArama(s);
  kayit("telefon: üst çubukta arama düğmesi yok", !a.eskiSinif && a.aramaBenzeri.length === 0, a);
  await s.screenshot({ path: OUT + "telefon-ana.png" });
  await s.locator(".os-gezinme-daha").first().click(); await s.waitForTimeout(300);
  const giris = s.locator(".os-daha-komut").first();
  kayit("telefon: Daha fazla penceresinde Komut paleti girişi", await giris.isVisible());
  await s.screenshot({ path: OUT + "telefon-daha.png" });
  await giris.click(); await s.waitForTimeout(300);
  const dahaAcik = await s.evaluate(() => !!document.querySelector("dialog.os-daha")?.open);
  kayit("telefon: girişten palet açılır, pencere kapanır", (await paletAcik(s)) && !dahaAcik, { dahaAcik });
  await s.screenshot({ path: OUT + "telefon-palet.png" });
  await c.close();
}
await b.close();
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
