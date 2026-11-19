// BAĞLAMLI ÇALIŞMA ALANI — KABUL (19.11.2026, tasarim/baglamli-calisma-alani dalı).
//
// Gerçek Next uygulaması (temiz üretim derlemesi, `next start`) yerel yığına
// bağlıyken tarayıcıda ve doğrudan veritabanı/REST istekleriyle sınar:
//   S1 eski ve yeni çalışma: aç, düzenle, kaydet
//   S2 genel/çalışma gezinmesi, geri/ileri, doğrudan bağlantı, Esc, listeye dönüş
//   S3 durum koruma: arama sorgusu, süzgeç, liste konumu, seçili PDF ve sayfası
//   S4 panel boyutlandırma ve belge okunabilirliği (1920/1440/1280/1024)
//   S5 kaynak–PDF bağı: farklı çalışma/kullanıcı erişimi reddedilir (REST, kullanıcı belirteciyle)
//   S6 atıf kartı: tek/çok/hiç eşleşme; doğrulanmış pasaj ve dayanağa git
//   S7 belge dili ↔ arayüz dili bağımsızlığı (Word çıktısının içindekiler başlığı)
//   S8 dışa aktarma regresyonu: Word ve yazdırma 200, belge metni değişmedi
//   S9 klavye ve dokunma: Tab, Esc, Alt+Enter, ayırıcı oklar, 44 px hedefler
// Yalnızca sentetik kullanıcı ve içerik; AI çağrısı yok.
//
// Kullanım: node scripts/yerel-yigin/calisma-alani-kabul.mjs http://localhost:3132 [görüntü-dizini]
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok. Sonuç: sonuclar/calisma-alani-kabul.json
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
const GORSEL = process.argv[3] ?? null;
if (GORSEL) fs.mkdirSync(GORSEL, { recursive: true });
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

/*
  Sınanan derleme kayda geçer (studyo-kabul.mjs ile aynı yöntem): .next/BUILD_ID
  sunucunun döndürdüğü HTML'de geçmek ZORUNDA, yoksa sunucu bu dizinin
  derlemesini çalıştırmıyor ve koşu başlamaz. git HEAD ve çalışma ağacının
  temizliği de yazılır: kabulün hangi içeriğe ait olduğu sonradan sorulabilsin.
*/
const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
const KIRLI = execFileSync("git", ["status", "--porcelain", "--", "app", "lib", "proxy.ts", "next.config.ts", "package.json"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID ?? "yok"}) derlemesini çalıştırmıyor (next build + next start bu dizinden mi?)`);
    process.exit(2);
  }
} catch (e) {
  console.error("Ön koşul yok (uygulama):", e.message);
  process.exit(2);
}
try {
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
  if (!(await fetch(UYG)).ok) throw new Error("uygulama");
  psql("select belge_dili from public.academic_projects limit 0");
  psql("select kaynak_id from public.kaynak_pdfleri limit 0");
} catch (e) {
  console.error("Ön koşul yok (yerel yığın, uygulama ya da iki yeni migration):", e.message);
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

/* ---------- Tohum ---------- */
const A = await kullanici("kabul-elif", "Elif Aydın");
const B = await kullanici("kabul-baska", "Başka Öğrenci");
const BELGE = { type: "doc", content: [
  h(1, "Giriş"),
  p("Uzaktan öğrenme, pandemi döneminde yükseköğretimin varsayılan biçimi hâline geldi."),
  p("Önceki araştırmalar yalnızlık puanlarının daha yüksek olduğunu gösteriyor (Kaya, 2021). Akran grupları bu etkiyi azaltıyor (Demir, 2019). Başka bir görüş de var (Yılmaz, 2010)."),
  h(2, "Araştırmanın amacı"),
  p("Çalışmanın amacı akran temasının etkisini değerlendirmektir."),
  h(1, "Yöntem"),
  p("Üç fakülteden öğrencilere iki dalga hâlinde anket uygulandı."),
] };
const ESKI = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${A.id}','thesis','Eski Tez: Akran Teması ve Yalnızlık') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text, include_toc) values ('${ESKI}', ${q(JSON.stringify(BELGE))}::jsonb, 'x', true)`);
const IKINCI = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${A.id}','article','İkinci Çalışma') returning id`).split("\n")[0];
// S8 dışa aktarma: içeriği bilinen bir belge (başlık, atıflar, tablo etiketi, kaynakça; içindekiler açık).
const CIKTI_METINLERI = {
  paragraf1: "Uzaktan öğrenme birinci sınıf öğrencilerinde yalnızlığı artırdı (Kaya, 2021).",
  paragraf2: "Akran çalışma grupları bu etkiyi azaltıyor (Demir, 2019).",
  tablo: "Katılımcıların fakültelere göre dağılımı",
  kaynak1: "Demir, B. (2019). Peer study groups in higher education. Synthetic Review, 4(1), 10–22.",
  kaynak2: "Kaya, A. (2021). Remote learning and student wellbeing. Journal of Synthetic Studies, 12(3), 201–219.",
};
const CIKTI_BELGESI = { type: "doc", content: [
  h(1, "Giriş"), p(CIKTI_METINLERI.paragraf1), p(CIKTI_METINLERI.paragraf2),
  { type: "paragraph", attrs: { caption: "table" }, content: [{ type: "text", text: CIKTI_METINLERI.tablo }] },
  h(1, "Kaynakça"), p(CIKTI_METINLERI.kaynak1), p(CIKTI_METINLERI.kaynak2),
] };
const CIKTI = psql(`insert into public.academic_projects (owner_id, project_type, title, belge_dili) values ('${A.id}','thesis','Çıktı Sınaması','en') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text, include_toc) values ('${CIKTI}', ${q(JSON.stringify(CIKTI_BELGESI))}::jsonb, 'x', true)`);
const BASKA_TEZ = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${B.id}','thesis','Başkasının Tezi') returning id`).split("\n")[0];
const K_KAYA = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url) values ('${A.id}','${ESKI}','Remote learning and student wellbeing','Kaya, A.','2021','https://doi.org/10.5555/kabul.2021.001') returning id`).split("\n")[0];
const K_DEMIR = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year) values ('${A.id}','${ESKI}','Peer study groups in higher education','Demir, B.','2019') returning id`).split("\n")[0];
const K_IKINCI = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year) values ('${A.id}','${IKINCI}','İkinci çalışmanın kaynağı','Ak, E.','2018') returning id`).split("\n")[0];
const K_BASKA = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year) values ('${B.id}','${BASKA_TEZ}','Başkasının kaynağı','Şahin, C.','2017') returning id`).split("\n")[0];
const pdf = sentetikPdf([["Remote learning and student wellbeing", "Kaya, A. Journal of Synthetic Studies 12(3)", "", "Remote learning increased reported isolation among first-year students.", "The effect was strongest in programmes without weekly live sessions.", "Students who joined peer study groups reported lower isolation scores."], ["Method", "Participants completed the Synthetic Isolation Scale at two time points."]]);
const yol = `${ESKI}/kaynak-pdf/kaya-${ek}.pdf`;
await fetch(`${GECIT}/storage/v1/object/project-files/${yol}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${A.erisim}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf });
const kunye = "Kaya, A. (2021). Remote learning and student wellbeing. Journal of Synthetic Studies, 12(3), 201-219.";
const PDF = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu) values ('${ESKI}','${A.id}',${q(kunye)},${q("kaya 2021 kabul " + ek)},'10.5555/kabul.2021.001','yuklendi',${q(yol)}) returning id`).split("\n")[0];
const pdfDegisik = sentetikPdf([["Remote learning and student wellbeing", "Kaya, A. Journal of Synthetic Studies 12(3)", "", "Remote learning increased reported isolation among first-year students.", "Students who joined peer study groups reported lower isolation scores."], ["Method", "The effect was strongest in programmes without weekly live sessions.", "Participants completed the Synthetic Isolation Scale at two time points."]]);

/* ---------- Kayıt ---------- */
const sonuclar = [];
const kaydet = (no, ad, durum, ayrinti) => {
  sonuclar.push({ no, ad, durum, ayrinti });
  console.log(`${durum.padEnd(10)} ${no} ${ad}${ayrinti ? ` — ${ayrinti}` : ""}`);
};
// KABUL_SADECE=S10,S11: yalnızca bu senaryolar (hata ayıklama için; teslimdeki koşu filtresizdir).
const SADECE = process.env.KABUL_SADECE ? new Set(process.env.KABUL_SADECE.split(",")) : null;
const dene = async (no, ad, fn) => {
  if (SADECE && !SADECE.has(no)) return;
  try {
    const r = await fn();
    kaydet(no, ad, r?.durum ?? "PASS", r?.ayrinti ?? "");
  } catch (e) {
    // Düşen senaryonun son sayfası görüntülenir (hata ayıklama; GORSEL verildiyse).
    if (GORSEL && sonSayfa && !sonSayfa.isClosed()) await sonSayfa.screenshot({ path: `${GORSEL}/hata-${no}.png` }).catch(() => {});
    kaydet(no, ad, "FAIL", String(e.message ?? e).split("\n")[0].slice(0, 300));
  }
};
const beklenen = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

const b = await chromium.launch();
const hatalar = [];
let sonSayfa = null;
async function oturum(k, { genislik = 1440, yukseklik = 900, dil = "tr", tema = "light", mobil = false } = {}) {
  const c = await b.newContext({ baseURL: UYG, viewport: { width: genislik, height: yukseklik }, colorScheme: tema, isMobile: mobil, hasTouch: mobil, acceptDownloads: true });
  await c.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await c.newPage();
  sonSayfa = s;
  if (process.env.KABUL_AYIKLA) s.on("response", (r) => { if (r.request().method() === "POST" && !String(r.headers()["content-type"]).includes("x-component")) console.log("AYIKLA", r.status(), r.url(), r.headers()["content-type"], r.request().headers()["next-action"]); });
  s.on("pageerror", (e) => hatalar.push(`${e.message} @ ${s.url().replace(UYG, "")}`));
  await s.goto("/"); await s.fill('input[name="email"]', k.adres); await s.fill('input[name="password"]', k.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s };
}
const editorAc = async (s, ek = "") => {
  await s.goto(`/dashboard/editor/${ESKI}/write${ek}`);
  await s.waitForSelector(".ProseMirror", { timeout: 60000 });
  await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 800 }).catch(() => {});
};
const kelimeKonumu = (s, kelime, kayma = 1) =>
  s.evaluate(([w, k]) => {
    const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = y.nextNode())) {
      const i = n.data.indexOf(w);
      if (i >= 0) {
        const r = document.createRange(); r.setStart(n, i + k); r.setEnd(n, i + k + 1);
        const d = r.getBoundingClientRect();
        return { x: d.left + d.width / 2, y: d.top + d.height / 2 };
      }
    }
    return null;
  }, [kelime, kayma]);
const goruntu = async (s, ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}.png` }); };

try {
  /* ---------- S1 ---------- */
  await dene("S1a", "eski çalışma (belge_dili NULL) açılır, düzenlenir, kaydedilir, yenilemede kalır", async () => {
    const { c, s } = await oturum(A);
    await editorAc(s);
    await s.locator(".ProseMirror p").last().click();
    await s.keyboard.press("Control+End");
    await s.keyboard.type(" Kabul-S1a-isareti.");
    await s.waitForFunction(() => /Kaydedildi|Saved/.test(document.querySelector(".yazma-kayit")?.textContent ?? ""), null, { timeout: 30000 });
    await s.reload(); await s.waitForSelector(".ProseMirror");
    beklenen((await s.locator(".ProseMirror").innerText()).includes("Kabul-S1a-isareti."), "yenilemede metin yok");
    beklenen(psql(`select coalesce(belge_dili,'NULL') from public.academic_projects where id='${ESKI}'`) === "NULL", "eski çalışmanın belge_dili doldurulmuş");
    await c.close();
  });
  let YENI = null;
  await dene("S1b", "yeni çalışma (ad, tür, belge dili EN) oluşturulur, yazılır, kaydedilir", async () => {
    const { c, s } = await oturum(A);
    await s.goto("/dashboard/editor"); await s.waitForTimeout(800);
    await s.locator(".projects-header .projects-primary-button").first().click();
    await s.fill('input[name="title"]', `Kabul Yeni Çalışma ${ek}`);
    await s.getByRole("button", { name: /^Makale/ }).click();
    await s.selectOption('select[name="belgeDili"]', "en");
    await Promise.all([s.waitForURL(/\/write/, { timeout: 60000 }), s.getByRole("button", { name: /Oluştur ve yaz/ }).click()]);
    await s.waitForSelector(".ProseMirror");
    YENI = s.url().match(/editor\/([^/]+)\/write/)[1];
    await s.locator(".ProseMirror").click(); await s.keyboard.type("New work body.");
    await s.waitForFunction(() => /Kaydedildi|Saved/.test(document.querySelector(".yazma-kayit")?.textContent ?? ""), null, { timeout: 30000 });
    beklenen(psql(`select belge_dili||'/'||project_type||'/'||coalesce(university,'-') from public.academic_projects where id='${YENI}'`) === "en/article/-", "belge dili/tür yanlış ya da üniversite soruldu");
    await c.close();
  });

  /* ---------- S2 ---------- */
  await dene("S2", "genel → çalışma gezinmesi, araç adreste; geri/ileri, doğrudan bağlantı, Esc, listeye dönüş", async () => {
    const { c, s } = await oturum(A);
    await s.goto("/dashboard/editor?q=Tez"); await s.waitForTimeout(600);
    beklenen(await s.locator(".os-gezinme .os-calisma-govde").count() === 0, "listede çalışma menüsü çıktı");
    await editorAc(s);
    beklenen(await s.locator(".os-calisma-geri").first().isVisible(), "Çalışmalarıma dön yok");
    beklenen(await s.locator(".os-calisma-ad").innerText() !== "", "çalışma adı yok");
    await s.locator('.os-calisma-govde a[href*="sol=bolumler"]').click();
    await s.waitForSelector(".os-sol-alan[data-acik='bolumler'] .sol-bolum-listesi");
    beklenen(s.url().includes("sol=bolumler"), "adres sol=bolumler değil");
    await s.goBack(); await s.waitForTimeout(500);
    beklenen(await s.locator(".os-sol-alan[data-acik]").count() === 0, "geri sonrası araç açık");
    await s.goForward(); await s.waitForSelector(".os-sol-alan[data-acik='bolumler']");
    // Odak araç alanının içindeyken (gerçek kullanımda olduğu gibi) Esc; bölüm kendisi odaklanabilir değil.
    await s.locator(".os-sol-alan .sol-bolum-listesi button, .os-sol-alan .sol-bolum-listesi a").first().focus();
    await s.keyboard.press("Escape"); await s.waitForTimeout(800);
    beklenen(!s.url().includes("sol="), "Esc aracı kapatmadı");
    await editorAc(s, "?sol=arama&sag=ai");
    beklenen(await s.locator(".os-sol-alan[data-acik='arama']").isVisible(), "doğrudan bağlantı: arama yok");
    beklenen(await s.locator(".yazim-paneli").isVisible(), "doğrudan bağlantı: AI paneli yok");
    await s.locator(".os-sol-geri").click(); await s.waitForTimeout(500);
    await s.locator(".os-calisma-geri").first().click();
    await s.waitForURL(/\/dashboard\/editor(\?|$)/);
    beklenen(s.url().includes("q=Tez"), `listeye dönüş süzgeci kaybetti: ${s.url()}`);
    await c.close();
  });

  /* ---------- S3 ---------- */
  await dene("S3", "durum koruma: arama sorgusu, kaynak süzgeci, PDF seçimi ve sayfası", async () => {
    const { c, s } = await oturum(A);
    await editorAc(s, "?sol=arama");
    await s.locator(".sol-arama-govde input[type=search]").fill("peer support loneliness");
    await s.locator('.os-calisma-govde a[href*="sol=kaynaklar"]').click({ force: true }).catch(async () => {
      await s.goto(`/dashboard/editor/${ESKI}/write?sol=kaynaklar`);
    });
    await editorAc(s, "?sol=kaynaklar");
    await s.locator(".sol-arama input").fill("Demir");
    await s.goto(`/dashboard/editor/${ESKI}/kanit`); await s.waitForTimeout(500);
    await editorAc(s, "?sol=arama");
    await s.waitForTimeout(500);
    beklenen((await s.locator(".sol-arama-govde input[type=search]").inputValue()) === "peer support loneliness", "arama sorgusu kayboldu");
    await editorAc(s, "?sol=kaynaklar"); await s.waitForTimeout(800);
    beklenen((await s.locator(".sol-arama input").inputValue()) === "Demir", "kaynak süzgeci kayboldu");
    beklenen((await s.locator(".sol-kaynak").count()) === 1, "süzgeç uygulanmadı");
    await editorAc(s, "?sag=pdf");
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    await s.getByRole("button", { name: /^Sonraki sayfa$/ }).click(); await s.waitForTimeout(800);
    await s.reload(); await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(800);
    const sayfa = await s.locator(".pdf-sayfa-girdi input").inputValue();
    beklenen(sayfa === "2", `PDF sayfası korunmadı: ${sayfa}`);
    await c.close();
  });

  /* ---------- S4 ---------- */
  await dene("S4", "panel boyutlandırma ve okunabilirlik: ölçek ≥ %85 ya da çekmece; ayırıcı klavyeyle", async () => {
    const olc = async (genislik, ek2) => {
      const { c, s } = await oturum(A, { genislik, yukseklik: 900 });
      await editorAc(s, ek2); await s.waitForTimeout(1500);
      const r = await s.evaluate(() => {
        const y = document.querySelector(".manuscript-layout");
        return { olcek: Number(getComputedStyle(document.querySelector(".manuscript-editor-content")).zoom), cekmece: y.hasAttribute("data-sag-cekmece"), sabit: y.hasAttribute("data-sabit-kagit"), ray: document.documentElement.getAttribute("data-gezinme") === "dar" };
      });
      await goruntu(s, `s4-${genislik}${ek2.replace(/[?=&]/g, "-")}`);
      return { c, s, r };
    };
    const a = await olc(1920, "?sag=pdf"); beklenen(!a.r.cekmece && a.r.olcek >= 0.85, `1920 ${JSON.stringify(a.r)}`);
    const ayirici = a.s.locator(".pdf-panel-ayirici");
    const once = Number(await ayirici.getAttribute("aria-valuenow"));
    await ayirici.focus(); await a.s.keyboard.press("ArrowLeft"); await a.s.waitForTimeout(300);
    const sonra = Number(await ayirici.getAttribute("aria-valuenow"));
    beklenen(sonra === Math.min(600, once + 24), `ayırıcı ArrowLeft: ${once} → ${sonra}`);
    await a.s.keyboard.press("End"); await a.s.waitForTimeout(300);
    beklenen(Number(await ayirici.getAttribute("aria-valuenow")) === 440, "End en dar değil");
    await a.c.close();
    const b1 = await olc(1440, "?sag=pdf"); beklenen(!b1.r.cekmece && b1.r.olcek >= 0.85 && b1.r.ray, `1440 ${JSON.stringify(b1.r)}`); await b1.c.close();
    const c1 = await olc(1280, "?sag=pdf"); beklenen(c1.r.cekmece && c1.r.olcek === 1, `1280 ${JSON.stringify(c1.r)}`); await c1.c.close();
    const d1 = await olc(1440, "?sol=arama&sag=ai"); beklenen(d1.r.cekmece, `1440 araç+AI ${JSON.stringify(d1.r)}`); await d1.c.close();
    const e1 = await olc(1024, "?sag=pdf"); beklenen(e1.r.cekmece && !e1.r.sabit, `1024 ${JSON.stringify(e1.r)}`); await e1.c.close();
    return { ayrinti: `1920 %${Math.round(a.r.olcek * 100)} sütun; 1440 %${Math.round(b1.r.olcek * 100)} ray+sütun; 1280 çekmece %100; 1024 akan+çekmece` };
  });

  /* ---------- S5 ---------- */
  await dene("S5", "kaynak–PDF bağı: başka çalışmanın/kullanıcının kaynağı reddedilir; yetkisiz kullanıcı yazamaz; meşru bağ yazılır", async () => {
    const rest = async (belirtec, govde) => {
      const r = await fetch(`${GECIT}/rest/v1/kaynak_pdfleri?id=eq.${PDF}`, { method: "PATCH", headers: { apikey: ANON, Authorization: `Bearer ${belirtec}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(govde) });
      return { durum: r.status, govde: await r.text() };
    };
    const baskaCalisma = await rest(A.erisim, { kaynak_id: K_IKINCI });
    beklenen(baskaCalisma.durum >= 400 && /ait değil/.test(baskaCalisma.govde), `başka çalışma: ${baskaCalisma.durum} ${baskaCalisma.govde.slice(0, 120)}`);
    const baskaKullanici = await rest(A.erisim, { kaynak_id: K_BASKA });
    beklenen(baskaKullanici.durum >= 400, `başka kullanıcının kaynağı: ${baskaKullanici.durum}`);
    const yetkisiz = await rest(B.erisim, { kaynak_id: K_BASKA });
    beklenen(yetkisiz.durum === 200 && yetkisiz.govde.trim() === "[]", `B, A'nın PDF'ine yazdı: ${yetkisiz.durum} ${yetkisiz.govde.slice(0, 80)}`);
    beklenen(psql(`select coalesce(kaynak_id::text,'NULL') from public.kaynak_pdfleri where id='${PDF}'`) === "NULL", "reddedilen istek bağ yazdı");
    const mesru = await rest(A.erisim, { kaynak_id: K_KAYA });
    beklenen(mesru.durum === 200 && mesru.govde.includes(K_KAYA), `meşru bağ: ${mesru.durum}`);
    // Arayüzde bağlı görünür; sonra kaldır (bir sonraki senaryo DOI eşleşmesini de sınasın).
    const { c, s } = await oturum(A);
    await editorAc(s, "?sag=pdf");
    await s.waitForSelector(".pdf-bag-durum");
    beklenen(/Kaynağa bağlı/.test(await s.locator(".pdf-bag-durum").innerText()), "arayüz bağı göstermiyor");
    await s.getByRole("button", { name: /Bağı kaldır/ }).click(); await s.waitForTimeout(1000);
    beklenen(psql(`select coalesce(kaynak_id::text,'NULL') from public.kaynak_pdfleri where id='${PDF}'`) === "NULL", "bağ kaldırılamadı");
    await c.close();
    psql(`delete from public.literature_sources where id='${K_DEMIR}'`);
    beklenen(psql(`select count(*) from public.kaynak_pdfleri where id='${PDF}'`) === "1", "kaynak silinince PDF de silindi");
    psql(`insert into public.literature_sources (id, owner_id, project_id, title, authors, year) values ('${K_DEMIR}','${A.id}','${ESKI}','Peer study groups in higher education','Demir, B.','2019')`);
  });

  /* ---------- S6 ---------- */
  await dene("S6", "atıf kartı: tek eşleşme, belirsiz eşleşme (kullanıcı seçer), eşleşme yok; doğrulanmış pasaj ve dayanağa git", async () => {
    const { c, s } = await oturum(A, { genislik: 1920, yukseklik: 1080 });
    await editorAc(s);
    const tikla = async (w, k = 1) => { const n = await kelimeKonumu(s, w, k); await s.mouse.click(n.x, n.y); await s.waitForTimeout(1200); return (await s.locator(".atif-karti").innerText().catch(() => "")).replace(/\n+/g, " | "); };
    const tek = await tikla("Kaya, 2021");
    beklenen(/Remote learning/.test(tek) && /PDF'i aç|Open PDF/.test(tek) && !/Dayanağa git/.test(tek), `tek: ${tek}`);
    await goruntu(s, "s6-kart-tek");
    const yok = await tikla("Yılmaz, 2010");
    beklenen(/eşleşmedi/.test(yok) && !/PDF'i aç/.test(yok), `yok: ${yok}`);
    // Belirsiz: aynı yazar ve yıl ikinci kaynak.
    psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year) values ('${A.id}','${ESKI}','Isolation and online cohorts','Kaya, M.','2021')`);
    await s.reload(); await s.waitForSelector(".ProseMirror"); await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 800 }).catch(() => {});
    const iki = await tikla("Kaya, 2021");
    beklenen(/Hangisi\?/.test(iki) && (await s.locator(".atif-karti-aday").count()) === 2 && !/Künye/.test(iki), `belirsiz: ${iki}`);
    await goruntu(s, "s6-kart-belirsiz");
    await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).click(); await s.waitForTimeout(400);
    beklenen(/Künye/.test(await s.locator(".atif-karti").innerText()), "seçimden sonra kart açılmadı");
    // Doğrulanmış pasaj: PDF'ten seç, doğrula, ekle; sonra karttan dayanağa git.
    await s.keyboard.press("Escape");
    await editorAc(s, "?sag=pdf");
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    if ((await s.locator(".pdf-sayfa-girdi input").inputValue()) !== "1") { await s.locator(".pdf-sayfa-girdi input").fill("1"); await s.keyboard.press("Enter"); await s.waitForTimeout(1200); }
    await s.locator(".ProseMirror p").nth(1).click(); await s.keyboard.press("End");
    // Kullanıcı gibi: önce PDF'e tıklanır (editör odağı bırakır, imleç yeri editörün durumunda kalır),
    // sonra seçim yapılır. Editör odaktayken betikle seçim kurmak imleci belge başına atıyordu.
    await s.locator(".pdf-sayfa").first().click({ position: { x: 5, y: 5 } });
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
    const k = await s.evaluate(() => { const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n, son = null; while ((n = y.nextNode())) { const j = n.data.lastIndexOf("sessions.” (Kaya"); if (j >= 0) son = { n, j: j + 12 }; } const r = document.createRange(); r.setStart(son.n, son.j); r.setEnd(son.n, son.j + 1); const d = r.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; });
    await s.mouse.click(k.x, k.y); await s.waitForTimeout(1200);
    const secilenVarMi = await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).count();
    if (secilenVarMi) await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).click();
    const kart = (await s.locator(".atif-karti").innerText()).replace(/\n+/g, " | ");
    beklenen(/Birebir eşleşti/.test(kart) && /Dayanağa git/.test(kart), `pasajlı kart: ${kart}`);
    await s.getByRole("button", { name: /Dayanağa git/ }).first().click(); await s.waitForTimeout(3000);
    const vurgu = await s.locator(".pdf-sayfa .textLayer span.pdf-pasaj").count();
    beklenen(vurgu >= 1 && /işaretlendi/.test(await s.locator(".pdf-pasaj-durum").innerText()), `vurgu: ${vurgu}`);
    await goruntu(s, "s6-dayanak");
    await c.close();
    return { ayrinti: "bulunamayan pasaj: S10" };
  });

  /* ---------- S10 ---------- */
  /*
    Bulunamayan pasaj, kontrollü düzenek: pasaj gerçek PDF'e karşı doğrulanıp
    eklenir ve "Dayanağa git" onu işaretler (önceki vurgu). Sonra tarayıcıya
    aynı PDF'in DEĞİŞİK bir kopyası verilir (Playwright route): cümle 1. sayfada
    yok, 2. sayfada var. Beklenen: hiçbir parça işaretlenmez (ne önceki vurgu
    ne 2. sayfadaki aynı cümle), kullanıcıya "bulunamadı" denir, "Pasaja
    odaklan" çıkmaz.
  */
  let PDF2 = null;
  await dene("S10", "bulunamayan pasaj: önceki ya da yanlış yer vurgulanmaz, kullanıcıya söylenir", async () => {
    // S10 için ikinci PDF (yalnızca seçici değiştirmek için) ve tarayıcıya verilecek DEĞİŞİK bir kopya:
    // doğrulanan cümle 1. sayfada YOK, 2. sayfada VAR. Sunucunun doğrulaması depodaki asıl dosyaya bakar.
    const pdf2 = sentetikPdf([["Peer study groups in higher education", "Demir, B. Synthetic Review 4(1)", "", "Peer groups met weekly during the term."]]);
    const yol2 = `${ESKI}/kaynak-pdf/demir-${ek}.pdf`;
    await fetch(`${GECIT}/storage/v1/object/project-files/${yol2}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${A.erisim}`, "Content-Type": "application/pdf", "x-upsert": "true" }, body: pdf2 });
    PDF2 = psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, durum, depo_yolu) values ('${ESKI}','${A.id}',${q("Demir, B. (2019). Peer study groups in higher education.")},${q("demir 2019 kabul " + ek)},'yuklendi',${q(yol2)}) returning id`).split("\n")[0];
    const { c, s } = await oturum(A, { genislik: 1920, yukseklik: 1080 });
    await editorAc(s, "?sag=pdf");
    if ((await s.locator(".kaynak-pdf-paneli select").first().inputValue()) !== PDF) {
      await s.locator(".kaynak-pdf-paneli select").first().selectOption(PDF);
    }
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    await s.locator(".ProseMirror p").nth(2).click(); await s.keyboard.press("End");
    await s.locator(".pdf-sayfa").first().click({ position: { x: 5, y: 5 } });
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
    const kartiAc = async () => {
      const k = await s.evaluate(() => { const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n, son = null; while ((n = y.nextNode())) { const j = n.data.lastIndexOf("sessions.” (Kaya"); if (j >= 0) son = { n, j: j + 12 }; } const r = document.createRange(); r.setStart(son.n, son.j); r.setEnd(son.n, son.j + 1); const d = r.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; });
      await s.mouse.click(k.x, k.y); await s.waitForTimeout(1200);
      if (await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).count()) await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).click();
    };
    await kartiAc();
    await s.getByRole("button", { name: /Dayanağa git/ }).first().click(); await s.waitForTimeout(3000);
    const once = await s.locator(".pdf-sayfa .textLayer span.pdf-pasaj").count();
    beklenen(once >= 1, `ön koşul: önceki vurgu yok (${once})`);
    // Düzenek: bu PDF'in baytları artık değişik kopyadan gelir; başka PDF'e geçip dönmek yeniden yüklemeyi tetikler.
    await s.route(new RegExp(`/api/kaynak-pdf/${PDF}`), (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from(pdfDegisik) }));
    await s.locator(".kaynak-pdf-paneli select").first().selectOption(PDF2);
    await s.waitForTimeout(2500);
    beklenen((await s.locator(".pdf-pasaj-durum").count()) === 0, "PDF değişince önceki 'işaretlendi' bildirimi kaldı");
    await kartiAc();
    await s.getByRole("button", { name: /Dayanağa git/ }).first().click(); await s.waitForTimeout(3500);
    const sayfa = await s.locator(".pdf-sayfa-girdi input").inputValue();
    const vurgu1 = await s.locator(".pdf-sayfa .textLayer span.pdf-pasaj").count();
    const durum = await s.locator(".pdf-pasaj-durum").innerText().catch(() => "");
    const odakla = await s.locator(".pdf-pasaja-odaklan").count();
    await goruntu(s, "s10-pasaj-bulunamadi");
    beklenen(sayfa === "1", `kayıtlı sayfaya gidilmedi: ${sayfa}`);
    beklenen(vurgu1 === 0, `1. sayfada ${vurgu1} parça işaretli`);
    beklenen(/bulunamadı/.test(durum), `bildirim: ${durum}`);
    beklenen(odakla === 0, "Pasaja odaklan düğmesi çıktı");
    await s.getByRole("button", { name: /^Sonraki sayfa$/ }).click(); await s.waitForTimeout(1500);
    const metin2 = await s.locator(".pdf-sayfa .textLayer").innerText();
    const vurgu2 = await s.locator(".pdf-sayfa .textLayer span.pdf-pasaj").count();
    beklenen(/The effect was strongest/.test(metin2), "düzenek: cümle 2. sayfada değil");
    beklenen(vurgu2 === 0, `2. sayfadaki aynı cümle işaretlendi (${vurgu2})`);
    await c.close();
    return { ayrinti: `önceki vurgu ${once} parça → değişik kopyada 1. sayfa 0, 2. sayfa 0; bildirim "${durum.slice(0, 60)}…"` };
  });

  /* ---------- S7 ---------- */
  await dene("S7", "belge dili arayüz dilinden bağımsız (Word içindekiler başlığı)", async () => {
    const icindekiler = async (k, proje, dil) => {
      const { c, s } = await oturum(k, { dil });
      const r = await s.request.get(`/api/manuscripts/${proje}/export`);
      const tampon = Buffer.from(await r.body());
      await c.close();
      const tmp = path.join(KOK, `.kabul-${crypto.randomBytes(3).toString("hex")}.docx`);
      fs.writeFileSync(tmp, tampon);
      const xml = execFileSync("unzip", ["-p", tmp, "word/document.xml"], { encoding: "utf8" });
      fs.unlinkSync(tmp);
      return { durum: r.status(), en: xml.includes("TABLE OF CONTENTS"), tr: xml.includes("İÇİNDEKİLER") };
    };
    psql(`update public.project_manuscripts set include_toc = true where project_id='${YENI}'`);
    const yeniTr = await icindekiler(A, YENI, "tr");
    beklenen(yeniTr.durum === 200 && yeniTr.en && !yeniTr.tr, `EN belge, TR arayüz: ${JSON.stringify(yeniTr)}`);
    psql(`update public.academic_projects set belge_dili='tr' where id='${YENI}'`);
    const trEn = await icindekiler(A, YENI, "en");
    beklenen(trEn.tr && !trEn.en, `TR belge, EN arayüz: ${JSON.stringify(trEn)}`);
    const eskiEn = await icindekiler(A, ESKI, "en");
    beklenen(eskiEn.en, `NULL (eski) çalışma eski kurala göre arayüz dilini izler: ${JSON.stringify(eskiEn)}`);
  });

  /* ---------- S8 ---------- */
  /*
    Dışa aktarma İÇERİĞİ: yalnızca HTTP 200 değil. Word'ün document.xml'i ve
    yazdırma sayfasının metni okunur; her paragraf, iki atıf, tablo etiketi ve
    iki kaynakça girdisi birebir aranır. Belge dili iki yönde: EN belge + TR
    arayüz → "TABLE OF CONTENTS" ve "Table 1"; TR belge + EN arayüz →
    "İÇİNDEKİLER" ve "Tablo 1". Son olarak editörü açıp tıklamak saklı içeriği
    değiştirmemeli (kart ve vurgular belgeye yazılmaz).
  */
  await dene("S8", "dışa aktarma içeriği: Word ve yazdırmada metin, atıflar, tablo etiketi, kaynakça ve belge dili korunur", async () => {
    const docxMetni = async (s) => {
      const r = await s.request.get(`/api/manuscripts/${CIKTI}/export`);
      beklenen(r.status() === 200, `Word ${r.status()}`);
      const tmp = path.join(KOK, `.kabul-${crypto.randomBytes(3).toString("hex")}.docx`);
      fs.writeFileSync(tmp, Buffer.from(await r.body()));
      const xml = execFileSync("unzip", ["-p", tmp, "word/document.xml"], { encoding: "utf8" });
      fs.unlinkSync(tmp);
      // Paragraf paragraf w:t birleştirilir (bir cümle birden çok koşuya bölünmüş olabilir).
      return xml.split("</w:p>").map((par) => [...par.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")).join("\n")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    };
    const yazdirmaMetni = async (s) => {
      const r = await s.goto(`/print/manuscript/${CIKTI}`);
      beklenen(r.status() === 200, `yazdırma ${r.status()}`);
      // Paged.js sayfalara böldükten sonra birden çok .print-sheet olur (zamanlamaya bağlı,
      // 18.11.2026 koşusunda çıktı); okunan, bölünmeden önceki KAYNAK sayfadır.
      await s.waitForSelector(".print-page > .print-sheet");
      return s.locator(".print-page > .print-sheet").first().innerText();
    };
    const icerikEksigi = (metin) => Object.entries(CIKTI_METINLERI).filter(([, v]) => !metin.includes(v)).map(([k]) => k);
    const sonuc = {};
    for (const [belge, arayuz] of [["en", "tr"], ["tr", "en"]]) {
      psql(`update public.academic_projects set belge_dili='${belge}' where id='${CIKTI}'`);
      const { c, s } = await oturum(A, { dil: arayuz });
      const word = await docxMetni(s);
      const baski = await yazdirmaMetni(s);
      await c.close();
      for (const [ad, metin] of [["Word", word], ["yazdırma", baski]]) {
        const eksik = icerikEksigi(metin);
        beklenen(eksik.length === 0, `${ad} (${belge} belge, ${arayuz} arayüz) eksik: ${eksik.join(", ")}`);
        const toc = belge === "en" ? "TABLE OF CONTENTS" : "İÇİNDEKİLER";
        const yanlisToc = belge === "en" ? "İÇİNDEKİLER" : "TABLE OF CONTENTS";
        // Word'de tablo numarası bir SEQ alanı (metinde yok): "Table . <başlık>"; yazdırmada "Table 1. <başlık>".
        const etiket = (ad) => new RegExp(`${ad}\\s*\\d*\\s*\\.\\s*${CIKTI_METINLERI.tablo}`);
        const tablo = etiket(belge === "en" ? "Table" : "Tablo");
        const yanlisTablo = etiket(belge === "en" ? "Tablo" : "Table");
        beklenen(metin.toLocaleUpperCase(belge === "en" ? "en" : "tr").includes(toc) && !metin.includes(yanlisToc), `${ad} içindekiler başlığı ${belge} değil`);
        beklenen(tablo.test(metin) && !yanlisTablo.test(metin), `${ad} tablo etiketi ${belge} değil`);
        sonuc[`${ad}-${belge}`] = "metin+atıf+tablo+kaynakça+dil";
      }
    }
    psql(`update public.academic_projects set belge_dili='en' where id='${CIKTI}'`);
    // Editörde kart açmak/tıklamak saklı içeriği değiştirmez.
    const once = psql(`select md5(content::text) from public.project_manuscripts where project_id='${CIKTI}'`);
    const { c, s } = await oturum(A);
    await s.goto(`/dashboard/editor/${CIKTI}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(1500);
    const n = await kelimeKonumu(s, "Kaya, 2021", 2);
    await s.mouse.click(n.x, n.y); await s.waitForTimeout(2500);
    await c.close();
    beklenen(psql(`select md5(content::text) from public.project_manuscripts where project_id='${CIKTI}'`) === once, "belge içeriği değişti");
    return { ayrinti: `${Object.keys(sonuc).join(", ")}; kart açmak içeriği değiştirmedi. LaTeX ve paylaşım: test:editor (latex-*, cikti-yollari)` };
  });

  /* ---------- S9 ---------- */
  await dene("S9", "klavye ve dokunma: Tab ile gezinme, Alt+Enter kart, Esc, telefonda 44 px", async () => {
    const { c, s } = await oturum(A);
    await editorAc(s);
    const n = await kelimeKonumu(s, "Demir, 2019", 2);
    await s.mouse.click(n.x, n.y); await s.keyboard.press("Escape"); await s.waitForTimeout(300);
    beklenen((await s.locator(".atif-karti").count()) === 0, "Esc kartı kapatmadı");
    await s.keyboard.press("Alt+Enter"); await s.waitForTimeout(1500);
    beklenen((await s.locator(".atif-karti").count()) === 1, "Alt+Enter kartı açmadı");
    const odak = await s.evaluate(() => document.activeElement?.closest(".atif-karti") !== null);
    beklenen(odak, "odak karta geçmedi");
    await s.keyboard.press("Escape"); await s.waitForTimeout(300);
    beklenen((await s.locator(".atif-karti").count()) === 0, "karttan Esc kapatmadı");
    await s.goto("/dashboard"); await s.keyboard.press("Tab"); await s.keyboard.press("Tab");
    beklenen(await s.evaluate(() => !!document.activeElement && document.activeElement !== document.body), "Tab odak vermedi");
    await c.close();
    const m = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
    await m.s.goto(`/dashboard/editor/${ESKI}/write?sol=bolumler`); await m.s.waitForSelector(".os-sol-alan[data-acik] .sol-bolum-listesi");
    const kucuk = await m.s.evaluate(() => Array.from(document.querySelectorAll(".os-sol-alan button, .os-sol-alan a, .os-gezinme .os-gezinme-oge")).filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim().slice(0, 30)));
    beklenen(kucuk.length === 0, `44 px altı: ${kucuk.join(", ")}`);
    await goruntu(m.s, "s9-telefon-bolumler");
    await m.c.close();
  });

  /* ---------- S11 ---------- */
  /*
    İnceleme paneli (teslim kontrolü, kılavuz, kaynakça, yorumlar). Sağ yuvanın
    sakini: AI/PDF ile aynı anda gösterilmez (iki sağ sütun olmaz, örtüşmez).
    Yalnız açıkken belgeyi %85 altına sıkıştırmaz: önce gezinme raya iner,
    yetmezse panel belgenin üstünde çekmece olur (Esc kapatır). AI/PDF açıkken
    Kontroller menüsü "İnceleme paneline geç" der ve geçer. Telefonda aynı
    menüden açılır ve panel görünür alana kaydırılır.
  */
  await dene("S11", "inceleme paneli: belgeyi sıkıştırmaz, AI/PDF ile örtüşmez, geçiş ve telefon erişimi", async () => {
    const olc = (s) => s.evaluate(() => {
      const kutu = (q) => { const e = document.querySelector(q); if (!e) return null; const st = getComputedStyle(e); if (st.display === "none" || e.hidden) return null; const d = e.getBoundingClientRect(); return d.width && d.height ? { x: d.left, y: d.top, w: d.width, h: d.height } : null; };
      const ust = (a, b2) => Boolean(a && b2 && a.x < b2.x + b2.w - 1 && b2.x < a.x + a.w - 1 && a.y < b2.y + b2.h - 1 && b2.y < a.y + a.h - 1);
      const inc = kutu(".manuscript-outline"), sag = kutu(".kaynak-pdf-paneli") || kutu(".yazim-paneli"), kagit = kutu(".manuscript-editor-content");
      return {
        olcek: Number(getComputedStyle(document.querySelector(".manuscript-editor-content")).zoom || 1),
        yer: document.querySelector(".manuscript-layout").getAttribute("data-inceleme-yer"),
        inceleme: Boolean(inc), sag: Boolean(sag), incSag: ust(inc, sag), incKagit: ust(inc, kagit),
        incGorunur: inc ? inc.y < innerHeight && inc.y + inc.h > 0 : false,
        tasma: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    const kontroller = async (s) => {
      await s.locator('button[aria-label^="Kontroller"], button[aria-label^="Checks"]').first().click();
      return s.locator(".arac-menu-pencere:not([hidden]) .arac-menu-oge", { hasText: /İnceleme panel/ }).first();
    };
    const sonuc = [];
    for (const [g, y] of [[1920, 1080], [1440, 900], [1280, 800]]) {
      const { c, s } = await oturum(A, { genislik: g, yukseklik: y });
      await c.addInitScript(() => { try { localStorage.setItem("arvolab:inceleme-paneli", "1"); } catch {} });
      for (const ek of ["", "?sol=kaynaklar"]) {
        await editorAc(s, ek); await s.waitForTimeout(1500);
        const r = await olc(s);
        sonuc.push(`${g}${ek ? "+araç" : ""}: ${r.yer} %${Math.round(r.olcek * 100)}`);
        beklenen(r.inceleme && !r.tasma, `${g}${ek}: panel yok ya da yatay taşma ${JSON.stringify(r)}`);
        if (r.yer === "sutun") beklenen(r.olcek >= 0.85 && !r.incKagit, `${g}${ek}: sütunda belge ${r.olcek} / örtüşme`);
        else beklenen(r.yer === "cekmece" && r.olcek >= 0.85, `${g}${ek}: ${JSON.stringify(r)}`);
        if (r.yer === "cekmece") {
          await goruntu(s, `s11-cekmece-${g}`);
          await s.locator(".manuscript-outline button").first().focus();
          await s.keyboard.press("Escape"); await s.waitForTimeout(500);
          beklenen(!(await olc(s)).inceleme, `${g}${ek}: çekmece Esc ile kapanmadı`);
          await s.evaluate(() => { localStorage.setItem("arvolab:inceleme-paneli", "1"); window.dispatchEvent(new Event("arvolab:editor-tercihi")); });
        }
      }
      for (const sag of ["pdf", "ai"]) {
        await editorAc(s, `?sag=${sag}`); await s.waitForTimeout(1500);
        const r = await olc(s);
        beklenen(!r.inceleme && r.sag && !r.incSag, `${g} ${sag}: inceleme ile sağ panel aynı anda ${JSON.stringify(r)}`);
      }
      /*
        AI açıkken incelemeye ulaşmak. Sütun yerleşiminde Kontroller menüsü
        görünür: "İnceleme paneline geç". Çekmece yerleşiminde (dar masaüstü)
        çekmece başlık satırını örter; yol paneli kapatmaktır, inceleme
        tercihi açık olduğu için panel kendiliğinden geri gelir.
      */
      const cekmece = await s.locator(".manuscript-layout[data-sag-cekmece]").count();
      if (!cekmece) {
        const oge = await kontroller(s);
        beklenen(/İnceleme paneline geç/.test(await oge.innerText()), "AI açıkken menü 'geç' demiyor");
        await oge.click(); await s.waitForTimeout(1200);
        sonuc.push(`${g} AI sütun → menüden geçiş`);
      } else {
        await s.getByRole("button", { name: /^Paneli kapat$/ }).click(); await s.waitForTimeout(1200);
        sonuc.push(`${g} AI çekmece → kapat, inceleme geri gelir`);
      }
      const g2 = await olc(s);
      beklenen(g2.inceleme && !g2.sag && !s.url().includes("sag="), `${g}: geçiş çalışmadı ${JSON.stringify(g2)}`);
      if (g === 1440) await goruntu(s, "s11-gecis-1440");
      await c.close();
    }
    // Telefon: menüden açılır ve panel görünür alana kaydırılır; PDF tam ekranken kapatınca inceleme geri gelir.
    const m = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
    await editorAc(m.s);
    await m.s.evaluate(() => { localStorage.setItem("arvolab:inceleme-paneli", "0"); window.dispatchEvent(new Event("arvolab:editor-tercihi")); });
    await m.s.waitForTimeout(600);
    beklenen(!(await olc(m.s)).inceleme, "telefon: tercih kapalıyken panel açık");
    const ac = await kontroller(m.s);
    beklenen(/İnceleme panelini aç/.test(await ac.innerText()), "telefon: menüde 'aç' yok");
    await ac.click(); await m.s.waitForTimeout(1500);
    const t1 = await olc(m.s);
    beklenen(t1.inceleme && t1.incGorunur && !t1.tasma, `telefon: panel görünür değil ${JSON.stringify(t1)}`);
    await goruntu(m.s, "s11-telefon-inceleme");
    await editorAc(m.s, "?sag=pdf"); await m.s.waitForTimeout(1500);
    const t2 = await olc(m.s);
    beklenen(!t2.inceleme && t2.sag, `telefon PDF: ${JSON.stringify(t2)}`);
    await m.s.getByRole("button", { name: /^Kaynak panelini kapat$/ }).click(); await m.s.waitForTimeout(1200);
    const t3 = await olc(m.s);
    beklenen(t3.inceleme && !t3.sag && !t3.tasma, `telefon: PDF kapanınca inceleme yok ${JSON.stringify(t3)}`);
    await m.c.close();
    return { ayrinti: sonuc.join("; ") + "; AI/PDF açıkken gizli (örtüşme yok); telefon menüden açılır ve görünür alana gelir" };
  });

  /* ---------- S12 ---------- */
  /*
    Kayıtlı AI cevapları, yerel model taklidiyle (scripts/yerel-yigin/
    model-taklidi.mjs; gerçek sağlayıcı yok). Sohbette bir cevap üretilir
    (+1 kayıt, +1 taklit isteği). Sayfa yeniden açılınca sohbet boştur,
    Kayıtlı sekmede cevap ve isteği durur; sekmeyi açmak ve oradan eklemek
    YENİ kayıt ve model isteği üretmez. Kullanıcı/çalışma ayrımı: başka
    kullanıcının, başka çalışmanın ve başka yeteneğin kaydı listede yok.
    Güncel kaynak denetimi: kütüphanede olmayan kaynağa atıflı eski cevap
    eklenmez, belge değişmez.
  */
  await dene("S12", "Kayıtlı AI cevapları: yeniden açılınca durur, yalnızca kullanıcının bu çalışmadaki kayıtları, model/hak tüketmez, ekleme denetimli", async () => {
    const taklitIstekleri = () => {
      try { return fs.readFileSync(process.env.STUDYO_ISTEM_KAYDI ?? "/tmp/claude-0/-home-user/222306a4-3182-58d4-a2c9-d7c5715a80b4/scratchpad/tasarim/istem-kaydi.jsonl", "utf8").split("\n").filter(Boolean).length; } catch { return 0; }
    };
    try { await fetch("http://127.0.0.1:54900/v1/chat/completions", { method: "POST", body: "{}" }); } catch { return { durum: "UNVERIFIED", ayrinti: "model taklidi çalışmıyor (54900)" }; }
    const kayitSayisi = () => Number(psql(`select count(*) from public.ai_assistant_runs where user_id='${A.id}'`));
    // Ayrım için tohum: başka kullanıcı, başka çalışma, başka yetenek; ayrıca kaynağı kütüphanede olmayan eski bir cevap.
    const satir = (uid, proje, yetenek, metin, istek) =>
      psql(`insert into public.ai_assistant_runs (user_id, project_id, capability, status, output, findings, context, created_at) values ('${uid}','${proje}','${yetenek}','completed',${q(JSON.stringify({ yanit: "Tohum.", metin }))},${q(JSON.stringify({ gorev: "paragraf", istek }))}::jsonb,'tohum', now() - interval '1 day')`);
    satir(B.id, BASKA_TEZ, "yazim", "BASKA-KULLANICI-CEVABI metni.", "B isteği");
    satir(A.id, IKINCI, "yazim", "BASKA-CALISMA-CEVABI metni.", "İkinci çalışma isteği");
    satir(A.id, ESKI, "kaynak", "BASKA-YETENEK-CEVABI metni.", "Kaynak sohbeti");
    satir(A.id, ESKI, "yazim", "Bu bulgu önceki çalışmalarla uyumlu (Şahin, 2017).", "SILINMIS-KAYNAK-ISTEGI");
    const { c, s } = await oturum(A, { genislik: 1920, yukseklik: 1080 });
    await editorAc(s, "?sag=ai");
    const once = { kayit: kayitSayisi(), taklit: taklitIstekleri() };
    await s.locator(".yazim-girdi textarea").fill("KABUL-S12 akran grupları için bir paragraf yaz");
    await s.locator(".yazim-girdi button[type=submit]").click();
    await s.waitForSelector(".yazim-oneri-metin", { timeout: 60000 });
    const sonra = { kayit: kayitSayisi(), taklit: taklitIstekleri() };
    beklenen(sonra.kayit === once.kayit + 1 && sonra.taklit === once.taklit + 1, `üretim: kayıt ${once.kayit}→${sonra.kayit}, taklit ${once.taklit}→${sonra.taklit}`);
    // Yeniden aç: sohbet boş, Kayıtlı'da cevap ve istek.
    await editorAc(s, "?sag=ai");
    beklenen((await s.locator(".yazim-oneri-metin").count()) === 0, "yeniden açılınca sohbet dolu (beklenen: boş, cevap Kayıtlı'da)");
    await s.locator("#yazim-sekme-kayitli").click();
    await s.waitForSelector(".yazim-kayitli-kart, .yazim-kayitli-bos", { timeout: 30000 });
    const liste = await s.locator(".yazim-kayitli").innerText();
    beklenen(/KABUL-S12/.test(liste) && /Demir, 2019/.test(liste), `Kayıtlı'da cevap/istek yok: ${liste.slice(0, 200)}`);
    beklenen(!/BASKA-KULLANICI|BASKA-CALISMA|BASKA-YETENEK/.test(liste), `ayrım: ${liste.match(/BASKA-[A-Z]+/g)}`);
    beklenen(/SILINMIS-KAYNAK-ISTEGI/.test(liste), "kütüphane dışı atıflı eski cevap listede yok");
    await goruntu(s, "s12-kayitli");
    const acinca = { kayit: kayitSayisi(), taklit: taklitIstekleri() };
    beklenen(acinca.kayit === sonra.kayit && acinca.taklit === sonra.taklit, "Kayıtlı sekmeyi açmak kayıt/model isteği üretti");
    // Ekle: denetimden geçen cevap imlece girer, asistan izi taşır.
    await s.locator(".ProseMirror p").last().click(); await s.keyboard.press("End");
    const kart = s.locator(".yazim-kayitli-kart", { hasText: "KABUL-S12" });
    await kart.getByRole("button", { name: /İmlece ekle/ }).click();
    await s.waitForFunction(() => document.querySelector(".ProseMirror")?.textContent?.includes("Akran çalışma grupları birinci sınıf"), null, { timeout: 30000 });
    const iz = await s.evaluate(() => Array.from(document.querySelectorAll(".ProseMirror [data-asistan-izi], .ProseMirror .asistan-izi")).some((e) => e.textContent.includes("Akran çalışma grupları")));
    beklenen(iz, "eklenen metin asistan izi taşımıyor");
    // Kütüphanede olmayan kaynağa atıflı eski cevap: eklenmez, nedeni yazar.
    const metinOnce = await s.locator(".ProseMirror").innerText();
    const eski = s.locator(".yazim-kayitli-kart", { hasText: "SILINMIS-KAYNAK-ISTEGI" });
    await eski.getByRole("button", { name: /İmlece ekle/ }).click();
    await eski.locator(".yazim-kayitli-hata").waitFor({ timeout: 30000 });
    const hata = await eski.locator(".yazim-kayitli-hata").innerText();
    beklenen(/kütüphanenizde yok/.test(hata), `hata metni: ${hata}`);
    beklenen((await s.locator(".ProseMirror").innerText()) === metinOnce && !/Şahin, 2017/.test(metinOnce), "kütüphane dışı atıflı metin belgeye girdi");
    const son = { kayit: kayitSayisi(), taklit: taklitIstekleri() };
    beklenen(son.kayit === sonra.kayit && son.taklit === sonra.taklit, `ekleme/denetim kayıt ya da model isteği üretti: ${JSON.stringify(son)}`);
    await c.close();
    return { ayrinti: `üretim +1 kayıt/+1 taklit; yeniden açma, Kayıtlı ve iki ekleme denemesi +0; 3 yabancı kayıt görünmedi; Şahin (2017) atıflı cevap eklenmedi` };
  });

  /* ---------- S13 ---------- */
  await dene("S13", "Gezinme prototip gruplamasıyla; Kaynakça ve Kılavuz ve biçim araçları; kalıcı kılavuz şeridi yok; üst başlık çalışmayı anlatır", async () => {
    const { c, s } = await oturum(A, { genislik: 1440, yukseklik: 900 });
    await editorAc(s);
    const gruplar = await s.evaluate(() => Array.from(document.querySelectorAll(".os-calisma-grup")).map((g) => ({ ad: g.querySelector(".os-calisma-grup-ad, .os-gezinme-ad")?.textContent?.trim(), ogeler: Array.from(g.querySelectorAll("ul a .os-gezinme-ad")).map((e) => e.textContent.trim()), kapali: g.querySelector("ul")?.hidden ?? false })));
    const ozet = gruplar.map((g) => `${g.ad}: ${g.ogeler.join(", ")}${g.kapali ? " (kapalı)" : ""}`).join(" | ");
    beklenen(ozet.startsWith("Yaz: Belge, Bölümler | Araştır: Kaynaklar, Makale bul, Arvo AI | Kontrol et: Kaynakça, Kılavuz ve biçim, Özet ve teslim | Diğer araçlar:"), `gruplar: ${ozet}`);
    beklenen(gruplar[3]?.kapali && gruplar[3].ogeler.length === 4, `Diğer araçlar kapalı ve 4 öğe değil: ${ozet}`);
    beklenen((await s.locator(".kilavuz-satiri").count()) === 0, "kalıcı kılavuz şeridi duruyor");
    const baslik = await s.locator(".os-marka-sayfa").innerText();
    beklenen(baslik === "Belge · Eski Tez: Akran Teması ve Yalnızlık", `üst başlık: ${baslik}`);
    // Diğer araçlar açılır, öğesi çalışır ve çalışma bağlamı korunur.
    await s.locator(".os-calisma-ikincil-bas").click();
    await s.locator("#os-calisma-ikincil-liste a", { hasText: "Kanıt matrisi" }).click();
    await s.waitForURL(/\/kanit/);
    beklenen(await s.locator(".os-calisma-geri").first().isVisible(), "Kanıt matrisinde çalışma gezinmesi yok");
    beklenen((await s.locator(".os-marka-sayfa").innerText()).startsWith("Kanıt matrisi · "), "Kanıt matrisinde üst başlık");
    // Kılavuz ve biçim: kılavuz yok + iki yol + biçim özeti + kontrol.
    await editorAc(s, "?sol=kilavuz");
    const k = s.locator(".os-sol-alan[data-acik='kilavuz']");
    await k.waitFor();
    const kmetin = await k.innerText();
    beklenen(/kılavuz yok/i.test(kmetin) && /Kenar boşlukları/.test(kmetin), `Kılavuz aracı: ${kmetin.slice(0, 160)}`);
    beklenen((await k.locator('a[href*="kilavuz"]').count()) >= 1 && (await k.getByRole("link", { name: "Kurumu seç" }).count()) === 1, "Kılavuzumu yükle / Kurumu seç yok");
    await goruntu(s, "s13-kilavuz");
    // Kaynakça: stil, kaynakça bölümü, uyum ve atıf yapılmamış kaynaklar.
    await editorAc(s, "?sol=kaynakca");
    const r = s.locator(".os-sol-alan[data-acik='kaynakca']");
    await r.waitFor(); await s.waitForTimeout(1500);
    const rmetin = await r.innerText();
    beklenen(/Atıf stili/.test(rmetin) && /KAYNAKÇA UYUMU|kaynakça uyumu/.test(rmetin), `Kaynakça aracı: ${rmetin.slice(0, 160)}`);
    const git = r.getByRole("button", { name: /bölümüne git/ });
    if (await git.count()) {
      await git.click(); await s.waitForTimeout(800);
      beklenen(await s.evaluate(() => { const h = Array.from(document.querySelectorAll(".ProseMirror h1, .ProseMirror h2")).find((e) => /Kaynakça/.test(e.textContent)); if (!h) return false; const d = h.getBoundingClientRect(); return d.top >= 0 && d.top < innerHeight; }), "Kaynakça bölümüne gidilmedi");
    }
    await goruntu(s, "s13-kaynakca");
    await c.close();
    // Telefon: Çalışma sayfasında dört grup, Kaynakça ve Kılavuz ve biçim doğrudan.
    const m = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
    await editorAc(m.s);
    await m.s.locator(".os-gezinme-daha:visible").first().click();
    await m.s.waitForTimeout(600);
    const dmetin = await m.s.locator("dialog[open]").first().evaluate((d) => d.textContent).catch(() => "");
    beklenen(/Kaynakça/.test(dmetin) && /Kılavuz ve biçim/.test(dmetin) && /Diğer araçlar/.test(dmetin), `telefon Çalışma sayfası: ${dmetin.slice(0, 200)}`);
    await goruntu(m.s, "s13-telefon-calisma");
    await m.c.close();
    return { ayrinti: ozet };
  });

  /* ---------- S14 ---------- */
  await dene("S14", "PDF denetimleri ortak görünümde (koyu tema dahil); çekmece başlığı örtmez; telefonda alt çubuk ve ölçek davranışı", async () => {
    // Koyu tema: kaynak seçici, sayfa kutusu ve arama varsayılan açık gri değil; field-control ile aynı zemin.
    const kd = await oturum(A, { genislik: 1920, yukseklik: 1080, tema: "dark" });
    await kd.s.evaluate(() => { document.documentElement.dataset.theme = "dark"; try { localStorage.setItem("arvolab.tema", "dark"); } catch {} });
    await editorAc(kd.s, "?sag=pdf");
    await kd.s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    const zemin = await kd.s.evaluate(() => {
      const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      return ["." + "kaynak-pdf-secici select", ".pdf-sayfa-girdi input", ".pdf-ara input"].map((q) => { const e = document.querySelector(q); const st = getComputedStyle(e); return { q, sinif: e.classList.contains("field-control"), zemin: st.backgroundColor, lum: lum(st.backgroundColor) }; });
    });
    beklenen(zemin.every((z) => z.sinif && z.lum < 0.35), `koyu temada denetim zeminleri: ${JSON.stringify(zemin)}`);
    await goruntu(kd.s, "s14-pdf-koyu");
    await kd.c.close();
    // 1280: PDF çekmece; üstü editör başlığının altında, Kontroller ve Dışa aktar tıklanabilir, kapatma görünür.
    const d = await oturum(A, { genislik: 1280, yukseklik: 800 });
    await editorAc(d.s, "?sag=pdf"); await d.s.waitForTimeout(1500);
    const g = await d.s.evaluate(() => {
      const panel = document.querySelector(".kaynak-pdf-paneli").getBoundingClientRect();
      const baslik = document.querySelector(".yazma-basligi").getBoundingClientRect();
      const ust = (q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e.contains(x); };
      return { panelUst: Math.round(panel.top), baslikAlt: Math.round(baslik.bottom), kontroller: ust('button[aria-label^="Kontroller"]'), disaAktar: ust('button[aria-label^="Word"], button[aria-label^="Dışa"], .yazma-eylemleri .projects-filter-button:last-child'), kapat: ust('.kaynak-pdf-paneli button[aria-label="Kaynak panelini kapat"]') };
    });
    beklenen(g.panelUst >= g.baslikAlt && g.kontroller && g.kapat, `1280 çekmece: ${JSON.stringify(g)}`);
    await goruntu(d.s, "s14-cekmece-1280");
    await d.c.close();
    // 1472: AI paneli açılınca belge kaymaz, editör başlığı görünür kalır. (Karşılaştırma 08'de görülen 159 px
    // kayma odaktan değil, çalışmanın geri yüklenen okuma konumundandı; temiz açılışta kayma olmamalı.)
    const ai = await oturum(A, { genislik: 1472, yukseklik: 921 });
    await editorAc(ai.s, "?sag=ai"); await ai.s.waitForTimeout(1500);
    const a = await ai.s.evaluate(() => ({ kayma: Math.round(document.scrollingElement.scrollTop), baslikUst: Math.round(document.querySelector(".yazma-basligi").getBoundingClientRect().top), panelUst: Math.round(document.querySelector(".yazim-paneli").getBoundingClientRect().top) }));
    beklenen(a.kayma === 0 && a.baslikUst > 0 && a.panelUst >= 0, `1472 AI açılışı: ${JSON.stringify(a)}`);
    await ai.c.close();
    // Telefon: PDF alt çubuğun üstünde biter; alt çubuk görünür ve tıklanır; pasaj yokken sığdır + yakınlaştırma çalışır.
    const m = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
    await editorAc(m.s, "?sag=pdf");
    await m.s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    const t = await m.s.evaluate(() => {
      const panel = document.querySelector(".kaynak-pdf-paneli").getBoundingClientRect();
      const alt = document.querySelector(".os-calisma-telefon, .os-gezinme").getBoundingClientRect();
      const belge = Array.from(document.querySelectorAll(".os-gezinme a, .os-calisma-telefon a")).find((a) => /Belge/.test(a.textContent) && a.offsetParent);
      const r = belge?.getBoundingClientRect();
      const x = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return { panelAlt: Math.round(panel.bottom), altUst: Math.round(alt.top), belgeTiklanir: Boolean(belge && belge.contains(x)), olcek: document.querySelector(".pdf-yuzde")?.textContent?.match(/(\d+)/)?.[1] };
    });
    beklenen(t.panelAlt <= t.altUst + 1 && t.belgeTiklanir, `telefon PDF/alt çubuk: ${JSON.stringify(t)}`);
    await m.s.getByRole("button", { name: /^Yakınlaştır$/ }).click(); await m.s.waitForTimeout(700);
    const yakin = await m.s.evaluate(() => document.querySelector(".pdf-yuzde")?.textContent?.match(/(\d+)/)?.[1]);
    beklenen(Number(yakin) > Number(t.olcek), `yakınlaştırma: ${t.olcek}% → ${yakin}%`);
    await goruntu(m.s, "s14-telefon-pdf");
    await m.c.close();
    return { ayrinti: `koyu zemin lum ${zemin.map((z) => z.lum.toFixed(2)).join("/")}; 1280 panel üstü ${g.panelUst} ≥ başlık altı ${g.baslikAlt}; 1472 AI açılışı kayma ${a.kayma}, başlık üstü ${a.baslikUst}; telefon panel altı ${t.panelAlt} ≤ alt çubuk ${t.altUst}, ölçek ${t.olcek}%→${yakin}% (pasajlı odak S15)` };
  });

  /* ---------- S15 ---------- */
  /*
    Telefonda pasajlı odak: doğrulanmış alıntı telefonda eklenir, atıf kartından
    "Dayanağa git" → PDF okunabilir ölçekte (≥ %160) açılır, vurgulu parça
    görünür alandadır, "Pasaja odaklan" düğmesi vardır.
  */
  await dene("S15", "telefonda pasaj: okunabilir ölçekte odak, vurgu görünür alanda", async () => {
    const { c, s } = await oturum(A, { genislik: 390, yukseklik: 844, mobil: true });
    await editorAc(s, "?sag=pdf");
    if ((await s.locator(".kaynak-pdf-paneli select").first().inputValue()) !== PDF) await s.locator(".kaynak-pdf-paneli select").first().selectOption(PDF);
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
    if ((await s.locator(".pdf-sayfa-girdi input").inputValue()) !== "1") { await s.locator(".pdf-sayfa-girdi input").fill("1"); await s.keyboard.press("Enter"); await s.waitForTimeout(1200); }
    // Telefonda PDF paneli belgeyi örttüğü için imleç dokunarak konamıyor; ilk
    // denemede imleç belgenin başında (Giriş başlığı) kaldı ve alıntı başlığın
    // İÇİNE eklendi. İmleç masaüstü senaryosundaki gibi 3. paragrafın sonuna konur.
    await s.evaluate(() => {
      const ed = document.querySelector(".ProseMirror").editor;
      let hedef = null, say = 0;
      ed.state.doc.descendants((n, pos) => { if (hedef !== null) return false; if (n.type.name === "paragraph" && ++say === 3) hedef = pos + n.nodeSize - 1; });
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
    // Telefonda panel eklemeden sonra kapanır; atfa dokun → kart → Dayanağa git.
    const k = await s.evaluate(() => { const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n, son = null; while ((n = y.nextNode())) { const j = n.data.lastIndexOf("sessions.” (Kaya"); if (j >= 0) son = { n, j: j + 12 }; } if (!son) return null; const r = document.createRange(); r.setStart(son.n, son.j); r.setEnd(son.n, son.j + 1); son.n.parentElement.scrollIntoView({ block: "center" }); const d = r.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; });
    beklenen(k, "eklenen atıf bulunamadı");
    // Kaydırma oturmadan dokunulursa kart açılmıyor: kart açılana kadar en fazla üç deneme.
    for (let deneme = 0; deneme < 3 && !(await s.locator(".atif-karti").count()); deneme++) {
      await s.waitForTimeout(500);
      const k2 = await s.evaluate(() => { const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n, son = null; while ((n = y.nextNode())) { const j = n.data.lastIndexOf("sessions.” (Kaya"); if (j >= 0) son = { n, j: j + 12 }; } const r = document.createRange(); r.setStart(son.n, son.j); r.setEnd(son.n, son.j + 1); const d = r.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; });
      await s.mouse.click(k2.x, k2.y); await s.waitForTimeout(1200);
    }
    if (await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).count()) await s.locator(".atif-karti-aday", { hasText: "Remote learning" }).click();
    await s.getByRole("button", { name: /Dayanağa git/ }).first().click(); await s.waitForTimeout(3500);
    const r = await s.evaluate(() => {
      const olcek = Number(document.querySelector(".pdf-yuzde")?.textContent?.match(/(\d+)/)?.[1] ?? 0);
      const v = document.querySelector(".pdf-sayfa .textLayer span.pdf-pasaj");
      const d = v?.getBoundingClientRect();
      const alan = document.querySelector(".pdf-sayfa-alani")?.getBoundingClientRect();
      // Okunur ölçekte cümle ekrandan geniş olabilir: BAŞI ve satırı görünür alanda olmalı.
      const kapat = document.querySelector(".kaynak-pdf-paneli")?.querySelector('button[aria-label*="kapat"], button[aria-label*="Close"]')?.getBoundingClientRect();
      return { olcek, vurgu: Boolean(v), gorunur: Boolean(d && alan && d.top >= alan.top && d.bottom <= alan.bottom && d.left >= alan.left - 1 && d.left < alan.right - 40), odakla: Boolean(document.querySelector(".pdf-pasaja-odaklan")), kapatGorunur: Boolean(kapat && kapat.top >= 0 && kapat.bottom <= innerHeight) };
    });
    await goruntu(s, "s15-telefon-pasaj");
    beklenen(r.olcek >= 160 && r.vurgu && r.gorunur && r.odakla && r.kapatGorunur, `telefon pasaj: ${JSON.stringify(r)}`);
    await c.close();
    return { ayrinti: `ölçek %${r.olcek}, pasajın başı görünür alanda, Pasaja odaklan var, panelin kapatma düğmesi ekranda` };
  });

  /* ---------- S16 ---------- */
  /*
    Kaynak listesi + belge + PDF (4. tur). 1472 ve 1440'ta liste şeride iner,
    PDF belgenin yanında sütundur ve belge ≥ %85; 1280'de liste açık kalır,
    PDF geçici çekmecedir. Her genişlikte PDF açıkken belgeye tıklanır,
    yazılır, kayıt veritabanında görülür; PDF kapatılınca seçim aynı yerde
    kalır, odak belgeye döner ve yazmaya kaldığı yerden devam edilir.
  */
  await dene("S16", "kaynak listesi + belge + PDF: şerit/sütun ya da geçici çekmece; PDF açıkken imleç, yazma, kaydetme, kapatınca konum", async () => {
    const icerik = (isaret) => psql(`select position(${q(isaret)} in content::text) > 0 from public.project_manuscripts where project_id='${ESKI}'`) === "t";
    const kayitBekle = async (isaret) => { for (let i = 0; i < 30; i++) { if (icerik(isaret)) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };
    const yerlesim = (s) => s.evaluate(() => {
      const kok = document.documentElement, y = document.querySelector(".manuscript-layout");
      const sol = document.querySelector(".os-sol-alan")?.getBoundingClientRect();
      const kagit = document.querySelector(".manuscript-editor-content")?.getBoundingClientRect();
      const pdf = document.querySelector(".kaynak-pdf-paneli")?.getBoundingClientRect();
      const ipucu = document.querySelector(".kaynak-pdf-cekmece-ipucu");
      return {
        serit: kok.hasAttribute("data-sol-alan-dar"), solEn: Math.round(sol?.width ?? 0),
        cekmece: y.hasAttribute("data-sag-cekmece"), olcek: Number(getComputedStyle(document.querySelector(".manuscript-editor-content")).zoom),
        yanyana: Boolean(kagit && pdf && kagit.right <= pdf.left + 1), ipucu: Boolean(ipucu && ipucu.offsetParent),
      };
    });
    const durumOku = (s) => s.evaluate(() => { const e = document.querySelector(".ProseMirror").editor; return { from: e.state.selection.from, odak: e.view.hasFocus(), kayma: Math.round(scrollY) }; });
    const yazVeKaydet = async (s, isaret) => {
      const k = await kelimeKonumu(s, "Çalışmanın amacı", 0);
      beklenen(k, "paragraf bulunamadı");
      await s.mouse.click(k.x - 2, k.y); await s.waitForTimeout(300);
      await s.keyboard.type(`${isaret} `, { delay: 15 });
      beklenen(await kayitBekle(isaret), `${isaret} kaydedilmedi`);
      return durumOku(s);
    };
    const kapatSonrasi = async (s, once, isaret) => {
      await s.waitForTimeout(800);
      const sonra = await durumOku(s);
      beklenen(sonra.from === once.from, `kapatınca seçim değişti: ${once.from} → ${sonra.from}`);
      beklenen(sonra.odak, "kapatınca odak belgeye dönmedi");
      beklenen(Math.abs(sonra.kayma - once.kayma) <= 4, `kapatınca belge kaydı: ${once.kayma} → ${sonra.kayma}`);
      await s.keyboard.type("+", { delay: 15 });
      beklenen(await kayitBekle(`${isaret} +Çalışmanın`), "kaldığı yerden yazılamadı");
    };
    const ozet = [];
    for (const [g, y] of [[1472, 921], [1440, 900]]) {
      const { c, s } = await oturum(A, { genislik: g, yukseklik: y });
      await editorAc(s, "?sol=kaynaklar&sag=pdf");
      await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(800);
      const l = await yerlesim(s);
      beklenen(l.serit && l.solEn <= 66 && !l.cekmece && l.yanyana && l.olcek >= 0.85, `${g} yerleşim: ${JSON.stringify(l)}`);
      await goruntu(s, `s16-${g}-serit`);
      const isaret = `KABUL-S16-${g}`;
      const once = await yazVeKaydet(s, isaret);
      if (g === 1472) {
        // Şeritten liste geri açılır → PDF geçici çekmece; Esc kapatır, liste tam genişlikte kalır.
        await s.locator(".os-sol-genislet").click(); await s.waitForTimeout(900);
        const ac = await yerlesim(s);
        beklenen(!ac.serit && ac.solEn >= 290 && ac.cekmece && ac.ipucu, `şeritten genişletince: ${JSON.stringify(ac)}`);
        await goruntu(s, "s16-1472-genis-cekmece");
        await s.keyboard.press("Escape");
        beklenen(await s.locator(".kaynak-pdf-paneli").count() === 0 || !(await s.locator(".kaynak-pdf-paneli").isVisible()), "Esc çekmeceyi kapatmadı");
        await kapatSonrasi(s, once, isaret);
        const son = await yerlesim(s);
        beklenen(!son.serit && son.solEn >= 290, `kapatınca liste: ${JSON.stringify(son)}`);
        ozet.push(`1472 şerit ${l.solEn}px, belge %${Math.round(l.olcek * 100)}, PDF yan yana; şeritten açınca çekmece, Esc kapatır`);
      } else {
        await s.locator('.kaynak-pdf-paneli button[aria-label="Kaynak panelini kapat"]').click();
        await kapatSonrasi(s, once, isaret);
        ozet.push(`1440 şerit ${l.solEn}px, belge %${Math.round(l.olcek * 100)}, PDF yan yana; kapat → konum ve odak korunur`);
      }
      await c.close();
    }
    {
      const { c, s } = await oturum(A, { genislik: 1280, yukseklik: 800 });
      await editorAc(s, "?sol=kaynaklar&sag=pdf");
      await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(800);
      const l = await yerlesim(s);
      beklenen(!l.serit && l.solEn >= 290 && l.cekmece && l.ipucu && l.olcek >= 0.85, `1280 yerleşim: ${JSON.stringify(l)}`);
      await goruntu(s, "s16-1280-cekmece");
      const isaret = "KABUL-S16-1280";
      const once = await yazVeKaydet(s, isaret);
      // İmleç belgedeyken Esc: ProseMirror Esc'i her zaman işlenmiş sayar; çekmece yine de kapanmalı.
      await s.keyboard.press("Escape"); await s.waitForTimeout(500);
      beklenen((await s.locator(".kaynak-pdf-paneli").count()) === 0 || !(await s.locator(".kaynak-pdf-paneli").isVisible()), "1280: imleç belgedeyken Esc çekmeceyi kapatmadı");
      await kapatSonrasi(s, once, isaret);
      ozet.push(`1280 liste açık, PDF geçici çekmece (belge %${Math.round(l.olcek * 100)}); çekmece açıkken yazıldı, Esc → konum ve odak korunur`);
      await c.close();
    }
    return { ayrinti: ozet.join("; ") };
  });

  /* ---------- S17 ---------- */
  /*
    Makale bul, KAYITLI (sentetik) dizin yanıtlarıyla. Yerel ortamın dış ağı
    yok; sunucu scripts/yerel-yigin/kayitli-dizin-yanitlari.mjs ile
    başlatıldıysa OpenAlex/Crossref aramaları kayitli-yanitlar/ altındaki
    yanıtlara çevrilir. Bu GERÇEK DİZİN KABULÜ DEĞİLDİR: sonuç listesinin
    yerleşimi, birleştirme ve "Listeme ekle" davranışı sınanır.
  */
  await dene("S17", "Makale bul (kayıtlı sentetik dizin yanıtları, gerçek dizin değil): sonuç listesi yerleşimi ve Listeme ekle", async () => {
    const KAYIT = process.env.KAYITLI_DIZIN_KAYDI;
    if (!KAYIT) return { durum: "UNVERIFIED", ayrinti: "KAYITLI_DIZIN_KAYDI verilmedi; sunucu kayıtlı yanıt düzeneğiyle başlatılmamış olabilir" };
    const satir = () => (fs.existsSync(KAYIT) ? fs.readFileSync(KAYIT, "utf8").trim().split("\n").filter(Boolean).length : 0);
    const { c, s } = await oturum(A, { genislik: 1472, yukseklik: 921 });
    await editorAc(s, "?sol=arama");
    const alan = s.locator(".os-sol-alan");
    const once = satir();
    await alan.locator('input[type="search"], input[type="text"]').first().fill("peer study groups loneliness");
    await alan.getByRole("button", { name: /Dizinlerde ara/ }).click();
    await alan.locator(".bulgu-satiri").first().waitFor({ timeout: 20000 }).catch(() => {});
    if (satir() === once) { await c.close(); return { durum: "UNVERIFIED", ayrinti: "arama kayıtlı yanıtlara gitmedi (sunucu düzeneksiz başlatılmış)" }; }
    beklenen(satir() - once === 2, `kayıtlı yanıt isteği ${satir() - once} (2 bekleniyor: OpenAlex + Crossref)`);
    const l = await alan.evaluate((a) => {
      const satirlar = Array.from(a.querySelectorAll(".bulgu-satiri"));
      const r = a.getBoundingClientRect();
      const tasan = satirlar.filter((x) => { const d = x.getBoundingClientRect(); return d.left < r.left - 1 || d.right > r.right + 1; }).length;
      const dugmeler = satirlar.map((x) => x.querySelector(".bulgu-eylemler button, .bulgu-eylemler .status-pill")).filter(Boolean);
      const gorunmeyen = dugmeler.filter((d) => { const b = d.getBoundingClientRect(); return b.width < 1 || b.left < r.left - 1 || b.right > r.right + 1; }).length;
      // Satır içeriğine göre boylanır: başlık + yazar + rozet + düğme 260 px'i geçmez; rozet bir satır yüksekliğinde.
      const enUzun = Math.max(...satirlar.map((x) => x.getBoundingClientRect().height));
      const rozet = Math.max(0, ...satirlar.flatMap((x) => Array.from(x.querySelectorAll(".pill-row .status-pill")).map((p) => p.getBoundingClientRect().height)));
      return { sayi: satirlar.length, metin: a.innerText, tasan, gorunmeyen, enUzun: Math.round(enUzun), rozet: Math.round(rozet), yatay: a.querySelector(".os-sol-alan-yuva")?.scrollWidth > a.querySelector(".os-sol-alan-yuva")?.clientWidth + 1 };
    });
    beklenen(l.sayi === 4 && /4 kayıt/.test(l.metin), `sonuç sayısı: ${l.sayi}`);
    beklenen(/Peer support and loneliness/.test(l.metin) && /Synthetic Education Council/.test(l.metin) && /Nakamura, K\., Ak, E\., Şahin, C\. vd\./.test(l.metin), "sonuç satırları beklenen içerikte değil");
    beklenen(l.tasan === 0 && l.gorunmeyen === 0 && !l.yatay, `yerleşim taşması: ${JSON.stringify({ tasan: l.tasan, gorunmeyen: l.gorunmeyen, yatay: l.yatay })}`);
    beklenen(l.enUzun <= 260 && l.rozet <= 32, `satır boyu: en uzun ${l.enUzun}px, rozet ${l.rozet}px`);
    await goruntu(s, "s17-makale-bul-kayitli");
    const hedef = await alan.locator("select").first().inputValue().catch(() => "");
    beklenen(hedef === ESKI, `eklenecek çalışma bu çalışma değil: ${hedef}`);
    const ilk = alan.locator(".bulgu-satiri", { hasText: "Peer support and loneliness" });
    await ilk.getByRole("button", { name: /Listeme ekle/ }).click();
    await ilk.getByText("Listenizde").waitFor({ timeout: 15000 });
    const say = () => Number(psql(`select count(*) from public.literature_sources where owner_id='${A.id}' and project_id='${ESKI}' and title='Peer support and loneliness during online study: a two-wave survey'`));
    beklenen(say() === 1, `eklenen kayıt sayısı ${say()}`);
    // Yeniden arama: sunucu listedeki kaydı "Listenizde" işaretler; ikinci ekleme düğmesi yok.
    await alan.getByRole("button", { name: /Dizinlerde ara/ }).click(); await s.waitForTimeout(2500);
    beklenen(await alan.locator(".bulgu-satiri", { hasText: "Peer support and loneliness" }).getByRole("button", { name: /Listeme ekle/ }).count() === 0, "yeniden aramada eklenen kayıt yine eklenebilir görünüyor");
    beklenen(say() === 1, "kayıt iki kez eklendi");
    await c.close();
    return { ayrinti: `SENTETİK kayıtlı yanıt (gerçek dizin değil): OpenAlex 3 + Crossref 2 → 4 satır (aynı DOI birleşti), taşma yok, en uzun satır ${l.enUzun}px; Listeme ekle bu çalışmaya 1 kayıt yazdı, yeniden aramada "Listenizde"` };
  });

  /* ---------- S18 ---------- */
  /*
    Odak modunda Esc (son kabul, 18.11.2026). Denetim "[role=dialog]"
    arıyordu; ortak pencere kapalıyken de sayfada role="dialog" ile durduğu
    için Esc odak modundan hiç çıkarmıyordu. Burada: imleç belgedeyken ve
    gövdedeyken Esc çıkarır; açık bir pencere (Kısayollar) varken ilk Esc
    yalnızca pencereyi kapatır, odak modu sürer.
  */
  await dene("S18", "odak modu: Esc çıkarır; açık pencere varken önce pencere kapanır", async () => {
    const { c, s } = await oturum(A, { genislik: 1440, yukseklik: 900 });
    await editorAc(s);
    const odakMi = () => s.evaluate(() => document.querySelector(".manuscript-layout").hasAttribute("data-odak"));
    const menu = async () => { await s.getByRole("button", { name: /^Bul, odak modu/ }).first().click(); await s.waitForTimeout(200); };
    const ac = async () => { await menu(); await s.getByRole("button", { name: /^Odak modu/ }).first().click(); await s.waitForTimeout(400); beklenen(await odakMi(), "odak modu açılmadı"); };
    const kapali = await s.evaluate(() => document.querySelectorAll("[role=dialog]").length);
    await ac();
    await s.locator(".ProseMirror p").first().click(); await s.keyboard.press("Escape"); await s.waitForTimeout(400);
    beklenen(!(await odakMi()), `imleç belgedeyken Esc odak modundan çıkarmadı (sayfada ${kapali} kapalı pencere)`);
    await ac();
    await s.evaluate(() => document.activeElement?.blur()); await s.keyboard.press("Escape"); await s.waitForTimeout(400);
    beklenen(!(await odakMi()), "gövdedeyken Esc odak modundan çıkarmadı");
    await ac();
    await menu(); await s.getByRole("button", { name: /^Klavye kısayolları/ }).first().click();
    await s.locator(".drawer-root.open").waitFor({ timeout: 5000 });
    await s.keyboard.press("Escape"); await s.waitForTimeout(500);
    beklenen((await s.locator(".drawer-root.open").count()) === 0, "Esc Kısayollar penceresini kapatmadı");
    beklenen(await odakMi(), "açık pencere varken Esc odak modundan da çıkardı");
    await s.keyboard.press("Escape"); await s.waitForTimeout(400);
    beklenen(!(await odakMi()), "pencere kapandıktan sonra Esc odak modundan çıkarmadı");
    await c.close();
    return { ayrinti: `sayfada ${kapali} kapalı pencere varken: belgede Esc çıkar, gövdede Esc çıkar; Kısayollar açıkken ilk Esc yalnızca pencereyi kapatır, ikinci Esc çıkar` };
  });

  /* ---------- S19 ---------- */
  /*
    Kaynak listesi + belge + PDF, ara genişlikler (son kabul). Aynı sayfada
    imleç belgedeyken pencere 1560'tan 1200'e ve geri boyutlandırılır; her
    genişlikte: yatay taşma yok; PDF sütunsa belge ≥ %85 ve PDF belgeyle
    çakışmıyor; çekmeceyse ipucu ve kapatma düğmesi görünür; Kontroller
    tıklanabilir; imleç ve odak korunur. Sonda kaldığı yerden yazılır.
  */
  await dene("S19", "kaynak listesi + belge + PDF: ara genişliklerde taşma yok, %85 ya da çekmece, odak ve imleç korunur", async () => {
    const { c, s } = await oturum(A, { genislik: 1472, yukseklik: 900 });
    await editorAc(s, "?sol=kaynaklar&sag=pdf");
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(800);
    const k = await kelimeKonumu(s, "Çalışmanın amacı", 0);
    await s.mouse.click(k.x - 2, k.y); await s.waitForTimeout(300);
    const bas = await s.evaluate(() => document.querySelector(".ProseMirror").editor.state.selection.from);
    const satirlar = [];
    for (const g of [1560, 1500, 1472, 1440, 1400, 1360, 1320, 1280, 1240, 1200, 1280, 1440, 1472]) {
      await s.setViewportSize({ width: g, height: 900 }); await s.waitForTimeout(900);
      const r = await s.evaluate(() => {
        const y = document.querySelector(".manuscript-layout");
        const kagit = document.querySelector(".manuscript-editor-content").getBoundingClientRect();
        const pdf = document.querySelector(".kaynak-pdf-paneli")?.getBoundingClientRect();
        const kapat = document.querySelector('.kaynak-pdf-paneli button[aria-label="Kaynak panelini kapat"]')?.getBoundingClientRect();
        const ipucu = document.querySelector(".kaynak-pdf-cekmece-ipucu");
        const kontrol = document.querySelector('button[aria-label^="Kontroller"]');
        const kr = kontrol?.getBoundingClientRect();
        const tiklanir = Boolean(kr && kontrol.contains(document.elementFromPoint(kr.left + kr.width / 2, kr.top + kr.height / 2)));
        const e = document.querySelector(".ProseMirror").editor;
        return {
          tasma: document.documentElement.scrollWidth > innerWidth + 1,
          cekmece: y.hasAttribute("data-sag-cekmece"), serit: document.documentElement.hasAttribute("data-sol-alan-dar"),
          olcek: Number(getComputedStyle(document.querySelector(".manuscript-editor-content")).zoom),
          cakisma: Boolean(pdf && !y.hasAttribute("data-sag-cekmece") && kagit.right > pdf.left + 1),
          kapatGorunur: Boolean(kapat && kapat.top >= 0 && kapat.bottom <= innerHeight && kapat.right <= innerWidth),
          ipucu: Boolean(ipucu && ipucu.offsetParent), kontroller: tiklanir,
          from: e.state.selection.from, odak: e.view.hasFocus(),
        };
      });
      satirlar.push(`${g}:${r.serit ? "şerit" : "liste"}/${r.cekmece ? "çekmece" : "sütun"}/%${Math.round(r.olcek * 100)}`);
      beklenen(!r.tasma, `${g}: yatay taşma`);
      beklenen(r.cekmece || (r.olcek >= 0.85 && !r.cakisma), `${g}: PDF sütunken belge %${Math.round(r.olcek * 100)} ya da çakışma`);
      beklenen(!r.cekmece || r.ipucu, `${g}: çekmecede ipucu yok`);
      beklenen(r.kapatGorunur, `${g}: PDF kapatma düğmesi görünür alanda değil`);
      beklenen(r.kontroller, `${g}: Kontroller tıklanamıyor (örtülüyor)`);
      beklenen(r.from === bas && r.odak, `${g}: imleç/odak kayboldu (${bas} → ${r.from}, odak ${r.odak})`);
    }
    await s.keyboard.type("S19 ", { delay: 15 });
    const yazildi = await s.evaluate(() => document.querySelector(".ProseMirror").textContent.includes("S19 Çalışmanın amacı"));
    beklenen(yazildi, "boyutlandırmalardan sonra kaldığı yerden yazılamadı");
    await goruntu(s, "s19-1472-son");
    await c.close();
    return { ayrinti: satirlar.join(" · ") + "; taşma yok, imleç ve odak korundu, kaldığı yerden yazıldı" };
  });

  /* ---------- S20 ---------- */
  /*
    PDF çekmecesi ve Esc, yayın kabulü C6 (19.11.2026). Canlıda sayfa
    açıldıktan sonra ~2 saniye boyunca "Esc ile kapatın" yazan çekmece Esc'le
    kapanmadı: çekmece yerleşim kararından önce çiziliyor, dinleyici karar
    gelince ekleniyordu. Yerelde sunucu hızlı olduğu için ara sıfıra yakın;
    yavaş cihaz CPU kısıtlamasıyla (CDP, 6×) kurulur ve Esc ipucu GÖRÜNÜR
    görünmez basılır — kullanıcının gördüğü an. Koda gecikme eklenmedi.
    (a) erken Esc, 10 tekrar; (b) aynı sekmede Arvo AI aç/kapat → Kaynaklar →
    PDF'i aç → 1472'den 1280'e → belge → önce açık pencere (Teslim kontrolü): ilk
    Esc yalnızca pencereyi kapatır, PDF kalır; ikinci Esc PDF'i kapatır,
    10 tekrar.
  */
  await dene("S20", "PDF çekmecesi Esc: yerleşim kararından önce (yavaş cihaz) ve AI → PDF → 1472→1280 dizisi; açık pencerede ilk Esc yalnızca pencereyi kapatır", async () => {
    const belgeyeTikla = async (s) => { const k = await kelimeKonumu(s, "Uzaktan öğrenme", 3); await s.mouse.click(k.x, k.y); };
    const pdfAdreste = (s) => s.evaluate(() => new URL(location.href).searchParams.get("sag") === "pdf");
    let erken = 0;
    const e = await oturum(A, { genislik: 1280, yukseklik: 860 });
    const cdp = await e.c.newCDPSession(e.s); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    for (let i = 0; i < 10; i++) {
      await e.s.goto(`/dashboard/editor/${ESKI}/write?sol=kaynaklar&sag=pdf`);
      await e.s.locator(".kaynak-pdf-cekmece-ipucu").waitFor({ state: "visible", timeout: 60000 });
      await e.s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
      await belgeyeTikla(e.s); await e.s.keyboard.press("Escape");
      await e.s.waitForFunction(() => new URL(location.href).searchParams.get("sag") !== "pdf", null, { timeout: 8000 }).catch(() => {});
      if (!(await pdfAdreste(e.s)) && (await e.s.locator(".kaynak-pdf-paneli").count()) === 0) erken++;
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await e.c.close();
    beklenen(erken === 10, `erken Esc: çekmece ${erken}/10 kapandı`);
    const { c, s } = await oturum(A, { genislik: 1472, yukseklik: 921 });
    await editorAc(s);
    let dizi = 0, pencere = 0;
    for (let i = 0; i < 10; i++) {
      await s.setViewportSize({ width: 1472, height: 921 }); await s.waitForTimeout(300);
      await s.locator(".os-calisma-govde a", { hasText: "Arvo AI" }).first().click(); await s.locator(".yazim-paneli").waitFor({ timeout: 15000 });
      await s.locator(".yazim-paneli").getByRole("button", { name: /^Paneli kapat$/ }).click(); await s.waitForTimeout(300);
      await s.locator(".os-calisma-govde a", { hasText: "Kaynaklar" }).first().click();
      await s.locator(".os-sol-alan").getByRole("button", { name: /PDF'i aç/ }).first().click();
      await s.locator(".kaynak-pdf-paneli").waitFor({ timeout: 15000 });
      await s.setViewportSize({ width: 1280, height: 860 }); await s.waitForTimeout(500);
      beklenen(await s.locator(".kaynak-pdf-cekmece-ipucu").isVisible(), `1280'de PDF çekmece değil (tur ${i + 1})`);
      await belgeyeTikla(s);
      // 1280'de çekmece açıkken araç çubuğunun Belge menüsü çekmecenin altında kalıyor; başlıktaki Kontroller erişilebilir.
      await s.getByRole("button", { name: /^Kontroller/ }).first().click(); await s.waitForTimeout(150);
      await s.getByRole("button", { name: /^Teslim kontrolü/ }).first().click();
      await s.locator(".drawer-root.open").waitFor({ timeout: 5000 });
      await s.keyboard.press("Escape"); await s.waitForTimeout(400);
      if ((await s.locator(".drawer-root.open").count()) === 0 && (await pdfAdreste(s))) pencere++;
      await belgeyeTikla(s); await s.keyboard.press("Escape"); await s.waitForTimeout(500);
      if (!(await pdfAdreste(s)) && (await s.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror"))))) dizi++;
      // Sonraki tur için sol aracı kapat (adres temiz başlasın).
      await s.goto(`/dashboard/editor/${ESKI}/write`); await s.waitForSelector(".ProseMirror");
    }
    await c.close();
    beklenen(pencere === 10, `açık pencerede ilk Esc yalnızca pencereyi kapatmalı: ${pencere}/10`);
    beklenen(dizi === 10, `AI → PDF → 1472→1280 → belge → Esc: ${dizi}/10 kapandı`);
    return { ayrinti: `yavaş cihaz (CPU 6×) ipucu görünür görünmez Esc: ${erken}/10 kapandı; AI aç/kapat → PDF'i aç → 1472→1280 → Teslim kontrolü penceresi açıkken ilk Esc yalnızca pencereyi kapattı ${pencere}/10, ikinci Esc PDF'i kapattı ve odak belgede ${dizi}/10` };
  });

  /* ---------- Görseller: TR/EN, açık/koyu, masaüstü/tablet/telefon ---------- */
  if (GORSEL) {
    // Görseller senaryoların bıraktığı eklemelerden arınmış, tohumdaki belgeyle alınır.
    psql(`update public.project_manuscripts set content = ${q(JSON.stringify(BELGE))}::jsonb where project_id='${ESKI}'`);
    for (const [ad, ayar, adres] of [
      ["sonra-masaustu-acik-tr", { genislik: 1440 }, `/dashboard/editor/${ESKI}/write`],
      ["sonra-masaustu-koyu-en", { genislik: 1440, tema: "dark", dil: "en" }, `/dashboard/editor/${ESKI}/write?sol=kaynaklar`],
      ["sonra-masaustu-pdf-1440", { genislik: 1440 }, `/dashboard/editor/${ESKI}/write?sag=pdf`],
      ["sonra-masaustu-arama", { genislik: 1440 }, `/dashboard/editor/${ESKI}/write?sol=arama`],
      ["sonra-tablet-acik-tr", { genislik: 1024, yukseklik: 768 }, `/dashboard/editor/${ESKI}/write?sol=bolumler`],
      ["sonra-telefon-acik-tr", { genislik: 390, yukseklik: 844, mobil: true }, `/dashboard/editor/${ESKI}/write`],
      ["sonra-telefon-koyu-en", { genislik: 390, yukseklik: 844, mobil: true, tema: "dark", dil: "en" }, `/dashboard/editor/${ESKI}/write?sag=pdf`],
      ["sonra-ana-acik-tr", { genislik: 1440 }, `/dashboard`],
      ["sonra-liste-acik-tr", { genislik: 1440 }, `/dashboard/editor`],
    ]) {
      const { c, s } = await oturum(A, ayar);
      if (ayar.tema === "dark") await s.evaluate(() => { document.documentElement.dataset.theme = "dark"; try { localStorage.setItem("arvolab.tema", "dark"); } catch {} });
      await s.goto(adres); await s.waitForTimeout(2500);
      await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 800 }).catch(() => {});
      await s.waitForTimeout(800);
      await goruntu(s, ad);
      await c.close();
    }
  }
} finally {
  await b.close();
}

if (hatalar.length) kaydet("S0", "sayfa hataları (pageerror)", "FAIL", [...new Set(hatalar)].slice(0, 5).join(" | "));
else kaydet("S0", "sayfa hataları (pageerror)", "PASS", "yok");
/*
  Her tam koşu sınanan commit'in adıyla AYRI dosyaya yazılır; eski sonuç yeni
  HEAD'in kanıtı gibi görünmesin, tarihsel kanıt da üzerine yazılmasın.
  calisma-alani-kabul.json 23e927c derlemesinin (ilk teslim) sonucudur.
  Filtreli (KABUL_SADECE) koşu kanıt değildir: "-kismi" ekiyle yazılır.
*/
const cikti = path.join(KOK, `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-${HEAD.slice(0, 7)}${SADECE ? "-kismi" : ""}.json`);
fs.writeFileSync(cikti, JSON.stringify({ tarih: new Date().toISOString(), uygulama: UYG, derleme: { gitHead: HEAD, buildId: BUILD_ID, uygulamaKoduTemiz: KIRLI === "", kirliDosyalar: KIRLI ? KIRLI.split("\n") : [] }, sonuclar }, null, 2));
const fail = sonuclar.filter((r) => r.durum === "FAIL").length;
console.log(`\n${sonuclar.filter((r) => r.durum === "PASS").length} PASS, ${fail} FAIL, ${sonuclar.filter((r) => r.durum === "UNVERIFIED").length} UNVERIFIED → ${path.relative(KOK, cikti)}`);
process.exit(fail ? 1 : 0);
