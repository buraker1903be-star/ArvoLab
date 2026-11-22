// M7 kabulü: sade Makale Bul (tek alan, Filtreler kapalı, çipler), sonuç
// başına PDF durumu, "PDF'yi oku" → çekmece, Geri al yalnızca yeni kayıtta.
// Yerel yığın + `next start -p 3150`. Arama GERÇEK Crossref/OpenAlex'e gider.
//   GERCEK_PDF=/yol/tracemonkey.pdf node tasarim/makale-bul/betikler/kabul.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium } = createRequire(`${KOK}/package.json`)("playwright");
const U = "http://localhost:3150", GECIT = "http://127.0.0.1:54401";
const OUT = (process.env.CIKTI ?? "/tmp/makale-bul-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const KUL = T.hesaplar.bireysel;
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };

const ek = Date.now().toString(36).slice(-5);
const DOI = "10.1145/1542476.1542528"; // TraceMonkey (PLDI 2009)
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis',${q(`Makale bul ${ek}`)},'writing') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: {}, content: [{ type: "text", text: "Giriş metni." }] }] }))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
// Çalışmada bu makalenin PDF'i önceden hazır: "PDF'yi oku" yeniden indirmeden çekmeceyi açmalı.
// Dizin aynı makalenin İKİ sürümünü döndürüyor (PLDI bildirisi ve SIGPLAN Notices; iki DOI): ikisi için de.
const pdf = fs.readFileSync(process.env.GERCEK_PDF);
for (const [i, doi] of [DOI, "10.1145/1543135.1542528"].entries()) {
  const pdfYol = `${PR}/kaynak-pdf/makale-bul-${ek}-${i}.pdf`;
  await fetch(`${GECIT}/storage/v1/object/project-files/${pdfYol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
  psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu) values ('${PR}','${KUL.id}','Gal, A. (2009). Trace-based just-in-time type specialization for dynamic languages.',${q(`mb-${ek}-${i}`)},'${doi}','yuklendi',${q(pdfYol)})`);
}

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
const s = await c.newPage();
const hatalar = [];
s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
await s.goto(`/dashboard/editor/${PR}/write?sol=arama`); await s.waitForSelector(".sol-arama-govde input[type=search]", { timeout: 60000 });
const kok = s.locator(".sol-arama-govde");
// PDF panelini kapat: kapatma düğmesi varsa onunla (main'deki sağ sütun Esc'i kullanmıyor), yoksa Esc (M8 çekmecesi).
const paneliKapat = async () => {
  const kapat = s.locator(".kaynak-pdf-paneli:not([hidden])").getByRole("button", { name: /^(Kapat|Kaynak panelini kapat|Paneli kapat|Close)/ }).first();
  if (await kapat.count()) await kapat.click();
  else await s.keyboard.press("Escape");
  await s.waitForTimeout(500);
};

kayit("ilk açılışta tek alan + Ara + Filtreler; filtre alanları kapalı", (await kok.locator("input[type=search]").count()) === 1 && (await kok.getByRole("button", { name: /^Ara$/ }).isVisible()) && (await kok.locator("#makale-filtreler").count()) === 0);
await s.screenshot({ path: OUT + "sade-arama.png" });

await kok.locator("input[type=search]").fill("Trace-based just-in-time type specialization for dynamic languages");
await kok.getByRole("button", { name: /^Ara$/ }).click();
// Dış dizin sınırı (429) uygulamanın değil servisin durumu: sonuç yerine uyarı gelirse betik bunu söyleyip çıkar.
await kok.locator(".bulgu-satiri, .asistan-uyari").first().waitFor({ timeout: 60000 });
if (!(await kok.locator(".bulgu-satiri").count())) {
  console.log("DIŞ SERVİS YANITI:", (await kok.locator(".asistan-uyari").allTextContents()).join(" | "));
  await b.close();
  process.exit(2);
}
const satirSayisi = await kok.locator(".bulgu-satiri").count();
kayit("arama sonuç getirir (canlı dizin)", satirSayisi > 0, { satirSayisi });
kayit("sonuçlar için PDF kendiliğinden indirilmez (başlangıç: aranmadı)", (await kok.locator("[data-pdf-durumu]").evaluateAll((e) => e.map((x) => x.getAttribute("data-pdf-durumu")))).every((d) => d === "aranmadi"));

// Filtre: aç, yıl gir → çip; çipi kaldır → yeniden arama.
await kok.getByRole("button", { name: /Filtreler/ }).click();
await kok.locator("#makale-filtreler input[type=number]").first().fill("2005");
await s.waitForTimeout(1500);
kayit("etkin filtre çip olarak görünür", (await kok.locator(".makale-cip").allTextContents()).some((t) => /2005/.test(t)));
await kok.locator(".makale-cip button").first().click();
await s.waitForTimeout(400);
kayit("çip × ile kalkar", (await kok.locator(".makale-cip").count()) === 0);
await kok.getByRole("button", { name: /Filtreler/ }).click();

// TraceMonkey satırı: PDF hazır → çekmece açılır.
await s.waitForTimeout(2500);
const tm = kok.locator(".bulgu-satiri", { hasText: /Trace-based just-in-time/i }).first();
await tm.getByRole("button", { name: /PDF'yi oku/ }).click();
await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa", { timeout: 60000 });
kayit("PDF'yi oku: çalışmadaki hazır PDF çekmecede açılır", await s.locator(".kaynak-pdf-paneli:not([hidden])").isVisible());
const eklenen = psql(`select count(*) from literature_sources where project_id='${PR}' and status='to_review' and doi_or_url ilike '%.1542528%'`);
kayit("kaynak çalışmaya 'Okunacak' olarak eklendi", eklenen === "1", { eklenen });
await s.screenshot({ path: OUT + "cekmece-acildi.png" });
await paneliKapat();


// Geri al: yalnızca yeni eklenen kaydı siler.
await tm.getByRole("button", { name: /Geri al/ }).click(); await s.waitForTimeout(800);
kayit("Geri al yeni eklenen kaydı siler", psql(`select count(*) from literature_sources where project_id='${PR}' and doi_or_url ilike '%.1542528%'`) === "0");

// Önceden var olan kayıt: Geri al çıkmaz, kayıt silinmez.
// Başlık aynı: DOI farklı sürüm de olsa aynı eser sayılır, ikinci kopya eklenmez.
psql(`insert into literature_sources (owner_id, project_id, title, authors, year, doi_or_url, status) values ('${KUL.id}','${PR}','Trace-based just-in-time type specialization for dynamic languages','Gal, A.','2009','https://doi.org/${DOI}','read')`);
await s.reload(); await s.waitForSelector(".sol-arama-govde .bulgu-satiri", { timeout: 60000 });
const tm2 = s.locator(".sol-arama-govde .bulgu-satiri", { hasText: /Trace-based just-in-time/i }).first();
await tm2.getByRole("button", { name: /PDF'yi oku|PDF'yi aç/ }).click();
await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa", { timeout: 60000 });
await paneliKapat();
kayit("önceden var olan kayıtta Geri al yok, kayıt korunur, ikinci kopya yok", (await tm2.getByRole("button", { name: /Geri al/ }).count()) === 0 && psql(`select count(*) from literature_sources where project_id='${PR}' and doi_or_url ilike '%.1542528%'`) === "1");

// Başka bir sonuç: PDF önceden yok → dizine gidilir; dizin 429/ulaşılamaz ise "servis hatası", "bulunamadı" DEĞİL.
const diger = s.locator(".sol-arama-govde .bulgu-satiri").filter({ hasNotText: /Trace-based just-in-time/i }).first();
if (await diger.count()) {
  await diger.getByRole("button", { name: /PDF'yi oku/ }).click();
  // Durum değişince düğme rozete dönüşebilir (farklı öğe): her turda yeniden bulunur.
  let son = "araniyor";
  for (let i = 0; i < 180 && son === "araniyor"; i++) {
    await s.waitForTimeout(500);
    son = (await diger.locator("[data-pdf-durumu]").first().getAttribute("data-pdf-durumu").catch(() => "araniyor")) ?? "araniyor";
  }
  kayit("başka sonuç: durum aranıyor'dan kesin bir duruma geçer (bulundu/bulunamadı/servis hatası)", ["bulundu", "bulunamadi", "servis_hatasi"].includes(son), { son });
  await s.screenshot({ path: OUT + "pdf-durumu.png" });
} else kayit("başka sonuç yok (atlandı)", true, { atlandi: true });
kayit("sayfa hatası yok", hatalar.length === 0, { hatalar });
await b.close();
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
