// PDF ÇEKMECESİ KABULÜ (20.11.2026). Yalnızca 127.0.0.1, sentetik hesap ve veri.
// Ön koşul: yerel yığın (scripts/yerel-yigin) + gecit.mjs + model-taklidi.mjs +
// AI_TABAN_URL=http://127.0.0.1:54900/v1 ile `next start -p 3150`; tohum hesapları
// tasarim/tek-deneyim/betikler/tohum.json. Depo kökünden:
//   node tasarim/pdf-cekmecesi/betikler/cekmece-kabul.mjs
// Görseller: $CIKTI (varsayılan /tmp/cekmece-kabul). Çıkış: 0 hepsi geçti, 1 en az biri düştü.
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium, devices } = require("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const U = "http://localhost:3150", GECIT = "http://127.0.0.1:54401";
const OUT = (process.env.CIKTI ?? "/tmp/cekmece-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KUL = T.hesaplar.bireysel;
const sonuc = [];
const kayit = (ad, gecti, ayrinti) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 500)); };

// ── Tohum (paragraflar attrs taşır: taşımasa editör "biçim bilgileri kaybolmuş" uyarısı gösterir): çalışma, iki kaynak (Fisher yapılandırılmış yazarla; Demir), Fisher'a bağlı üç sayfalık PDF
const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Çekmece ${ek}','writing') returning id`).split("\n")[0];
const METIN = "Mevsimsel örüntüler önceki çalışmalarda şöyle tanımlanmıştır";
const belge = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, { type: "paragraph", attrs: {}, content: [{ type: "text", text: METIN }] }, ...Array.from({ length: 14 }, (_, i) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: `Dolgu paragrafı ${i + 1}: belge kaydırılabilir olsun diye sentetik metin, ölçüm için yeterince uzun bir satır.` }] }))] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, ${q(METIN)}) on conflict (project_id) do update set content = excluded.content`);
const FISHER = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}','Seasonal patterns in synthetic data','Fisher, E. W., & Other, J.',2023,'https://doi.org/10.5555/fisher.${ek}','Journal of Science & Society') returning id`).split("\n")[0];
const CUMLE = "Seasonal variation explained most of the observed difference across the three regions.";
const satirlar = (n) => Array.from({ length: 46 }, (_, i) => `Page ${n} line ${i + 1}: synthetic body text for scrolling inside the reader drawer.`);
const pdf = sentetikPdf([["Seasonal patterns in synthetic data", "Edward W. Fisher and Jane Other", "", CUMLE, "A second sentence closes the synthetic abstract for testing.", ...satirlar(1).slice(0, 40)], satirlar(2), satirlar(3)]);
const yol = `${PR}/kaynak-pdf/cekmece-${ek}.pdf`;
await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
const kunye = `Fisher, E. W., & Other, J. (2023). Seasonal patterns in synthetic data. Journal of Science & Society.`;
const PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}',${q(kunye)},${q("cekmece-" + ek)},'10.5555/fisher.${ek}','yuklendi',${q(yol)},'${FISHER}') returning id`).split("\n")[0];
console.log("tohum", { PR, PDF });

const b = await chromium.launch();
async function baglam(secenek) {
  const c = await b.newContext({ baseURL: U, ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hatalar };
}
const kutu = (s, sel) => s.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
const kagit = (s) => s.evaluate(() => { const e = document.querySelector(".manuscript-editor-content"); const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), olcek: getComputedStyle(document.querySelector(".manuscript-layout")).getPropertyValue("--belge-olcek").trim(), kaydirma: Math.round(document.scrollingElement.scrollTop) }; });
const pdfiAc = async (s) => {
  await s.getByRole("button", { name: /Kaynak PDF/ }).first().click();
  await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
  await s.waitForTimeout(700);
};
async function secPdf(s, metin) {
  const k = await s.evaluate((c) => { const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].find((x) => x.textContent.includes(c.slice(0, 30))); if (!sp) return null; const r = sp.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; }, metin);
  if (!k) return null;
  await s.mouse.move(k.x + 1, k.y); await s.mouse.down(); await s.mouse.move(k.x + k.w - 1, k.y, { steps: 8 }); await s.mouse.up();
  await s.waitForTimeout(500);
  return s.evaluate(() => getSelection().toString());
}

// ── Masaüstü 1440 ve 1280
for (const w of [1440, 1280]) {
  const { c, s, hatalar } = await baglam({ viewport: { width: w, height: 900 } });
  await s.goto(`/dashboard/editor/${PR}/write`);
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(1200);
  // İmleci paragrafın sonuna koy, belgeyi biraz kaydır.
  /*
    İmleç satır sonuna. Tıklamanın hemen ardından basılan End bazen hiç
    işlemiyor (tarayıcının kendi imleci de yerinde kalıyor; 6 turdan 1'inde
    ölçüldü): imlecin gerçekten sonda olduğu doğrulanmadan ilerlenmez.
    Eskiden bu denetim yoktu ve betik "bir karakter önceye yazdı" diye düşüyordu.
  */
  await s.locator(".ProseMirror p").first().click();
  for (let i = 0; i < 5; i++) {
    await s.keyboard.press("End");
    await s.waitForTimeout(300);
    const sonda = await s.evaluate(() => { const d = getSelection(); return d.focusOffset === (d.focusNode?.textContent?.length ?? -1); });
    if (sonda) break;
  }
  await s.waitForTimeout(500);
  const once = await kagit(s);
  await s.screenshot({ path: `${OUT}masaustu-${w}-kapali.png` });
  await pdfiAc(s);
  const acik = await kagit(s);
  const cekmece = await kutu(s, ".kaynak-pdf-paneli");
  const ortu = await kutu(s, ".pdf-cekmece-ortu");
  const alan = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
  await s.screenshot({ path: `${OUT}masaustu-${w}-acik.png` });
  kayit(`${w}: editör yerinden oynamaz (konum, genişlik, ölçek, kaydırma)`, JSON.stringify(once) === JSON.stringify(acik), { once, acik });
  kayit(`${w}: çekmece ≈ ekranın %65'i, arkası karartılmış`, Boolean(cekmece && Math.abs(cekmece.w - Math.round(w * 0.65)) <= 2 && ortu), { cekmece, ortu });
  kayit(`${w}: okuma alanı çekmecenin neredeyse bütün yüksekliği`, Boolean(alan && cekmece && alan.h > cekmece.h - 200), { alan, cekmece });

  if (w === 1440) {
    // Seçim → araç çubuğu; okuma alanı küçülmez.
    const secilen = await secPdf(s, CUMLE);
    const arac = await kutu(s, ".pdf-secim-arac");
    const alanSecim = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
    kayit("seçim: araç çubuğu seçimin yanında, okuma alanı küçülmez", Boolean(arac && alanSecim && alanSecim.h === alan.h), { secilen, arac, alanSecim });
    await s.screenshot({ path: `${OUT}masaustu-1440-secim.png` });
    // Esc sırası: önce seçim kapanır, çekmece açık kalır.
    await s.keyboard.press("Escape");
    await s.waitForTimeout(300);
    kayit("Esc 1: seçim katmanı kapanır, çekmece açık", !(await kutu(s, ".pdf-secim-arac")) && Boolean(await kutu(s, ".kaynak-pdf-paneli")), {});
    // Alıntı ekle → kısa onay → Ekle.
    await secPdf(s, CUMLE);
    await s.getByRole("button", { name: /^Alıntı ekle$/ }).click();
    await s.waitForSelector(".pdf-onay .pdf-onay-alinti", { timeout: 30000 });
    const onay = await kutu(s, ".pdf-onay");
    const alanOnay = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
    await s.screenshot({ path: `${OUT}masaustu-1440-onay.png` });
    kayit("kısa onay: okuma alanı küçülmez", Boolean(onay && alanOnay.h === alan.h), { onay, alanOnay });
    const eklenecek = await s.locator(".pdf-onay-alinti").innerText();
    await s.waitForSelector(".pdf-onay-atif", { timeout: 15000 });
    const onizleme1 = await s.locator(".pdf-onay-atif").innerText();
    await s.locator(".pdf-onay-sayfa input").fill("214");
    await s.waitForFunction(() => document.querySelector(".pdf-onay-atif")?.textContent?.includes("214"), null, { timeout: 15000 });
    const onizleme2 = await s.locator(".pdf-onay-atif").innerText();
    const sayfalar = await s.locator(".pdf-onay-sayfalar").innerText();
    kayit("onay: tam atıf önizlemesi; basılı sayfa girilince atıf onu taşır, PDF sayfası ayrı ve atfa girmez", onizleme1 === "(Fisher ve Other, 2023)" && onizleme2 === "(Fisher ve Other, 2023, s. 214)" && /PDF (SAYFASI|sayfası)\s*1/.test(sayfalar), { onizleme1, onizleme2, sayfalar });
    await s.locator(".pdf-onay").getByRole("button", { name: /^Ekle$/ }).click();
    await s.waitForTimeout(2500);
    const metin = await s.locator(".ProseMirror").innerText();
    kayit("eklenen alıntı seçilenle aynı, önünde boşluk, atıf önizlemeyle birebir, kayıtlı konumda", metin.includes(`${METIN} “${CUMLE}” ${onizleme2}`), { eklenecek, bas: metin.slice(0, 220) });
    kayit("ekleme sonrası çekmece açık kalır", Boolean(await kutu(s, ".kaynak-pdf-paneli")), {});
    await s.screenshot({ path: `${OUT}masaustu-1440-eklendi.png` });
    // Yakınlaştırma elle; tutamakla genişlet → elle seçilen ölçek korunur.
    await s.getByRole("button", { name: "Yakınlaştır" }).click();
    await s.getByRole("button", { name: "Yakınlaştır" }).click();
    await s.waitForTimeout(800);
    const yuzde1 = await s.locator(".pdf-yuzde").innerText();
    const tut = await kutu(s, ".pdf-cekmece-tutamak");
    await s.mouse.move(tut.x + 5, tut.y + tut.h / 2); await s.mouse.down(); await s.mouse.move(tut.x - 180, tut.y + tut.h / 2, { steps: 10 }); await s.mouse.up();
    await s.waitForTimeout(900);
    const genis = await kutu(s, ".kaynak-pdf-paneli");
    const yuzde2 = await s.locator(".pdf-yuzde").innerText();
    kayit("tutamakla genişler; elle seçilen yakınlaştırma ezilmez", genis.w > cekmece.w + 150 && yuzde1 === yuzde2, { once: cekmece.w, sonra: genis.w, yuzde1, yuzde2 });
    // Sığdır modunda genişlik değişince yeniden sığar.
    await s.getByRole("button", { name: "Genişliğe sığdır" }).click();
    await s.waitForTimeout(900);
    const tuval1 = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa canvas");
    const tut2 = await kutu(s, ".pdf-cekmece-tutamak");
    await s.mouse.move(tut2.x + 5, tut2.y + tut2.h / 2); await s.mouse.down(); await s.mouse.move(tut2.x + 200, tut2.y + tut2.h / 2, { steps: 10 }); await s.mouse.up();
    await s.waitForTimeout(1200);
    const tuval2 = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa canvas");
    kayit("sığdır modunda çekmece daralınca sayfa yeniden sığar", tuval2.w < tuval1.w - 100, { tuval1, tuval2 });
    // Sayfa 2'ye git, içeride kaydır; kapat/aç → sayfa, ölçek, kaydırma korunur.
    await s.getByRole("button", { name: "Sonraki sayfa" }).click();
    await s.waitForTimeout(1000);
    await s.evaluate(() => document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").scrollTo({ top: 240 }));
    await s.waitForTimeout(500);
    const konum1 = await s.evaluate(() => ({ sayfa: document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-girdi input").value, kaydirma: Math.round(document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").scrollTop), yuzde: document.querySelector(".pdf-yuzde").textContent }));
    await s.keyboard.press("Escape"); // odak çekmecede: Esc çekmeceyi kapatır
    await s.waitForTimeout(500);
    const kapandi = !(await kutu(s, ".kaynak-pdf-paneli"));
    const odak = await s.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
    kayit("Esc 2: çekmece kapanır, odak editöre döner", kapandi && odak, { kapandi, odak });
    await pdfiAc(s);
    await s.waitForTimeout(600);
    const konum2 = await s.evaluate(() => ({ sayfa: document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-girdi input").value, kaydirma: Math.round(document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").scrollTop), yuzde: document.querySelector(".pdf-yuzde").textContent }));
    kayit("yeniden açılınca sayfa, yakınlaştırma ve sayfa içi konum aynı", JSON.stringify(konum1) === JSON.stringify(konum2), { konum1, konum2 });
    // AI görünümü: çekmece içinde; PDF'e dönünce konum yerinde.
    await s.getByRole("button", { name: /PDF'e sor/ }).click();
    await s.waitForSelector(".pdf-ai-gorunum", { timeout: 10000 });
    await s.locator("#kaynak-pdf-soru").fill("Bu kaynağın ana bulgusu nedir?");
    await s.locator("#kaynak-pdf-soru").press("Enter");
    await s.waitForSelector(".pdf-ai-gorunum .kaynak-cevap, .pdf-ai-gorunum .kaynak-hata", { timeout: 60000 });
    await s.screenshot({ path: `${OUT}masaustu-1440-ai.png` });
    await s.getByRole("button", { name: /PDF'e dön/ }).click();
    await s.waitForTimeout(600);
    const konum3 = await s.evaluate(() => ({ sayfa: document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-girdi input").value, kaydirma: Math.round(document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").scrollTop), yuzde: document.querySelector(".pdf-yuzde").textContent }));
    kayit("AI görünümünden PDF'e dönünce okuma konumu yerinde", JSON.stringify(konum2) === JSON.stringify(konum3), { konum2, konum3 });
    // Tam ekran.
    await s.getByRole("button", { name: "Tam ekran" }).click();
    await s.waitForTimeout(400);
    const tam = await kutu(s, ".kaynak-pdf-paneli");
    await s.screenshot({ path: `${OUT}masaustu-1440-tam-ekran.png` });
    kayit("tam ekran: çekmece bütün genişlik", tam.w >= w - 20, { tam });
    // Tek geri alma: alıntı + atıf + kaynakça birlikte gider.
    await s.getByRole("button", { name: /Kaynak panelini kapat/ }).click();
    await s.waitForTimeout(400);
    await s.locator(".ProseMirror").first().focus();
    await s.keyboard.press("Control+z");
    await s.waitForTimeout(600);
    const geri = await s.locator(".ProseMirror").innerText();
    kayit("tek Ctrl+Z alıntıyı, atfı ve kaynakça girdisini birlikte geri alır", !geri.includes(CUMLE) && !geri.includes("Kaynakça"), { bas: geri.slice(0, 160) });
  }
  if (w === 1280) {
    // EKRAN KENARI: sayfayı büyütüp sağa kaydır, sağ kenardaki sözcüğü seç; katman çekmecenin içinde kalmalı.
    for (let i = 0; i < 4; i++) await s.getByRole("button", { name: "Yakınlaştır" }).click();
    await s.waitForTimeout(900);
    // Satırlar görünür alanın sağ kenarını aşacak biçimde (sayfanın başında): kenardaki sözcük seçilebilsin.
    await s.evaluate(() => { const a = document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani"); a.scrollLeft = 0; a.scrollTop = 0; });
    await s.waitForTimeout(400);
    const kenar = await s.evaluate(() => {
      const a = document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").getBoundingClientRect();
      // Sağ kenara değen ya da kenara 40 px'ten yakın biten, görünür satır.
      const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].filter((x) => { const r = x.getBoundingClientRect(); return x.textContent.trim().length > 20 && r.right > a.right - 120 && r.left < a.right - 240 && r.top > a.top + 40 && r.bottom < a.bottom - 40; })[0];
      if (!sp) return null; const r = sp.getBoundingClientRect(); const sag = Math.min(r.right, a.right - 6); return { x: sag - 230, y: r.top + r.height / 2, w: 228 };
    });
    if (kenar) {
      await s.mouse.move(kenar.x, kenar.y); await s.mouse.down(); await s.mouse.move(kenar.x + kenar.w, kenar.y, { steps: 6 }); await s.mouse.up();
      await s.waitForTimeout(500);
    }
    const katman = await kutu(s, ".pdf-secim-katmani");
    const alanK = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
    kayit("ekran kenarı: sağ kenardaki seçimde katman görünür alanın içinde", Boolean(katman && alanK && katman.x >= alanK.x && katman.x + katman.w <= alanK.x + alanK.w && katman.y + katman.h <= alanK.y + alanK.h), { kenar, katman, alanK });
    await s.screenshot({ path: `${OUT}masaustu-1280-kenar.png` });
    // Esc yalnızca katman açıksa: katman yokken Esc çekmeceyi kapatır (doğru davranış) ve senaryo düşer.
    if (katman) await s.keyboard.press("Escape");
    // UZUN SEÇİM: birinci satırdan görünür alanın altına kadar; katman yine görünür alanda.
    await s.getByRole("button", { name: "Genişliğe sığdır" }).click();
    await s.waitForTimeout(900);
    const uc = await s.evaluate(() => {
      const a = document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani"); a.scrollTop = 0; a.scrollLeft = 0;
      const ab = a.getBoundingClientRect();
      const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].filter((x) => x.textContent.trim());
      const ilk = sp.find((x) => x.textContent.includes("Seasonal variation")).getBoundingClientRect();
      const son = sp.filter((x) => x.getBoundingClientRect().bottom < ab.bottom - 4).pop().getBoundingClientRect();
      return { x1: ilk.left + 1, y1: ilk.top + ilk.height / 2, x2: son.right - 1, y2: son.top + son.height / 2 };
    });
    await s.mouse.move(uc.x1, uc.y1); await s.mouse.down(); await s.mouse.move(uc.x2, uc.y2, { steps: 12 }); await s.mouse.up();
    await s.waitForTimeout(600);
    const uzun = await s.evaluate(() => getSelection().toString().length);
    const katman2 = await kutu(s, ".pdf-secim-katmani");
    const alan2 = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
    kayit("uzun seçim: katman görünür alanda (alta taşmıyor)", Boolean(katman2 && katman2.y >= alan2.y && katman2.y + katman2.h <= alan2.y + alan2.h), { uzun, katman2, alan2 });
    await s.screenshot({ path: `${OUT}masaustu-1280-uzun-secim.png` });
    if (katman2) await s.keyboard.press("Escape");
  }
  kayit(`${w}: sayfa hatası yok`, hatalar.length === 0, hatalar);
  await c.close();
}

// ── Telefon: tam örtü, arka kilitli, sade başlık, klavye öykünmesi
{
  const { c, s, hatalar } = await baglam({ ...devices["iPhone 13"] });
  await s.goto(`/dashboard/editor/${PR}/write`);
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(1200);
  await s.screenshot({ path: `${OUT}telefon-kapali.png` });
  await s.goto(`/dashboard/editor/${PR}/write?sag=pdf`);
  await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
  await s.waitForTimeout(800);
  const tel = await kutu(s, ".kaynak-pdf-paneli");
  const vp = s.viewportSize();
  const alttaki = await s.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest(".kaynak-pdf-paneli")), [vp.width / 2, vp.height - 6]);
  // Kullanıcı kaydırması (tekerlek/dokunma) çekmecenin kaydırılamayan başlığında: arkadaki sayfa yerinde kalmalı.
  const once = await s.evaluate(() => window.scrollY);
  const bas = await kutu(s, ".pdf-cekmece-bas");
  await s.mouse.move(bas.x + 20, bas.y + bas.h / 2);
  await s.mouse.wheel(0, 600);
  await s.waitForTimeout(400);
  const kilit = await s.evaluate((once) => ({ kok: getComputedStyle(document.documentElement).overflow, govde: getComputedStyle(document.body).overflow, once, sonra: window.scrollY }), once);
  const okuma = await kutu(s, ".kaynak-pdf-paneli .pdf-sayfa-alani");
  await s.screenshot({ path: `${OUT}telefon-acik.png` });
  kayit("telefon: çekmece alt gezinme dahil bütün ekranı örter", Boolean(tel && tel.x === 0 && tel.y === 0 && tel.w === vp.width && tel.h === vp.height && alttaki), { tel, vp, alttaki });
  kayit("telefon: arkadaki sayfa kaydırılamaz", kilit.kok === "hidden" && kilit.once === kilit.sonra, kilit);
  kayit("telefon: okuma alanı ekranın en az %70'i", okuma.h >= vp.height * 0.7, { okuma, vp });
  // Durum ayrıntıları dokununca açılır, üç durum ayrı.
  const kisa = await s.locator(".pdf-durum-kisa").innerText();
  await s.locator(".pdf-durum-kisa").click();
  await s.waitForTimeout(300);
  const cipler = await s.locator(".pdf-durum-ozeti .guven-cip").allInnerTexts();
  await s.screenshot({ path: `${OUT}telefon-ayrintilar.png` });
  kayit("telefon: üç durum kısa özette ayrı, ayrıntılar isteğe bağlı açılır", /Kayıt/.test(kisa) && /PDF/.test(kisa) && /Alıntı/.test(kisa) && cipler.length === 3, { kisa, cipler });
  await s.locator(".pdf-durum-kisa").click();
  // Seçim → onay → basılı sayfa kutusu; klavye açılınca (görünür alan daralır) kutu görünür kalır.
  const secilen = await secPdf(s, CUMLE);
  await s.getByRole("button", { name: /^Alıntı ekle$/ }).click().catch(() => {});
  const onayVar = await s.waitForSelector(".pdf-onay .pdf-onay-sayfa input", { timeout: 30000 }).then(() => true).catch(() => false);
  if (onayVar) {
    await s.locator(".pdf-onay-sayfa input").focus();
    await s.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) }); // klavye öykünmesi
    await s.waitForTimeout(900);
    const girdi = await kutu(s, ".pdf-onay-sayfa input");
    const vp2 = s.viewportSize();
    await s.screenshot({ path: `${OUT}telefon-klavye.png` });
    kayit("telefon klavyesi (öykünme): basılı sayfa kutusu görünür kalır", Boolean(girdi && girdi.y >= 0 && girdi.y + girdi.h <= vp2.height), { secilen: Boolean(secilen), girdi, vp2 });
  } else kayit("telefon: seçimden onay katmanına ulaşıldı", false, { secilen });
  kayit("telefon: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
}

// ── Gerçek, iki sütunlu akademik PDF (yerel dosya: GERCEK_PDF; depoda yok)
if (process.env.GERCEK_PDF && fs.existsSync(process.env.GERCEK_PDF)) {
  const GERCEK = fs.readFileSync(process.env.GERCEK_PDF);
  const yol2 = `${PR}/kaynak-pdf/gercek-${ek}.pdf`;
  await fetch(`${GECIT}/storage/v1/object/project-files/${yol2}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: GERCEK });
  const K2 = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}','Trace-based just-in-time type specialization for dynamic languages','Gal, A.; Eich, B.; Shaver, M.',2009,'https://doi.org/10.1145/1542476.1542528','Proceedings of PLDI') returning id`).split("\n")[0];
  const P2 = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}','Gal, A., Eich, B., & Shaver, M. (2009). Trace-based just-in-time type specialization for dynamic languages. Proceedings of PLDI.',${q("gercek-" + ek)},'10.1145/1542476.1542528','yuklendi',${q(yol2)},'${K2}') returning id`).split("\n")[0];
  const { c, s, hatalar } = await baglam({ viewport: { width: 1440, height: 900 } });
  await s.goto(`/dashboard/editor/${PR}/write`);
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  await s.locator(".ProseMirror p").first().click();
  for (let i = 0; i < 5; i++) { await s.keyboard.press("End"); await s.waitForTimeout(300); if (await s.evaluate(() => { const d = getSelection(); return d.focusOffset === (d.focusNode?.textContent?.length ?? -1); })) break; }
  await pdfiAc(s);
  await s.locator(".pdf-cekmece-secici select").selectOption(P2);
  await s.waitForFunction(() => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].some((x) => x.textContent.includes("Dynamic languages")), null, { timeout: 90000 });
  await s.waitForTimeout(800);
  // Sol sütunda üç satırlık seçim (özet): sağ sütuna taşmamalı.
  const secimDene = async () => {
    const k = await s.evaluate(() => {
      const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].filter((x) => x.textContent.trim());
      const i = sp.findIndex((x) => x.textContent.includes("Dynamic languages"));
      // Seçilecek satırı görünür alana getir (yakınlaştırmadan sonra ekran dışında kalabilir).
      const alan = document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani");
      const a0 = alan.getBoundingClientRect(), r0 = sp[i].getBoundingClientRect();
      alan.scrollLeft += r0.left - a0.left - 20; alan.scrollTop += r0.top - a0.top - 60;
      const ilk = sp[i].getBoundingClientRect();
      // Aynı sütunda (sol kenarı yakın) iki satır aşağıdaki parça.
      const alt = sp.slice(i + 1).filter((x) => Math.abs(x.getBoundingClientRect().left - ilk.left) < 30 && x.getBoundingClientRect().top > ilk.top + 1.5 * ilk.height)[1].getBoundingClientRect();
      return { x1: ilk.left + 1, y1: ilk.top + ilk.height / 2, x2: alt.left + alt.width * 0.6, y2: alt.top + alt.height / 2 };
    });
    await s.mouse.move(k.x1, k.y1); await s.mouse.down(); await s.mouse.move(k.x2, k.y2, { steps: 12 }); await s.mouse.up();
    await s.waitForTimeout(600);
    return s.evaluate(() => getSelection().toString());
  };
  const secim1 = await secimDene();
  kayit("gerçek PDF: sol sütunda çok satırlı seçim sağ sütuna taşmıyor", secim1.startsWith("Dynamic languages") && !/Trace trees|Introduction|1\.\s+Introduction/i.test(secim1) && secim1.length > 80, { secim1 });
  await s.screenshot({ path: `${OUT}gercek-pdf-secim.png` });
  // Yakınlaştırma: iki adım büyüt, aynı seçim yine yapılabiliyor ve metin aynı.
  await s.keyboard.press("Escape");
  await s.getByRole("button", { name: "Yakınlaştır" }).click();
  await s.getByRole("button", { name: "Yakınlaştır" }).click();
  await s.waitForTimeout(1200);
  const secim2 = await secimDene();
  kayit("gerçek PDF: yakınlaştırmadan sonra metin katmanı hizalı (aynı seçim, aynı metin)", secim2 === secim1, { secim2 });
  // Alıntı eşleşmesi: sunucu seçimi PDF metninde doğrular; eklenen alıntı seçilenle aynı.
  await s.getByRole("button", { name: /^Alıntı ekle$/ }).click();
  const sonuc2 = await Promise.race([
    s.waitForSelector(".pdf-onay .pdf-onay-alinti", { timeout: 30000 }).then(() => "onay"),
    s.waitForSelector(".pdf-onay .kaynak-hata", { timeout: 30000 }).then(() => "hata"),
  ]).catch(() => "zaman");
  if (sonuc2 === "onay") {
    const kanonik = (await s.locator(".pdf-onay-alinti").innerText()).replace(/^“|”\s*$/g, "").trim();
    const norm = (x) => x.replace(/\s+/g, " ").replace(/-\s/g, "").trim();
    await s.waitForSelector(".pdf-onay-atif", { timeout: 15000 });
    const atifMetni = await s.locator(".pdf-onay-atif").innerText();
    await s.locator(".pdf-onay").getByRole("button", { name: /^Ekle$/ }).click();
    await s.waitForTimeout(2500);
    const belgeMetni = await s.locator(".ProseMirror").innerText();
    kayit("gerçek PDF: alıntı PDF metninde doğrulandı; eklenen metin doğrulanan dilim ve atıf önizlemesiyle aynı", belgeMetni.includes(`“${kanonik}” ${atifMetni}`) && norm(kanonik) === norm(secim1), { kanonik, secim1, atifMetni });
    await s.screenshot({ path: `${OUT}gercek-pdf-eklendi.png` });
  } else {
    const mesaj = sonuc2 === "hata" ? await s.locator(".pdf-onay .kaynak-hata").innerText() : "zaman aşımı";
    kayit("gerçek PDF: alıntı PDF metninde doğrulandı", false, { sonuc2, mesaj });
  }
  kayit("gerçek PDF: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
} else kayit("gerçek PDF dosyası verilmedi (GERCEK_PDF) — senaryo koşmadı", false, {});
await b.close();
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify(sonuc, null, 2));
process.exit(sonuc.every((x) => x.gecti) ? 0 : 1);
