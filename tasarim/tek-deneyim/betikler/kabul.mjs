// Tek ana deneyim kabulü (yerel üretim derlemesi, sentetik veri). Hiçbir kayıt OLUŞTURMAZ:
// Yeni çalışma penceresi açılıp Esc ile kapatılır, form gönderilmez.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(`${process.env.KOK ?? process.cwd()}/package.json`);
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = process.argv[2] ?? "http://localhost:3150";
const T = JSON.parse(fs.readFileSync(`${D}tohum.json`, "utf8"));
const BASLIK = { kurucu: "Kurucunun kendi tezi", personel: "Personelin kendi makalesi", kurumlu: "Kurumlu öğrencinin tezi", bireysel: "Bireysel abonenin tezi", bkurumu: "B kurumundaki öğrencinin tezi" };
const ROLLER = ["kurucu", "personel", "kurumlu", "bireysel"];
const G = `${D}gorseller`; fs.mkdirSync(G, { recursive: true });
const b = await chromium.launch();
const sonuc = []; const kayit = (ad, gecti, ayrinti) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };

async function oturum(anahtar) {
  const yol = `${D}oturum-${anahtar}.json`;
  if (fs.existsSync(yol)) return yol;
  const c = await b.newContext({ baseURL: URL0 });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage();
  await s.goto("/"); await s.fill('input[name="email"]', T.hesaplar[anahtar].adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  await c.storageState({ path: yol }); await c.close(); return yol;
}
async function baglam(anahtar, { dil = "tr", tema = "light", telefon = false } = {}) {
  const c = await b.newContext({ baseURL: URL0, storageState: await oturum(anahtar), colorScheme: tema, viewport: telefon ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: telefon, hasTouch: telefon, deviceScaleFactor: telefon ? 2 : 1 });
  await c.addCookies([{ name: "arvolab_dil", value: dil, url: URL0 }]);
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  return { c, s, hata };
}
const metin = (s) => s.evaluate(() => document.querySelector("main")?.innerText ?? "");
const gorulenler = (yazi) => Object.entries(BASLIK).filter(([, t]) => yazi.includes(t)).map(([k]) => k);

const imzalar = {};
for (const rol of ROLLER) {
  const { c, s, hata } = await baglam(rol);
  // A1 Ana sayfa: kişisel düzen, yalnızca kendi çalışması
  await s.goto("/dashboard"); await s.waitForLoadState("networkidle").catch(() => {});
  const h1 = await s.locator("main h1").first().innerText();
  const anaYazi = await metin(s);
  const anaGorulen = gorulenler(anaYazi);
  const mainSinif = await s.evaluate(() => document.querySelector("main")?.className ?? "");
  kayit(`${rol}: ana sayfa kişisel, yalnızca kendi çalışması`, !/Yönetim/.test(h1) && anaGorulen.length === 1 && anaGorulen[0] === rol && /os5-ana/.test(mainSinif), { h1, anaGorulen, mainSinif });
  // A4 Ana gezinme aynı (kenar çubuğu bağlantıları)
  const gezinme = await s.evaluate(() => [...document.querySelectorAll("nav.os-gezinme a")].filter((a) => !a.closest(".os-kullanici")).map((a) => a.getAttribute("href")).filter(Boolean));
  imzalar[rol] = { gezinme, mainSinif };
  // A7 Hesap menüsü: Görünüm yok; Yönetim yalnızca personel rollerinde
  const menu = await s.evaluate(() => { const m = document.querySelector(".os-kullanici-menu"); return m ? m.textContent : ""; });
  const yonetimLinki = await s.evaluate(() => [...document.querySelectorAll('.os-kullanici-menu a[href="/dashboard/yonetim"]')].length > 0);
  const gorunumVar = /Görünüm|Öğrenci · kurum|Öğrenci · bireysel/.test(menu);
  const yetkili = rol === "kurucu" || rol === "personel";
  kayit(`${rol}: hesap menüsünde görünüm seçimi yok; Yönetim ${yetkili ? "var" : "yok"}`, !gorunumVar && yonetimLinki === yetkili, { gorunumVar, yonetimLinki });
  await s.screenshot({ path: `${G}/${rol}-ana-tr-acik-masaustu.png` });
  // A2 Çalışmalarım: yalnızca kendi çalışması, sayaç/onay yok
  await s.goto("/dashboard/editor"); await s.waitForLoadState("networkidle").catch(() => {});
  const listeYazi = await metin(s);
  const listeGorulen = gorulenler(listeYazi);
  const sayacVar = await s.locator(".personel-sayaclar").count();
  kayit(`${rol}: Çalışmalarım yalnızca kendi çalışması, yönetim sayaçları yok`, listeGorulen.length === 1 && listeGorulen[0] === rol && sayacVar === 0, { listeGorulen, sayacVar });
  await s.screenshot({ path: `${G}/${rol}-calismalarim-tr-acik-masaustu.png` });
  // A3 Yeni çalışma: tek bileşen, üç alan, iki çıkış; kurum alanı yok
  for (const [giris, adres] of [["Çalışmalarım düğmesi", null], ["ana sayfa ?yeni=1", "/dashboard/editor?yeni=1"]]) {
    if (adres) await s.goto(adres); else await s.locator("button:visible", { hasText: /^\s*Yeni çalışma\s*$/ }).first().click();
    const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible", timeout: 15000 });
    const alanlar = await s.evaluate(() => { const f = document.querySelector(".yeni-calisma-formu"); return { adlar: [...f.querySelectorAll("input,select,textarea")].map((e) => e.name).filter(Boolean), turler: f.querySelectorAll(".analiz-karti").length, cikislar: [...f.querySelectorAll('button[type="submit"]')].map((x) => x.value) }; });
    const kurumAlani = alanlar.adlar.some((a) => /universit|institute|department|academicUnit/i.test(a));
    if (!adres) await s.screenshot({ path: `${G}/${rol}-yeni-calisma-tr-acik-masaustu.png` });
    kayit(`${rol}: Yeni çalışma (${giris}) ad+tür+belge dili, iki çıkış, kurum alanı yok`, alanlar.adlar.includes("title") && alanlar.adlar.includes("type") && alanlar.adlar.includes("belgeDili") && alanlar.turler === 3 && alanlar.cikislar.join(",") === "word,yaz" && !kurumAlani, alanlar);
    await s.keyboard.press("Escape"); await s.waitForTimeout(400);
  }
  // A5/A6 Yönetim erişimi ve veri ayrımı
  for (const yol of ["/dashboard/yonetim", "/dashboard/yonetim/calismalar"]) {
    const yanit = await s.goto(yol); await s.waitForLoadState("networkidle").catch(() => {});
    const baslik = await s.locator("main h1").first().innerText().catch(() => "");
    const yazi = await metin(s);
    const icerde = /Yönetim/.test(baslik);
    if (yetkili) {
      const gorulen = gorulenler(yazi);
      const beklenen = yol.endsWith("calismalar") ? (rol === "personel" ? ["personel", "kurumlu"] : ["kurucu", "personel", "kurumlu", "bireysel", "bkurumu"]) : null;
      const ayrim = beklenen ? JSON.stringify([...gorulen].sort()) === JSON.stringify([...beklenen].sort()) : true;
      const onayAraci = yol.endsWith("calismalar") ? await s.locator(".personel-sayaclar").count() : null;
      kayit(`${rol}: ${yol} açılır${beklenen ? ", yetkinin kapsadığı çalışmalar" : ""}`, icerde && ayrim && (onayAraci === null || onayAraci > 0), { durum: yanit?.status(), baslik, gorulen, beklenen, onayAraci });
      await s.screenshot({ path: `${G}/${rol}-${yol.endsWith("calismalar") ? "yonetim-calismalar" : "yonetim"}-tr-acik-masaustu.png` });
    } else {
      kayit(`${rol}: ${yol} kapalı (bulunamadı)`, !icerde && !gorulenler(yazi).some((k) => k !== rol), { durum: yanit?.status(), baslik });
    }
  }
  kayit(`${rol}: sayfa hatası yok`, hata.length === 0, hata);
  await c.close();
}
// A4 karşılaştırma
const ilk = JSON.stringify(imzalar.kurucu);
kayit("dört erişim türünde aynı ana gezinme ve ana sayfa düzeni", ROLLER.every((r) => JSON.stringify(imzalar[r]) === ilk), imzalar);

// A9/A10 Başkasının çalışması: yetkili Yönetim'e iner, yetkisiz kendi listesinde kalır
{
  const { c, s } = await baglam("personel");
  await s.goto(`/dashboard/editor?sec=${T.calismalar.kurumlu}`); await s.waitForLoadState("networkidle").catch(() => {});
  const u1 = new URL(s.url()); const secili1 = (await metin(s)).includes(BASLIK.kurumlu);
  await s.goto(`/dashboard/editor/${T.calismalar.kurumlu}`); await s.waitForLoadState("networkidle").catch(() => {});
  const u2 = new URL(s.url());
  kayit("personel: öğrencinin çalışması Yönetim listesinde seçili açılır (Özet ve teslim, eski adres)", u1.pathname === "/dashboard/yonetim/calismalar" && secili1 && u2.pathname === "/dashboard/yonetim/calismalar" && u2.searchParams.get("sec") === T.calismalar.kurumlu, { u1: u1.pathname + u1.search, u2: u2.pathname + u2.search });
  await s.goto(`/dashboard/editor/${T.calismalar.personel}`); await s.waitForLoadState("networkidle").catch(() => {});
  kayit("personel: kendi çalışması kişisel listede seçili açılır", new URL(s.url()).pathname === "/dashboard/editor", { u: s.url().replace(URL0, "") });
  await c.close();
}
{
  const { c, s } = await baglam("kurumlu");
  await s.goto(`/dashboard/editor?sec=${T.calismalar.bireysel}`); await s.waitForLoadState("networkidle").catch(() => {});
  const yazi = await metin(s);
  kayit("kurumlu öğrenci: başkasının çalışma kimliğiyle Yönetim'e yönlenmez ve o çalışmayı görmez", new URL(s.url()).pathname === "/dashboard/editor" && !yazi.includes(BASLIK.bireysel), { u: s.url().replace(URL0, "") });
  await c.close();
}

// Görsel matris: dört rolün ana sayfası + kurucuda TR/EN × açık/koyu × masaüstü/telefon
for (const rol of ROLLER) for (const dil of ["tr", "en"]) for (const tema of ["light", "dark"]) for (const telefon of [false, true]) {
  if (rol !== "kurucu" && !(dil === "en" && tema === "dark")) continue; // diğer roller: TR açık masaüstü yukarıda + EN koyu (masaüstü/telefon)
  const { c, s } = await baglam(rol, { dil, tema, telefon });
  const ek = `${dil}-${tema === "light" ? "acik" : "koyu"}-${telefon ? "telefon" : "masaustu"}`;
  await s.goto("/dashboard"); await s.waitForLoadState("networkidle").catch(() => {}); await s.waitForTimeout(500);
  await s.screenshot({ path: `${G}/${rol}-ana-${ek}.png` });
  if (rol === "kurucu") {
    await s.goto("/dashboard/editor?yeni=1"); await s.locator(".yeni-calisma-formu").waitFor({ state: "visible", timeout: 15000 }); await s.waitForTimeout(500);
    await s.screenshot({ path: `${G}/${rol}-yeni-calisma-${ek}.png` });
    await s.goto("/dashboard/yonetim"); await s.waitForLoadState("networkidle").catch(() => {}); await s.waitForTimeout(500);
    await s.screenshot({ path: `${G}/${rol}-yonetim-${ek}.png` });
  }
  await c.close();
}
fs.writeFileSync(`${D}sonuc.json`, JSON.stringify(sonuc, null, 2));
const gecen = sonuc.filter((x) => x.gecti).length;
console.log(`\nTOPLAM ${gecen}/${sonuc.length}`);
await b.close();
for (const r of [...ROLLER]) fs.rmSync(`${D}oturum-${r}.json`, { force: true });
