// KAYNAK BAĞLANTILARI VE DURUMLARI KABULÜ (M5/M9, 20.11.2026). Yalnızca 127.0.0.1, sentetik hesap ve veri.
// Ön koşul: yerel yığın + gecit.mjs + model-taklidi.mjs + `next start -p 3150` (tasarim/pdf-cekmecesi/README.md).
//   node tasarim/kaynak-baglantilari/betikler/kabul.mjs
// Görseller: $CIKTI (varsayılan /tmp/kaynak-baglantilari). Çıkış: 0 hepsi geçti, 1 en az biri düştü.
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium, devices } = require("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const U = "http://localhost:3150", GECIT = "http://127.0.0.1:54401";
const OUT = (process.env.CIKTI ?? "/tmp/kaynak-baglantilari").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KUL = T.hesaplar.bireysel;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };

// ── Tohum: dört durum (bağlı PDF, yalnızca DOI eşleşmesi, aynı DOI'de iki PDF, PDF yok) + uzun künyeli kaynak + 30 dolgu kaynak
const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Bağlantı ${ek}','writing') returning id`).split("\n")[0];
const METIN = "Önceki çalışmalar bu örüntüyü gösterir (Demir, 2021).";
const belge = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, { type: "paragraph", attrs: {}, content: [{ type: "text", text: METIN }] }] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, ${q(METIN)}) on conflict (project_id) do update set content = excluded.content`);
const kaynak = (baslik, yazar, yil, doi) => psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}',${q(baslik)},${q(yazar)},${yil},${doi ? q(doi) : "null"},'Journal of Synthetic Studies') returning id`).split("\n")[0];
for (let i = 1; i <= 30; i++) kaynak(`Dolgu kaynağı ${i}: sentetik başlık`, `Dolgu, A.`, 2000 + (i % 20), null);
const FISHER = kaynak("Seasonal patterns in synthetic data", "Fisher, E. W., & Other, J.", 2023, `https://doi.org/10.5555/fisher.${ek}`);
const DEMIR = kaynak("Sentetik veride mevsimsel örüntüler", "Demir, A.", 2021, `10.5555/demir.${ek}`);
const KAYA = kaynak("İki dosyalı belirsiz kaynak", "Kaya, B.", 2019, `10.5555/kaya.${ek}`);
const UZUN = kaynak(
  "Çokdeğişkenliistatistikselmodellemeyaklaşımlarınınkarşılaştırmalıdeğerlendirilmesiveuygulamaalanlarıüzerinebirinceleme",
  "Abdurrahmangazioğlu-Karamustafapaşaoğulları, Ş., Uzunsoyadlıyazar-İkincisoyadlı, Ö., & Üçüncüyazar, Ç.",
  2020,
  null,
);
const CUMLE = "Seasonal variation explained most of the observed difference.";
const pdfYukle = async (ad, satirlar) => {
  const yol = `${PR}/kaynak-pdf/${ad}-${ek}.pdf`;
  await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: sentetikPdf([satirlar]) });
  return yol;
};
const pdfKaydi = (anahtar, doi, yol, kaynakId) => psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}',${q(anahtar)},${q(anahtar + ek)},${q(doi)},'yuklendi',${q(yol)},${kaynakId ? q(kaynakId) : "null"}) returning id`).split("\n")[0];
const PDF_FISHER = pdfKaydi("fisher", `10.5555/fisher.${ek}`, await pdfYukle("fisher", ["Seasonal patterns in synthetic data", "Edward W. Fisher", "", CUMLE]), FISHER);
const PDF_DEMIR = pdfKaydi("demir", `10.5555/demir.${ek}`, await pdfYukle("demir", ["Sentetik veride mevsimsel örüntüler", "A. Demir", "", "Demir PDF gövdesi."]), null);
pdfKaydi("kaya1", `10.5555/kaya.${ek}`, await pdfYukle("kaya1", ["Kaya bir"]), null);
pdfKaydi("kaya2", `10.5555/kaya.${ek}`, await pdfYukle("kaya2", ["Kaya iki"]), null);
console.log("tohum", { PR, FISHER, DEMIR, KAYA, UZUN, PDF_FISHER, PDF_DEMIR });

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
// Yatay taşma: sayfa ve verilen kapsayıcıların içinde, sınır çizgisini aşan çocuklar dahil.
const tasma = (s, sel) => s.evaluate((sel) => {
  const ekran = document.documentElement.clientWidth;
  const sayfa = document.scrollingElement.scrollWidth - ekran;
  const tasan = [];
  for (const kap of document.querySelectorAll(sel)) {
    const k = kap.getBoundingClientRect();
    if (!k.width) continue;
    if (kap.scrollWidth - kap.clientWidth > 1) tasan.push({ kap: kap.className.slice(0, 40), fark: kap.scrollWidth - kap.clientWidth });
    for (const e of kap.querySelectorAll("*")) {
      const r = e.getBoundingClientRect();
      if (r.width && (r.right > Math.min(k.right, ekran) + 1 || r.left < Math.max(k.left, 0) - 1)) { tasan.push({ oge: `${e.tagName}.${String(e.className).slice(0, 30)}`, sag: Math.round(r.right), kap: Math.round(k.right) }); break; }
    }
  }
  return { sayfa, tasan: tasan.slice(0, 5) };
}, sel);
const satir = (s, id) => s.locator(`#kaynak-${id}`);

// ── 1-3) Kaynaklar sayfası: taşma, doğrudan kayıt, PDF durumları — telefon ve masaüstü
for (const [ad, secenek] of [["telefon", { ...devices["iPhone 13"] }], ["masaustu", { viewport: { width: 1440, height: 900 } }]]) {
  const { c, s, hatalar } = await baglam(secenek);
  await s.goto(`/dashboard/literature?calisma=${PR}&kaynak=${UZUN}`);
  await s.waitForSelector(".kaynak-satiri");
  await s.waitForTimeout(800);
  const t = await tasma(s, ".kaynak-satiri");
  kayit(`${ad}: Kaynaklar listesinde yatay taşma yok`, t.sayfa <= 0 && t.tasan.length === 0, t);
  const odak = await s.evaluate((id) => { const e = document.getElementById(`kaynak-${id}`); if (!e) return null; const r = e.getBoundingClientRect(); return { odak: e.dataset.odak, gorunur: r.top >= 0 && r.bottom <= innerHeight, etkin: document.activeElement === e }; }, UZUN);
  kayit(`${ad}: ?kaynak= ile gelinen kayıt görünür, vurgulu ve odakta (30 dolgu kaynağın altında)`, odak?.odak === "true" && odak.gorunur && odak.etkin, odak);
  await s.screenshot({ path: `${OUT}${ad}-kaynaklar-odak.png` });
  if (ad === "masaustu") {
    const durumlar = {};
    for (const [n, id] of [["fisher", FISHER], ["demir", DEMIR], ["kaya", KAYA]]) {
      durumlar[n] = await satir(s, id).evaluate((e) => ({ pdf: e.querySelector(".kaynak-pdf-durumu")?.textContent ?? null, ton: e.querySelector(".kaynak-pdf-durumu")?.dataset.ton ?? null, oku: [...e.querySelectorAll("a")].some((a) => /PDF'i oku/.test(a.textContent)) }));
    }
    kayit("bağlı PDF: 'PDF bağlı' onay tonunda ve okunabilir", durumlar.fisher.pdf === "PDF bağlı" && durumlar.fisher.ton === "tamam" && durumlar.fisher.oku, durumlar.fisher);
    kayit("yalnızca DOI eşleşmesi: uyarı tonunda, 'bağlı' denmez, okunabilir", /DOI ile eşleşti/.test(durumlar.demir.pdf) && durumlar.demir.ton === "uyari" && durumlar.demir.oku, durumlar.demir);
    kayit("aynı DOI'de iki PDF: belirsiz yazılır, gizlenmez ve AÇILMAZ", /2 PDF/.test(durumlar.kaya.pdf) && durumlar.kaya.ton === "uyari" && !durumlar.kaya.oku, durumlar.kaya);

    // 4) Kaynaklar sayfasından "PDF'i oku" → editör çekmecesi o PDF'le
    await satir(s, FISHER).getByRole("link", { name: /PDF'i oku/ }).click();
    await s.waitForURL(/\/write/, { timeout: 60000 });
    await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
    await s.waitForTimeout(800);
    const cekmece = await s.evaluate((c) => ({ metin: [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].some((x) => x.textContent.includes(c.slice(0, 25))), adres: location.search }), CUMLE);
    kayit("Kaynaklar'dan 'PDF'i oku' editörün çekmecesinde O PDF'i açar, adres temizlenir", cekmece.metin && !/pdf=/.test(cekmece.adres) && /sag=pdf/.test(cekmece.adres), cekmece);
    await s.screenshot({ path: `${OUT}masaustu-kaynaklardan-cekmece.png` });

    // 5) Doğrudan editör adresi: DOI eşleşmeli PDF + sayfa; bilinmeyen kimlik sessiz kalmaz
    await s.goto(`/dashboard/editor/${PR}/write?sag=pdf&pdf=${PDF_DEMIR}&sayfa=1`);
    await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
    await s.waitForTimeout(800);
    kayit("editör ?pdf= adresi istenen PDF'i açar", await s.evaluate(() => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].some((x) => x.textContent.includes("Demir PDF"))));
    await s.goto(`/dashboard/editor/${PR}/write?sag=pdf&pdf=00000000-0000-4000-8000-000000000000`);
    await s.waitForSelector(".kaynak-pdf-paneli:not([hidden])", { timeout: 60000 });
    await s.waitForTimeout(2500);
    const yok = await s.locator(".kaynak-pdf-paneli .pdf-durum[role=alert]").textContent().catch(() => null);
    kayit("bulunamayan PDF kimliği: panel bunu söyler (sessizce başka PDF'te kalmaz)", /bulunamadı/.test(yok ?? ""), { yok });

    // 6) Atıf kartı: kısa özet + ayrıntı; DOI eşleşmesi onay tonunda değil; kayda doğrudan bağlantı
    await s.goto(`/dashboard/editor/${PR}/write`);
    await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
    await s.waitForTimeout(1200);
    const k = await s.evaluate(() => { const w = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf("Demir, 2021"); if (i >= 0) { const r = document.createRange(); r.setStart(n, i + 2); r.setEnd(n, i + 3); const b = r.getBoundingClientRect(); return { x: b.left + 1, y: b.top + b.height / 2 }; } } return null; });
    await s.mouse.click(k.x, k.y);
    await s.waitForSelector(".atif-karti .atif-karti-ozet", { timeout: 20000 });
    await s.waitForTimeout(600);
    const kart = await s.evaluate(() => {
      const e = document.querySelector(".atif-karti");
      return {
        cipler: [...e.querySelectorAll(".atif-karti-ozet .guven-cip")].map((c) => [c.textContent.trim(), c.dataset.tur]),
        ayrintiKapali: !e.querySelector(".atif-karti-ayrinti").open,
        kayit: [...e.querySelectorAll("a")].find((a) => /Kaynak kaydı/.test(a.textContent))?.getAttribute("href") ?? null,
        pdfAc: [...e.querySelectorAll("button")].some((x) => /PDF'i aç/.test(x.textContent)),
      };
    });
    const pdfCip = kart.cipler.find(([m]) => /PDF/.test(m));
    kayit("atıf kartı: üç durum kısa özet olarak, ayrıntı kapalı", kart.cipler.length === 3 && kart.ayrintiKapali, kart);
    kayit("atıf kartı: DOI eşleşmesi 'uyarı', 'Açılabilir/bağlı' değil", !!pdfCip && pdfCip[1] === "uyari" && /DOI ile eşleşti/.test(pdfCip[0]), { pdfCip });
    kayit("atıf kartı: 'Kaynak kaydı' o kaydın kendisine gider", kart.kayit === `/dashboard/literature?calisma=${encodeURIComponent(PR)}&kaynak=${encodeURIComponent(DEMIR)}`, { kayit: kart.kayit });
    await s.locator(".atif-karti-ayrinti summary").click();
    await s.waitForTimeout(200);
    await s.screenshot({ path: `${OUT}masaustu-atif-karti.png` });
    await s.locator(".atif-karti").getByRole("link", { name: /Kaynak kaydı/ }).click();
    await s.waitForURL(/literature/, { timeout: 60000 });
    await s.waitForSelector(`#kaynak-${DEMIR}[data-odak="true"]`, { timeout: 20000 });
    kayit("atıf kartından kayda gidince satır vurgulu açılır", true);
  }
  kayit(`${ad}: sayfa hatası yok`, hatalar.length === 0, { hatalar });
  await c.close();
}

// ── 7) Editörün Kaynaklar aracı (telefon): taşma yok, durumlar, kayıt bağlantısı
{
  const { c, s, hatalar } = await baglam({ ...devices["iPhone 13"] });
  await s.goto(`/dashboard/editor/${PR}/write?sol=kaynaklar`);
  await s.waitForSelector(".sol-kaynak", { timeout: 60000 });
  await s.waitForTimeout(800);
  const t = await tasma(s, ".sol-kaynak");
  kayit("telefon: editör Kaynaklar aracında taşma yok (uzun künye dahil)", t.sayfa <= 0 && t.tasan.length === 0, t);
  const kaya = await s.evaluate(() => { const li = [...document.querySelectorAll(".sol-kaynak")].find((e) => e.textContent.includes("İki dosyalı")); return { cip: li?.querySelector(".guven-cip")?.textContent.trim(), tur: li?.querySelector(".guven-cip")?.dataset.tur, ac: [...(li?.querySelectorAll("button") ?? [])].some((x) => /PDF'i aç/.test(x.textContent)) }; });
  kayit("Kaynaklar aracı: aynı DOI'de iki PDF belirsiz, açılmaz", /2 PDF/.test(kaya.cip ?? "") && kaya.tur === "uyari" && !kaya.ac, kaya);
  await s.screenshot({ path: `${OUT}telefon-sol-kaynaklar.png` });
  const kayitAdresi = await s.evaluate(() => [...document.querySelectorAll(".sol-kaynak")].find((e) => e.textContent.includes("Seasonal"))?.querySelector('a[href*="kaynak="]')?.getAttribute("href"));
  kayit("Kaynaklar aracı: her kaynağın kaydına doğrudan bağlantı", kayitAdresi === `/dashboard/literature?calisma=${encodeURIComponent(PR)}&kaynak=${encodeURIComponent(FISHER)}`, { kayitAdresi });
  // Kaynaklar aracından PDF: çekmece tam ekran ve alt gezinmeyi örter
  const li = s.locator(".sol-kaynak", { hasText: "Seasonal" });
  await li.getByRole("button", { name: /PDF'i aç/ }).click();
  await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
  await s.waitForTimeout(800);
  const ortu = await s.evaluate(() => {
    const p = document.querySelector(".kaynak-pdf-paneli").getBoundingClientRect();
    const g = document.querySelector(".os-gezinme");
    const alt = g && g.getClientRects().length && getComputedStyle(g).visibility !== "hidden" ? g : null;
    const ust = alt ? document.elementFromPoint(innerWidth / 2, innerHeight - 10) : null;
    return { panel: { y: Math.round(p.top), h: Math.round(p.height) }, ekran: innerHeight, altGezinmeVar: !!alt, alttakiOge: ust ? (ust.closest(".kaynak-pdf-paneli") ? "panel" : ust.className.slice(0, 40)) : null };
  });
  kayit("telefon: PDF çekmecesi tam ekran, alt gezinmeyi örter", ortu.panel.y <= 1 && ortu.panel.h >= ortu.ekran - 1 && (!ortu.altGezinmeVar || ortu.alttakiOge === "panel"), ortu);
  await s.screenshot({ path: `${OUT}telefon-cekmece-tam-ekran.png` });
  kayit("telefon editör: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}

await b.close();
const gecen = sonuc.filter((x) => x.gecti).length;
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify({ tarih: new Date().toISOString(), gecen, toplam: sonuc.length, sonuc }, null, 2));
console.log(`${gecen}/${sonuc.length} geçti`);
process.exit(gecen === sonuc.length ? 0 : 1);
