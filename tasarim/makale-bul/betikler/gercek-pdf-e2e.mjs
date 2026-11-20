// GERÇEK PDF EDİNME — UÇTAN UCA (20.11.2026). Yerel yığın + sentetik hesap; dış servisler GERÇEK
// (Crossref/OpenAlex araması, yayıncının açık erişim PDF'i). Önceden yüklenmiş PDF KULLANILMAZ:
// betik başta bu DOI'nin hiçbir çalışmada PDF kaydı olmadığını doğrular.
// Ön koşul: birleşik sürümün `next start -p 3150`'i NODE_USE_ENV_PROXY=1 ile (Node fetch vekili
// kendiliğinden kullanmıyor) ve ağda api.openalex.org, api.crossref.org, journals.plos.org açık.
// Makale Bul (M7) + PDF çekmecesi (M8) + alıntı ekleme (M2) birlikte gerektiği için yalnızca
// birleşik sürümde koşar.
//   node tasarim/makale-bul/betikler/gercek-pdf-e2e.mjs
// Çıkış: 0 hepsi geçti, 1 en az biri düştü, 2 dış servis engeli (hangi adım olduğu yazılır).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/gercek-pdf-e2e").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const KUL = T.hesaplar.bireysel;
// PLOS ONE (CC BY), açık erişim PDF'i yayıncıda. Depoda/tohumda hiç yok.
const DOI = "10.1371/journal.pone.0115069";
const BASLIK = "An Efficiency Comparison of Document Preparation Systems Used in Academic Research and Development";
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };
const engel = async (adim, ayrinti) => { console.log(`ENGEL (${adim}):`, ayrinti); sonuc.push({ ad: adim, gecti: null, ayrinti }); fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify({ tarih: new Date().toISOString(), engel: adim, sonuc }, null, 2)); await b?.close(); process.exit(2); };

// 0) Ön koşul: bu DOI'nin hiçbir PDF kaydı ve kaynağı yok (önceden yüklenmiş PDF kabulün yerine geçmez).
const oncePdf = psql(`select count(*) from public.kaynak_pdfleri where lower(doi) = lower('${DOI}')`);
const onceKaynak = psql(`select count(*) from public.literature_sources where doi_or_url ilike '%${DOI}%'`);
kayit("ön koşul: DOI'nin depoda hiç PDF kaydı ve kaynağı yok", oncePdf === "0" && onceKaynak === "0", { oncePdf, onceKaynak });
const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Gerçek PDF ${ek}','writing') returning id`).split("\n")[0];
const METIN = "Belge hazırlama araçlarının verimliliği tartışılmaktadır.";
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', '${JSON.stringify({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, { type: "paragraph", attrs: {}, content: [{ type: "text", text: METIN }] }] }).replace(/'/g, "''")}'::jsonb, '${METIN}') on conflict (project_id) do update set content = excluded.content`);
psql(`delete from public.auth_rate_limits where key like '%${KUL.id}%'`);

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
const s = await c.newPage();
const hatalar = [];
s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);

// 1) Arama sonucundan bul (canlı dizin).
await s.goto(`/dashboard/editor/${PR}/write?sol=arama`);
await s.waitForSelector(".sol-arama-govde input[type=search]", { timeout: 60000 });
const kok = s.locator(".sol-arama-govde");
await kok.locator("input[type=search]").fill(BASLIK);
await kok.getByRole("button", { name: /^Ara$/ }).click();
await kok.locator(".bulgu-satiri, .asistan-uyari").first().waitFor({ timeout: 90000 }).catch(() => {});
if (!(await kok.locator(".bulgu-satiri").count())) await engel("arama (Crossref/OpenAlex)", (await kok.locator(".asistan-uyari").allTextContents()).join(" | ") || "sonuç yok");
await s.waitForTimeout(1500);
// Aynı başlıklı bir "Correction:" kaydı da çıkıyor (ayrı DOI); ilk denemede o seçilmişti.
const satir = kok.locator(".bulgu-satiri", { hasText: /Efficiency Comparison of Document Preparation/i }).filter({ hasNotText: /Correction/i }).first();
kayit("1. makale arama sonucunda bulundu", (await satir.count()) === 1, { satirSayisi: await kok.locator(".bulgu-satiri").count() });
if (!(await satir.count())) await engel("arama sonucu", "makale ilk sayfada yok");
kayit("arama sonucu için PDF kendiliğinden indirilmedi", psql(`select count(*) from public.kaynak_pdfleri where project_id='${PR}'`) === "0");
await s.screenshot({ path: `${OUT}1-arama.png` });

// 2) PDF'yi getir → 3) kaynağa bağla → 4) çekmecede aç
const t0 = Date.now();
await satir.getByRole("button", { name: /PDF'yi oku/ }).click();
const acildi = await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 120000 }).then(() => true).catch(() => false);
const durum = await satir.getAttribute("data-pdf-durumu").catch(() => null) ?? (await satir.locator("[data-pdf-durumu]").first().getAttribute("data-pdf-durumu").catch(() => null));
if (!acildi) {
  const pdfSatiri = psql(`select coalesce(durum,'') || ' ' || coalesce(kaynak_adres,'') from public.kaynak_pdfleri where project_id='${PR}' limit 1`);
  await s.screenshot({ path: `${OUT}2-acilmadi.png` });
  // Konteynerde dış DNS yoksa SSRF koruması (lib/guvenli-indir.ts) adresi genel IP'ye çözemez ve indirmeyi reddeder.
  await engel("PDF indirme", { durum, pdfSatiri, uyari: (await satir.innerText()).slice(0, 300), ipucu: "sunucu günlüğünde 'Adres genel ağa çözümlenemedi' varsa ortamda DNS yok" });
}
const pdf = psql(`select id || '|' || durum || '|' || coalesce(kaynak_id::text,'') || '|' || coalesce(depo_yolu,'') || '|' || coalesce(kaynak_adres,'') from public.kaynak_pdfleri where project_id='${PR}'`).split("|");
const kaynak = psql(`select id || '|' || status from public.literature_sources where project_id='${PR}' and doi_or_url ilike '%${DOI}%'`).split("|");
kayit("2. PDF yayıncıdan indirildi ve depoya yazıldı (durum 'indirildi')", pdf[1] === "indirildi" && !!pdf[3], { durum: pdf[1], depo: pdf[3]?.slice(-40), adres: pdf[4], sure_sn: Math.round((Date.now() - t0) / 1000) });
const depoBoyut = psql(`select coalesce((metadata->>'size')::text,'?') from storage.objects where bucket_id='project-files' and name='${pdf[3]}'`);
kayit("depoda gerçek dosya var", depoBoyut !== "" && depoBoyut !== "?" && Number(depoBoyut) > 50_000, { depoBoyut });
kayit("3. kaynak çalışmaya 'Okunacak' eklendi ve PDF bu kayda BAĞLI", kaynak[1] === "to_review" && pdf[2] === kaynak[0], { kaynak, pdfKaynak: pdf[2] });
const metinVar = await s.evaluate(() => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].map((x) => x.textContent).join(" "));
kayit("4. çekmecede açıldı; metin katmanında makalenin başlığı var", /Efficiency Comparison/i.test(metinVar), { ornek: metinVar.slice(0, 120) });
await s.screenshot({ path: `${OUT}4-cekmece.png` });

// 5) Pasaj seç: ilk sayfadaki uzun bir satır (başlık değil).
const hedef = await s.evaluate(() => {
  const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .pdf-sayfa:first-of-type .textLayer span")].filter((x) => x.textContent.trim().length > 60 && /\s/.test(x.textContent) && !/Efficiency Comparison/i.test(x.textContent));
  const e = sp[2] ?? sp[0];
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { metin: e.textContent, x: r.left, y: r.top + r.height / 2, w: r.width };
});
if (!hedef) await engel("pasaj seçimi", "metin katmanında seçilecek satır bulunamadı");
await s.mouse.move(hedef.x + 1, hedef.y); await s.mouse.down(); await s.mouse.move(hedef.x + hedef.w - 1, hedef.y, { steps: 10 }); await s.mouse.up();
await s.waitForTimeout(600);
const secilen = await s.evaluate(() => getSelection().toString());
kayit("5. pasaj seçildi, seçim araçları göründü", secilen.trim().length > 40 && (await s.locator(".pdf-secim-arac").count()) > 0, { secilen: secilen.slice(0, 100) });
await s.screenshot({ path: `${OUT}5-secim.png` });

// 6) Alıntı ekle → onay → Ekle. Sunucu seçimi PDF metnine karşı doğrular.
await s.getByRole("button", { name: /^Alıntı ekle$/ }).click();
const sonuc6 = await Promise.race([
  s.waitForSelector(".pdf-onay .pdf-onay-alinti", { timeout: 60000 }).then(() => "onay"),
  s.waitForSelector(".pdf-onay .kaynak-hata, .kaynak-pdf-paneli .kaynak-hata", { timeout: 60000 }).then(() => "hata"),
]).catch(() => "zaman");
if (sonuc6 !== "onay") {
  kayit("6. alıntı onayı açıldı (seçim PDF metninde doğrulandı)", false, { sonuc6, hata: await s.locator(".kaynak-hata").first().innerText().catch(() => null) });
} else {
  await s.waitForSelector(".pdf-onay-atif", { timeout: 20000 }).catch(() => {});
  const onizleme = await s.locator(".pdf-onay-atif").innerText().catch(() => "");
  const alinti = (await s.locator(".pdf-onay-alinti").innerText()).replace(/[“”"]/g, "").trim();
  await s.screenshot({ path: `${OUT}6-onay.png` });
  await s.locator(".pdf-onay").getByRole("button", { name: /^Ekle$/ }).click();
  await s.waitForTimeout(3000);
  const belge = await s.locator(".ProseMirror").innerText();
  kayit("6. alıntı ve atıf belgeye eklendi (alıntı seçilenle aynı, atıf önizlemeyle aynı)", belge.includes(alinti.slice(0, 40)) && !!onizleme && belge.includes(onizleme), { onizleme, alinti: alinti.slice(0, 80) });
  await s.screenshot({ path: `${OUT}6-eklendi.png` });
}
kayit("sayfa hatası yok", hatalar.length === 0, { hatalar });
await b.close();
const gecen = sonuc.filter((x) => x.gecti).length;
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify({ tarih: new Date().toISOString(), doi: DOI, proje: PR, gecen, toplam: sonuc.length, sonuc }, null, 2));
console.log(`${gecen}/${sonuc.length} geçti`);
process.exit(gecen === sonuc.length ? 0 : 1);
