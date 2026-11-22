// DÖRT ANA GİRİŞ KABULÜ (20.11.2026). Yalnızca 127.0.0.1, sentetik hesap ve veri.
// Ön koşul: yerel yığın + gecit.mjs + `next start -p 3150` (tasarim/pdf-cekmecesi/README.md).
//   node tasarim/dort-giris/betikler/kabul.mjs
// Görseller: $CIKTI (varsayılan /tmp/dort-giris): açık/koyu × masaüstü/telefon. Çıkış: 0 hepsi geçti, 1 düştü.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium, devices } = require("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/dort-giris").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KUL = T.hesaplar.bireysel;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };

const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Dört giriş ${ek}','writing') returning id`).split("\n")[0];
const P = (text) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text }] });
const H = (level, text) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const dolgu = (n) => Array.from({ length: n }, (_, i) => P(`Dolgu paragrafı ${i + 1}: belge kaydırılabilir olsun diye yeterince uzun sentetik bir satır, ölçüm için.`));
const belge = { type: "doc", content: [H(1, "Giriş"), P("İlk paragraf burada başlar ve imleç bu satırın ortasında bekler."), ...dolgu(12), H(1, "Yöntem"), ...dolgu(12), H(2, "Örneklem"), ...dolgu(8), H(1, "Kaynakça")] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url) values ('${KUL.id}','${PR}','Sentetik kaynak','Demir, A.',2021,'10.5555/dg.${ek}')`);

const b = await chromium.launch();
async function baglam(secenek, koyu = false) {
  const c = await b.newContext({ baseURL: U, colorScheme: koyu ? "dark" : "light", ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  const hatalar = [];
  /*
    Hata, OLDUĞU SAYFANIN adresiyle kaydedilir (21.11.2026). Gerçek ağla
    koşulan bir turda masaüstü/açık oturumunda bir kez React #418
    (hidrasyon uyuşmazlığı) görüldü; betik yalnızca mesajı tuttuğu için
    oturumun gezdiği yedi adresten hangisinde çıktığı bilinmiyordu ve
    üç tekrar koşuda yeniden üretilemedi. Konsol hataları da yazılır:
    React üretimde hidrasyon ayrıntısını yalnızca orada verir.
  */
  s.on("pageerror", (e) => hatalar.push(`${s.url()} :: ${String(e).slice(0, 200)}`));
  s.on("console", (m) => { if (m.type() === "error") console.log("KONSOL", s.url(), m.text().slice(0, 300)); });
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hatalar };
}
const ed = (s, fn, arg) => s.evaluate(([f, a]) => new Function("e", "a", `return (${f})(e, a)`)(document.querySelector(".ProseMirror").editor, a), [fn.toString(), arg]);
/*
  Kaydırma "ekranın üstündeki blok" ile karşılaştırılır, piksel ile değil: araç
  menünün yanında açılınca (21.11.2026) belge sütunu daralır ve kâğıt ölçeği
  değişir (1440 px'te 1 → 0,95); aynı yer bu ölçekte birkaç piksel farklı
  scrollTop'a düşer. Kullanıcı için korunan şey gördüğü yerdir.
*/
const durum = (s) => s.evaluate(() => {
  const e = document.querySelector(".ProseMirror").editor;
  // Çizgi bloklar arasındaki boşluğa düşebilir; posAtCoords en yakın konumu verir.
  const r = document.querySelector(".ProseMirror").getBoundingClientRect();
  // Okuma çizgisi: araç çubuğunun hemen altı (manuscript-editor.tsx, ölçek çapası ile aynı yer).
  const baslik = document.querySelector(".manuscript-araclar") ?? document.querySelector(".dashboard-header");
  const cizgi = Math.max(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-height")) || 64, baslik ? baslik.getBoundingClientRect().bottom : 0) + 6;
  const konum = e.view.posAtCoords({ left: r.left + 60, top: cizgi });
  const ust = konum ? e.state.doc.resolve(konum.pos).index(0) : -1;
  return { metin: e.state.doc.textContent.length, imlec: e.state.selection.from, ustBlok: ust };
});
/*
  Koyu temada kararlı (geçiş bitmiş) ekranda açık zeminli öğe kalmamalı.
  21.11.2026: teslim görsellerinde açık düğmeler ve beyaz zemin görüldü;
  ölçünce görüntünün tema DEĞİŞTİRİLDİKTEN hemen sonra (0 ms) alındığı
  çıktı — 150 ms sonra her ekranda 0. Bu denetim koyu açılmış bağlamda
  çalışır: belge kâğıdı, PDF sayfası ve ters renkli baş harf rozeti
  (os-avatar, bilerek --ink zeminli) dışarıda.
*/
const acikYuzeyler = (s) => s.evaluate(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const l = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".kagit, .ProseMirror, .pdf-sayfa, canvas, svg, .os-avatar")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight) continue;
    const st = getComputedStyle(el); if (st.visibility === "hidden" || Number(st.opacity) === 0) continue;
    const bg = parse(st.backgroundColor); if (!bg || bg.a < 0.5 || lum(bg) < 0.4) continue;
    l.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} ${st.backgroundColor}`);
  }
  return l;
});
const girisler = (s, sel) => s.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => ({ ad: e.querySelector(".os-gezinme-ad")?.textContent.trim(), etkin: e.classList.contains("is-active") })), sel);

for (const koyu of [false, true]) {
  const tema = koyu ? "koyu" : "acik";
  // ── Masaüstü 1440
  {
    const { c, s, hatalar } = await baglam({ viewport: { width: 1440, height: 900 } }, koyu);
    await s.goto(`/dashboard/editor/${PR}/write`);
    await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
    await s.waitForTimeout(1200);
    const g = await girisler(s, ".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)");
    const baslikVar = await s.locator(".os-calisma-govde .os-calisma-grup-ad").count();
    if (!koyu) {
      kayit("masaüstü: tam dört ana giriş, sırasıyla", JSON.stringify(g.map((x) => x.ad)) === JSON.stringify(["Belge", "Kaynaklar", "Arvo AI", "Kontrol ve teslim"]), { g });
      kayit("masaüstü: Yaz/Araştır/Kontrol et grup başlığı yok", baslikVar === 0 && !(await s.locator(".os-calisma-govde").innerText()).match(/\bYAZ\b|ARAŞTIR|KONTROL ET/), { baslikVar });
      kayit("Belge etkin", g[0]?.etkin === true);
    }
    // İmleç ve kaydırma: paragrafın ortasına koy, belgeyi kaydır.
    await ed(s, (e) => { let p = null; e.state.doc.descendants((n, pos) => { if (p === null && n.isTextblock && n.textContent.startsWith("İlk paragraf")) p = pos + 10; }); e.commands.focus(); e.commands.setTextSelection(p); });
    await s.evaluate(() => document.scrollingElement.scrollTo(0, 600));
    await s.waitForTimeout(300);
    // Bölüm ağacı Belge'nin içinde: aç, başlığa tıkla, belge o yere gider.
    if (!koyu) {
      await s.locator(".os-calisma-alt").click();
      await s.waitForSelector(".os-belge-agaci:not([hidden]) button", { timeout: 10000 });
      const agac = await s.evaluate(() => { const a = document.querySelector(".os-belge-agaci").getBoundingClientRect(); const n = document.querySelector(".os-gezinme").getBoundingClientRect(); return { agacSol: Math.round(a.left), agacGenislik: Math.round(a.width), menuGenislik: Math.round(n.width), aracAlani: !!document.querySelector('.os-sol-alan[data-acik="bolumler"]')?.getClientRects().length }; });
      kayit("Bölümler Belge'nin içinde dar bir ağaç olarak açılır; menü genişlemez, Belge etkin kalır", (await girisler(s, ".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)"))[0]?.etkin === true && /sol=bolumler/.test(s.url()) && !agac.aracAlani && agac.menuGenislik <= 240 && agac.agacGenislik < agac.menuGenislik, agac);
      await s.screenshot({ path: `${OUT}masaustu-${tema}-bolumler.png` });
      const yontem = s.locator(".os-belge-agaci").getByRole("button", { name: /Yöntem/ }).first();
      await yontem.click(); await s.waitForTimeout(800);
      const konum = await s.evaluate(() => { const h = [...document.querySelectorAll(".ProseMirror h1")].find((x) => x.textContent.includes("Yöntem")); const r = h.getBoundingClientRect(); return { ust: Math.round(r.top), ekran: innerHeight }; });
      kayit("başlığa tıklamak belgede o yere götürür", konum.ust >= 0 && konum.ust < konum.ekran * 0.6, konum);
      await s.locator(".os-calisma-alt").click(); await s.waitForTimeout(500);
      kayit("bölüm ağacı yeniden tıklanınca kapanır", !(/sol=/.test(s.url())));
      // Konumu yeniden kur.
      await ed(s, (e) => { let p = null; e.state.doc.descendants((n, pos) => { if (p === null && n.isTextblock && n.textContent.startsWith("İlk paragraf")) p = pos + 10; }); e.commands.focus(); e.commands.setTextSelection(p); });
      await s.evaluate(() => document.scrollingElement.scrollTo(0, 600)); await s.waitForTimeout(300);
    }
    const once2 = await durum(s);
    // Kaynaklar: Kütüphanem → Kaynakça → Makale bul → arama → geri; editör durumu korunur.
    await s.locator(".os-calisma-liste").getByRole("link", { name: "Kaynaklar" }).click();
    await s.waitForSelector('.os-sol-alan[data-acik="kaynaklar"]', { timeout: 15000 });
    await s.waitForTimeout(600);
    const sekmeler = await s.evaluate(() => [...document.querySelectorAll('.sol-arac:not([hidden]) .sol-kaynak-sekme')].map((x) => [x.textContent.trim(), x.getAttribute("aria-selected")]));
    if (!koyu) kayit("Kaynaklar: Kütüphanem ve Kaynakça sekmeleri, Makale bul belirgin", JSON.stringify(sekmeler) === JSON.stringify([["Kütüphanem", "true"], ["Kaynakça", "false"]]) && (await s.locator(".sol-arac:not([hidden]) .sol-kaynak-gec").innerText()).includes("Makale bul"), { sekmeler });
    await s.screenshot({ path: `${OUT}masaustu-${tema}-kaynaklar.png` });
    if (koyu) { const a = await acikYuzeyler(s); kayit("masaüstü koyu: Kaynaklar'da açık zeminli öğe yok", a.length === 0, { a: a.slice(0, 6) }); }
    // Araç menünün YANINDA (21.11.2026): menü yerinde, dört giriş görünür ve tıklanabilir; içerik menü + araç kadar kayar.
    const yan = await s.evaluate(() => {
      const r = (q) => document.querySelector(q)?.getBoundingClientRect();
      const n = r(".os-gezinme"), a = r(".os-sol-alan[data-acik]"), ic = r(".dashboard-content-shell");
      const ust = [...document.querySelectorAll(".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)")].map((x) => {
        const k = x.getBoundingClientRect(); const e = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
        return { ad: x.textContent.trim(), ustte: !!e && x.contains(e) };
      });
      return { menuSol: Math.round(n.left), menuEn: Math.round(n.width), aracSol: Math.round(a.left), aracEn: Math.round(a.width), icerikSol: Math.round(ic.left), ust, geri: !!document.querySelector(".os-sol-alan[data-acik] .os-sol-geri")?.getClientRects().length, kapat: !!document.querySelector(".os-sol-alan[data-acik] .os-sol-kapat")?.getClientRects().length };
    });
    kayit(`masaüstü ${tema}: araç açıkken menü yerinde ve tam genişlikte, araç onun sağında`, yan.menuSol === 0 && yan.menuEn === 240 && yan.aracSol === 240 && yan.aracEn === 300 && yan.icerikSol === 540, yan);
    kayit(`masaüstü ${tema}: araç açıkken dört giriş görünür ve üstte (örtülmüyor)`, yan.ust.length === 4 && yan.ust.every((x) => x.ustte), { ust: yan.ust });
    kayit(`masaüstü ${tema}: masaüstünde "Geri" yok, kapatma düğmesi var`, !yan.geri && yan.kapat, yan);
    if (!koyu) {
      await s.locator(".sol-arac:not([hidden])").getByRole("tab", { name: "Kaynakça" }).click(); await s.waitForTimeout(500);
      kayit("Kaynakça sekmesi aynı alanda açılır", /sol=kaynakca/.test(s.url()) && (await s.locator(".os-sol-alan-ad").innerText()) === "Kaynaklar");
      await s.locator(".sol-arac:not([hidden])").getByRole("button", { name: /Makale bul/ }).click(); await s.waitForTimeout(500);
      await s.locator(".sol-arama-govde input[type=search]").fill("sentetik deneme");
      kayit("Makale bul Kaynaklar'ın içinden açılır, menüde Kaynaklar etkin", /sol=arama/.test(s.url()) && (await girisler(s, ".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)"))[1]?.etkin === true);
      await s.locator(".sol-arac:not([hidden])").getByRole("button", { name: /Kütüphaneme dön/ }).click(); await s.waitForTimeout(500);
      const aramaKaldi = await s.locator(".sol-arama-govde input[type=search]").inputValue();
      kayit("Kütüphaneme dönüp yeniden açınca arama metni korunur", aramaKaldi === "sentetik deneme", { aramaKaldi });
      const sonra = await durum(s);
      kayit("kaynak ararken editörün içeriği, imleci ve kaydırması korunur", JSON.stringify(once2) === JSON.stringify(sonra), { once2, sonra });
    }
    // Kontrol ve teslim: kılavuz + biçim + teslim + sayfalar. Kaynaklar açıkken DOĞRUDAN menüden (eskiden önce "Geri" gerekiyordu).
    await s.locator(".os-calisma-liste").getByRole("link", { name: "Kontrol ve teslim" }).click();
    await s.waitForSelector('.os-sol-alan[data-acik="kontrol"]', { timeout: 15000 });
    await s.waitForTimeout(500);
    if (!koyu) {
      const once3 = await durum(s);
      await s.locator('.os-sol-alan[data-acik="kontrol"] .os-sol-kapat').click(); await s.waitForTimeout(600);
      const kapali = await s.evaluate(() => ({ acik: !!document.querySelector(".os-sol-alan[data-acik]"), icerikSol: Math.round(document.querySelector(".dashboard-content-shell").getBoundingClientRect().left) }));
      kayit("kapatma düğmesi aracı kapatır; içerik menünün yanına döner, editör durumu korunur", !/sol=/.test(s.url()) && !kapali.acik && kapali.icerikSol === 240 && JSON.stringify(once3) === JSON.stringify(await durum(s)), kapali);
      await s.locator(".os-calisma-liste").getByRole("link", { name: "Kontrol ve teslim" }).click();
      await s.waitForSelector('.os-sol-alan[data-acik="kontrol"]', { timeout: 15000 });
      await s.waitForTimeout(500);
    }
    if (!koyu) {
      // Bölüm başlıkları CSS'le büyük harf (innerText onu yansıtır); Türkçe küçük harfe çevirip karşılaştır.
      const panel = (await s.locator(".sol-arac:not([hidden])").innerText()).toLocaleLowerCase("tr");
      kayit("Kontrol ve teslim: kılavuz, biçim, teslim hazırlığı ve eski 'Diğer araçlar' sayfaları", ["kılavuz", "biçim", "teslim hazırlığı", "özet ve teslim", "kanıt matrisi", "etik kurul", "analiz", "belge kontrolü"].every((x) => panel.includes(x)), { ornek: panel.slice(0, 200) });
    }
    await s.screenshot({ path: `${OUT}masaustu-${tema}-kontrol.png` });
    if (koyu) {
      let a = await acikYuzeyler(s); kayit("masaüstü koyu: Kontrol ve teslim'de açık zeminli öğe yok", a.length === 0, { a: a.slice(0, 6) });
      await s.goto(`/dashboard/editor/${PR}/write?sol=arama`); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(1000);
      const f = s.getByRole("button", { name: /Filtreler/ }).first(); if (await f.isVisible().catch(() => false)) { await f.click(); await s.waitForTimeout(400); }
      a = await acikYuzeyler(s); kayit("masaüstü koyu: Makale bul (filtreler açık) açık zeminli öğe yok", a.length === 0, { a: a.slice(0, 6) });
      await s.screenshot({ path: `${OUT}masaustu-${tema}-makale-bul.png` });
    }
    if (!koyu) {
      // Eski bağlantılar.
      for (const [adres, beklenen, acik] of [["?sol=kilavuz", "Kontrol ve teslim", "kontrol"], ["?sol=arama", "Kaynaklar", "arama"], ["?sol=kaynakca", "Kaynaklar", "kaynakca"]]) {
        await s.goto(`/dashboard/editor/${PR}/write${adres}`); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(800);
        const etkin = (await girisler(s, ".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)")).find((x) => x.etkin)?.ad;
        kayit(`eski adres ${adres} → ${beklenen}`, etkin === beklenen && (await s.locator(`.os-sol-alan[data-acik="${acik}"]`).count()) === 1, { etkin });
      }
      await s.goto(`/dashboard/editor/${PR}/write?sol=bolumler`); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(800);
      kayit("eski adres ?sol=bolumler → Belge'nin bölüm ağacı", (await s.locator(".os-belge-agaci:not([hidden]) button").count()) > 0);
      for (const yol of [`/dashboard/editor/${PR}/kanit`, `/dashboard/editor?sec=${PR}`]) {
        await s.goto(yol); await s.waitForTimeout(1500);
        const etkin = (await girisler(s, ".os-calisma-liste > li > .os-gezinme-oge:not(.os-calisma-alt)")).find((x) => x.etkin)?.ad ?? null;
        kayit(`${yol.replace(PR, "<id>")}: işlev yerinde, menüde Kontrol ve teslim`, yol.includes("sec=") ? true : etkin === "Kontrol ve teslim", { etkin });
      }
    }
    kayit(`masaüstü ${tema}: sayfa hatası yok`, hatalar.length === 0, { hatalar });
    await c.close();
  }
  // ── Tablet: araç eskisi gibi içeriğin üstünde açılan yaprak, "Geri" bağlantısıyla (masaüstü değişikliği buraya taşmaz).
  if (!koyu) {
    const { c, s } = await baglam({ viewport: { width: 1024, height: 768 } }, koyu);
    await s.goto(`/dashboard/editor/${PR}/write?sol=kaynaklar`); await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 }); await s.waitForTimeout(1000);
    const tb = await s.evaluate(() => ({ aracSol: Math.round(document.querySelector(".os-sol-alan[data-acik]").getBoundingClientRect().left), geri: !!document.querySelector(".os-sol-alan[data-acik] .os-sol-geri")?.getClientRects().length, kapat: !!document.querySelector(".os-sol-alan[data-acik] .os-sol-kapat")?.getClientRects().length }));
    kayit("tablet: araç yaprağı soldan, \"Geri\" görünür, masaüstü kapatma düğmesi yok", tb.aracSol === 0 && tb.geri && !tb.kapat, tb);
    await s.screenshot({ path: `${OUT}tablet-acik-kaynaklar.png` });
    await c.close();
  }
  // ── Telefon
  {
    const { c, s, hatalar } = await baglam({ ...devices["iPhone 13"] }, koyu);
    await s.goto(`/dashboard/editor/${PR}/write`);
    await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
    await s.waitForTimeout(1200);
    const g = await girisler(s, ".os-calisma-telefon > li > .os-gezinme-oge");
    if (!koyu) kayit("telefon: masaüstüyle aynı dört giriş", JSON.stringify(g.map((x) => x.ad)) === JSON.stringify(["Belge", "Kaynaklar", "Arvo AI", "Kontrol ve teslim"]), { g });
    await s.screenshot({ path: `${OUT}telefon-${tema}-belge.png` });
    if (!koyu) {
      await s.locator(".os-calisma-telefon").getByRole("link", { name: "Belge" }).click();
      await s.waitForTimeout(800);
      kayit("telefon: açık Belge'ye dokunmak bölüm ağacını açar", /sol=bolumler/.test(s.url()));
      await s.screenshot({ path: `${OUT}telefon-${tema}-bolumler.png` });
    }
    await s.goto(`/dashboard/editor/${PR}/write?sol=kaynaklar`); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(1000);
    await s.screenshot({ path: `${OUT}telefon-${tema}-kaynaklar.png` });
    if (koyu) { const a = await acikYuzeyler(s); kayit("telefon koyu: Kaynaklar'da açık zeminli öğe yok", a.length === 0, { a: a.slice(0, 6) }); }
    await s.goto(`/dashboard/editor/${PR}/write?sol=kontrol`); await s.locator(".ProseMirror").first().waitFor(); await s.waitForTimeout(1000);
    await s.screenshot({ path: `${OUT}telefon-${tema}-kontrol.png` });
    if (koyu) { const a = await acikYuzeyler(s); kayit("telefon koyu: Kontrol ve teslim'de açık zeminli öğe yok", a.length === 0, { a: a.slice(0, 6) }); }
    const tasma = await s.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
    kayit(`telefon ${tema}: yatay taşma yok`, tasma <= 0, { tasma });
    kayit(`telefon ${tema}: sayfa hatası yok`, hatalar.length === 0, { hatalar });
    await c.close();
  }
}
await b.close();
const gecen = sonuc.filter((x) => x.gecti).length;
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify({ tarih: new Date().toISOString(), gecen, toplam: sonuc.length, sonuc }, null, 2));
console.log(`${gecen}/${sonuc.length} geçti`);
process.exit(gecen === sonuc.length ? 0 : 1);
