// Makale → PDF → alıntı akışı belirtilerinin YEREL, SENTETİK yeniden üretimi (yalnızca 127.0.0.1).
// Kullanım (README): yerel yığın + gecit + model-taklidi + next start -p 3150, sonra depo kökünden:
//   node tasarim/makale-pdf-alinti/betikler/yeniden-uret.mjs   (görseller $CIKTI ya da /tmp/makale-pdf-alinti)
// Not: End tuşundan sonra 1,5 sn beklenir; beklemeden koşunca alıntı bir karakter önceye girdi (betiğin
// insan hızının çok üstünde davranmasından doğan yarış, bkz. PLAN.md B-8).
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd(); // depo kökü
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const U = "http://localhost:3150", GECIT = "http://127.0.0.1:54401";
const OUT = (process.env.CIKTI ?? "/tmp/makale-pdf-alinti").replace(/\/?$/, "/"); fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const S = {}; const not = (k, v) => { S[k] = v; console.log(k, JSON.stringify(v).slice(0, 600)); };
const KUL = T.hesaplar.bireysel;

// ── Tohum: proje + belge + iki kaynak (Fisher: arama içe aktarımı biçiminde; Demir) + Fisher'a bağlı PDF
const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Repro ${ek}','writing') returning id`).split("\n")[0];
const belge = { type: "doc", content: [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] },
  { type: "paragraph", content: [{ type: "text", text: "Mevsimsel örüntüler önceki çalışmalarda şöyle tanımlanmıştır" }] },
] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, 'Giriş Mevsimsel') on conflict (project_id) do update set content = excluded.content`);
// aramaKaydiniEkle ile aynı biçim: yazarlar ", " ile birleşik "Ad Soyad", dergi ham (&amp;), cilt/sayı/sayfa yok
const FISHER = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}','Seasonal patterns in synthetic data','Edward W. Fisher, Jane Other',2023,'https://doi.org/10.5555/fisher.2023','Journal of Science &amp; Society') returning id`).split("\n")[0];
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${KUL.id}','${PR}','Peer study groups in higher education','Demir, B.',2019,'Synthetic Review of Education')`);
const CUMLE = "Seasonal variation explained most of the observed difference across the three regions.";
const pdf = sentetikPdf([["Seasonal patterns in synthetic data", "Edward W. Fisher and Jane Other", "", CUMLE, "A second sentence closes the synthetic abstract for testing."]]);
const yol = `${PR}/kaynak-pdf/repro-${ek}.pdf`;
const yuk = await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
not("tohum.depo", yuk.status);
const kunye = "Fisher, E. W., & Other, J. (2023). Seasonal patterns in synthetic data. Journal of Science & Society.";
const PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}',${q(kunye)},${q("repro-" + ek)},'10.5555/fisher.2023','yuklendi',${q(yol)},'${FISHER}') returning id`).split("\n")[0];
not("tohum", { PR, FISHER, PDF });

const b = await chromium.launch();
async function baglam(w, h = 900) {
  const c = await b.newContext({ baseURL: U, viewport: { width: w, height: h } });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s };
}

async function secPdf(s, cumle, kes = 0) {
  const k = await s.evaluate((c) => { const sp = [...document.querySelectorAll(".pdf-sayfa .textLayer span")].find((x) => x.textContent.includes(c.slice(0, 30))); if (!sp) return null; sp.scrollIntoView({ block: "center" }); const r = sp.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; }, cumle);
  if (!k) return false;
  await s.mouse.move(k.x + 1, k.y); await s.mouse.down(); await s.mouse.move(k.x + k.w - 1 - kes, k.y, { steps: 8 }); await s.mouse.up();
  await s.waitForTimeout(600);
  return s.evaluate(() => getSelection().toString());
}
const tasma = (s) => s.evaluate(() => {
  const d = document.documentElement; const genis = [];
  for (const e of document.querySelectorAll("body *")) { const r = e.getBoundingClientRect(); if (r.right > d.clientWidth + 1 && r.width > 0 && getComputedStyle(e).position !== "fixed") genis.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")} r=${Math.round(r.right)}`); }
  const kaydiranlar = [...document.querySelectorAll("body *")].filter((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")} ${e.scrollWidth}/${e.clientWidth}`);
  return { sayfa: `${d.scrollWidth}/${d.clientWidth}`, tasan: genis.slice(0, 6), icKaydirma: kaydiranlar.slice(0, 6) };
});

// R1 Kaynaklar yatay kaydırma
for (const w of [1440, 1280, 390]) {
  const { c, s } = await baglam(w, w === 390 ? 844 : 900);
  await s.goto(`/dashboard/literature?calisma=${PR}`); await s.waitForLoadState("networkidle").catch(() => {});
  not(`R1.kaynaklar.${w}`, await tasma(s));
  await s.screenshot({ path: `${OUT}r1-kaynaklar-${w}.png` });
  await c.close();
}

// R2 PDF okuyucu genişlikleri
for (const w of [1280, 1440]) {
  const { c, s } = await baglam(w);
  await s.goto(`/dashboard/editor/${PR}/write?sag=pdf`);
  await s.waitForSelector(".kaynak-pdf-paneli", { timeout: 60000 });
  const sec = s.locator(".kaynak-pdf-paneli select").first();
  if (await sec.count()) await sec.selectOption(PDF).catch(() => {});
  await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 90000 }).catch(() => {});
  await s.waitForTimeout(800);
  const olc = () => s.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), sh: e.scrollHeight, ch: e.clientHeight }; };
    return { panel: r(".kaynak-pdf-paneli"), alan: r(".pdf-sayfa-alani"), tuval: r(".pdf-sayfa canvas"), alt: r(".kaynak-pdf-alt"), kagit: r(".manuscript-editor-content"), dugmeler: document.querySelectorAll(".kaynak-pdf-paneli button:not([hidden])").length };
  });
  not(`R2.pdf.${w}.acilis`, await olc());
  await s.screenshot({ path: `${OUT}r2-pdf-${w}-acilis.png` });
  // Metin seçimi: cümleyi taşıyan span
  const secildi = await secPdf(s, CUMLE);
  await s.waitForTimeout(800);
  not(`R2.pdf.${w}.secim`, { secildi, ...(await olc()) });
  await s.screenshot({ path: `${OUT}r2-pdf-${w}-secim.png` });
  if (w === 1440) {
    // R3 alıntı + atıf ekleme: imleci paragraf sonuna koy
    await s.locator(".ProseMirror p").first().click();
    await s.keyboard.press("End"); await s.waitForTimeout(1500);
    not("R3.pmOnce", await s.evaluate(() => { const e = document.querySelector(".ProseMirror")?.editor; if (!e) return "editor yok"; const { from, to } = e.state.selection; return { from, to, sonuc: e.state.doc.content.size, onceki: e.state.doc.textBetween(Math.max(0, from - 3), from) }; })); not("R3.imlecOnce", await s.evaluate(() => { const sl = getSelection(); return { metin: sl.anchorNode?.textContent?.length, ofset: sl.anchorOffset }; }));
    not("R3.secilen", await secPdf(s, CUMLE));
    await s.waitForTimeout(500);
    const toastlar = [];
    const izle = setInterval(async () => { const t = await s.locator("[role=status], [role=alert], .toast, .bildirim").allInnerTexts().catch(() => []); for (const x of t) if (x.trim() && !toastlar.includes(x.trim())) toastlar.push(x.trim()); }, 150);
    not("R3.pmSecimSonrasi", await s.evaluate(() => { const e = document.querySelector(".ProseMirror")?.editor; if (!e) return "editor yok"; const { from, to } = e.state.selection; return { from, to, sonuc: e.state.doc.content.size, onceki: e.state.doc.textBetween(Math.max(0, from - 3), from) }; }));
    const al = s.getByRole("button", { name: /Alıntı ve atıf ekle/ });
    not("R3.alintiDugmesi", await al.count());
    if (await al.count()) {
      await al.click();
      await s.waitForTimeout(2500);
      not("R3.form", await olc());
      await s.screenshot({ path: `${OUT}r3-form.png` });
      const kutu = s.getByLabel(/seçtiğim kaynak olduğunu kontrol ettim/); if (await kutu.count()) await kutu.check();
      const alintiKutu = s.getByLabel(/Doğrulanmış alıntıyı da ekle/); if (await alintiKutu.count()) await alintiKutu.check();
      await s.getByRole("button", { name: /İmlece ekle/ }).click();
      await s.waitForTimeout(3500);
      const metin1 = await s.locator(".ProseMirror").innerText();
      not("R3.belge1", metin1);
      await s.screenshot({ path: `${OUT}r3-sonra.png` });
      // İkinci kez aynı kaynağa atıf: kaynakça tekrarı
      not("R3.secilen", await secPdf(s, CUMLE));
      await s.waitForTimeout(500);
      if (await al.count()) { await al.click(); await s.waitForTimeout(2500); const k2 = s.getByLabel(/seçtiğim kaynak olduğunu kontrol ettim/); if (await k2.count()) await k2.check(); const a2 = s.getByLabel(/Doğrulanmış alıntıyı da ekle/); if (await a2.count()) await a2.uncheck(); await s.getByRole("button", { name: /İmlece ekle/ }).click().catch(() => {}); await s.waitForTimeout(3500); }
      const metin2 = await s.locator(".ProseMirror").innerText();
      not("R3.belge2", metin2);
      not("R3.fisherKunyeSayisi", (metin2.match(/Seasonal patterns in synthetic data/g) ?? []).length);
    }
    clearInterval(izle);
    not("R3.bildirimler", toastlar);
    await s.screenshot({ path: `${OUT}r3-son.png` });
  }
  await c.close();
}

// R4 PDF uç noktasının yanıt başlığı (okuyucu fetch eder; "aç" düğmesi imzalı adresi pencerede açar)
{
  const { c, s } = await baglam(1280);
  const r = await c.request.get(`/api/kaynak-pdf/${PDF}`);
  not("R4.uc", { durum: r.status(), tur: r.headers()["content-type"], ek: r.headers()["content-disposition"] });
  await c.close();
}

// R5 Yazım asistanı: "Seçilenin yerine koy" → Ctrl+Z → kart durumu
{
  const { c, s } = await baglam(1440);
  await s.goto(`/dashboard/editor/${PR}/write?sag=ai`);
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  await s.locator(".ProseMirror p").first().click({ clickCount: 3 });
  const kutu = s.locator(".yazim-paneli textarea, [class*=yazim] textarea").first();
  await kutu.waitFor({ timeout: 30000 }).catch(() => {});
  if (await kutu.count()) {
    await kutu.fill("Bu paragrafı akademik biçimde yeniden yaz.");
    await kutu.press("Enter");
    const koy = s.getByRole("button", { name: /Seçilenin yerine koy/ }).first();
    await koy.waitFor({ timeout: 30000 }).catch(() => {});
    if (await koy.count()) {
      await koy.click(); await s.waitForTimeout(600);
      const sonra = { belge: await s.locator(".ProseMirror").innerText(), koyEtkin: await koy.isEnabled(), ekleMetni: await s.getByRole("button", { name: /Eklendi|İmlece ekle/ }).first().innerText().catch(() => null) };
      await s.locator(".ProseMirror").first().focus(); await s.keyboard.press("Control+z"); await s.waitForTimeout(600);
      const geri = { belge: await s.locator(".ProseMirror").innerText(), koyEtkin: await koy.isEnabled(), ekleMetni: await s.getByRole("button", { name: /Eklendi|İmlece ekle/ }).first().innerText().catch(() => null) };
      not("R5.ai", { sonra, geri });
      await s.screenshot({ path: `${OUT}r5-geri-al.png` });
    } else not("R5.ai", "cevap düğmesi gelmedi");
  } else not("R5.ai", "yazma alanı bulunamadı");
  await c.close();
}
await b.close();
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify(S, null, 2));
