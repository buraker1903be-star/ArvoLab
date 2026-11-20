// M4 kabulü: AI kartı geri almada yeniden etkinleşir, kısaltma uyarısı, B-16
// (AI metnindeki eşleşen atıf Kaynakça'ya, belirsiz eşleşme eklenmez).
// Yerel yığın + model taklidi + `next start -p 3150`. Depo kökünden:
//   node tasarim/ai-kart/betikler/kabul.mjs
// Cevaplar MODEL TAKLİDİNDEN (scripts/yerel-yigin/model-taklidi.mjs); gerçek model değil.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium } = createRequire(`${KOK}/package.json`)("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/ai-kart-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const KUL = T.hesaplar.bireysel;
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };
// Yerel tohum hesabının saatlik asistan sayacı (yalnızca yerel yığın).
psql(`delete from public.auth_rate_limits where key = 'ai-asistan:${KUL.id}'`);

const ek = Date.now().toString(36).slice(-5);
const P = (t) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: t }] });
const SECIM = "Akran grupları yalnızlığı azaltmaktadır (Demir, 2019); ancak bu etki 3 ay sonra gözlenmemiştir ve kalıcı değildir.";
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis',${q(`AI kart ${ek}`)},'writing') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, P("Birinci sınıf öğrencilerinin uyumu."), P(SECIM)] }))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
// Kütüphane: "Demir (2019)" aynı eserin İKİ kopyası (belirsizlik sayılmamalı),
// "Aras (2020)" iki AYRI eser (belirsiz).
// Yalnızca bu betiğin eklediği başlıklar silinir; başka betiklerin tohumuna dokunulmaz.
psql(`delete from public.literature_sources where owner_id='${KUL.id}' and title in ('Akran çalışma grupları ve yalnızlık', 'Birinci Aras çalışması', 'İkinci Aras çalışması')`);
for (const [yazar, yil, baslik] of [["Demir, B.", 2019, "Peer study groups in higher education"], ["Demir, B.", 2019, "Peer study groups in higher education"], ["Aras, D.", 2020, "Birinci Aras çalışması"], ["Aras, E.", 2020, "İkinci Aras çalışması"]])
  psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${KUL.id}','${PR}',${q(baslik)},${q(yazar)},${yil},'Eğitim Dergisi')`);

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
const s = await c.newPage();
const hatalar = [];
s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
await s.goto(`/dashboard/editor/${PR}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(1200);
const ed = (fn, arg) => s.evaluate(([f, a]) => new Function("e", "a", `return (${f})(e, a)`)(document.querySelector(".ProseMirror").editor, a), [fn.toString(), arg]);
const metin = () => ed((e) => e.state.doc.textBetween(0, e.state.doc.content.size, "\n"));
const kaynakca = async () => ((await metin()).split(/\nKaynakça\n/)[1] ?? "");
const paragrafSonu = (bas) => ed((e, a) => { let h = null; e.state.doc.descendants((n, p) => { if (h === null && n.isTextblock && n.textContent.startsWith(a)) h = p + 1 + n.content.size; }); e.commands.focus(); e.commands.setTextSelection(h); }, bas);
const panel = s.locator("aside.yazim-paneli");
const sonKart = () => panel.locator(".yazim-oneri").last();
async function iste(metinIstek) {
  const once = await panel.locator(".yazim-oneri").count();
  await panel.locator("textarea").fill(metinIstek);
  await panel.getByRole("button", { name: "Gönder" }).click();
  await s.waitForFunction((n) => document.querySelectorAll("aside.yazim-paneli .yazim-oneri").length > n, once, { timeout: 15000 });
}

await s.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
await panel.waitFor();

// 1) B-16: eşleşen atıf → metin + Kaynakça girdisi.
await paragrafSonu("Birinci sınıf");
await iste("Akran grupları hakkında bir cümle yaz.");
const ekleDugme = () => sonKart().getByRole("button", { name: /İmlece ekle|Eklendi/ });
await ekleDugme().click(); await s.waitForTimeout(500);
const k1 = await kaynakca();
kayit("B-16: AI metni girer, eşleşen kaynak Kaynakça'ya yazılır", (await metin()).includes("(Demir, 2019).") && /Demir, B\. \(2019\)/.test(k1), { kaynakca: k1.slice(0, 160) });
kayit("kart 'Eklendi' olur ve kilitlenir", (await ekleDugme().textContent()).includes("Eklendi") && (await ekleDugme().isDisabled()));
await s.screenshot({ path: OUT + "eklendi.png" });

// 2) Ctrl+Z: metin ve künye birlikte gider; kart yeniden etkin.
await ed((e) => e.commands.focus());
await s.keyboard.press("Control+z"); await s.waitForTimeout(700);
const m2 = await metin();
kayit("tek Ctrl+Z metni ve künyeyi birlikte geri alır", !m2.includes("Akran çalışma grupları birinci") && !/Demir, B\. \(2019\)/.test(m2), { son: m2.slice(-120) });
kayit("geri alınca kart yeniden eklenebilir olur", (await ekleDugme().textContent()).includes("İmlece ekle") && !(await ekleDugme().isDisabled()));
await s.screenshot({ path: OUT + "geri-alindi.png" });
await paragrafSonu("Birinci sınıf"); await ekleDugme().click(); await s.waitForTimeout(500);
kayit("yeniden eklenebilir; künye bir kez yazılır", ((await kaynakca()).match(/Demir, B\. \(2019\)/g) ?? []).length === 1);

// 3) Belirsiz eşleşme: kaynakçaya eklenmez, kullanıcıya söylenir.
await paragrafSonu("Birinci sınıf");
await iste("ARAS hakkında yaz.");
await ekleDugme().click(); await s.waitForTimeout(600);
const bildirim = await s.evaluate(() => document.body.innerText);
kayit("belirsiz atıf Kaynakça'ya eklenmez", (await metin()).includes("(Aras, 2020)") && !/Aras, [DE]\./.test(await kaynakca()), { kaynakca: (await kaynakca()).slice(0, 160) });
kayit("belirsiz atıf kullanıcıya söylenir", /Belirsiz atıf: \(Aras, 2020\)/.test(bildirim));
await s.screenshot({ path: OUT + "belirsiz.png" });

// 4) Kısaltma uyarısı: engellemez, gösterir.
await ed((e, a) => { let f = null; e.state.doc.descendants((n, p) => { if (f === null && n.isTextblock && n.textContent === a) f = p + 1; }); e.commands.focus(); e.commands.setTextSelection({ from: f, to: f + a.length }); }, SECIM);
const onceKart = await panel.locator(".yazim-oneri").count();
await panel.getByRole("button", { name: /^Kısalt$/ }).click();
await s.waitForFunction((n) => document.querySelectorAll("aside.yazim-paneli .yazim-oneri").length > n, onceKart, { timeout: 15000 });
const uyari = await sonKart().locator(".yazim-oneri-uyari li").allTextContents();
kayit("kısaltma: somut kayıplar uyarı olarak görünür", uyari.some((u) => /Olumsuzluk/.test(u)) && uyari.some((u) => /atıf/.test(u)) && uyari.some((u) => /sayı/.test(u)), { uyari });
kayit("kısaltma uyarısı eklemeyi engellemez", !(await sonKart().getByRole("button", { name: /Seçilenin yerine koy/ }).isDisabled()));
await sonKart().scrollIntoViewIfNeeded();
await s.screenshot({ path: OUT + "kisaltma-uyari.png" });
kayit("sayfa hatası yok", hatalar.length === 0, { hatalar });
await b.close();
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
