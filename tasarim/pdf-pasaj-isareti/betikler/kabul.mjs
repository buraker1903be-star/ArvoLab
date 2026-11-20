// PDF PASAJ İŞARETİ KABULÜ (20.11.2026). Yalnızca 127.0.0.1, sentetik hesap ve veri.
// Ön koşul: yerel yığın (scripts/yerel-yigin) + gecit.mjs + model-taklidi.mjs +
// `next start -p 3150`; tohum hesapları tasarim/tek-deneyim/betikler/tohum.json.
// Depo kökünden:
//   GERCEK_PDF=<iki sütunlu gerçek PDF> node tasarim/pdf-pasaj-isareti/betikler/kabul.mjs
// Görseller: $CIKTI (varsayılan /tmp/pasaj-isareti). Çıkış: 0 hepsi geçti, 1 en az biri düştü.
//
// Neyi sınar: PDF'ten belgeye eklenen pasajın fosforlu sarı işareti (lib/tiptap-pdf-dayanak.ts)
//   1. ekleme → işaret; yalnızca seçim → işaret YOK
//   2. kayıt veritabanına iner; yenileme ve YENİ OTURUM sonrası işaret yerinde; çekmece kapat/aç
//   3. aynı PDF'te iki pasaj birlikte; "Yalnızca atıf" (pasaja bağlı) da işaretler
//   4. geri al → işaret gider, yinele → geri gelir; atfı silmek işareti götürür
//   5. yakınlaştırma ve çekmece genişliği değişince işaret metinle aynı span'larda
//   6. "Dayanağa git" doğru sayfa + pasaj
//   7. PDF dosyası değişince eski işaret yeni dosyada GÖSTERİLMEZ, uyarı çıkar
//   8. gerçek iki sütunlu PDF'te işaret seçilen sütunda kalır, yakınlaştırmada hizalı
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const U = "http://localhost:3150", GECIT = "http://127.0.0.1:54401";
const OUT = (process.env.CIKTI ?? "/tmp/pasaj-isareti").replace(/\/?$/, "/");
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
const yukle = (yol, govde) => fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: govde });

// ── Tohum
const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis','Pasaj işareti ${ek}','writing') returning id`).split("\n")[0];
const METIN = "Mevsimsel örüntüler önceki çalışmalarda şöyle tanımlanmıştır";
const IKINCI = "İkinci paragraf ayrıca şunu söyler";
const belge = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, { type: "paragraph", attrs: {}, content: [{ type: "text", text: METIN }] }, { type: "paragraph", attrs: {}, content: [{ type: "text", text: IKINCI }] }, ...Array.from({ length: 6 }, (_, i) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: `Dolgu paragrafı ${i + 1}.` }] }))] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, ${q(METIN)}) on conflict (project_id) do update set content = excluded.content`);
const FISHER = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}','Seasonal patterns in synthetic data','Fisher, E. W., & Other, J.',2023,'https://doi.org/10.5555/pasaj.${ek}','Journal of Science & Society') returning id`).split("\n")[0];
const CUMLE = "Seasonal variation explained most of the observed difference across the three regions.";
const CUMLE2 = "Rainfall alone did not account for the gap between the coastal stations.";
const satirlar = (n) => Array.from({ length: 40 }, (_, i) => `Page ${n} line ${i + 1}: synthetic body text for scrolling inside the reader drawer.`);
const PDF_BAYT = sentetikPdf([["Seasonal patterns in synthetic data", "Edward W. Fisher and Jane Other", "", CUMLE, "A second sentence closes the synthetic abstract for testing.", ...satirlar(1).slice(0, 30)], [CUMLE2, ...satirlar(2)], satirlar(3)]);
const yol = `${PR}/kaynak-pdf/pasaj-${ek}.pdf`;
await yukle(yol, PDF_BAYT);
const PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}',${q("Fisher, E. W., & Other, J. (2023). Seasonal patterns in synthetic data.")},${q("pasaj-" + ek)},'10.5555/pasaj.${ek}','yuklendi',${q(yol)},'${FISHER}') returning id`).split("\n")[0];
console.log("tohum", { PR, PDF });

const b = await chromium.launch();
async function baglam(secenek = {}) {
  const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 }, ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hatalar };
}
const ed = (s, fn, arg) => s.evaluate(([f, a]) => new Function("e", "a", `return (${f})(e, a)`)(document.querySelector(".ProseMirror").editor, a), [fn.toString(), arg]);
const sonaGit = (s, bas) => ed(s, (e, a) => { let h = null; e.state.doc.descendants((n, p) => { if (h === null && n.isTextblock && n.textContent.startsWith(a)) h = p + 1 + n.content.size; }); e.commands.focus(); e.commands.setTextSelection(h); }, bas);
const editoruAc = async (s) => {
  await s.goto(`/dashboard/editor/${PR}/write`);
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(1200);
};
const pdfiAc = async (s) => {
  await s.getByRole("button", { name: /Kaynak PDF/ }).first().click();
  await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
  await s.waitForTimeout(900);
};
const pdfiKapat = async (s) => {
  await s.getByRole("button", { name: /Kaynak panelini kapat/ }).click();
  await s.waitForTimeout(500);
};
async function secPdf(s, metin) {
  const k = await s.evaluate((c) => { const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].find((x) => x.textContent.includes(c.slice(0, 30))); if (!sp) return null; sp.scrollIntoView({ block: "center" }); const r = sp.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; }, metin);
  if (!k) return null;
  await s.mouse.move(k.x + 1, k.y); await s.mouse.down(); await s.mouse.move(k.x + k.w - 1, k.y, { steps: 8 }); await s.mouse.up();
  await s.waitForTimeout(500);
  return s.evaluate(() => getSelection().toString());
}
/* Çizili sayfalarda sarı işaretli span'ların metni (sayfa numarasıyla). */
const isaretliler = (s) => s.evaluate(() => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer")].map((k) => ({ sayfa: k.dataset.sayfa, metin: [...k.querySelectorAll("span.pdf-kalici")].map((x) => x.textContent).join("") })).filter((x) => x.metin));
const bekleIsaret = (s, parca, var_ = true) => s.waitForFunction(([p, v]) => [...document.querySelectorAll(".kaynak-pdf-paneli span.pdf-kalici")].some((x) => x.textContent.includes(p)) === v, [parca.slice(0, 25), var_], { timeout: 8000 }).then(() => true).catch(() => false);
const belgedekiDayanak = (s) => ed(s, (e) => { const r = []; e.state.doc.descendants((n) => { for (const m of n.marks) if (m.type.name === "pdfDayanak") r.push(m.attrs); }); return r; });
const dbDayanak = () => Number(psql(`select count(*) from jsonb_path_query(coalesce((select content from public.project_manuscripts where project_id='${PR}'),'{}'::jsonb), 'strict $.**.marks[*] ? (@.type == "pdfDayanak")')`));
const bekleDb = async (kosul) => { for (let i = 0; i < 40; i++) { const n = dbDayanak(); if (kosul(n)) return n; await new Promise((r) => setTimeout(r, 500)); } return dbDayanak(); };
const ekle = async (s, metin, dugme) => {
  await secPdf(s, metin);
  await s.getByRole("button", { name: dugme }).click();
  await s.waitForSelector(".pdf-onay", { timeout: 30000 });
  await s.waitForSelector(".pdf-onay-atif", { timeout: 15000 });
  await s.locator(".pdf-onay").getByRole("button", { name: /^Ekle$/ }).click();
  await s.waitForTimeout(1500);
};

// ── 1–4: masaüstü ana akış
{
  const { c, s, hatalar } = await baglam();
  await editoruAc(s);
  await sonaGit(s, METIN.slice(0, 20));
  await pdfiAc(s);

  // Yalnızca seçim: işaret yok.
  await secPdf(s, CUMLE);
  await s.keyboard.press("Escape");
  await s.waitForTimeout(400);
  kayit("yalnızca seçim kalıcı işaret oluşturmaz", (await isaretliler(s)).length === 0 && (await belgedekiDayanak(s)).length === 0, {});

  // Alıntı ekle → sarı işaret.
  await ekle(s, CUMLE, /^Alıntı ekle$/);
  const ilk = await bekleIsaret(s, CUMLE);
  const dayanak1 = await belgedekiDayanak(s);
  kayit("alıntı eklenince pasaj fosforlu sarı işaretli", ilk && (await isaretliler(s)).some((x) => x.sayfa === "1" && x.metin.replace(/\s+/g, " ").includes(CUMLE)), await isaretliler(s));
  kayit("işaret çalışma belgesinde: PDF kimliği, dosya özeti, PDF sayfası, pasaj, kaynak", dayanak1.length >= 2 && dayanak1.every((d) => d.pdf === PDF && /^sha256:[0-9a-f]{32}$/.test(d.surum) && d.sayfa === 1 && d.pasaj === CUMLE && d.kaynak === FISHER), dayanak1.slice(0, 1));
  const renk = await s.evaluate(() => getComputedStyle(document.querySelector(".kaynak-pdf-paneli span.pdf-kalici")).backgroundColor);
  kayit("işaret rengi fosforlu sarı token'ı", /rgba\(255, 242, 0/.test(renk), { renk });
  await s.screenshot({ path: `${OUT}1-eklendi.png` });

  // Geri al / yinele (editörün kendi geçmişi).
  await ed(s, (e) => e.commands.undo());
  const geriAlindi = await bekleIsaret(s, CUMLE, false);
  kayit("geri al: alıntı ve işaret birlikte gider", geriAlindi && !(await s.locator(".ProseMirror").innerText()).includes(CUMLE), {});
  await ed(s, (e) => e.commands.redo());
  kayit("yinele: işaret geri gelir", await bekleIsaret(s, CUMLE), {});

  // İkinci pasaj (sayfa 2), "Yalnızca atıf" ile — pasaja bağlı atıf da işaretlenir.
  await sonaGit(s, IKINCI.slice(0, 20));
  await s.getByRole("button", { name: "Sonraki sayfa" }).click();
  await s.waitForFunction((p) => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].some((x) => x.textContent.includes(p)), CUMLE2.slice(0, 20), { timeout: 30000 });
  await ekle(s, CUMLE2, /^Yalnızca atıf$/);
  const ikinci = await bekleIsaret(s, CUMLE2);
  const dayanak2 = await belgedekiDayanak(s);
  kayit("aynı PDF'te ikinci pasaj (Yalnızca atıf): ikisi de belgede ayrı işaret", ikinci && new Set(dayanak2.map((d) => `${d.sayfa}|${d.pasaj}`)).size === 2, { sayfalar: [...new Set(dayanak2.map((d) => d.sayfa))] });
  kayit("yalnızca atıf: alıntı metni belgeye girmedi", !(await s.locator(".ProseMirror").innerText()).includes(CUMLE2), {});
  await s.screenshot({ path: `${OUT}2-ikinci-pasaj.png` });

  // Kayıt veritabanına iner.
  const db = await bekleDb((n) => n >= 3);
  kayit("işaret veritabanındaki belgeye kaydedildi (tarayıcı belleğine dayanmıyor)", db >= 3, { db });

  // Çekmece kapat / aç.
  await pdfiKapat(s);
  await pdfiAc(s);
  // Çekmece son okunan sayfada (2) açılır: o sayfanın işareti yerinde olmalı.
  kayit("çekmece kapatıp açınca işaret yerinde", await bekleIsaret(s, CUMLE2), await isaretliler(s));

  // Yakınlaştırma ve çekmece genişliği: işaret aynı metin span'larında, kutular metinle çakışık.
  const olc = () => s.evaluate(() => { const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer[data-sayfa='1'] span.pdf-kalici")]; return { metin: sp.map((x) => x.textContent).join(""), kutu: sp.map((x) => { const r = x.getBoundingClientRect(); return Math.round(r.width); }) }; });
  await s.getByRole("button", { name: "Önceki sayfa" }).click().catch(() => {});
  await bekleIsaret(s, CUMLE);
  const o1 = await olc();
  await s.getByRole("button", { name: "Yakınlaştır" }).click();
  await s.getByRole("button", { name: "Yakınlaştır" }).click();
  await s.waitForTimeout(1200);
  await bekleIsaret(s, CUMLE);
  const o2 = await olc();
  kayit("yakınlaştırma: işaret aynı metinde, kutular ölçekle büyüdü", o1.metin === o2.metin && o1.metin.length > 0 && o2.kutu.reduce((a, x) => a + x, 0) > o1.kutu.reduce((a, x) => a + x, 0) * 1.1, { o1, o2 });
  await s.screenshot({ path: `${OUT}3-yakinlastirma.png` });
  await s.getByRole("button", { name: "Genişliğe sığdır" }).click();
  await s.setViewportSize({ width: 1280, height: 900 });
  await s.waitForTimeout(1200);
  await bekleIsaret(s, CUMLE);
  const o3 = await olc();
  kayit("yeniden boyutlandırma: işaret aynı metinde", o3.metin === o1.metin, { o3 });
  await s.setViewportSize({ width: 1440, height: 900 });
  kayit("ana akış: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
}

// ── Yeni oturum: yenileme sonrası işaret, Dayanağa git, atfı silmek
{
  const { c, s, hatalar } = await baglam();
  await editoruAc(s);
  const dayanak = await belgedekiDayanak(s);
  kayit("yeni oturum: belge işaretlerle açıldı", dayanak.length >= 3, { n: dayanak.length });
  // Atıf kartı → Dayanağa git (sayfa 2 pasajı).
  const atif = await ed(s, (e) => { let r = null; e.state.doc.descendants((n, p) => { if (r === null && n.isText && n.marks.some((m) => m.type.name === "pdfDayanak" && m.attrs.sayfa === 2)) r = p + 2; }); return r; });
  await ed(s, (e, a) => { e.commands.focus(); e.commands.setTextSelection(a); }, atif);
  const k = await s.evaluate((a) => { const e = document.querySelector(".ProseMirror").editor; const c = e.view.coordsAtPos(a); return { x: c.left + 2, y: (c.top + c.bottom) / 2 }; }, atif);
  await s.mouse.click(k.x, k.y);
  await s.waitForSelector(".atif-karti", { timeout: 10000 });
  await s.locator(".atif-karti").getByRole("button", { name: /Dayanağa git/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
  const dugmeler = await s.locator(".atif-karti").getByRole("button", { name: /Dayanağa git/ }).allTextContents();
  kayit("yenileme sonrası atıf kartında Dayanağa git (iki pasaj)", dugmeler.length === 2 && dugmeler.some((x) => /s\. 2/.test(x)), { dugmeler });
  await s.locator(".atif-karti").getByRole("button", { name: /Dayanağa git · s\. 2/ }).click();
  await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .textLayer[data-sayfa='2'] span.pdf-pasaj", { timeout: 60000 }).catch(() => {});
  const gidis = await s.evaluate(() => ({ sayfa: document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-girdi input, .kaynak-pdf-paneli input[aria-label*='Sayfa']")?.value ?? null, pasaj: [...document.querySelectorAll(".kaynak-pdf-paneli span.pdf-pasaj")].map((x) => x.textContent).join(""), kalici: [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer[data-sayfa='2'] span.pdf-kalici")].map((x) => x.textContent).join("") }));
  kayit("Dayanağa git: 2. sayfa açıldı, pasaj vurgulu ve kalıcı işaretli", gidis.pasaj.includes(CUMLE2.slice(0, 30)) && gidis.kalici.includes(CUMLE2.slice(0, 30)), gidis);
  await s.screenshot({ path: `${OUT}4-dayanaga-git.png` });

  // Atfı (sayfa 2) sil → işareti gider, sayfa 1 işareti kalır.
  await ed(s, (e) => { let bas = -1, son = -1; e.state.doc.descendants((n, p) => { if (n.isText && n.marks.some((m) => m.type.name === "pdfDayanak" && m.attrs.sayfa === 2)) { if (bas < 0) bas = p; son = p + n.nodeSize; } }); e.chain().focus().deleteRange({ from: bas, to: son }).run(); });
  const silindi = await s.waitForFunction(() => ![...document.querySelectorAll(".kaynak-pdf-paneli .textLayer[data-sayfa='2'] span.pdf-kalici")].length, null, { timeout: 8000 }).then(() => true).catch(() => false);
  const kalan = await belgedekiDayanak(s);
  kayit("atfı silmek işaretini götürür; öteki pasaj kalır", silindi && kalan.length > 0 && kalan.every((d) => d.sayfa === 1), { kalan: kalan.length });
  const db = await bekleDb((n) => n > 0 && n < 3);
  kayit("silme de kaydedildi", db > 0 && db < 3, { db });
  kayit("yeni oturum: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
}

// ── PDF değişti: aynı satır, başka bayt → eski işaret gösterilmez, uyarı çıkar.
{
  await yukle(yol, sentetikPdf([["Seasonal patterns in synthetic data — revised", "", CUMLE, "Revised abstract text.", ...satirlar(1).slice(0, 20)], satirlar(2)]));
  const { c, s, hatalar } = await baglam();
  await editoruAc(s);
  await pdfiAc(s);
  await s.waitForTimeout(1500);
  const uyari = await s.locator(".kaynak-pdf-paneli .pdf-durum[role=status]").allTextContents();
  const isaret = await isaretliler(s);
  kayit("PDF değişince eski işaret yeni dosyada sessizce uygulanmaz", isaret.length === 0, { isaret });
  kayit("PDF değişince kullanıcıya söylenir", uyari.some((x) => /değişmiş/.test(x) && /eski sürüm/.test(x)), { uyari });
  await s.screenshot({ path: `${OUT}5-pdf-degisti.png` });
  kayit("PDF değişti: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
}

// ── Gerçek, iki sütunlu akademik PDF (yerel dosya: GERCEK_PDF; depoda yok)
if (process.env.GERCEK_PDF && fs.existsSync(process.env.GERCEK_PDF)) {
  const yol2 = `${PR}/kaynak-pdf/gercek-${ek}.pdf`;
  await yukle(yol2, fs.readFileSync(process.env.GERCEK_PDF));
  const K2 = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR}','Trace-based just-in-time type specialization for dynamic languages','Gal, A.; Eich, B.; Shaver, M.',2009,'https://doi.org/10.1145/1542476.1542528','Proceedings of PLDI') returning id`).split("\n")[0];
  const P2 = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${KUL.id}','Gal, A., Eich, B., & Shaver, M. (2009). Trace-based just-in-time type specialization for dynamic languages. Proceedings of PLDI.',${q("gercek-" + ek)},'10.1145/1542476.1542528','yuklendi',${q(yol2)},'${K2}') returning id`).split("\n")[0];
  const { c, s, hatalar } = await baglam();
  await editoruAc(s);
  await sonaGit(s, IKINCI.slice(0, 20));
  await pdfiAc(s);
  await s.locator(".pdf-cekmece-secici select").selectOption(P2);
  await s.waitForFunction(() => [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].some((x) => x.textContent.includes("Dynamic languages")), null, { timeout: 90000 });
  await s.waitForTimeout(800);
  // Sol sütunda iki satırlık seçim.
  const k = await s.evaluate(() => {
    const sp = [...document.querySelectorAll(".kaynak-pdf-paneli .textLayer span")].filter((x) => x.textContent.trim());
    const i = sp.findIndex((x) => x.textContent.includes("Dynamic languages"));
    sp[i].scrollIntoView({ block: "center" });
    const ilk = sp[i].getBoundingClientRect();
    const alt = sp.slice(i + 1).filter((x) => Math.abs(x.getBoundingClientRect().left - ilk.left) < 30 && x.getBoundingClientRect().top > ilk.top + 1.5 * ilk.height)[1].getBoundingClientRect();
    return { x1: ilk.left + 1, y1: ilk.top + ilk.height / 2, x2: alt.left + alt.width * 0.6, y2: alt.top + alt.height / 2 };
  });
  await s.mouse.move(k.x1, k.y1); await s.mouse.down(); await s.mouse.move(k.x2, k.y2, { steps: 12 }); await s.mouse.up();
  await s.waitForTimeout(600);
  await s.getByRole("button", { name: /^Alıntı ekle$/ }).click();
  const durum = await Promise.race([
    s.waitForSelector(".pdf-onay .pdf-onay-atif", { timeout: 30000 }).then(() => "onay"),
    s.waitForSelector(".pdf-onay .kaynak-hata", { timeout: 30000 }).then(() => "hata"),
  ]).catch(() => "zaman");
  if (durum === "onay") {
    await s.locator(".pdf-onay").getByRole("button", { name: /^Ekle$/ }).click();
    await bekleIsaret(s, "Dynamic languages");
    /* Sütun: işaretli span'ların sol kenarı sayfanın sol yarısında olmalı. */
    const sutun = () => s.evaluate(() => {
      const k = document.querySelector(".kaynak-pdf-paneli .textLayer[data-sayfa='1']");
      const kr = k.getBoundingClientRect();
      const sp = [...k.querySelectorAll("span.pdf-kalici")];
      return { n: sp.length, metin: sp.map((x) => x.textContent).join(" ").slice(0, 160), sagYari: sp.filter((x) => x.getBoundingClientRect().left > kr.left + kr.width / 2).length };
    });
    const s1 = await sutun();
    kayit("gerçek iki sütunlu PDF: işaret seçilen sütunda (sağ sütuna taşmıyor)", s1.n > 0 && s1.sagYari === 0 && s1.metin.startsWith("Dynamic languages"), s1);
    await s.screenshot({ path: `${OUT}6-gercek-pdf.png` });
    await s.getByRole("button", { name: "Yakınlaştır" }).click();
    await s.getByRole("button", { name: "Yakınlaştır" }).click();
    await s.waitForTimeout(1500);
    await bekleIsaret(s, "Dynamic languages");
    const s2 = await sutun();
    kayit("gerçek iki sütunlu PDF: yakınlaştırmada aynı metin, aynı sütun", s2.metin === s1.metin && s2.sagYari === 0, s2);
    await s.screenshot({ path: `${OUT}7-gercek-pdf-yakin.png` });
  } else kayit("gerçek iki sütunlu PDF: alıntı doğrulandı", false, { durum });
  kayit("gerçek PDF: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
} else kayit("gerçek PDF dosyası verilmedi (GERCEK_PDF) — senaryo koşmadı", false, {});

await b.close();
fs.writeFileSync(`${OUT}sonuc.json`, JSON.stringify(sonuc, null, 2));
const gecen = sonuc.filter((x) => x.gecti).length;
console.log(`${gecen}/${sonuc.length} geçti`);
process.exit(gecen === sonuc.length ? 0 : 1);
