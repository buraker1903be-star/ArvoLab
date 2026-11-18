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

/* ---------- Kayıt ---------- */
const sonuclar = [];
const kaydet = (no, ad, durum, ayrinti) => {
  sonuclar.push({ no, ad, durum, ayrinti });
  console.log(`${durum.padEnd(10)} ${no} ${ad}${ayrinti ? ` — ${ayrinti}` : ""}`);
};
const dene = async (no, ad, fn) => {
  try {
    const r = await fn();
    kaydet(no, ad, r?.durum ?? "PASS", r?.ayrinti ?? "");
  } catch (e) {
    kaydet(no, ad, "FAIL", String(e.message ?? e).split("\n")[0].slice(0, 300));
  }
};
const beklenen = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

const b = await chromium.launch();
const hatalar = [];
async function oturum(k, { genislik = 1440, yukseklik = 900, dil = "tr", tema = "light", mobil = false } = {}) {
  const c = await b.newContext({ baseURL: UYG, viewport: { width: genislik, height: yukseklik }, colorScheme: tema, isMobile: mobil, hasTouch: mobil, acceptDownloads: true });
  await c.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await c.newPage();
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
    return { ayrinti: "bulunamayan pasajın işaretlenmemesi birimde (tests/unit/pdf-pasaj.test.ts); arayüz mesajı yolu ayrıca UNVERIFIED (S6b)" };
  });
  kaydet("S6b", "dayanağa git: pasaj sayfada bulunamazsa arayüz mesajı", "UNVERIFIED", "doğrulanmış pasaj her zaman sayfadan geldiği için tarayıcıda üretilemedi; karar mantığı birim testinde (null → hiçbir parça işaretlenmez)");

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
  await dene("S8", "dışa aktarma ve atıf regresyonu: Word/yazdırma 200; kart açmak belgeyi değiştirmez", async () => {
    const once = psql(`select md5(content::text) from public.project_manuscripts where project_id='${YENI}'`);
    const { c, s } = await oturum(A);
    beklenen((await s.request.get(`/api/manuscripts/${ESKI}/export`)).status() === 200, "Word");
    beklenen((await s.goto(`/print/manuscript/${ESKI}`)).status() === 200, "yazdırma");
    await s.goto(`/dashboard/editor/${YENI}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(2000);
    await s.locator(".ProseMirror").click(); await s.waitForTimeout(2500);
    await c.close();
    beklenen(psql(`select md5(content::text) from public.project_manuscripts where project_id='${YENI}'`) === once, "belge içeriği değişti");
    return { ayrinti: "çıktı yolları ayrıca test:editor (cikti-yollari) ile" };
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
const cikti = path.join(KOK, "scripts/yerel-yigin/sonuclar/calisma-alani-kabul.json");
fs.writeFileSync(cikti, JSON.stringify({ tarih: new Date().toISOString(), uygulama: UYG, sonuclar }, null, 2));
const fail = sonuclar.filter((r) => r.durum === "FAIL").length;
console.log(`\n${sonuclar.filter((r) => r.durum === "PASS").length} PASS, ${fail} FAIL, ${sonuclar.filter((r) => r.durum === "UNVERIFIED").length} UNVERIFIED → ${path.relative(KOK, cikti)}`);
process.exit(fail ? 1 : 0);
