// KILAVUZ İSTEĞE BAĞLI, STİLİN DAYANAĞI VE HAZIR DÜZELTMELER — KABUL (23.11.2026).
//
// Dört kusur ölçülüyor:
//   1) Kılavuz ekranı yalnızca "yükleyin" diyordu; kılavuzsuz başlamak bir
//      eksiklik gibi duruyordu, oysa hiçbir yer kılavuz istemiyor.
//   2) Kılavuzdan çıkan stil yalnızca ADIYLA gösteriliyordu; öğrenci
//      doğrulamak için kılavuzu açmak zorundaydı ve çoğu açmıyordu.
//   3) Kılavuzda iki sistem birden geçtiğinde ekran "bulamadım" deyip
//      bütün kararı öğrenciye bırakıyordu, kanıt göstermeden.
//   4) Denetim neyin yanlış olduğunu söylüyor, düzeltmeyi öğrenci otuz
//      künye için elle yapıyordu.
//
// Kullanım: node scripts/yerel-yigin/kilavuz-ve-duzeltme-kabul.mjs http://localhost:3141 [görüntü-dizini]
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
const UYG = process.argv[2] ?? "http://localhost:3141";
const GORSEL = process.argv[3] ?? null;
if (GORSEL) fs.mkdirSync(GORSEL, { recursive: true });
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8",
  }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, govde, yontem = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  return { durum: r.status, json: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID ?? "yok"}) derlemesini çalıştırmıyor`);
    process.exit(2);
  }
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
} catch (e) {
  console.error("Ön koşul yok:", e.message);
  process.exit(2);
}

const sonuclar = [];
let sonSayfa = null;
const kaydet = (no, ad, durum, ayrinti = "") => {
  sonuclar.push({ no, ad, durum, ayrinti });
  console.log(`${durum.padEnd(5)} ${no} ${ad}${ayrinti ? ` — ${ayrinti}` : ""}`);
};
const SADECE = process.env.KABUL_SADECE ? new Set(process.env.KABUL_SADECE.split(",")) : null;
const dene = async (no, ad, fn) => {
  if (SADECE && !SADECE.has(no)) return;
  try {
    const r = await fn();
    kaydet(no, ad, r?.durum ?? "PASS", r?.ayrinti ?? "");
  } catch (e) {
    if (GORSEL && sonSayfa && !sonSayfa.isClosed()) await sonSayfa.screenshot({ path: `${GORSEL}/hata-${no}.png`, fullPage: true }).catch(() => {});
    kaydet(no, ad, "FAIL", String(e.message).slice(0, 300));
  }
};
const dogru = (kosul, mesaj) => { if (!kosul) throw new Error(mesaj); };

/* ---------- Sentetik kullanıcı ve çalışmalar ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `kilavuz-${ek}@yerel.test`, parola = `Kv7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Kilavuz Denegi" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const proje = (ad, stil = "apa7") => psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', ${q(ad)}, ${q(stil)}) returning id`).split("\n")[0];

const P_KILAVUZSUZ = proje("Kilavuzsuz baslayan calisma");
const P_KILAVUZ = proje("Kilavuzu sonradan uygulanan calisma");
const P_CELISKI = proje("Celiskili kilavuzlu calisma");
const P_DUZELTME = proje("Hazir duzeltme calismasi");

/* ---------- Kılavuz PDF'leri (ASCII) ---------- */
const kilavuzPdf = (satirlar) => sentetikPdf([satirlar]);
const NET_KILAVUZ = kilavuzPdf([
  "T.C. ORNEK UNIVERSITESI",
  "SOSYAL BILIMLER ENSTITUSU",
  "TEZ YAZIM KILAVUZU",
  "",
  "1. GIRIS",
  "Bu kilavuz tez yaziminda uyulacak kurallari aciklar. Tezler A4 kagida",
  "yazilir ve enstituye PDF olarak teslim edilir.",
  "",
  "2. KAYNAK GOSTERME",
  "Tez metninde kaynak gosterimi Vancouver sistemine gore yapilir.",
  "Vancouver sisteminde kaynaklar metinde gecis sirasina gore numaralanir.",
  "Kaynakca Vancouver kurallarina uygun duzenlenir.",
  "",
  "3. SAYFA DUZENI",
  "Ust bosluk 3 cm, alt bosluk 2.5 cm olarak ayarlanir.",
]);
const CELISKILI_KILAVUZ = kilavuzPdf([
  "T.C. ORNEK UNIVERSITESI",
  "LISANSUSTU EGITIM ENSTITUSU",
  "TEZ YAZIM KILAVUZU",
  "",
  "2. KAYNAK GOSTERME",
  "Sosyal bilimler programlarinda kaynak gosterimi APA sistemine gore yapilir.",
  "APA sisteminde yazar ve yil metin icinde parantez icinde verilir.",
  "",
  "3. SAGLIK BILIMLERI PROGRAMLARI",
  "Saglik bilimleri programlarinda Vancouver sistemi kullanilir.",
  "Vancouver sisteminde kaynaklar numaralanir.",
]);

/* ---------- Hazır düzeltme için: kaynaklar, müsvedde, denetim ---------- */
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, doi_or_url, source_type, status)
  values (${q(KULLANICI)}, ${q(P_DUZELTME)}, 'Ogrenme stilleri ve akademik basari', 'Yilmaz, A.', 2020, 'Egitim Dergisi', '12', '3', '45-60', 'https://doi.org/10.5555/a', 'article', 'used')`);
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, doi_or_url, source_type, status)
  values (${q(KULLANICI)}, ${q(P_DUZELTME)}, 'Motivasyonun sinif ici rolu', 'Demir, B.', 2019, 'Psikoloji Dergisi', '8', '1', '10-25', 'https://doi.org/10.5555/b', 'article', 'used')`);
const BOZUK_A = "Yilmaz A 2020 Ogrenme stilleri ve akademik basari Egitim Dergisi 12 3 45-60";
const BOZUK_B = "Demir B 2019 Motivasyonun sinif ici rolu Psikoloji Dergisi 8 1 10-25";
const MUSVEDDE = [
  "Giris",
  "Ogrenme stilleri basariyi etkiler (Yilmaz, 2020). Motivasyon da onemlidir (Demir, 2019).",
  "",
  "Kaynakça",
  BOZUK_A,
  BOZUK_B,
].join("\n");
const MUSVEDDE_JSON = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
    { type: "paragraph", content: [{ type: "text", text: "Ogrenme stilleri basariyi etkiler (Yilmaz, 2020). Motivasyon da onemlidir (Demir, 2019)." }] },
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kaynakça" }] },
    { type: "paragraph", content: [{ type: "text", text: BOZUK_A }] },
    { type: "paragraph", content: [{ type: "text", text: BOZUK_B }] },
  ],
};
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
      values (${q(P_DUZELTME)}, ${q(JSON.stringify(MUSVEDDE_JSON))}::jsonb, ${q(MUSVEDDE)}, ${MUSVEDDE.split(/\s+/).length}, ${q(KULLANICI)})`);
const AYRISTIRILAN = [
  { raw: BOZUK_A, authors: ["Yilmaz A"], year: null, title: null, issues: [{ field: "year", message: "Yıl parantez içinde bulunamadı, örn: (2023).", severity: "error" }] },
  { raw: BOZUK_B, authors: ["Demir B"], year: null, title: null, issues: [{ field: "year", message: "Yıl parantez içinde bulunamadı, örn: (2023).", severity: "error" }] },
];
psql(`insert into public.citation_checks (project_id, project_title, raw_reference_list, parsed_references, in_text_citations, cross_check, compliance_score, citation_style, created_by)
  values (${q(P_DUZELTME)}, 'Hazir duzeltme', ${q(`${BOZUK_A}\n${BOZUK_B}`)}, ${q(JSON.stringify(AYRISTIRILAN))}::jsonb, '[]'::jsonb, '{}'::jsonb, 60, 'apa7', ${q(KULLANICI)})`);

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async (g = 1440, y = 900, dil = "tr") => {
  psql(`update public.profiles set arayuz_dili = ${q(dil)} where id = ${q(KULLANICI)}`);
  const ctx = await tarayici.newContext({ viewport: { width: g, height: y }, locale: "tr-TR" });
  await ctx.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await ctx.newPage();
  sonSayfa = s;
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};

/** Kılavuz penceresini açar. */
const kilavuzPenceresi = async (s, projeId) => {
  await s.goto(`${UYG}/dashboard/editor/${projeId}?kilavuz=1`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
  const pencere = s.locator(".drawer-root.open section.drawer");
  if (!(await pencere.count())) {
    await s.locator("button, a, summary").filter({ hasText: /Kılavuz/ }).first().click();
  }
  await pencere.first().waitFor({ state: "visible", timeout: 20000 });
  return pencere.first();
};

/*
  Form en az bir zorunlu bölüm istiyor (lib/kilavuz-dogrulama.ts,
  "bolum-yok"): kalıp bu sentetik kılavuzda bölüm bulamıyor, öğrenci de
  gerçekte elle ekliyor.
*/
const bolumEkle = async (pencere, ad = "Giriş") => {
  const kutu = pencere.locator('input[placeholder*="Bölüm ekle"]');
  await kutu.fill(ad);
  await kutu.press("Enter");
};

/** Kılavuz dosyasını yükleyip doğrulama adımına geçer. */
const kilavuzTara = async (s, pencere, pdf, ad) => {
  await pencere.locator('input[type="file"]').first().setInputFiles({ name: ad, mimeType: "application/pdf", buffer: pdf });
  /* Tarama uzun sürebiliyor (PDF + OCR denemesi); doğrulama formu belirene kadar. */
  await pencere.locator("label", { hasText: /Kaynakça sistemi/ }).waitFor({ state: "visible", timeout: 180000 });
};

/* ================= SENARYOLAR ================= */

await dene("G1", "Kılavuzsuz başlama: ekran zorunlu göstermiyor, kaynak eklenebiliyor", async () => {
  const { ctx, s } = await oturum();
  try {
    const pencere = await kilavuzPenceresi(s, P_KILAVUZSUZ);
    const metin = await pencere.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/G1-kilavuzsuz.png`, fullPage: true });
    dogru(/Kılavuz zorunlu değil/.test(metin), `kılavuzun isteğe bağlı olduğu yazmıyor: ${metin.slice(0, 300)}`);
    const devam = pencere.locator("a", { hasText: /Kılavuz eklemeden devam et/ });
    dogru(await devam.count(), "«Kılavuz eklemeden devam et» yok");
    await devam.first().click();
    await s.waitForURL(/dashboard\/literature/, { timeout: 30000 });
    /* Stil seçilmemişken kaynak ekleme engellenmemeli: elle kaynak ekle. */
    await s.waitForLoadState("networkidle").catch(() => {});
    const once = Number(psql(`select count(*) from public.literature_sources where project_id = ${q(P_KILAVUZSUZ)}`));
    await s.locator("details.kaynak-ekle > summary").first().click();
    const menu = s.locator(".kaynak-ekle-menu");
    await menu.waitFor({ state: "visible", timeout: 20000 });
    /*
      Kaynak ekleme yollarının hiçbiri kılavuza ya da stile bağlı
      değil: üçü de açık. Ağa gitmeyen yol dosyadan içe aktarma
      (BibTeX), kabulde o kullanılıyor.
    */
    const yollar = await menu.locator("button, summary, a").allInnerTexts();
    dogru(yollar.length >= 3, `kaynak ekleme yolları eksik: ${yollar.join(" | ")}`);
    await menu.locator("button, summary, a").filter({ hasText: /Dosyadan içe aktar/ }).first().click();
    const alan = s.locator(".drawer-root.open section.drawer").last();
    const bibtex = `@article{kabul${ek},\n  title = {Kilavuzsuz eklenen kaynak},\n  author = {Yilmaz, Ahmet},\n  year = {2020},\n  journal = {Sentetik Dergi}\n}\n`;
    await alan.locator('input[type="file"]').first().setInputFiles({ name: `kaynaklar-${ek}.bib`, mimeType: "text/plain", buffer: Buffer.from(bibtex, "utf8") });
    const ekleDugmesi = alan.locator("button").filter({ hasText: /kaynağı ekle|source[s]? / });
    await ekleDugmesi.first().waitFor({ state: "visible", timeout: 30000 });
    await ekleDugmesi.first().click();
    for (let i = 0; i < 40; i += 1) {
      if (Number(psql(`select count(*) from public.literature_sources where project_id = ${q(P_KILAVUZSUZ)}`)) > once) break;
      await s.waitForTimeout(500);
    }
    const sonra = Number(psql(`select count(*) from public.literature_sources where project_id = ${q(P_KILAVUZSUZ)}`));
    dogru(sonra > once, `kılavuzsuz kaynak eklenemedi (${once} → ${sonra})`);
    return { ayrinti: `kaynak ${once} → ${sonra}; devam bağlantısı Kaynaklar'a gidiyor` };
  } finally { await ctx.close(); }
});

await dene("G2", "Kılavuzdan çıkan stil dayanağıyla gösteriliyor ve çalışmaya uygulanıyor", async () => {
  const { ctx, s } = await oturum();
  try {
    const pencere = await kilavuzPenceresi(s, P_KILAVUZ);
    await kilavuzTara(s, pencere, NET_KILAVUZ, `kilavuz-${ek}.pdf`);
    const stilKutusu = pencere.locator("label", { hasText: /Kaynakça sistemi/ }).locator("select");
    dogru((await stilKutusu.inputValue()) === "vancouver", `stil önceden seçilmedi: ${await stilKutusu.inputValue()}`);
    const dayanak = pencere.locator(".kilavuz-dayanak");
    dogru(await dayanak.count(), "stilin dayanağı gösterilmiyor");
    const dayanakMetni = await dayanak.first().innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/G2-stil-dayanagi.png`, fullPage: true });
    dogru(/Vancouver sistemine gore yapilir/i.test(dayanakMetni), `alıntı kuralı söylemiyor: ${dayanakMetni}`);
    dogru(/KAYNAK GOSTERME/i.test(dayanakMetni), `bölüm yazılı değil: ${dayanakMetni}`);
    /* "Bu çalışmaya uygula": stil çalışma düzeyinde kaydedilmeli. */
    await bolumEkle(pencere);
    await pencere.locator("button", { hasText: /Kurallarımı uygula/ }).click();
    for (let i = 0; i < 60; i += 1) {
      if (psql(`select citation_style from public.academic_projects where id = ${q(P_KILAVUZ)}`) === "vancouver") break;
      await s.waitForTimeout(500);
    }
    const kayitli = psql(`select citation_style from public.academic_projects where id = ${q(P_KILAVUZ)}`);
    if (kayitli !== "vancouver") {
      const uyari = await s.locator('[role="alert"], .alert, .toast').allInnerTexts().catch(() => []);
      if (GORSEL) await s.screenshot({ path: `${GORSEL}/G2-uygula-hatasi.png`, fullPage: true });
      throw new Error(`çalışmanın stili kaydedilmedi: ${kayitli}; ekran: ${uyari.join(" | ").slice(0, 250)}`);
    }
    return { ayrinti: `dayanak: "${dayanakMetni.replace(/\n/g, " ").slice(0, 120)}"; çalışma stili: ${kayitli}` };
  } finally { await ctx.close(); }
});

await dene("G3", "Çelişkili kılavuzda iki aday kanıtıyla soruluyor, seçim kullanıcının", async () => {
  const { ctx, s } = await oturum();
  try {
    const pencere = await kilavuzPenceresi(s, P_CELISKI);
    await kilavuzTara(s, pencere, CELISKILI_KILAVUZ, `celiski-${ek}.pdf`);
    const celiski = pencere.locator(".kilavuz-celiski");
    dogru(await celiski.count(), "çelişki sorusu gösterilmedi");
    const metin = await celiski.first().innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/G3-celiski.png`, fullPage: true });
    dogru(/APA/.test(metin) && /Vancouver/.test(metin), `iki aday yok: ${metin.slice(0, 250)}`);
    dogru(/APA sistemine gore yapilir/i.test(metin), `APA'nın cümlesi yok: ${metin.slice(0, 300)}`);
    dogru(/Vancouver sistemi kullanilir/i.test(metin), `Vancouver'ın cümlesi yok: ${metin.slice(0, 300)}`);
    /* Kullanıcı Vancouver'ı seçiyor: kutu da ona dönmeli. */
    await celiski.locator("button", { hasText: /^Vancouver$/ }).click();
    const stilKutusu = pencere.locator("label", { hasText: /Kaynakça sistemi/ }).locator("select");
    dogru((await stilKutusu.inputValue()) === "vancouver", `seçim kutuya geçmedi: ${await stilKutusu.inputValue()}`);
    await bolumEkle(pencere);
    await pencere.locator("button", { hasText: /Kurallarımı uygula/ }).click();
    for (let i = 0; i < 60; i += 1) {
      if (psql(`select citation_style from public.academic_projects where id = ${q(P_CELISKI)}`) === "vancouver") break;
      await s.waitForTimeout(500);
    }
    dogru(psql(`select citation_style from public.academic_projects where id = ${q(P_CELISKI)}`) === "vancouver", "seçim kaydedilmedi");
    return { ayrinti: `iki aday kanıtıyla soruldu; kullanıcının seçimi (Vancouver) kaydedildi` };
  } finally { await ctx.close(); }
});

await dene("G4", "Hazır düzeltmeler: önizleme, tek tıkla uygulama ve geri alma", async () => {
  const { ctx, s } = await oturum();
  try {
    await s.goto(`${UYG}/dashboard/editor/${P_DUZELTME}/write?sol=kaynakca`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    const panel = s.locator(".kaynakca-duzeltme");
    await panel.waitFor({ state: "visible", timeout: 30000 });
    /* DENETİM TEK BAŞINA BELGEYİ DEĞİŞTİRMEZ: liste istek üzerine geliyor. */
    const belgeMetni = async () => (await s.locator(".ProseMirror").first().innerText()).replace(/\s+/g, " ");
    const once = await belgeMetni();
    dogru(once.includes(BOZUK_A), `başlangıçta bozuk künye yok: ${once.slice(0, 200)}`);
    await panel.locator("button", { hasText: /Hazır düzeltmeleri göster/ }).click();
    await panel.locator(".kaynakca-duzeltme-liste").first().waitFor({ state: "visible", timeout: 30000 });
    const onizleme = await panel.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/G4-onizleme.png`, fullPage: true });
    dogru(/2 kaynakça düzeltmesi hazır/.test(onizleme), `özet cümlesi yok: ${onizleme.slice(0, 250)}`);
    dogru(/Yilmaz, A\. \(2020\)\./.test(onizleme), `yeni künye önizlemede yok: ${onizleme.slice(0, 400)}`);
    dogru((await belgeMetni()) === once, "önizleme belgeyi değiştirdi");

    await panel.locator("button", { hasText: /Seçilenleri uygula/ }).click();
    await s.waitForTimeout(1000);
    const sonra = await belgeMetni();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/G4-uygulandi.png`, fullPage: true });
    dogru(sonra.includes("Yilmaz, A. (2020)."), `düzeltme belgeye yazılmadı: ${sonra.slice(0, 300)}`);
    dogru(!sonra.includes(BOZUK_A), "eski künye duruyor");
    dogru(sonra.includes("Ogrenme stilleri basariyi etkiler"), "gövde metni bozuldu");

    await panel.locator("button", { hasText: /Geri al/ }).click();
    await s.waitForTimeout(1000);
    const geri = await belgeMetni();
    dogru(geri.includes(BOZUK_A) && geri.includes(BOZUK_B), `geri alma iki künyeyi birden kaldırmadı: ${geri.slice(0, 300)}`);
    dogru(!geri.includes("Yilmaz, A. (2020)."), "geri almadan sonra yeni künye duruyor");
    return { ayrinti: "2 düzeltme önizlendi, uygulandı ve TEK geri alma ile ikisi birden kalktı" };
  } finally { await ctx.close(); }
});

await tarayici.close();

const fail = sonuclar.filter((x) => x.durum === "FAIL");
console.log(`\n${sonuclar.length - fail.length} PASS · ${fail.length} FAIL   (HEAD ${HEAD.slice(0, 7)}, BUILD_ID ${BUILD_ID})`);
if (GORSEL) fs.writeFileSync(`${GORSEL}/kilavuz-sonuc.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 2));
process.exit(fail.length ? 1 : 0);
