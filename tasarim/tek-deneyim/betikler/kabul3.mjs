// Tek ana deneyim kabulü, ÜÇÜNCÜ tur (20.11.2026, güncellenmiş ürün kararı). YEREL, SENTETİK veri (tohum.mjs).
// Ölçülen: doçentlik modülü ve eski adresleri, Yönetim/kurum seçici/personel görünümünün yokluğu, herkes için
// aynı Ana Sayfa / Çalışmalarım / Yeni çalışma, personelin kurum lisansından erişimi (açık ve kapalı lisans),
// Ekip Yönetimi'nde kurum atama/oluşturma yokluğu, geçici uzman kuyruğunun dürüst notu.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = process.argv[2] ?? "http://localhost:3150";
const T = JSON.parse(fs.readFileSync(`${D}tohum.json`, "utf8"));
const G = `${D}../gorseller3`; fs.mkdirSync(G, { recursive: true });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ek = Date.now().toString(36).slice(-5);
const sonuc = []; const kayit = (ad, gecti, ayrinti) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };
const bekle = async (kosul, ms = 20000) => { const son = Date.now() + ms; while (Date.now() < son) { if (await kosul()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; };
const b = await chromium.launch();

async function baglam(anahtar) {
  const c = await b.newContext({ baseURL: URL0, viewport: { width: 1440, height: 900 } });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await s.goto("/"); await s.fill('input[name="email"]', T.hesaplar[anahtar].adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hata };
}
const yeniCalisma = async (s, baslik, cikis = "yaz") => {
  await s.goto("/dashboard/editor"); await s.waitForLoadState("networkidle").catch(() => {});
  await s.locator("button:visible", { hasText: /^\s*Yeni çalışma\s*$/ }).first().click();
  const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible" });
  await f.locator('input[name="title"]').fill(baslik);
  await Promise.all([s.waitForURL(/\/dashboard\/editor\/[0-9a-f-]{36}\/write/, { timeout: 60000 }), f.locator(`button[value="${cikis}"]`).click()]);
  return s.url().match(/editor\/([0-9a-f-]{36})/)[1];
};
// Panelin loading.tsx iskeleti de bir <main aria-busy="true">; sayım ve görüntü ondan ÖNCE alınırsa
// "şerit yok" boş iskelette doğru çıkar ve hiçbir şey ölçmez.
const yuklendi = async (s) => { await s.locator('main[aria-busy="true"]').first().waitFor({ state: "detached", timeout: 30000 }).catch(() => {}); await s.locator("main").first().waitFor({ timeout: 30000 }); };
const editorMetni = (s) => s.locator(".ProseMirror").first().innerText();

const ana = (s) => s.locator('main:not([aria-busy="true"])').first().innerText();
const hesapMenusuMetni = async (s) => {
  await s.locator(".os-kullanici > summary").filter({ visible: true }).first().click();
  // textContent: innerText CSS'in büyük harfe çevirdiği başlığı ("EKİP ARAÇLARI") döndürür.
  const m = (await s.locator(".os-kullanici-menu").filter({ visible: true }).first().textContent()) ?? "";
  await s.keyboard.press("Escape");
  return m;
};
// Ctrl+K paleti bir <dialog class="os-palette"> (os-komut-paleti.tsx); açılınca bütün komutlar listelenir.
const paletMetni = async (s) => {
  await s.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await s.keyboard.press("Control+k");
  await s.waitForFunction(() => document.querySelector("dialog.os-palette")?.open, null, { timeout: 10000 });
  const metin = await s.locator("dialog.os-palette").innerText();
  await s.keyboard.press("Escape");
  return metin;
};
const HER_ROL = ["kurucu", "personel", "kurumlu", "bireysel"];
const KENDI = { kurucu: "Kurucunun kendi tezi", personel: "Personelin kendi makalesi", kurumlu: "Kurumlu öğrencinin tezi", bireysel: "Bireysel abonenin tezi" };
const BASKA = Object.values(KENDI).concat("B kurumundaki öğrencinin tezi");

// 1) Doçentlik: eski adresler Ana Sayfa'ya, menü ve palette yok; var olan doçentlik dosyası açılıyor
for (const rol of ["kurucu", "personel"]) {
  const { c, s, hata } = await baglam(rol);
  const sonuc = {};
  for (const adres of ["/dashboard/associate-professorship", "/print/docentlik"]) {
    await s.goto(adres); await s.waitForURL((u) => new URL(u).pathname === "/dashboard", { timeout: 20000 }).catch(() => {});
    sonuc[adres] = new URL(s.url()).pathname;
  }
  await yuklendi(s);
  const menu = await hesapMenusuMetni(s);
  const palet = await paletMetni(s);
  kayit(`${rol}: doçentlik adresleri Ana Sayfa'ya iniyor; hesap menüsünde ve Ctrl+K'da doçentlik yok`, Object.values(sonuc).every((p) => p === "/dashboard") && !/Doçentlik/.test(menu) && !/Doçentlik/.test(palet), { sonuc, menuda: /Doçentlik/.test(menu), palette: /Doçentlik/.test(palet), hata });
  if (rol === "personel") {
    await s.goto(`/dashboard/editor/${T.calismalar.docentlik}/write`); await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
    const editorAcildi = (await editorMetni(s)).includes("Personelin eski doçentlik dosyası");
    await s.goto(`/dashboard/editor?sec=${T.calismalar.docentlik}`); await yuklendi(s);
    const liste = await ana(s);
    kayit("personel: var olan doçentlik dosyası editörde açılıyor, Çalışmalarım'da 'Doçentlik dosyası' etiketiyle duruyor", editorAcildi && liste.includes("Personelin eski doçentlik dosyası") && liste.includes("Doçentlik dosyası"), { editorAcildi });
    await s.screenshot({ path: `${G}/personel-eski-docentlik-dosyasi.png`, animations: "disabled" });
  }
  await c.close();
}
// Sunucu da yeni doçentlik dosyasını reddediyor (pencereden değil, doğrudan işlem çağrısıyla aynı yol: form alanı elle değiştirilir)
{
  const { c, s } = await baglam("personel");
  await s.goto("/dashboard/editor?yeni=1"); const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible" });
  const turSayisi = await f.locator(".analiz-karti").count();
  await f.locator('input[name="title"]').fill(`TEK-DOC-RED-${ek}`);
  // Pencerenin gizli "type" alanı elle doçentliğe çevrilir: sunucu işlemi doğrudan çağrılmış gibi.
  await f.evaluate((form) => { form.querySelector('input[name="type"]').value = "associate-professorship"; });
  await f.locator('button[value="yaz"]').click();
  await s.waitForTimeout(3000);
  const acilan = psql(`select count(*) from public.academic_projects where title = ${q(`TEK-DOC-RED-${ek}`)}`);
  const turu = psql(`select coalesce(string_agg(project_type, ','), '') from public.academic_projects where title = ${q(`TEK-DOC-RED-${ek}`)}`);
  kayit("Yeni çalışma penceresi üç türlü; doçentlik türü elle gönderilse de sunucu doçentlik dosyası açmıyor", turSayisi === 3 && !turu.includes("associate-professorship"), { turSayisi, acilan, turu });
  await c.close();
}

// 2) Yönetim yok, kurum seçici yok, herkes aynı ana deneyim ve yalnızca kendi çalışmaları
for (const rol of HER_ROL) {
  const { c, s, hata } = await baglam(rol);
  const yonetim = [];
  for (const adres of ["/dashboard/yonetim", "/dashboard/yonetim/calismalar"]) {
    await s.goto(adres); await yuklendi(s);
    yonetim.push(/bulunamadı|not found/i.test(await s.locator("main").first().innerText()));
  }
  await s.goto("/dashboard"); await yuklendi(s);
  const anaYazi = await ana(s);
  const anaSinif = await s.locator("main").first().getAttribute("class");
  const serit = await s.locator(".kurum-seridi, .onizleme-serit").count();
  const sayac = await s.locator(".personel-sayac").count();
  await s.screenshot({ path: `${G}/${rol}-ana-sayfa.png`, animations: "disabled" });
  await s.goto("/dashboard/editor"); await yuklendi(s);
  const listeYazi = await ana(s);
  const listeSayac = await s.locator(".personel-sayac").count();
  await s.screenshot({ path: `${G}/${rol}-calismalarim.png`, animations: "disabled" });
  const menu = await hesapMenusuMetni(s);
  const kendi = KENDI[rol];
  const baskalari = BASKA.filter((x) => x !== kendi);
  kayit(`${rol}: Yönetim adresleri bulunamadı; kurum şeridi ve sayaç yok; hesap menüsünde kurum/Yönetim yok; yalnızca kendi çalışması`,
    yonetim.every(Boolean) && serit === 0 && sayac === 0 && listeSayac === 0 && !/Yönetim|Kurum seç|Bütün kurumlar/.test(menu.replace("Ekip Yönetimi", ""))
      && anaYazi.includes(kendi) && listeYazi.includes(kendi) && baskalari.every((x) => !anaYazi.includes(x) && !listeYazi.includes(x)) && hata.length === 0,
    { yonetim, anaSinif, serit, sayac, listeSayac, menudeYonetim: /Yönetim/.test(menu.replace("Ekip Yönetimi", "")), hata });
  await c.close();
}

// 3) Personelin erişimi kurum lisansından: açık lisans (A) açık; kapalı lisans (K) bireysel ödeme değil kurum uyarısı
{
  const { c, s } = await baglam("personel");
  await s.goto("/dashboard/editor"); await yuklendi(s);
  const kapaliEkran = await s.locator("text=Erişiminiz şu an kapalı").count();
  kayit("personel (controller, Kurum A, lisans açık ve ArvoOS'tan yansıtılmış): panel açık, abonelik ekranı yok", kapaliEkran === 0, { kapaliEkran });
  await c.close();
}
{
  const { c, s } = await baglam("kapali");
  await s.goto("/dashboard"); await yuklendi(s);
  const metin = await s.locator("main").first().innerText();
  const kapali = metin.includes("Erişiminiz şu an kapalı");
  const kartlaOde = await s.locator("text=Kartla öde").count();
  const kurumYolu = /ArvoOS panelinizdeki Ödeme ve Lisans/.test(metin);
  await s.screenshot({ path: `${G}/kapali-lisans-personel.png`, animations: "disabled" });
  kayit("personel (employee, Kurum K, lisans kapalı): erişim kapalı, bireysel 'Kartla öde' YOK, kurum lisansı yolu gösteriliyor", kapali && kartlaOde === 0 && kurumYolu, { kapali, kartlaOde, kurumYolu });
  await c.close();
}

// 4) Ekip Yönetimi: kurum oluşturma ve kurum atama yok; rol ve erişim yönetimi duruyor
{
  const { c, s, hata } = await baglam("kurucu");
  await s.goto("/dashboard/team"); await yuklendi(s);
  const kurumEkle = await s.getByRole("button", { name: /Kurum ekle/ }).count();
  const kurumSec = await s.locator('select[name="organizationId"]').count();
  await s.locator(`a[href*="${T.hesaplar.kurumlu.id}"]`).first().click().catch(() => {});
  await s.waitForTimeout(1500);
  const kurumSec2 = await s.locator('select[name="organizationId"]').count();
  const rolSec = await s.locator('select[name="role"]').count();
  await s.screenshot({ path: `${G}/kurucu-ekip-yonetimi.png`, animations: "disabled" });
  kayit("kurucu: Ekip Yönetimi'nde 'Kurum ekle' ve kurum seçimi yok; rol seçimi duruyor", kurumEkle === 0 && kurumSec === 0 && kurumSec2 === 0 && rolSec > 0 && hata.length === 0, { kurumEkle, kurumSec, kurumSec2, rolSec, hata });
  const menu = await hesapMenusuMetni(s);
  kayit("kurucu: hesap menüsünde 'Ekip araçları' (Asistan Kayıtları, Ekip Yönetimi); Yönetim ve doçentlik yok", /Ekip araçları/.test(menu) && /Asistan Kayıtları/.test(menu) && /Ekip Yönetimi/.test(menu) && !/Yönetim|Doçentlik/.test(menu.replace("Ekip Yönetimi", "")), { menu: menu.slice(0, 300) });
  await c.close();
}

// 5) Uzmana sor: talep ArvoLab'da kaydediliyor; personelin kuyruğu GEÇİCİ olduğunu söylüyor
{
  const { c, s } = await baglam("kurumlu");
  await s.goto("/dashboard/expert-requests"); await yuklendi(s);
  await s.getByRole("button", { name: /Uzmana sor/ }).first().click();
  const pencere = s.locator('[role="dialog"]').filter({ visible: true }).first();
  await pencere.locator('textarea[name="message"]').fill(`TEK-UZMAN-${ek} sentetik soru`);
  await pencere.locator('button[type="submit"]').first().click();
  const kaydedildi = await bekle(async () => psql(`select count(*) from public.consultancy_requests where message like ${q(`TEK-UZMAN-${ek}%`)}`) === "1");
  kayit("kurumlu: Uzmana sor talebi ArvoLab'da kaydedildi (ArvoOS'a iletilmiyor; geçici yol)", kaydedildi, {});
  await c.close();
}
{
  const { c, s } = await baglam("personel");
  await s.goto("/dashboard/expert-requests?kuyruk=uzman-acik"); await yuklendi(s);
  const metin = await s.locator("main").first().innerText();
  const not = /ArvoOS'un Talepler bölümüne aktarılacak/.test(metin) && /henüz kurulmadı/.test(metin);
  const talepGorunur = metin.includes(`TEK-UZMAN-${ek}`) || (await s.locator(`text=TEK-UZMAN-${ek}`).count()) > 0;
  await s.screenshot({ path: `${G}/personel-gecici-uzman-kuyrugu.png`, animations: "disabled" });
  kayit("personel: uzman kuyruğunda 'ArvoOS Talepler … bağlantı henüz kurulmadı' notu; kendi kurumunun talebi görünüyor", not && talepGorunur, { not, talepGorunur });
  await c.close();
}

// 6) Yeni çalışma herkes için aynı akış: dört hesap türünde oluşturma ve sahiplik
for (const rol of HER_ROL) {
  const { c, s, hata } = await baglam(rol);
  const baslik = `TEK3-YENI-${rol}-${ek}`;
  const id = await yeniCalisma(s, baslik);
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  const [sahip, tur] = psql(`select owner_id, project_type from public.academic_projects where id='${id}'`).split("|");
  await s.goto("/dashboard/editor"); await yuklendi(s);
  kayit(`${rol}: Yeni çalışma → sahibi kendisi, tez, editör açıldı, kişisel listede`, sahip === T.hesaplar[rol].id && tur === "thesis" && (await ana(s)).includes(baslik) && hata.length === 0, { id, hata });
  await c.close();
}

await b.close();
fs.writeFileSync(`${D}../kabul3-sonucu.json`, JSON.stringify(sonuc, null, 2));
console.log(`\nTOPLAM ${sonuc.filter((x) => x.gecti).length}/${sonuc.length}`);
