/*
  PROTOTİP KARŞILAŞTIRMASI (18.11.2026, kabul turu 3).

  Onaylı prototipin görselleri (tasarim/baglamli-calisma-alani/gorseller/)
  ile uygulamanın AYNI boyutta ve AYNI içerikte ekran görüntülerini yan yana
  koyar. Prototip kareleri üç biçimde:
    - masaüstü: 1472×921 tam uygulama görünümü (çekim aynı ölçüde);
    - 071440 / 071280: 1440 ve 1280 genişlikte çizilip 1472'ye ölçeklenmiş
      (çekim 1440×901 / 1280×801, aynı ölçekleme);
    - telefon: 390×844 görünüm 320×692'ye küçültülüp 1472 genişliğinde
      tuvalin ortasına konmuş (x = 576, y = 1).
  04 iki yarım ekrandır (Çalışmalarım listesi ve çalışma düzeyi): her yarı
  1456×910 çekilip 728×455'e küçültülür.

  İçerik prototiptekiyle aynı: başlık, paragraflar, (Kaya, 2021) ve
  (Demir, 2019) atıfları, üç kaynak, sentetik Kaya PDF'i. Kullanıcılar ve
  içerik sentetiktir, yalnızca yerel yığında yazılır. Arvo AI ekranı yerel
  model taklidiyle (model-taklidi.mjs) doldurulur; gerçek model çağrılmaz.

  Kullanım: node scripts/yerel-yigin/prototip-karsilastirma.mjs <uygulama> <çıktı-dizini>
  Çıktı: <dizin>/uygulama/<sahne>.png (prototiple aynı boyut), <dizin>/ham/ (ham çekimler; teslimde silinir) ve
  <dizin>/<sahne>.png (üstte prototip, altta uygulama).
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
const UYG = process.argv[2] ?? "http://localhost:3132";
const CIKTI = process.argv[3];
if (!CIKTI) {
  console.error("Kullanım: node prototip-karsilastirma.mjs <uygulama> <çıktı-dizini>");
  process.exit(2);
}
const PROTO = `${KOK}/tasarim/baglamli-calisma-alani/gorseller`;
fs.mkdirSync(`${CIKTI}/uygulama`, { recursive: true });
fs.mkdirSync(`${CIKTI}/ham`, { recursive: true });
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
const BUILD_ID = fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim();
const HEAD = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
if (!(await (await fetch(`${UYG}/`)).text()).includes(BUILD_ID)) {
  console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID}) derlemesini çalıştırmıyor`);
  process.exit(2);
}

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
const p = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const h = (n, t) => ({ type: "heading", attrs: { level: n }, content: [{ type: "text", text: t }] });

/* ---------- Tohum: prototipteki içerik ---------- */
const A = await kullanici("prototip-elif", "Elif Aydın");
const N = await kullanici("prototip-deniz", "Deniz Yılmaz");
const BELGE = { type: "doc", content: [
  h(1, "Giriş"),
  p("Uzaktan öğrenme, pandemi döneminde yükseköğretimin varsayılan biçimi hâline geldi. Bu çalışma, birinci sınıf öğrencilerinin yalnızlık algısının ders biçimine göre nasıl değiştiğini inceliyor."),
  p("Önceki araştırmalar, haftalık canlı oturum içermeyen programlarda yalnızlık puanlarının daha yüksek olduğunu gösteriyor (Kaya, 2021). Akran çalışma gruplarının bu etkiyi azalttığı da bildiriliyor (Demir, 2019)."),
  h(2, "Araştırmanın Amacı"),
  p("Çalışmanın amacı, yapılandırılmış akran temasının uzaktan öğrenmedeki yalnızlık üzerindeki etkisini nicel olarak değerlendirmektir. Bu doğrultuda iki dalgalı bir anket deseni kullanılmıştır."),
  h(2, "Önemi"),
  p("Bulgular, ilk yıl öğrencilerine yönelik ders planlamasında eşzamanlı oturumların yerine dair somut bir dayanak sunmayı amaçlar."),
] };
const duz = BELGE.content.map((b) => b.content[0].text).join("\n");
const calisma = (tur, baslik, belge, metin) => {
  const id = psql(`insert into public.academic_projects (owner_id, project_type, title, university, department) values ('${A.id}','${tur}',${q(baslik)},'Örnek Üniversitesi','Eğitim Bilimleri') returning id`).split("\n")[0];
  psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${id}', ${q(JSON.stringify(belge))}::jsonb, ${q(metin)})`);
  return id;
};
// En son düzenlenen başta: tez en son eklenir.
calisma("project", "Lisans Bitirme Projesi Taslağı", { type: "doc", content: [p("Taslak.")] }, "Taslak.");
calisma("project", "Araştırma Yöntemleri Dönem Ödevi", { type: "doc", content: [p("Taslak.")] }, "Taslak.");
calisma("article", "Akran Çalışma Gruplarının Akademik Başarıya Etkisi", { type: "doc", content: [h(1, "Giriş"), p("Akran öğrenmesi üzerine yapılan çalışmalar son yirmi yılda belirgin biçimde arttı.")] }, "Akran öğrenmesi");
const PR = calisma("thesis", "Uzaktan Öğrenmede Akran Teması ve Öğrenci Yalnızlığı", BELGE, duz);
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
// Prototipteki gibi PDF kaynağa BAĞLI (K2-A, kaynak_id): panelde "olası eşleşme" değil, bağlı kaynak.
const PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu, kaynak_id) values ('${PR}','${A.id}',${q(kunye)},${q(anahtar)},'10.5555/sentetik.2021.001','yuklendi',${q(yol)},'${KAYA}') returning id`).split("\n")[0];

/* ---------- Tarayıcı ---------- */
const b = await chromium.launch();
const hatalar = [];
async function oturum(k, { genislik, yukseklik, mobil = false }) {
  const c = await b.newContext({ baseURL: UYG, viewport: { width: genislik, height: yukseklik }, deviceScaleFactor: 1, isMobile: mobil, hasTouch: mobil });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
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
  await s.waitForTimeout(1200);
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
const cek = async (s, ad) => { await s.waitForTimeout(600); await s.screenshot({ path: `${CIKTI}/ham/${ad}.png` }); console.log("çekildi", ad); };

// Doğrulanmış alıntı: PDF'ten seçilen cümle 1. paragrafın SONUNA eklenir (Dayanağa git için gerekli).
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

// Masaüstü 1472×921
{
  const { c, s } = await oturum(N, { genislik: 1472, yukseklik: 921 });
  await ac(s, "/dashboard"); await cek(s, "01");
  await c.close();
}
{
  const { c, s } = await oturum(A, { genislik: 1472, yukseklik: 921 });
  await ac(s, "/dashboard"); await cek(s, "02");
  await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click().catch(() => s.getByRole("link", { name: /^Yeni çalışma$/ }).first().click());
  await s.waitForTimeout(900); await cek(s, "03");
  await ac(s, yaz); await cek(s, "05");
  const bas = await metinKonumu(s, "haftalık canlı"), son = await metinKonumu(s, "daha yüksek", 10);
  await s.mouse.move(bas.x - 3, bas.y); await s.mouse.down(); await s.mouse.move(son.x, son.y, { steps: 8 }); await s.mouse.up();
  await s.waitForTimeout(800); await cek(s, "05secim");
  await ac(s, yaz);
  const kaya = await metinKonumu(s, "(Kaya, 2021)", 3);
  await s.mouse.click(kaya.x, kaya.y); await s.waitForTimeout(1200); await cek(s, "05atif");
  await ac(s, `${yaz}?sol=arama`);
  const kutu = s.locator(".os-sol-alan input[type=search], .os-sol-alan input[type=text]").first();
  await kutu.fill("peer study groups loneliness").catch(() => {});
  await kutu.press("Enter").catch(() => {});
  await s.waitForTimeout(4000); await cek(s, "06");
  /*
    Doğrulanmış pasaj yalnızca oturum boyunca tutulur (K3-ek onaylı değil):
    sayfa yeniden yüklenirse kartta "Dayanağa git" olmaz. 07 bu yüzden aynı
    sayfada, istemci içi gezinmeyle (Kaynaklar bağlantısı) çekilir; 1440 ve
    1280 de pencere yeniden boyutlandırılarak.
  */
  await alintiEkle(s);
  await s.locator('a[href*="sol=kaynaklar"]').first().click(); await s.waitForTimeout(1200);
  await dayanagaGit(s); await cek(s, "07");
  for (const [ad, g, y] of [["071440", 1440, 901], ["071280", 1280, 801]]) {
    await s.setViewportSize({ width: g, height: y }); await s.waitForTimeout(1500); await cek(s, ad);
  }
  await s.setViewportSize({ width: 1472, height: 921 });
  await ac(s, `${yaz}?sag=ai`);
  // Uygulama çalışmanın okuma konumunu geri yükler; önceki sahnelerde kaydırılan belge prototipteki gibi başından gösterilir.
  await s.evaluate(() => window.scrollTo(0, 0));
  const istem = s.locator(".yazim-paneli textarea").first();
  await istem.fill("Akran gruplarıyla ilgili kısa bir paragraf yaz.");
  await istem.press("Enter"); await s.waitForTimeout(4000); await cek(s, "08");
  await c.close();
}
// 04: iki yarım ekran
{
  const { c, s } = await oturum(A, { genislik: 1456, yukseklik: 910 });
  await ac(s, "/dashboard/editor"); await cek(s, "04a");
  await ac(s, yaz); await cek(s, "04b");
  await c.close();
}
// Telefon 390×844
{
  const { c, s } = await oturum(N, { genislik: 390, yukseklik: 844, mobil: true });
  await ac(s, "/dashboard"); await cek(s, "tel-01");
  await c.close();
}
{
  const { c, s } = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
  await ac(s, "/dashboard"); await cek(s, "tel-02");
  await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click().catch(() => s.getByRole("link", { name: /^Yeni çalışma$/ }).first().click());
  await s.waitForTimeout(900); await cek(s, "tel-03");
  await ac(s, yaz); await s.locator(".os-gezinme-daha:visible").first().click(); await s.waitForTimeout(700); await cek(s, "tel-05");
  await ac(s, `${yaz}?sol=arama`);
  const kutu = s.locator(".os-sol-alan input[type=search], .os-sol-alan input[type=text]").first();
  await kutu.fill("peer study groups loneliness").catch(() => {});
  await kutu.press("Enter").catch(() => {});
  // Metin kutusu odaktayken (klavye açık) alt çubuk bilerek aşağı kayar; prototipteki gibi odak bırakılmış hâl çekilir.
  await s.waitForTimeout(4000); await s.evaluate(() => document.activeElement?.blur()); await s.waitForTimeout(500); await cek(s, "tel-06");
  await alintiEkle(s); await dayanagaGit(s); await cek(s, "tel-07");
  await ac(s, `${yaz}?sag=ai`); await s.waitForTimeout(800); await cek(s, "tel-08");
  await c.close();
}

/* ---------- Bileştirme: prototiple aynı boyut, sonra üst üste ---------- */
const veri = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
const boyut = async (f) => {
  const s = await (await b.newContext()).newPage();
  await s.setContent(`<img id=i src="${veri(f)}">`);
  const r = await s.evaluate(() => ({ w: document.getElementById("i").naturalWidth, h: document.getElementById("i").naturalHeight }));
  await s.context().close();
  return r;
};
const ciz = async (html, w, h, hedef) => {
  const s = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await s.setContent(`<!doctype html><html><body style="margin:0;background:#f4f5f7;font:14px system-ui">${html}</body></html>`);
  await s.waitForTimeout(150);
  await s.screenshot({ path: hedef, clip: { x: 0, y: 0, width: w, height: h } });
  await s.context().close();
};
const sahneler = [
  ["01", "01-acik-tr.png", "masa"], ["02", "02-acik-tr.png", "masa"], ["03", "03-acik-tr.png", "masa"], ["04", "04-acik-tr.png", "iki"],
  ["05", "05-acik-tr.png", "masa"], ["05secim", "05secim-acik-tr.png", "masa"], ["05atif", "05atif-acik-tr.png", "masa"], ["06", "06-acik-tr.png", "masa"],
  ["07", "07-acik-tr.png", "masa"], ["071440", "071440-acik-tr.png", "olcek"], ["071280", "071280-acik-tr.png", "olcek"], ["08", "08-acik-tr.png", "masa"],
  ["tel-01", "tel-01-acik-tr.png", "tel"], ["tel-02", "tel-02-acik-tr.png", "tel"], ["tel-03", "tel-03-acik-tr.png", "tel"], ["tel-05", "tel-05-acik-tr.png", "tel"],
  ["tel-06", "tel-06-acik-tr.png", "tel"], ["tel-07", "tel-07-acik-tr.png", "tel"], ["tel-08", "tel-08-acik-tr.png", "tel"],
];
for (const [ad, proto, tur] of sahneler) {
  const pr = `${PROTO}/${proto}`;
  const { w, h } = await boyut(pr);
  const uyg = `${CIKTI}/uygulama/${ad}.png`;
  if (tur === "masa") fs.copyFileSync(`${CIKTI}/ham/${ad}.png`, uyg);
  else if (tur === "olcek") await ciz(`<img src="${veri(`${CIKTI}/ham/${ad}.png`)}" style="width:${w}px;height:${h}px;display:block">`, w, h, uyg);
  else if (tur === "tel") await ciz(`<div style="width:${w}px;height:${h}px;position:relative;background:#f4f5f7"><img src="${veri(`${CIKTI}/ham/${ad}.png`)}" style="position:absolute;left:576px;top:1px;width:320px;height:692px;border-radius:18px;outline:1px solid #d6d9de"></div>`, w, h, uyg);
  else await ciz(`<div style="width:${w}px;height:${h}px;position:relative;background:#fff"><img src="${veri(`${CIKTI}/ham/04a.png`)}" style="position:absolute;left:0;top:0;width:728px;height:455px;outline:1px solid #d6d9de"><img src="${veri(`${CIKTI}/ham/04b.png`)}" style="position:absolute;left:744px;top:0;width:728px;height:455px;outline:1px solid #d6d9de"></div>`, w, h, uyg);
  const etiket = (t) => `<div style="height:36px;line-height:36px;padding:0 12px;font-weight:600;color:#1b2430;background:#e6e9ee">${t}</div>`;
  await ciz(`${etiket(`Prototip · ${proto}`)}<img src="${veri(pr)}" style="display:block">${etiket(`Uygulama · ${HEAD} · BUILD_ID ${BUILD_ID} · aynı boyut ${w}×${h}${/06$/.test(ad) && process.env.KAYITLI_DIZIN_KAYDI ? " · sonuçlar SENTETİK kayıtlı yanıt, gerçek dizin değil" : ""}`)}<img src="${veri(uyg)}" style="display:block">`, w, 2 * h + 72, `${CIKTI}/${ad}.png`);
  console.log("karşılaştırma", ad, `${w}×${h}`);
}
fs.writeFileSync(`${CIKTI}/derleme.json`, JSON.stringify({ gitHead: HEAD, buildId: BUILD_ID, tarih: new Date().toISOString(), sayfaHatalari: [...new Set(hatalar)], makaleBulKaynagi: process.env.KAYITLI_DIZIN_KAYDI ? "sentetik kayıtlı yanıt (scripts/yerel-yigin/kayitli-yanitlar), gerçek dizin değil" : "canlı dizin (bu ortamda ağ yok)" }, null, 2));
if (hatalar.length) console.log("SAYFA HATALARI:", [...new Set(hatalar)].join("\n"));
await b.close();
