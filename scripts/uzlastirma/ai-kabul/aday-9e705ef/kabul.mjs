// GERÇEK AI KABULÜ (21.11.2026, aday 9e705ef). Sentetik çalışma + sentetik test PDF'i, yerel yığın.
// Uygulama sayaç vekili (SINIR=8) üzerinden GERÇEK sağlayıcıya konuşur. Anahtar bu süreçte YOK.
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium } = createRequire(`${KOK}/package.json`)("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const U = process.env.URL ?? "http://localhost:3124", GECIT = "http://127.0.0.1:54401";
const OUT = process.env.CIKTI.replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KUL = T.hesaplar.bireysel;
const sonuclar = [];
const kaydet = (r) => { sonuclar.push(r); console.log(JSON.stringify(r)); fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuclar, null, 2)); };
psql(`delete from public.auth_rate_limits where key in ('ai-asistan:${KUL.id}', 'ai-tamamla:${KUL.id}')`);

const ek = Date.now().toString(36).slice(-5);
const P = (t) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: t }] });
const H = (t) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: t }] });
const calisma = (ad, dil, icerik) => {
  const id = psql(`insert into public.academic_projects (owner_id, project_type, title, status${dil ? ", belge_dili" : ""}) values ('${KUL.id}','thesis',${q(`${ad} ${ek}`)},'writing'${dil ? `, '${dil}'` : ""}) returning id`).split("\n")[0];
  psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${id}', ${q(JSON.stringify({ type: "doc", content: icerik }))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
  return id;
};
const TR = "Üniversiteye yeni başlayan öğrencilerin akademik uyum süreci, ilk dönemdeki akran destek ağlarıyla yakından ilişkilidir. Bu nedenle";
const KISA = "Akran mentorluğu programına katılan 412 öğrencinin birinci yıl sonundaki devam oranı %87 olarak bulunmuştur (Demir, 2019); ancak bu fark ikinci yılda istatistiksel olarak anlamlı değildir ve programın uzun vadeli etkisi henüz kanıtlanmamıştır, bu nedenle sonuçlar dikkatle yorumlanmalıdır.";
const PR_TR = calisma("Gerçek AI TR", null, [H("Giriş"), P(TR), P(KISA)]);
const EN = "First-year students who join peer study groups report a stronger sense of belonging during their first semester, and";
const PR_EN = calisma("Real AI EN", "en", [H("Introduction"), P(EN)]);
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${KUL.id}','${PR_TR}','Peer mentoring and retention','Demir, B.',2019,'Eğitim Dergisi')`);
// Sentetik test PDF'i: bilinen bilgiler bilinen sayfalarda.
const KAYNAK = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title) values ('${KUL.id}','${PR_TR}','Peer mentoring and first-year retention: a synthetic test report','Kaya, A., & Lee, M.',2024,'https://doi.org/10.5555/sentetik.${ek}','Synthetic Test Journal') returning id`).split("\n")[0];
const S2 = "The sample consisted of 412 first-year students from three campuses.";
const S2b = "Data were collected between March and May 2023 using an online questionnaire.";
const S3 = "Retention was 87 percent in the mentoring group and 74 percent in the comparison group.";
const dolgu = (n) => Array.from({ length: 12 }, (_, i) => `Page ${n} filler line ${i + 1}: neutral synthetic text without findings.`);
const pdf = sentetikPdf([
  ["Peer mentoring and first-year retention", "A. Kaya and M. Lee", "", "Introduction. This synthetic report describes a peer mentoring programme.", "It is a test document and contains no real data.", ...dolgu(1)],
  ["Method", S2, S2b, "Participants volunteered and could withdraw at any time.", ...dolgu(2)],
  ["Results", S3, "The difference was observed at the end of the first year only.", ...dolgu(3)],
]);
const yol = `${PR_TR}/kaynak-pdf/gercek-ai-${ek}.pdf`;
await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR_TR}','${KUL.id}',${q("Kaya, A., & Lee, M. (2024). Peer mentoring and first-year retention: a synthetic test report. Synthetic Test Journal.")},${q("gercek-ai-" + ek)},'10.5555/sentetik.${ek}','yuklendi',${q(yol)},'${KAYNAK}')`);

const sonKayit = (pr) => {
  const r = psql(`select json_build_object('capability',capability,'status',status,'reject_reason',reject_reason,'model',model,'output',output,'findings',findings,'duration_ms',duration_ms)::text from public.ai_assistant_runs where project_id='${pr}' order by created_at desc limit 1`);
  return r ? JSON.parse(r) : null;
};
const kayitSayisi = (pr) => Number(psql(`select count(*) from public.ai_assistant_runs where project_id='${pr}'`));
const vekil = () => fs.existsSync(process.env.VEKIL_GUNLUK) ? fs.readFileSync(process.env.VEKIL_GUNLUK, "utf8").split("\n").filter(Boolean).map((s) => JSON.parse(s)) : [];
const vekil401 = () => vekil().some((v) => v.durum === 401);

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
const s = await c.newPage();
await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
const ed = (fn, arg) => s.evaluate(([f, a]) => new Function("e", "a", `return (${f})(e, a)`)(document.querySelector(".ProseMirror").editor, a), [fn.toString(), arg]);
const ac = async (pr) => { await s.goto(`/dashboard/editor/${pr}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(1500); };
const sonaGit = async (bas) => { await s.locator(".ProseMirror").first().click(); await ed((e, a) => { let h = null; e.state.doc.descendants((n, p) => { if (h === null && n.isTextblock && n.textContent.startsWith(a)) h = p + 1 + n.content.size; }); e.commands.focus(); e.commands.setTextSelection(h); }, bas); await s.waitForFunction(() => document.querySelector(".ProseMirror")?.editor?.isFocused === true, null, { timeout: 5000 }); };
const durdu = () => { if (vekil401()) { console.log("401: DURULDU"); kaydet({ deneme: "DUR", sebep: "sağlayıcı 401 döndü; aynı anahtarla tekrar denenmedi" }); return true; } return false; };

// 1–2) Cümle tamamlama (Alt+/), TR ve EN.
for (const [ad, pr, bas, dil] of [["tamamlama-TR", PR_TR, "Üniversiteye", "tr"], ["tamamlama-EN", PR_EN, "First-year", "en"]]) {
  await ac(pr);
  await sonaGit(bas);
  const n0 = kayitSayisi(pr);
  const t0 = Date.now();
  await s.keyboard.press("Alt+/");
  let oneri = null;
  for (let i = 0; i < 300 && !oneri; i++) { await s.waitForTimeout(100); oneri = await s.evaluate(() => document.querySelector(".satir-ici-oneri")?.textContent ?? null); if (!oneri && kayitSayisi(pr) > n0 && i > 20) { const k = sonKayit(pr); if (k && k.status !== "completed") break; } }
  const sure = Date.now() - t0;
  await s.waitForTimeout(500);
  const k = kayitSayisi(pr) > n0 ? sonKayit(pr) : null;
  const bildirim = await s.evaluate(() => document.querySelector(".toast-yigini")?.textContent ?? "");
  await s.screenshot({ path: OUT + `${ad}.png` });
  kaydet({ deneme: ad, girdi: bas === "Üniversiteye" ? TR : EN, dil, gorunenOneri: oneri, sureMs: sure, kayit: k, bildirim: bildirim.slice(0, 300) });
  await s.keyboard.press("Escape");
  if (durdu()) process.exit(3);
}

// 3) Kısaltma (Yazım asistanı → Kısalt), seçili cümle.
await ac(PR_TR);
await s.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
const panel = s.locator("aside.yazim-paneli"); await panel.waitFor();
await ed((e, a) => { let f = null; e.state.doc.descendants((n, p) => { if (f === null && n.isTextblock && n.textContent === a) f = p + 1; }); e.commands.focus(); e.commands.setTextSelection({ from: f, to: f + a.length }); }, KISA);
{
  const n0 = kayitSayisi(PR_TR);
  const once = await panel.locator(".yazim-oneri").count();
  const t0 = Date.now();
  await panel.getByRole("button", { name: /^Kısalt$/ }).click();
  await s.waitForFunction((n) => document.querySelectorAll("aside.yazim-paneli .yazim-oneri").length > n || document.querySelector("aside.yazim-paneli .yazim-hata, aside.yazim-paneli [role=alert]"), once, { timeout: 90000 }).catch(() => {});
  const sure = Date.now() - t0;
  await s.waitForTimeout(500);
  const kart = (await panel.locator(".yazim-oneri").count()) > once ? await panel.locator(".yazim-oneri").last().innerText() : null;
  const uyari = kart ? await panel.locator(".yazim-oneri").last().locator(".yazim-oneri-uyari li").allTextContents() : [];
  const hataMetni = kart ? null : await panel.innerText();
  await s.screenshot({ path: OUT + "kisaltma.png" });
  kaydet({ deneme: "kisaltma", girdi: KISA, kart, uyari, hataMetni: hataMetni?.slice(-400) ?? null, sureMs: sure, kayit: kayitSayisi(PR_TR) > n0 ? sonKayit(PR_TR) : null });
  if (durdu()) process.exit(3);
}

// 4–5) PDF'e soru: cevabı olan ve olmayan.
await ac(PR_TR);
await s.getByRole("button", { name: /Kaynak PDF/ }).first().click();
await s.waitForSelector(".kaynak-pdf-paneli:not([hidden]) .pdf-sayfa .textLayer span", { timeout: 90000 });
await s.getByRole("button", { name: /PDF'e sor/ }).click();
await s.waitForSelector(".pdf-ai-gorunum", { timeout: 10000 });
for (const [ad, soru] of [["pdf-cevapli", "Örneklemde kaç öğrenci vardı ve veriler ne zaman toplandı?"], ["pdf-cevapsiz", "Bu çalışmanın etik kurul onay numarası nedir?"]]) {
  const n0 = kayitSayisi(PR_TR);
  const once = await s.locator(".pdf-ai-gorunum .kaynak-cevap, .pdf-ai-gorunum .kaynak-hata").count();
  const t0 = Date.now();
  await s.locator("#kaynak-pdf-soru").fill(soru);
  await s.locator("#kaynak-pdf-soru").press("Enter");
  await s.waitForFunction((n) => document.querySelectorAll(".pdf-ai-gorunum .kaynak-cevap, .pdf-ai-gorunum .kaynak-hata").length > n, once, { timeout: 90000 }).catch(() => {});
  const sure = Date.now() - t0;
  await s.waitForTimeout(500);
  const ekran = await s.locator(".pdf-ai-gorunum .kaynak-cevap, .pdf-ai-gorunum .kaynak-hata").last().innerText().catch(() => null);
  await s.screenshot({ path: OUT + `${ad}.png` });
  kaydet({ deneme: ad, girdi: soru, ekran, sureMs: sure, kayit: kayitSayisi(PR_TR) > n0 ? sonKayit(PR_TR) : null });
  if (durdu()) process.exit(3);
}
await b.close();
kaydet({ deneme: "vekil", istekler: vekil() });
