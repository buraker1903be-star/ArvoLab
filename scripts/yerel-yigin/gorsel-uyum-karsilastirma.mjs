/*
  GÖRSEL UYUM KARŞILAŞTIRMASI (19.11.2026, tasarim/gorsel-uyum dalı).

  Onaylı prototip (tasarim/baglamli-calisma-alani/prototip) ile uygulamanın
  AYNI ekranını, AYNI ölçüde ve AYNI temada çeker: beş ekran (ana, yeni
  çalışma, editör, kaynaklar/PDF, Arvo AI) × 1440×900, 1280×800, 390×844 ×
  açık/koyu. Prototipte 1280 yalnızca 7. ekranda tanımlı; öteki ekranlar
  1440 tasarımıyla karşılaştırılır ve görselde böyle yazar.

  Yalnızca yerel yığın (127.0.0.1): kullanıcı ve içerik sentetik, Production'a
  bağlanmaz. AI cevabı yerel model taklidi (model-taklidi.mjs); gerçek model
  çağrılmaz. Tohum belgesi editörün kendi şemasından üretilir (tam
  öznitelikli düğümler; eskiden özniteliksiz paragraflar format-loss
  uyarısını tetikliyordu) ve kelime sayısı uygulamanın countWords'ü ile.

  Kullanım (temiz üretim derlemesi + next start, yerel yığın ve geçit açık):
    node --import ./tests/register.mjs scripts/yerel-yigin/gorsel-uyum-karsilastirma.mjs <uygulama> <çıktı-dizini>
  Çıktı: uygulama/, prototip/ (tek tek çekimler), karsilastirma/ (yan yana
  sayfalar), olcumler.json (üst bant, gezinme, belge, panel, yazı boyutları),
  derleme.json (git HEAD, BUILD_ID, kod temiz mi).
*/
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
const UYG = process.argv[2] ?? "http://localhost:3140";
const CIKTI = process.argv[3];
if (!CIKTI) { console.error("Kullanım: … gorsel-uyum-karsilastirma.mjs <uygulama> <çıktı-dizini>"); process.exit(2); }
const SAHNELER = (process.env.SAHNE ?? "ana,yeni,editor,ai,pdfd,pdf").split(",");
const GORUNUMLER = (process.env.GORUNUM ?? "d1440,d1280,t390").split(",");
const TEMALAR = (process.env.TEMA ?? "acik,koyu").split(",");
const HESAP = `${CIKTI}/hesap.json`;
fs.mkdirSync(`${CIKTI}/uygulama`, { recursive: true });
fs.mkdirSync(`${CIKTI}/prototip`, { recursive: true });
const PROTO_HTML = `file://${KOK}/tasarim/baglamli-calisma-alani/prototip/index.html`;
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const ANON = imzala({ role: "anon" }), SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : "gelistirme";
const HEAD = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
const KIRLI = execFileSync("git", ["status", "--porcelain"], { cwd: KOK, encoding: "utf8" }).trim();
if (!(await (await fetch(`${UYG}/`)).text()).includes(BUILD_ID)) { console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID}) derlemesini çalıştırmıyor`); process.exit(2); }
if (!GECIT.includes("127.0.0.1")) process.exit(2);

const auth = async (yol, govde, yontem = "POST", belirtec = SERVIS) => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, { method: yontem, headers: { apikey: belirtec === SERVIS ? SERVIS : ANON, Authorization: `Bearer ${belirtec}`, "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  return { durum: r.status, json: await r.json().catch(() => ({})) };
};
const SURUM = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
async function kullanici(ad, tamAd) {
  const adres = `${ad}-${ek}@yerel.test`, parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
  const r = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: tamAd } });
  await auth(`/admin/users/${r.json.id}`, { password: parola }, "PUT");
  psql(`update public.profiles set full_name=${q(tamAd)} where id='${r.json.id}'`);
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi) values ('${r.json.id}','kullanim_sozlesmesi','${SURUM}','tr','${"0".repeat(64)}','giris',true)`);
  const t = await auth("/token?grant_type=password", { email: adres, password: parola }, "POST", ANON);
  return { id: r.json.id, adres, parola, erisim: t.json.access_token };
}
/* Ham düğümler: aşağıda editörün şemasından geçirilip tam öznitelikli hâle getirilir (tamBelge). */
const p = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const h = (n, t) => ({ type: "heading", attrs: { level: n }, content: [{ type: "text", text: t }] });

/* ---------- Tohum: prototipteki içerik ---------- */
let A;

const HAM_BELGE = { type: "doc", content: [
  h(1, "Giriş"),
  p("Uzaktan öğrenme, pandemi döneminde yükseköğretimin varsayılan biçimi hâline geldi. Bu çalışma, birinci sınıf öğrencilerinin yalnızlık algısının ders biçimine göre nasıl değiştiğini inceliyor."),
  p("Önceki araştırmalar, haftalık canlı oturum içermeyen programlarda yalnızlık puanlarının daha yüksek olduğunu gösteriyor (Kaya, 2021). Akran çalışma gruplarının bu etkiyi azalttığı da bildiriliyor (Demir, 2019)."),
  h(2, "Araştırmanın Amacı"),
  p("Çalışmanın amacı, yapılandırılmış akran temasının uzaktan öğrenmedeki yalnızlık üzerindeki etkisini nicel olarak değerlendirmektir. Bu doğrultuda iki dalgalı bir anket deseni kullanılmıştır."),
  h(2, "Önemi"),
  p("Bulgular, ilk yıl öğrencilerine yönelik ders planlamasında eşzamanlı oturumların yerine dair somut bir dayanak sunmayı amaçlar."),
] };
/* Tohum belgeleri editörün şemasından (tests/editor/ortam.ts ile aynı eklenti listesi): kaydedilen hâliyle tam öznitelikli. */
const { editorSchema } = await import(`${KOK}/tests/editor/ortam.ts`);
const { countWords } = await import(`${KOK}/lib/tiptap-text.ts`);
const tamBelge = (d) => editorSchema.nodeFromJSON(d).toJSON();
const BELGELER = { tez: tamBelge(HAM_BELGE), taslak: tamBelge({ type: "doc", content: [p("Taslak.")] }), makale: tamBelge({ type: "doc", content: [h(1, "Giriş"), p("Akran öğrenmesi üzerine yapılan çalışmalar son yirmi yılda belirgin biçimde arttı.")] }) };
BELGELER.kelime = Object.fromEntries(Object.entries(BELGELER).map(([k, v]) => [k, countWords(v)]));
const BELGE = BELGELER.tez;
const duz = HAM_BELGE.content.map((b) => b.content[0].text).join("\n");
const kelimeOf = (belge) => BELGELER.kelime[Object.keys(BELGELER).find((k) => BELGELER[k] === belge)] ?? 0;
const calisma = (tur, baslik, belge, metin) => {
  const id = psql(`insert into public.academic_projects (owner_id, project_type, title, university, department) values ('${A.id}','${tur}',${q(baslik)},'Örnek Üniversitesi','Eğitim Bilimleri') returning id`).split("\n")[0];
  psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count) values ('${id}', ${q(JSON.stringify(belge))}::jsonb, ${q(metin)}, ${kelimeOf(belge)})`);
  return id;
};
let PR, PDF;
if (fs.existsSync(HESAP)) { ({ A, PR, PDF } = JSON.parse(fs.readFileSync(HESAP, "utf8"))); } else {
A = await kullanici("gorsel-elif", "Elif Aydın");

calisma("project", "Lisans Bitirme Projesi Taslağı", BELGELER.taslak, "Taslak.");
calisma("project", "Araştırma Yöntemleri Dönem Ödevi", BELGELER.taslak, "Taslak.");
calisma("article", "Akran Çalışma Gruplarının Akademik Başarıya Etkisi", BELGELER.makale, "Akran öğrenmesi");
PR = calisma("thesis", "Uzaktan Öğrenmede Akran Teması ve Öğrenci Yalnızlığı", BELGE, duz);
const KAYA = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title, volume, issue, pages) values ('${A.id}','${PR}','Remote learning and student wellbeing','Kaya, A.',2021,'https://doi.org/10.5555/sentetik.2021.001','Journal of Synthetic Studies','12','3','201-219') returning id`).split("\n")[0];
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${A.id}','${PR}','Peer study groups in higher education','Demir, B.',2019,'Synthetic Review of Education')`);
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${A.id}','${PR}','Measuring loneliness in university students','Ak, E.; Şahin, C.',2018,'Synthetic Journal of Psychology')`);
const pdf = sentetikPdf([
  ["Remote learning and student wellbeing", "Kaya, A. Journal of Synthetic Studies 12(3)", "", "Remote learning increased reported isolation among first-year students.", "The effect was strongest in programmes without weekly live sessions.", "", "Students who joined peer study groups reported lower isolation scores.", "We surveyed 412 students across three faculties in autumn 2020.", "", "Participants completed the Synthetic Isolation Scale at two time points.", "The scale has twelve items rated on a five point agreement format."],
  ["Method", "Participants completed the Synthetic Isolation Scale at two time points."],
]);
const yol = `${PR}/kaynak-pdf/kaya-${ek}.pdf`;
await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${A.erisim}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
const kunye = "Kaya, A. (2021). Remote learning and student wellbeing. Journal of Synthetic Studies, 12(3), 201-219.";
const anahtar = kunye.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 400);
PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${A.id}',${q(kunye)},${q(anahtar)},'10.5555/sentetik.2021.001','yuklendi',${q(yol)},'${KAYA}') returning id`).split("\n")[0];

fs.writeFileSync(HESAP, JSON.stringify({ A, PR, PDF }));
}
const belgeyiSifirla = () => {
  // Her oturum aynı belgeyle başlar: alıntı ekleme belgeyi değiştirir, sonraki oturuma taşınmasın.
  psql(`update public.project_manuscripts set content=${q(JSON.stringify(BELGE))}::jsonb, plain_text=${q(duz)}, word_count=${BELGELER.kelime.tez} where project_id='${PR}'`);
  psql(`delete from public.project_manuscript_versions where project_id='${PR}'`);
};
/* ---------- Ölçüm: aynı işlev prototipte ve uygulamada ---------- */
// Bölgeler noktadan bulunur (sınıf adına bağlı değil): üst çubuk = (orta, 6) noktasının yüksekliği ≤ 140
// olan en geniş atası; gezinme = sol kenarın tam boy atası; panel = sağ kenarın tam boy atası.
const OLC = String.raw`(([ox, oy, W, H, belgeSec]) => {
  const at = (x, y, kosul) => { let e = document.elementFromPoint(ox + x, oy + y), son = null; while (e && e !== document.body) { const r = e.getBoundingClientRect(); if (kosul(r)) son = e; e = e.parentElement; } return son; };
  const kutu = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left - ox), y: Math.round(r.top - oy), w: Math.round(r.width), h: Math.round(r.height) }; };
  const ust = at(W / 2, 6, (r) => r.height <= 140 && r.width >= W * 0.3 && r.top - oy <= 2);
  const gez = W > 500 ? at(8, H * 0.55, (r) => r.height >= H * 0.6 && r.width <= W * 0.35 && r.left - ox <= 2) : null;
  const pan = W > 500 ? at(W - 8, H * 0.55, (r) => r.height >= H * 0.5 && r.width <= W * 0.5 && r.right - ox >= W - 2) : null;
  const belge = document.querySelector(belgeSec);
  const yazilar = (kok) => {
    if (!kok) return null;
    const say = {}; let min = 99;
    const y = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = y.nextNode())) {
      const t = n.data.trim(); if (!t) continue;
      const e = n.parentElement; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = e.getBoundingClientRect(); if (r.width === 0 || r.bottom < oy || r.top > oy + H || r.right < ox || r.left > ox + W) continue;
      const fs = parseFloat(cs.fontSize); say[fs] = (say[fs] || 0) + t.length; if (fs < min) min = fs;
    }
    const sirali = Object.entries(say).sort((a, b) => b[1] - a[1]);
    return { baskin: sirali[0] ? +sirali[0][0] : null, en_kucuk: min === 99 ? null : min, dagilim: sirali.slice(0, 4).map(([f, c]) => f + "px:" + c) };
  };
  const ogeler = (kok) => kok ? [...kok.querySelectorAll("button, a, input, select, textarea, [role=tab]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= oy && r.bottom <= oy + H; }).length : null;
  const ac_ = document.querySelector(".manuscript-araclar"); const bs = document.querySelector(".os-marka-sayfa"); const hd = document.querySelector(".dashboard-header");
  const ek = { arac: ac_ ? { sw: ac_.scrollWidth, cw: ac_.clientWidth, h: Math.round(ac_.getBoundingClientRect().height) } : null, baslikW: bs ? Math.round(bs.getBoundingClientRect().width) : null, ustH: hd ? Math.round(hd.getBoundingClientRect().height) : null, olcek: document.querySelector(".belge-olcek-deger")?.textContent ?? null };
  return { ek, ust: kutu(ust), ust_yazi: yazilar(ust), gezinme: kutu(gez), gezinme_yazi: yazilar(gez), panel: kutu(pan), panel_yazi: yazilar(pan), panel_oge: ogeler(pan), belge: kutu(belge), belge_yazi: yazilar(belge) };
})`;

/* ---------- Tarayıcı ---------- */
const b = await chromium.launch();
const hatalar = [];
const olcumler = {};
const GORUNUM = { d1440: { genislik: 1440, yukseklik: 900 }, d1280: { genislik: 1280, yukseklik: 800 }, t390: { genislik: 390, yukseklik: 844, mobil: true } };

async function oturum(k, gorunum, tema) {
  const { genislik, yukseklik, mobil = false } = GORUNUM[gorunum];
  const c = await b.newContext({ baseURL: UYG, viewport: { width: genislik, height: yukseklik }, deviceScaleFactor: 1, isMobile: mobil, hasTouch: mobil, colorScheme: tema === "koyu" ? "dark" : "light" });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  await c.addInitScript((t) => { try { localStorage.setItem("arvolab.theme", t); } catch {} }, tema === "koyu" ? "dark" : "light");
  const s = await c.newPage();
  s.on("pageerror", (e) => hatalar.push(`${e.message} @ ${s.url().replace(UYG, "")}`));
  await s.goto("/"); await s.fill('input[name="email"]', k.adres); await s.fill('input[name="password"]', k.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s };
}
const yaz = `/dashboard/editor/${PR}/write`;
const ac = async (s, adres) => {
  await s.goto(adres);
  if (adres.includes("/write")) await s.waitForSelector(".ProseMirror", { timeout: 60000 });
  await s.waitForTimeout(1500);
  await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 800 }).catch(() => {});
  await s.waitForTimeout(300);
};
const metinKonumu = (s, aranan, kayma = 0) => s.evaluate(([w, k]) => {
  const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = y.nextNode())) {
    const i = n.data.indexOf(w);
    if (i >= 0) { const r = document.createRange(); r.setStart(n, i + k); r.setEnd(n, i + k + 1); const d = r.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; }
  }
  return null;
}, [aranan, kayma]);
async function cek(s, ekran, gorunum, tema) {
  await s.waitForTimeout(700);
  const ad = `${ekran}-${gorunum}-${tema}`;
  await s.screenshot({ path: `${CIKTI}/uygulama/${ad}.png` });
  // Klavye benzetiminde görünen alan değişiyor; ölçü sayfanın o anki boyutundan.
  const { width: genislik, height: yukseklik } = s.viewportSize();
  olcumler[ad] = { ...(olcumler[ad] || {}), uygulama: await s.evaluate(`${OLC}([0,0,${genislik},${yukseklik},".ProseMirror"])`) };
  console.log("uygulama", ad);
}
async function alintiEkle(s) {
  await ac(s, `${yaz}?sag=pdf`);
  if ((await s.locator(".kaynak-pdf-paneli select").first().inputValue()) !== PDF) await s.locator(".kaynak-pdf-paneli select").first().selectOption(PDF);
  await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
  await s.evaluate(() => {
    const ed = document.querySelector(".ProseMirror").editor;
    let hedef = null, say = 0;
    ed.state.doc.descendants((n, pos) => { if (hedef !== null) return false; if (n.type.name === "paragraph" && ++say === 2) hedef = pos + n.nodeSize - 1; });
    ed.commands.setTextSelection(hedef);
  });
  await s.evaluate(() => {
    const hedef = Array.from(document.querySelectorAll(".pdf-sayfa .textLayer span")).find((x) => x.textContent.includes("The effect was strongest"));
    const r = document.createRange(); r.selectNodeContents(hedef);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    hedef.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
  await s.getByRole("button", { name: /Alıntı ve atıf ekle/ }).click();
  await s.waitForSelector(".kaynak-dogrulandi", { timeout: 60000 });
  await s.locator('input[name="kaynak-aday"]').first().check().catch(() => {});
  await s.locator(".kaynak-onay input[type=checkbox]").first().check().catch(() => {});
  await s.getByRole("button", { name: /^İmlece ekle$/ }).click(); await s.waitForTimeout(2500);
}
async function dayanagaGit(s) {
  for (let deneme = 0; deneme < 3 && !(await s.locator(".atif-karti").count()); deneme++) {
    const k = await metinKonumu(s, "sessions.” (Kaya", 12);
    if (!k) break;
    await s.mouse.click(k.x, k.y); await s.waitForTimeout(1200);
  }
  await s.getByRole("button", { name: /Dayanağa git/ }).first().click({ timeout: 15000 }); await s.waitForTimeout(3500);
}
const yeniCalismaAc = async (s) => {
  await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click().catch(() => s.getByRole("link", { name: /^Yeni çalışma$/ }).first().click());
  await s.waitForSelector(".drawer-root.open .yeni-calisma-formu", { timeout: 30000 }).catch(() => {});
  await s.waitForTimeout(900);
};

const enUste = (s) => s.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }); });
const var_ = (x) => SAHNELER.includes(x);
for (const gorunum of GORUNUMLER) {
  for (const tema of TEMALAR) {
    belgeyiSifirla();
    const { c, s } = await oturum(A, gorunum, tema);
    const tel = gorunum === "t390";
    if (var_("ana")) { await ac(s, "/dashboard"); await cek(s, "ana", gorunum, tema); }
    if (var_("yeni")) { await ac(s, "/dashboard"); await yeniCalismaAc(s); await cek(s, "yeni", gorunum, tema); }
    if (var_("editor")) {
      await ac(s, yaz); await enUste(s);
      if (tel) {
        await cek(s, "editor-duz", gorunum, tema);
        await s.locator(".os-gezinme-daha:visible").first().click().catch(() => {}); await s.waitForTimeout(700); await cek(s, "editor", gorunum, tema);
      } else {
        const bas = await metinKonumu(s, "haftalık canlı"), son = await metinKonumu(s, "daha yüksek", 10);
        await s.mouse.move(bas.x - 3, bas.y); await s.mouse.down(); await s.mouse.move(son.x, son.y, { steps: 8 }); await s.mouse.up();
        await s.waitForTimeout(800); await cek(s, "editor", gorunum, tema);
      }
    }
    if (var_("ai")) {
      await ac(s, `${yaz}?sag=ai`); await enUste(s);
      const istem = s.locator(".yazim-paneli textarea:visible").first();
      await istem.fill("Akran gruplarıyla ilgili kısa bir paragraf yaz.");
      await istem.press("Enter"); await s.waitForTimeout(4500); await enUste(s); await s.waitForTimeout(300); await cek(s, "ai", gorunum, tema);
    }
    // 2. tur: PDF tek başına (liste kapalı) — 1280'de ray + PDF sütunu yeni yerleşim.
    if (var_("pdfy")) { await ac(s, `${yaz}?sag=pdf`); await enUste(s); await s.waitForTimeout(2500); await cek(s, "pdfy", gorunum, tema); }
    // 2. tur: telefon klavyesi. Gerçek klavye açılamıyor; görünen alan 844 → 500 px'e
    // indirilerek benzetilir (klavyenin kapladığı ~344 px). Gerçek cihaz değildir.
    if (var_("aiklavye") && tel) {
      await ac(s, `${yaz}?sag=ai`); await enUste(s);
      const istem = s.locator(".yazim-paneli textarea:visible").first();
      await istem.fill("Akran gruplarıyla ilgili kısa bir paragraf yaz.");
      await istem.press("Enter"); await s.waitForTimeout(4500);
      await s.setViewportSize({ width: 390, height: 500 }); await istem.focus(); await s.waitForTimeout(700);
      await cek(s, "aiklavye", gorunum, tema);
      await s.setViewportSize({ width: 390, height: 844 });
    }
    if (var_("pdfd")) { await ac(s, `${yaz}?sol=kaynaklar&sag=pdf`); await enUste(s); await s.waitForTimeout(2500); await cek(s, "pdfd", gorunum, tema); }
    if (var_("pdf")) {
      await alintiEkle(s);
      if (!tel) { await s.locator('a[href*="sol=kaynaklar"]').first().click(); await s.waitForTimeout(1200); }
      await dayanagaGit(s); await cek(s, "pdf", gorunum, tema);
    }
    await c.close();
  }
}

/* ---------- Prototip: aynı ekran, aynı ölçü, doğal boyut (ölçekleme yok) ---------- */
const PROTO_EKRAN = Object.fromEntries(Object.entries({ ana: 2, yeni: 3, editor: 5, ai: 8, pdf: 7 }).filter(([e]) => SAHNELER.some((x) => x === e || (e === "pdf" && x.startsWith("pdf")) || (e === "ai" && x.startsWith("ai")))));
for (const gorunum of ["d1440", "d1280", "t390"]) {
  for (const tema of ["acik", "koyu"]) {
    for (const [ekran, no] of Object.entries(PROTO_EKRAN)) {
      const c = await b.newContext({ viewport: { width: 2200, height: 1700 }, deviceScaleFactor: 1 });
      const s = await c.newPage();
      await s.goto(`${PROTO_HTML}#ekran-${no}`); await s.waitForTimeout(400);
      await s.click(`.secici button[data-tema="${tema}"]`);
      if (gorunum === "t390") await s.click('button[data-cihaz="tel"]'); else await s.click('button[data-cihaz="masa"]');
      // Prototipte 1280 yalnızca 7. ekranda tanımlı; öteki ekranlar 1440 tasarımıyla karşılaştırılır.
      const proto1280 = gorunum === "d1280" && no === 7;
      if (no === 7 && gorunum !== "t390") await s.click(`button[data-alt="alt7:${proto1280 ? "1280" : "1440"}"]`);
      await s.evaluate(() => document.fonts.ready);
      await s.waitForTimeout(500);
      const kap = gorunum === "t390" ? ".telefonlar .cerceve" : ".cerceve";
      const boyut = await s.evaluate((sec) => {
        const cer = document.querySelector(sec); const dis = cer.parentElement;
        cer.style.transform = "none"; dis.style.width = cer.style.width; dis.style.aspectRatio = "auto"; dis.style.height = cer.style.height; dis.style.maxWidth = "none";
        return { w: parseInt(cer.style.width), h: parseInt(cer.style.height) };
      }, kap);
      await s.waitForTimeout(200);
      const ad = `${ekran}-${gorunum}-${tema}`;
      const el = s.locator(kap).first();
      await el.screenshot({ path: `${CIKTI}/prototip/${ad}.png` });
      await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox();
      olcumler[ad] = { ...(olcumler[ad] || {}), prototip_boyut: `${boyut.w}×${boyut.h}`, prototip: await s.evaluate(`${OLC}([${r.x},${r.y},${boyut.w},${boyut.h},"${kap} .kagit, ${kap} .tel-kagit"])`) };
      console.log("prototip", ad, boyut);
      await c.close();
    }
  }
}
fs.rmSync(HESAP, { force: true });
fs.writeFileSync(`${CIKTI}/olcumler.json`, JSON.stringify(olcumler, null, 2));
fs.writeFileSync(`${CIKTI}/derleme.json`, JSON.stringify({ etiket: `Yerel üretim derlemesi · ${HEAD}`, gitHead: HEAD, uygulamaKoduTemiz: KIRLI === "", buildId: BUILD_ID, sunucu: "next start (rm -rf .next, next build)", veri: "yalnızca yerel yığın 127.0.0.1, sentetik kullanıcı ve içerik", ai: "yerel model taklidi (scripts/yerel-yigin/model-taklidi.mjs), gerçek model çağrılmadı", tarih: new Date().toISOString(), sayfaHatalari: [...new Set(hatalar)] }, null, 2));
if (hatalar.length) console.log("SAYFA HATALARI:", [...new Set(hatalar)].join("\n"));
await b.close();

/* ---------- Karşılaştırma sayfaları: solda prototip, sağda uygulama ---------- */
{
const D = CIKTI;
  const der = JSON.parse(fs.readFileSync(`${D}/derleme.json`, "utf8"));
  fs.mkdirSync(`${D}/karsilastirma`, { recursive: true });
  const veri = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
  const AD = { pdfy: "Yalnızca PDF, liste kapalı ?sag=pdf (prototip ekran 7)", aiklavye: "Arvo AI, klavye benzetimi: görünen alan 390×500 (prototip ekran 8, 390×844)", ana: "Ana ekran (prototip ekran 2)", yeni: "Yeni çalışma (prototip ekran 3)", editor: "Editör (prototip ekran 5, metin seçili)", pdf: "Kaynaklar + PDF (prototip ekran 7)", ai: "Arvo AI paneli (prototip ekran 8)", pdfd: "Kaynaklar + PDF, doğrudan adresle ?sol=kaynaklar&sag=pdf (prototip ekran 7)" };
  const PK = (e) => (e.startsWith("pdf") ? "pdf" : e === "aiklavye" ? "ai" : e);
  const OLCU = { d1440: "1440×900", d1280: "1280×800", t390: "390×844" };
  const b = await chromium.launch();
  const etiketU = `Yerel üretim derlemesi · ${der.gitHead} · BUILD_ID ${der.buildId}`;
  async function sayfa(html, gen, hedef) {
    const s = await (await b.newContext({ viewport: { width: gen, height: 400 }, deviceScaleFactor: 1 })).newPage();
    await s.setContent(`<!doctype html><html><body style="margin:0;background:#e9ecf1;font:15px system-ui;color:#1b2430">${html}</body></html>`);
    await s.waitForTimeout(300);
    await s.screenshot({ path: hedef, fullPage: true });
    await s.context().close();
  }
  const hucre = (baslik, dosya, gen) => fs.existsSync(dosya)
    ? `<figure style="margin:0;width:${gen}px"><figcaption style="padding:6px 2px;font-weight:600;font-size:14px">${baslik}</figcaption><img src="${veri(dosya)}" style="width:${gen}px;display:block;outline:1px solid #c8cdd5"></figure>`
    : `<figure style="margin:0;width:${gen}px"><figcaption style="padding:6px 2px;font-weight:600">${baslik}</figcaption><div style="padding:40px;background:#fff">Bu görünüm prototipte yok</div></figure>`;
  // Yalnızca bu koşuda çekilen ekranlar birleştirilir (2. tur: etkilenen ekranlar).
  for (const ekran of ["ana", "yeni", "editor", "pdf", "pdfd", "pdfy", "ai"].filter((e) => SAHNELER.includes(e) && GORUNUMLER.some((g) => g !== "t390"))) {
    let govde = `<h1 style="margin:16px 20px 4px;font-size:22px">${AD[ekran]} · masaüstü</h1><p style="margin:0 20px 8px">Sol: onaylı prototip (tasarim/baglamli-calisma-alani/prototip, doğal boyut). Sağ: ${etiketU}. Sentetik yerel veri${ekran === "pdf" ? "; durum: atıf kartından Dayanağa git (pasaj vurgulu)" : ""}${ekran === "ai" ? "; AI cevabı YEREL TAKLİT (model-taklidi.mjs), gerçek model değil" : ""}.</p>`;
    for (const g of ["d1440", "d1280"].filter((g) => GORUNUMLER.includes(g))) for (const t of TEMALAR) {
      const pnot = g === "d1280" && PK(ekran) !== "pdf" ? " (prototipte 1280 tanımlı değil: 1440 tasarımı)" : "";
      govde += `<div style="display:flex;gap:20px;padding:10px 20px">${hucre(`Prototip · ${t === "acik" ? "açık" : "koyu"} · ${g === "d1280" && PK(ekran) === "pdf" ? "1280×800" : "1440×900"}${pnot}`, `${D}/prototip/${PK(ekran)}-${g}-${t}.png`, 940)}${hucre(`${etiketU} · ${t === "acik" ? "açık" : "koyu"} · ${OLCU[g]}`, `${D}/uygulama/${ekran}-${g}-${t}.png`, 940)}</div>`;
    }
    await sayfa(govde, 1940, `${D}/karsilastirma/${ekran}-masaustu.png`);
    console.log(ekran, "masaüstü");
  }
  // Telefon: tek sayfa, ekran başına bir satır: P açık, U açık, P koyu, U koyu.
  let tg = `<h1 style="margin:16px 20px 4px;font-size:22px">Telefon · 390×844</h1><p style="margin:0 20px 8px">Her satırda: prototip açık · uygulama açık · prototip koyu · uygulama koyu. Uygulama: ${etiketU}. AI cevabı YEREL TAKLİT.</p>`;
  for (const ekran of ["ana", "yeni", "editor", "pdf", "pdfd", "ai", "aiklavye"].filter((e) => SAHNELER.includes(e) && GORUNUMLER.includes("t390"))) {
    tg += `<h2 style="margin:14px 20px 0;font-size:17px">${AD[ekran]}${ekran === "editor" ? " · prototip ekran 5 telefonda 'Çalışma' yaprağıdır; uygulamada da yaprak açık" : ""}</h2><div style="display:flex;gap:16px;padding:8px 20px">`;
    // Eskiden etiket "8b28897" olarak sabit yazılıydı; derlemenin kendi HEAD'i yazılır.
    for (const t of TEMALAR) tg += hucre(`Prototip · ${t}`, `${D}/prototip/${PK(ekran)}-t390-${t}.png`, 390) + hucre(`Uygulama ${der.gitHead} · ${t}`, `${D}/uygulama/${ekran}-t390-${t}.png`, 390);
    tg += "</div>";
  }
  if (SAHNELER.includes("editor")) tg += `<h2 style="margin:14px 20px 0;font-size:17px">Ek: telefonda editörün yaprak açılmadan hâli (prototipte karşılığı yok)</h2><div style="display:flex;gap:16px;padding:8px 20px">${hucre("Uygulama · açık", `${D}/uygulama/editor-duz-t390-acik.png`, 390)}${hucre("Uygulama · koyu", `${D}/uygulama/editor-duz-t390-koyu.png`, 390)}</div>`;
  if (GORUNUMLER.includes("t390")) await sayfa(tg, 1700, `${D}/karsilastirma/telefon.png`);
  await b.close();
  
}
