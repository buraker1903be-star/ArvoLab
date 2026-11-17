// YAZIM STÜDYOSU KABULÜ (16.11.2026): Kaynaklar → PDF aç → editör yanında oku →
// pasaj seç → Arvo AI → doğrulanmış atıf (kullanıcı onayıyla) → dışa aktar.
// Gerçek Next (next dev) + gerçek GoTrue/PostgREST/storage-api + PostgreSQL
// (yerel yığın, scripts/yerel-yigin). Yalnızca 127.0.0.1 ve sentetik
// `@yerel.test` hesapları; gerçek bir Supabase projesine bağlanmaz.
//
// Kullanım:
//   scripts/yerel-yigin/kur-depo.sh && node scripts/yerel-yigin/gecit.mjs &
//   node scripts/yerel-yigin/model-taklidi.mjs &   (asistan hattı için; yoksa S9 UNVERIFIED)
//   (next dev yığına bağlı + AI_TABAN_URL=http://127.0.0.1:54900/v1, bkz. README)
//   node scripts/yerel-yigin/studyo-kabul.mjs http://localhost:3124
// Çıkış: 0 hepsi PASS (UNVERIFIED olabilir), 1 en az bir FAIL, 2 ön koşul yok.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { sentetikPdf } from "./sentetik-pdf.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const UYGULAMA = process.argv[2] ?? "http://localhost:3124";
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const KOK = new URL("../../", import.meta.url).pathname;
// Görseller ve indirilen dosyalar depo dışında; depoya yalnızca sonuç tablosu (sonuclar/studyo-kabul.json) girer.
const CIKTI = (process.env.STUDYO_CIKTI ?? path.join(os.tmpdir(), "studyo-kabul")).replace(/\/?$/, "/");
fs.mkdirSync(CIKTI, { recursive: true });

if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(UYGULAMA)) {
  console.error("ÖN KOŞUL: uygulama adresi yalnızca localhost olabilir");
  process.exit(2);
}

const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const ANON = imzala({ role: "anon" });
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function auth(yol, { yontem = "POST", govde, belirtec = ANON, apikey = ANON } = {}) {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem,
    headers: { apikey, Authorization: `Bearer ${belirtec}`, "Content-Type": "application/json" },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const metin = await r.text();
  let json = null;
  try {
    json = JSON.parse(metin);
  } catch {
    /* boş gövde */
  }
  return { durum: r.status, json };
}

for (const [ad, adres] of [["gecit", `${GECIT}/auth/v1/health`], ["depolama", `${GECIT}/storage/v1/status`], ["uygulama", `${UYGULAMA}/`]]) {
  const ok = await fetch(adres).then((r) => r.status < 500).catch(() => false);
  if (!ok) {
    console.error(`ÖN KOŞUL YOK: ${ad} (${adres})`);
    process.exit(2);
  }
}

const sonuclar = [];
const kayit = (kimlik, ad, beklenen, gozlenen, gecti, sonuc) => {
  const s = sonuc ?? (gecti ? "PASS" : "FAIL");
  sonuclar.push({ kimlik, ad, beklenen, gozlenen, sonuc: s });
  console.log(`${s}  ${kimlik}  ${ad}\n      beklenen: ${beklenen}\n      gözlenen: ${gozlenen}`);
};
let hataSayfasi = null; // senaryo düşerse ekran görüntüsü buradan alınır
// Hedefli koşu (RC06d): STUDYO_YALNIZ="U3,U4,U5" yalnızca bu önekli senaryoları koşturur; tohum yine kurulur.
const YALNIZ = (process.env.STUDYO_YALNIZ ?? "").split(",").map((x) => x.trim()).filter(Boolean);
async function senaryo(etiket, fn) {
  if (YALNIZ.length && !YALNIZ.some((o) => etiket.startsWith(o))) return;
  try {
    await fn();
  } catch (hata) {
    await hataSayfasi?.screenshot({ path: `${CIKTI}hata-${etiket}.png` }).catch(() => {});
    kayit(etiket, "senaryo tamamlanamadı", "senaryo koşar", String(hata?.message ?? hata).split("\n")[0].slice(0, 240), false);
  }
}

// ── Tohum ────────────────────────────────────────────────────────────────
const ek = crypto.randomBytes(3).toString("hex");
const SOZLESME_SURUMU = fs.readFileSync(path.join(KOK, "lib/sozlesme/kullanim-sozlesmesi.ts"), "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
async function kullaniciAc(ad) {
  const adres = `${ad}-${ek}@yerel.test`;
  const parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
  const r = await auth("/admin/users", { govde: { email: adres, email_confirm: true }, belirtec: SERVIS, apikey: SERVIS });
  if (r.durum >= 300) throw new Error(`kullanıcı açılamadı: ${r.durum}`);
  // Şifre onaydan SONRA (G1 tetikleyicisi onayla birlikte konan şifreyi siler).
  const g = await auth(`/admin/users/${r.json.id}`, { yontem: "PUT", govde: { password: parola }, belirtec: SERVIS, apikey: SERVIS });
  if (g.durum >= 300) throw new Error(`şifre konamadı: ${g.durum}`);
  psql(
    `insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi) values ('${r.json.id}', 'kullanim_sozlesmesi', '${SOZLESME_SURUMU}', 'tr', '${"0".repeat(64)}', 'giris', true)`,
  );
  const t = await auth("/token?grant_type=password", { govde: { email: adres, password: parola } });
  if (t.durum !== 200) throw new Error(`belirteç alınamadı: ${t.durum}`);
  return { id: r.json.id, adres, parola, erisim: t.json.access_token };
}

// kunyeAnahtari (lib/kaynak-pdf.ts) ile aynı indirgeme; satırın benzersizlik anahtarı.
const kunyeAnahtari = (k) =>
  k.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 400);

const SAYFA1 = [
  "Remote learning and student wellbeing",
  "Kaya, A. Journal of Synthetic Studies 12(3)",
  "",
  "Remote learning increased reported isolation among first-year students.",
  "The effect was strongest in programmes without weekly live sessions.",
  "Students who joined peer study groups reported lower isolation scores.",
  "We surveyed 412 students across three faculties in autumn 2020.",
];
const SAYFA2 = [
  "Method",
  "Participants completed the Synthetic Isolation Scale at two time points.",
  "The scale has twelve items rated on a five point agreement format.",
  "Internal consistency was acceptable in both waves of the survey.",
];
const SAYFA3 = [
  "Discussion",
  "Structured peer contact appears to buffer the isolation of remote study.",
  "Institutions should schedule regular synchronous sessions for new cohorts.",
  "Limitations include self-report measures and a single country sample.",
];
const PDF = sentetikPdf([SAYFA1, SAYFA2, SAYFA3]);

async function depoyaYukle(kullanici, depoYolu, bayt) {
  const r = await fetch(`${GECIT}/storage/v1/object/project-files/${depoYolu}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${kullanici.erisim}`, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: bayt,
  });
  if (r.status >= 300) throw new Error(`depoya yüklenemedi (${r.status}): ${(await r.text()).slice(0, 200)}`);
}
function pdfSatiri(projeId, kunye, doi, depoYolu, olusturan = A.id) {
  return psql(
    `insert into public.kaynak_pdfleri (project_id, olusturan, kunye, kunye_anahtari, doi, durum, depo_yolu) values ('${projeId}', '${olusturan}', ${q(kunye)}, ${q(kunyeAnahtari(kunye))}, ${doi ? q(doi) : "null"}, 'yuklendi', ${q(depoYolu)}) returning id`,
  );
}

const A = await kullaniciAc("studyo-a");
const B = await kullaniciAc("studyo-b");
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${A.id}', 'thesis', 'Studyo kabul tezi ${ek}') returning id`).split("\n")[0];
// Editörün açabildiği geçerli belge (boş "content: []" şemaya uymuyor; editör kaydı durdurur).
const BELGE = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Giris paragrafi." }] }, { type: "paragraph" }] });
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PROJE}', ${q(BELGE)}::jsonb, 'Giris paragrafi.')`);
const B_PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${B.id}', 'thesis', 'B kabul tezi ${ek}') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${B_PROJE}', ${q(BELGE)}::jsonb, 'Giris paragrafi.')`);

const DOI = `10.5555/synth.${ek}.001`;
const KUNYE_KESIN = `Kaya, A. (2021). Remote learning and student wellbeing. Journal of Synthetic Studies, 12(3), 201-219. https://doi.org/${DOI}`;
const KUNYE_BELIRSIZ = "Demir, B. (2019). Peer study groups in higher education. Synthetic Review of Education, 4(1), 10-30.";
const KUNYE_YOK = "Yilmaz, C. (2018). An unrelated report on coastal erosion. Synthetic Earth Notes, 2, 1-9.";
const yol = (ad) => `${PROJE}/kaynak-pdf/y-${A.id}-${ad}-${ek}.pdf`;
await depoyaYukle(A, yol("kesin"), PDF);
await depoyaYukle(A, yol("belirsiz"), PDF);
await depoyaYukle(A, yol("yok"), PDF);
const PDF_KESIN = pdfSatiri(PROJE, KUNYE_KESIN, DOI, yol("kesin")).split("\n")[0];
const PDF_BELIRSIZ = pdfSatiri(PROJE, KUNYE_BELIRSIZ, null, yol("belirsiz")).split("\n")[0];
// Büyük PDF: 300 sayfa × 45 satır (performans/bellek; görüntüleyici tek sayfa çizer).
const BUYUK = sentetikPdf(Array.from({ length: 300 }, (_, i) => Array.from({ length: 45 }, (_, j) => `Page ${i + 1} line ${j + 1}: synthetic filler text for the large document performance check.`)));
await depoyaYukle(A, yol("buyuk"), BUYUK);
const PDF_BUYUK = pdfSatiri(PROJE, "Ozturk, D. (2020). A very long synthetic report. Synthetic Press.", null, yol("buyuk")).split("\n")[0];
const PDF_YOK = pdfSatiri(PROJE, KUNYE_YOK, null, yol("yok")).split("\n")[0];

// RELEASE CLOSURE 05: işlem sınırı (L) ve eşzamanlılık/20 MB (C) için ayrı kullanıcılar —
// sayaç kullanıcı başına, A'nın senaryoları onların hakkını tüketmesin. next dev PDF_ISLEM_SAATLIK ile koşmalı.
const SAATLIK = Number(process.env.PDF_ISLEM_SAATLIK ?? 12);
const L = await kullaniciAc("studyo-l");
const L_PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${L.id}', 'thesis', 'Sinir tezi ${ek}') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${L_PROJE}', ${q(BELGE)}::jsonb, 'Giris paragrafi.')`);
const L_PDFLER = [];
for (let i = 0; i < SAATLIK + 2; i++) {
  const yolL = `${L_PROJE}/kaynak-pdf/y-${L.id}-l${i}-${ek}.pdf`;
  await depoyaYukle(L, yolL, sentetikPdf([[...SAYFA1, `Limit test document number ${i}.`], SAYFA2]));
  L_PDFLER.push(pdfSatiri(L_PROJE, `Sinir, L. (2020). Limit test document ${i}. Synthetic.`, null, yolL, L.id).split("\n")[0]);
}
const C = await kullaniciAc("studyo-c");
const C_PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${C.id}', 'thesis', 'Yuk tezi ${ek}') returning id`).split("\n")[0];
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${C_PROJE}', ${q(BELGE)}::jsonb, 'Giris paragrafi.')`);
const IRI = sentetikPdf(Array.from({ length: 300 }, (_, i) => Array.from({ length: 45 }, (_, j) => `Page ${i + 1} line ${j + 1}: synthetic filler text for the large document performance check.`)), { dolgu: 62000 });
const C_YOL = `${C_PROJE}/kaynak-pdf/y-${C.id}-iri-${ek}.pdf`;
await depoyaYukle(C, C_YOL, IRI);
const PDF_IRI = pdfSatiri(C_PROJE, "Yuk, C. (2022). A 19 MB synthetic report. Synthetic Press.", null, C_YOL, C.id).split("\n")[0];
const sayacDegeri = (k) => Number(psql(`select coalesce((select count from public.auth_rate_limits where key = '${k}'), 0)`));
// Kütüphane: DOI'si eşleşen tek kayıt (kesin) + başlığı benzeyen iki kayıt (belirsiz; DOI yok, sessizce seçilmemeli).
const LIT_KESIN = psql(
  `insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, container_title, volume, issue, pages) values ('${A.id}', '${PROJE}', 'Remote learning and student wellbeing', 'Kaya, A.', 2021, ${q(`https://doi.org/${DOI.toUpperCase()}`)}, 'Journal of Synthetic Studies', '12', '3', '201-219') returning id`,
).split("\n")[0];
const LIT_ADAY1 = psql(
  `insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${A.id}', '${PROJE}', 'Peer study groups in higher education', 'Demir, B.', 2019, 'Synthetic Review of Education') returning id`,
).split("\n")[0];
const LIT_ADAY2 = psql(
  `insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title) values ('${A.id}', '${PROJE}', 'Peer study groups in higher education: a replication', 'Demir, B.; Ak, E.', 2022, 'Synthetic Review of Education') returning id`,
).split("\n")[0];
console.log(`tohum: proje ${PROJE} · pdf ${PDF_KESIN}/${PDF_BELIRSIZ}/${PDF_YOK} · kütüphane ${LIT_KESIN}/${LIT_ADAY1}/${LIT_ADAY2}`);

// ── Tarayıcı ─────────────────────────────────────────────────────────────
const tarayici = await chromium.launch();
const yeniBaglam = (secenek = {}) => tarayici.newContext({ baseURL: UYGULAMA, ...secenek });
async function girisYap(sayfa, k) {
  await sayfa.goto("/");
  await sayfa.fill('input[name="email"]', k.adres);
  await sayfa.fill('input[name="password"]', k.parola);
  await Promise.all([sayfa.waitForURL(/\/dashboard/, { timeout: 60000 }), sayfa.press('input[name="password"]', "Enter")]);
}
const EDITOR = `/dashboard/editor/${PROJE}/write`;
async function editoruAc(sayfa) {
  await sayfa.goto(EDITOR, { timeout: 120000 });
  await sayfa.waitForSelector(".ProseMirror", { timeout: 120000 });
}
async function pdfPaneliniAc(sayfa, pdfId) {
  await sayfa.getByRole("button", { name: /Kaynak PDF/ }).first().click();
  await sayfa.waitForSelector(".kaynak-pdf-paneli select", { timeout: 60000 });
  await sayfa.selectOption(".kaynak-pdf-paneli select", pdfId);
  await sayfa.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 90000 });
}

// Kaynak değiştirir ve YENİ belgenin metin katmanını bekler. Üç PDF'in metni aynı:
// eski katmanda metni görüp seçim kurmak, katman yenilenince seçimi kaybettiriyordu.
async function kaynakDegistir(sayfa, pdfId) {
  const yanit = sayfa.waitForResponse((r) => r.url().includes(`/api/kaynak-pdf/${pdfId}`), { timeout: 60000 }).catch(() => null);
  await sayfa.selectOption(".kaynak-pdf-paneli select", pdfId);
  await yanit;
  await sayfa.waitForTimeout(800);
  await sayfa.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
  await sayfa.waitForTimeout(400);
}

// Sunucu işlemini arayüz olmadan çağırır (oturum çerezleriyle): istemci denetimini aşan
// biri ne görür? Kimlikler Next'in sunucu başvuru manifestinden.
function islemKimligi(dosyaParcasi, ad) {
  const m = JSON.parse(fs.readFileSync(path.join(KOK, ".next/dev/server/server-reference-manifest.json"), "utf8"));
  for (const [kimlik, kayit] of Object.entries(m.node ?? {})) {
    if (kayit.exportedName === ad && String(kayit.filename ?? "").includes(dosyaParcasi)) return kimlik;
  }
  throw new Error(`işlem kimliği yok: ${ad}`);
}
async function islemCagir(sayfa, kimlik, arguman) {
  return sayfa.evaluate(
    async ({ kimlik, govde }) => {
      // İstek bulunulan sayfaya gider: başka birinin çalışma adresine POST, o sayfanın notFound'una takılır.
      const r = await fetch(location.pathname, {
        method: "POST",
        headers: { "Next-Action": kimlik, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" },
        body: govde,
      });
      return { durum: r.status, metin: await r.text() };
    },
    { kimlik, govde: JSON.stringify([arguman]) },
  );
}
const islemSonucu = (metin) => {
  if (process.env.STUDYO_AYIKLA) console.log("[işlem yanıtı]", metin.slice(0, 400));
  // Geliştirme kipinde önce hata ayıklama satırı (1:D"$2") gelir; sonuç, 1: ile başlayan JSON satırıdır.
  const satir = metin.split("\n").filter((s) => /^1:[{["]/.test(s)).pop();
  try {
    return satir ? JSON.parse(satir.slice(2)) : null;
  } catch {
    return null;
  }
};

// Metin katmanında, verilen satırları kapsayan gerçek bir tarayıcı seçimi kurar ve
// görüntüleyicinin dinlediği pointerup olayını yollar (fareyle sürüklemenin karşılığı).
async function satirlariSec(sayfa, ilk, son = ilk) {
  const ok = await sayfa.evaluate(
    ({ ilk, son }) => {
      const spanlar = [...document.querySelectorAll(".pdf-sayfa .textLayer span")].filter((s) => s.firstChild?.nodeType === 3);
      const bas = spanlar.find((s) => s.textContent.includes(ilk));
      const bit = spanlar.find((s) => s.textContent.includes(son));
      if (!bas || !bit) return false;
      const r = document.createRange();
      r.setStart(bas.firstChild, bas.textContent.indexOf(ilk));
      r.setEnd(bit.firstChild, bit.textContent.indexOf(son) + son.length);
      const sec = window.getSelection();
      sec.removeAllRanges();
      sec.addRange(r);
      bit.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return true;
    },
    { ilk, son },
  );
  if (!ok) throw new Error(`metin katmanında bulunamadı: ${ilk}`);
}
const ISTEM_KAYDI = process.env.STUDYO_ISTEM_KAYDI ?? "/tmp/studyo-istem-kaydi.jsonl";
const istemSatirlari = () => (fs.existsSync(ISTEM_KAYDI) ? fs.readFileSync(ISTEM_KAYDI, "utf8").trim().split("\n").filter(Boolean) : []);
const istemSayisi = () => istemSatirlari().length;
const sonIstem = () => {
  const son = istemSatirlari().at(-1);
  return son ? JSON.parse(son).mesajlar.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n") : "";
};
async function degerBekle(konum, deger, sure = 10000) {
  const bitis = Date.now() + sure;
  while (Date.now() < bitis) {
    if ((await konum.inputValue().catch(() => "")) === deger) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}
const kutu = (sayfa, secici) => sayfa.locator(secici).first().boundingBox();

// ── G: yetkisiz erişim ────────────────────────────────────────────────────
await senaryo("G1", async () => {
  const c = await yeniBaglam();
  const r = await c.request.get(`/api/kaynak-pdf/${PDF_KESIN}`);
  kayit("G1", "Oturumsuz PDF isteği reddedilir", "401, gövde PDF değil", `${r.status()} ${(await r.body()).subarray(0, 5).toString()}`, r.status() === 401 && !(await r.body()).toString().startsWith("%PDF"));
  await c.close();
});
let baglamB;
await senaryo("G2", async () => {
  baglamB = await yeniBaglam();
  const s = await baglamB.newPage();
  await girisYap(s, B);
  const r = await baglamB.request.get(`/api/kaynak-pdf/${PDF_KESIN}`);
  const govde = await r.body();
  kayit("G2", "Başka kullanıcının PDF'i reddedilir (B → A'nın PDF'i)", "404 (var/yok ayırt edilmez), bayt yok", `${r.status()} ${govde.length} bayt`, r.status() === 404 && !govde.toString("latin1").startsWith("%PDF"));
  const r2 = await baglamB.request.get(`/api/kaynak-pdf/not-a-uuid`);
  kayit("G2b", "Geçersiz kimlik", "404", String(r2.status()), r2.status() === 404);
  // Depoya doğrudan (B'nin belirteciyle) gitmek de kapalı olmalı.
  const d = await fetch(`${GECIT}/storage/v1/object/project-files/${yol("kesin")}`, { headers: { apikey: ANON, Authorization: `Bearer ${B.erisim}` } });
  kayit("G2c", "B depodan A'nın dosyasını doğrudan indiremez", "4xx", String(d.status), d.status >= 400);
  const d2 = await fetch(`${GECIT}/storage/v1/object/public/project-files/${yol("kesin")}`);
  kayit("G2d", "Kova herkese açık değil (public adres)", "4xx", String(d2.status), d2.status >= 400);
});

// ── M: masaüstü yolculuk ──────────────────────────────────────────────────
const baglamA = await yeniBaglam({ viewport: { width: 1440, height: 900 } });
const sA = await baglamA.newPage();
const konsolHatalari = [];
sA.on("pageerror", (e) => konsolHatalari.push(String(e.message).slice(0, 200)));
await girisYap(sA, A);
hataSayfasi = sA;

await senaryo("G3", async () => {
  const r = await baglamA.request.get(`/api/kaynak-pdf/${PDF_KESIN}`);
  const govde = await r.body();
  const bas = r.headers();
  const ok = r.status() === 200 && govde.subarray(0, 5).toString() === "%PDF-" && /no-store/.test(bas["cache-control"] ?? "") && /private/.test(bas["cache-control"] ?? "");
  kayit("G3", "Sahibi PDF'i alır; önbelleğe girmez", "200 %PDF- · Cache-Control private, no-store", `${r.status()} ${govde.subarray(0, 5)} · ${bas["cache-control"]} · ${bas["content-type"]}`, ok);
});

await senaryo("M1", async () => {
  await editoruAc(sA);
  await pdfPaneliniAc(sA, PDF_KESIN);
  const ed = await kutu(sA, ".ProseMirror");
  const pn = await kutu(sA, ".kaynak-pdf-paneli");
  const kanvas = await kutu(sA, ".pdf-sayfa canvas");
  const yanYana = ed && pn && ed.x + ed.width <= pn.x + 1 && pn.width >= 360 && ed.width >= 420;
  await sA.screenshot({ path: path.join(CIKTI, "m1-masaustu-yan-yana.png") });
  kayit("M1", "Masaüstü: editör ve gerçek PDF sayfası yan yana", "editör solda ≥420px, panel sağda ≥360px, kanvas çizildi", `editör x=${ed?.x | 0} w=${ed?.width | 0} · panel x=${pn?.x | 0} w=${pn?.width | 0} · kanvas ${kanvas?.width | 0}×${kanvas?.height | 0}`, Boolean(yanYana && kanvas?.width > 100));
  const sayfaYazisi = await sA.locator(".pdf-goruntuleyici").innerText();
  kayit("M1b", "Sayfa sayısı gösterilir", "/ 3", sayfaYazisi.match(/\/\s*\d+/)?.[0] ?? "-", /\/\s*3/.test(sayfaYazisi));
  const tasma = await sA.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  kayit("M1c", "Masaüstünde yatay taşma yok", "0", String(tasma), tasma <= 0);
});

await senaryo("M2", async () => {
  const girdi = sA.locator(".pdf-sayfa-girdi");
  await sA.getByRole("button", { name: /Sonraki sayfa/ }).click();
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Synthetic Isolation Scale"), null, { timeout: 30000 });
  const v2 = await girdi.inputValue();
  await girdi.fill("3");
  await girdi.press("Enter");
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Discussion"), null, { timeout: 30000 });
  const v3 = await girdi.inputValue();
  await sA.getByRole("button", { name: /Önceki sayfa/ }).click();
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Method"), null, { timeout: 30000 });
  kayit("M2", "Sayfa gezinme (sonraki, numara yaz, önceki)", "2 → 3 → 2, metin katmanı sayfayla değişir", `${v2} → ${v3} → ${await girdi.inputValue()}`, v2 === "2" && v3 === "3" && (await girdi.inputValue()) === "2");
});

await senaryo("M3", async () => {
  const once = await kutu(sA, ".pdf-sayfa canvas");
  const yuzde0 = await sA.locator(".pdf-yuzde").innerText();
  await sA.getByRole("button", { name: /Yakınlaştır$/ }).click();
  await sA.waitForFunction((y) => document.querySelector(".pdf-yuzde")?.textContent !== y, yuzde0);
  await sA.waitForTimeout(400);
  const sonra = await kutu(sA, ".pdf-sayfa canvas");
  const yuzde1 = await sA.locator(".pdf-yuzde").innerText();
  const katmanEni = await sA.evaluate(() => {
    const k = document.querySelector(".pdf-sayfa .textLayer").getBoundingClientRect();
    const c = document.querySelector(".pdf-sayfa canvas").getBoundingClientRect();
    return Math.abs(k.width - c.width) + Math.abs(k.height - c.height);
  });
  kayit("M3", "Yakınlaştırma; metin katmanı kanvasla hizalı kalır", "kanvas büyür, yüzde artar, katman/kanvas farkı ≤2px", `${yuzde0}→${yuzde1} · ${once?.width | 0}→${sonra?.width | 0}px · fark ${katmanEni.toFixed(1)}px`, sonra.width > once.width && katmanEni <= 2);
  await sA.getByRole("button", { name: /Genişliğe sığdır/ }).click();
  await sA.waitForTimeout(400);
  const sigdir = await kutu(sA, ".pdf-sayfa canvas");
  const alan = await kutu(sA, ".pdf-sayfa-alani");
  kayit("M3b", "Genişliğe sığdır", "kanvas eni ≤ alan eni", `${sigdir?.width | 0} ≤ ${alan?.width | 0}`, sigdir.width <= alan.width + 1);
});

await senaryo("M4", async () => {
  await sA.fill(".pdf-ara input", "synchronous");
  await sA.press(".pdf-ara input", "Enter");
  await sA.waitForSelector(".pdf-sayfa .textLayer .pdf-esles", { timeout: 30000 });
  const sayfaNo = await sA.locator(".pdf-sayfa-girdi").inputValue();
  const sonuc = await sA.locator(".pdf-ara-sonuc").innerText().catch(() => "");
  kayit("M4", "PDF içinde arama", "3. sayfaya gider ve eşleşmeyi vurgular", `sayfa ${sayfaNo} · ${sonuc.replace(/\s+/g, " ")}`, sayfaNo === "3");
  await sA.fill(".pdf-ara input", "zzqx-yok");
  await sA.press(".pdf-ara input", "Enter");
  await sA.waitForTimeout(600);
  const yok = await sA.locator(".pdf-ara-sonuc").innerText().catch(() => "");
  kayit("M4b", "Bulunamayan arama", "'bulunamadı' bildirilir, sayfa değişmez", yok.replace(/\s+/g, " "), /bulunamadı|not found/i.test(yok));
});

await senaryo("M5", async () => {
  const once = (await kutu(sA, ".kaynak-pdf-paneli")).width;
  const ayirici = sA.locator(".pdf-panel-ayirici");
  await ayirici.focus();
  for (let i = 0; i < 4; i++) await ayirici.press("ArrowLeft");
  const genis = (await kutu(sA, ".kaynak-pdf-paneli")).width;
  await ayirici.press("Home");
  const enGenis = (await kutu(sA, ".kaynak-pdf-paneli")).width;
  // Editör SÜTUNU (yerleşimin iç sol kenarı → ayırıcıdan önceki aralık); kâğıdın iç dolgusu değil.
  const edEnDar = await sA.evaluate(() => {
    const l = document.querySelector(".manuscript-layout");
    const st = getComputedStyle(l);
    const sol = l.getBoundingClientRect().left + (parseFloat(st.paddingLeft) || 0);
    return document.querySelector(".pdf-panel-ayirici").getBoundingClientRect().left - (parseFloat(st.columnGap) || 0) - sol;
  });
  await ayirici.press("End");
  const enDar = (await kutu(sA, ".kaynak-pdf-paneli")).width;
  // Fareyle sürükleme
  const a = await kutu(sA, ".pdf-panel-ayirici");
  await sA.mouse.move(a.x + a.width / 2, a.y + 200);
  await sA.mouse.down();
  await sA.mouse.move(a.x - 150, a.y + 200, { steps: 6 });
  await sA.mouse.up();
  const surukle = (await kutu(sA, ".kaynak-pdf-paneli")).width;
  const saklanan = await sA.evaluate(() => localStorage.getItem("arvolab.pdfPanelGenisligi"));
  kayit(
    "M5",
    "Panel genişliği sınırlar içinde ayarlanır (klavye + sürükleme)",
    "←×4 büyütür; Home ≤960 ve editör ≥420; End =360; sürükleme büyütür; tercih saklanır",
    `${once | 0}→${genis | 0} · Home ${enGenis | 0} (editör ${edEnDar | 0}) · End ${enDar | 0} · sürükle ${surukle | 0} · saklanan ${saklanan}`,
    genis > once && enGenis <= 961 && edEnDar >= 419 && Math.abs(enDar - 360) <= 2 && surukle > enDar + 100 && Number(saklanan) > 0,
  );
});

await senaryo("M6", async () => {
  await sA.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
  await sA.waitForTimeout(500);
  const pdfGorunur = await sA.locator(".kaynak-pdf-paneli").isVisible().catch(() => false);
  const asistanGorunur = await sA.locator(".yazim-paneli").first().isVisible().catch(() => false);
  // Asistan paneli (mevcut tasarım) açıkken araç çubuğunun sağını örtüyor; öğrenci önce X ile kapatır.
  await sA.locator(".yazim-paneli").getByRole("button", { name: /Kapat|kapat/ }).first().click();
  await sA.getByRole("button", { name: /Kaynak PDF/ }).first().click();
  await sA.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
  const asistanSonra = await sA.locator(".yazim-paneli").first().isVisible().catch(() => false);
  const secili = await sA.locator(".kaynak-pdf-paneli select").inputValue();
  kayit(
    "M6",
    "AI paneliyle çakışma yok (biri açılınca öteki kapanır)",
    "asistan açılınca PDF gizli; PDF açılınca asistan gizli; seçili kaynak korunur",
    `asistan açıkken PDF görünür=${pdfGorunur}, asistan=${asistanGorunur} · PDF açıkken asistan=${asistanSonra} · seçili ${secili === PDF_KESIN ? "aynı" : secili}`,
    !pdfGorunur && asistanGorunur && !asistanSonra,
  );
});

// ── S: seçim, doğrulama, analiz, atıf ─────────────────────────────────────
const SEC_TEK = "Remote learning increased reported isolation among first-year students.";
await senaryo("S1", async () => {
  const girdi = sA.locator(".pdf-sayfa-girdi");
  await girdi.fill("1");
  await girdi.press("Enter");
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("first-year"), null, { timeout: 30000 });
  // İki satıra yayılan seçim: tarayıcının satır sonu/boşluk farkı sunucuda kapatılmalı.
  await satirlariSec(sA, "Remote learning increased", "weekly live sessions.");
  await sA.waitForSelector(".kaynak-secim", { timeout: 15000 });
  const secimMetni = await sA.evaluate(() => window.getSelection().toString());
  await sA.getByRole("button", { name: /Alıntı ve atıf ekle/ }).click();
  await sA.waitForSelector(".kaynak-atif .kaynak-dogrulandi, .kaynak-atif .kaynak-hata", { timeout: 60000 });
  const atif = await sA.locator(".kaynak-atif").innerText();
  kayit(
    "S1",
    "Görsel seçim sunucuda kaynak metne karşı doğrulanır (iki satır)",
    "'1. sayfasında doğrulandı'; kanonik metin iki cümleyi içerir",
    `tarayıcı seçimi ${JSON.stringify(secimMetni.slice(0, 60))}… · panel: ${atif.replace(/\s+/g, " ").slice(0, 160)}`,
    /1\. sayfas[ıi]nda doğrulandı/.test(atif) && /weekly live sessions/.test(atif),
  );
  kayit("S2", "DOI ile kesin eşleşme (büyük harf/https farkı normalleşir)", "eşleşen kaynağın başlığı, aday listesi yok", atif.replace(/\s+/g, " ").slice(0, 200), /Remote learning and student wellbeing/.test(atif) && (await sA.locator('.kaynak-atif input[type="radio"]').count()) === 0);
});

await senaryo("S3", async () => {
  // İmleci belgenin sonuna koy, basılı sayfayı yaz, ekle.
  await sA.getByLabel(/Basılı sayfa/).fill("203");
  const ekle = sA.getByRole("button", { name: /İmlece ekle/ });
  kayit("S3a", "Kesin eşleşmede ekleme düğmesi etkin", "etkin", String(await ekle.isEnabled()), await ekle.isEnabled());
  await ekle.click();
  await sA.waitForFunction(() => document.querySelector(".ProseMirror")?.textContent?.includes("Kaya"), null, { timeout: 20000 });
  const metin = await sA.locator(".ProseMirror").innerText();
  kayit(
    "S3",
    "Doğrulanmış alıntı + atıf kullanıcının düğmesiyle imlece eklenir",
    "“…isolation among first-year students…” ve (Kaya, 2021, s. 203) benzeri atıf; PDF sayfası (1) atıfta yok",
    metin.replace(/\s+/g, " ").slice(0, 260),
    /“Remote learning increased reported isolation/.test(metin) && /Kaya/.test(metin) && /2021/.test(metin) && /203/.test(metin),
  );
});

await senaryo("S4", async () => {
  // Otomatik kayıt: 'Kaydedildi' görününce yeniden yükle; içerik ve atıf korunmalı.
  await sA.waitForFunction(() => /Kaydedildi/.test(document.body.innerText) && !/Kaydediliyor|Kaydedilmedi/.test(document.querySelector(".yazma-durum, [data-kayit-durumu]")?.textContent ?? ""), null, { timeout: 60000 });
  await sA.waitForTimeout(2500);
  const db = psql(`select plain_text from public.project_manuscripts where project_id='${PROJE}'`);
  await editoruAc(sA);
  const yeniden = await sA.locator(".ProseMirror").innerText();
  kayit(
    "S4",
    "Otomatik kayıt bütünlüğü (yeniden yükleme + veritabanı)",
    "veritabanındaki düz metin ve yeniden açılan editör alıntıyı ve atfı içerir",
    `db: ${db.replace(/\s+/g, " ").slice(0, 120)} · editör: ${yeniden.replace(/\s+/g, " ").slice(0, 120)}`,
    /isolation among first-year/.test(db) && /Kaya/.test(db) && /isolation among first-year/.test(yeniden),
  );
});

await senaryo("S5", async () => {
  await pdfPaneliniAc(sA, PDF_KESIN);
  const id = islemKimligi("kaynak-pdf", "kaynakSecimiDogrula");
  const uydurma = await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: "Remote learning eliminated isolation for every student in the sample." });
  const u = islemSonucu(uydurma.metin);
  kayit("S5", "Uydurma alıntı (PDF'te yok) sunucuda reddedilir", "{hata}, metin yok", JSON.stringify(u)?.slice(0, 200), Boolean(u?.hata) && !u?.metin);
  const yanlisSayfa = islemSonucu((await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 3, metin: SEC_TEK })).metin);
  kayit("S5b", "Doğru cümle yanlış sayfa numarasıyla reddedilir", "{hata}", JSON.stringify(yanlisSayfa)?.slice(0, 200), Boolean(yanlisSayfa?.hata));
  const kisa = islemSonucu((await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: "Remote" })).metin);
  kayit("S5c", "Çok kısa seçim reddedilir", "{hata}", JSON.stringify(kisa)?.slice(0, 200), Boolean(kisa?.hata));
  const yok = islemSonucu((await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 9, metin: SEC_TEK })).metin);
  kayit("S5d", "Var olmayan sayfa reddedilir", "{hata}", JSON.stringify(yok)?.slice(0, 200), Boolean(yok?.hata));
  const dogru = islemSonucu((await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: SEC_TEK.replace(/ /g, "  ") })).metin);
  kayit("S5e", "Boşluk farkı olan gerçek alıntı kabul edilir, sunucunun metni döner", `metin = ${SEC_TEK}`, JSON.stringify(dogru)?.slice(0, 200), dogru?.metin === SEC_TEK);
  const asan = islemSonucu(
    (await islemCagir(sA, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: "We surveyed 412 students across three faculties in autumn 2020. Method Participants completed" })).metin,
  );
  kayit("S5g", "Sayfa sonundan sonraki sayfaya taşan seçim kabul edilir ve işaretlenir", "sayfa 1, sonrakiSayfaya true", JSON.stringify(asan)?.slice(0, 200), asan?.sayfa === 1 && asan?.sonrakiSayfaya === true);
  // Asistan da aynı doğrulamadan geçer: uydurma seçim modele hiç gitmez, kayıt da açılmaz.
  const sohbetId = islemKimligi("ai-kaynak-sohbeti", "kaynaklaSohbet");
  const onceSayi = psql(`select count(*) from public.ai_assistant_runs where user_id='${A.id}'`);
  const onceIstem = istemSayisi();
  const sohbet = islemSonucu(
    (await islemCagir(sA, sohbetId, { projectId: PROJE, pdfId: PDF_KESIN, soru: "Bu pasajı açıkla.", gecmis: [], secim: { sayfa: 1, metin: "Remote learning eliminated isolation for every student in the sample." } })).metin,
  );
  const sonraSayi = psql(`select count(*) from public.ai_assistant_runs where user_id='${A.id}'`);
  kayit(
    "S5f",
    "Uydurma seçimle asistan çağrısı modele gitmeden reddedilir",
    "secimReddi; modele istek yok; yeni asistan kaydı yok",
    `${JSON.stringify(sohbet)?.slice(0, 140)} · modele istek ${onceIstem}→${istemSayisi()} · kayıt ${onceSayi}→${sonraSayi}`,
    Boolean(sohbet?.secimReddi) && onceSayi === sonraSayi && onceIstem === istemSayisi(),
  );
});

await senaryo("S6", async () => {
  // B, A'nın çalışmasının PDF'i için seçim doğrulatamaz ve listesini göremez.
  const sB = await baglamB.newPage();
  await sB.goto(`/dashboard/editor/${B_PROJE}/write`, { timeout: 120000 });
  await sB.waitForSelector(".ProseMirror", { timeout: 120000 });
  const id = islemKimligi("kaynak-pdf", "kaynakSecimiDogrula");
  const r = islemSonucu((await islemCagir(sB, id, { projectId: PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: SEC_TEK })).metin);
  const r2 = islemSonucu((await islemCagir(sB, id, { projectId: B_PROJE, pdfId: PDF_KESIN, sayfa: 1, metin: SEC_TEK })).metin);
  const listeId = islemKimligi("kaynak-pdf", "goruntuleyiciKaynaklari");
  const liste = islemSonucu((await islemCagir(sB, listeId, PROJE)).metin);
  kayit(
    "S6",
    "Başka kullanıcı A'nın PDF'inden seçim doğrulatamaz / listeyi göremez",
    "iki çağrıda {hata}; liste boş",
    `${JSON.stringify(r)?.slice(0, 90)} · ${JSON.stringify(r2)?.slice(0, 90)} · liste ${JSON.stringify(liste)?.slice(0, 80)}`,
    Boolean(r?.hata) && Boolean(r2?.hata) && (liste?.satirlar?.length ?? 0) === 0,
  );
});

await senaryo("S7", async () => {
  // Belirsiz eşleşme: DOI yok, iki benzer başlık. Sessiz seçim yok; açık seçim + onay ister.
  await kaynakDegistir(sA, PDF_BELIRSIZ);
  await satirlariSec(sA, "Students who joined peer study groups reported lower isolation scores.");
  await sA.getByRole("button", { name: /Alıntı ve atıf ekle/ }).click();
  await sA.waitForSelector(".kaynak-atif .kaynak-dogrulandi, .kaynak-atif .kaynak-hata", { timeout: 60000 });
  const radyo = sA.locator('.kaynak-atif input[type="radio"]');
  const adaySayisi = await radyo.count();
  const ekle = sA.getByRole("button", { name: /İmlece ekle/ });
  const bastaKapali = !(await ekle.isEnabled());
  await radyo.first().check();
  const yalnizSecimle = await ekle.isEnabled();
  const onay = sA.getByLabel(/seçtiğim kaynak olduğunu kontrol ettim/);
  await onay.check();
  const onayla = await ekle.isEnabled();
  const metin = await sA.locator(".kaynak-atif").innerText();
  await sA.screenshot({ path: path.join(CIKTI, "s7-belirsiz-eslesme.png") });
  kayit(
    "S7",
    "Belirsiz eşleşme kullanıcıya bildirilir; açık seçim + onay olmadan ekleme yok",
    "≥2 aday, düğme başta kapalı, yalnızca seçimle kapalı, onayla açık",
    `aday ${adaySayisi} · başta kapalı ${bastaKapali} · yalnız seçim ${yalnizSecimle} · onayla ${onayla} · ${metin.replace(/\s+/g, " ").slice(0, 120)}`,
    adaySayisi >= 2 && bastaKapali && !yalnizSecimle && onayla,
  );
  await sA.getByRole("button", { name: /Vazgeç|İptal|Kapat/ }).first().click().catch(() => {});
});

await senaryo("S8", async () => {
  await kaynakDegistir(sA, PDF_YOK);
  await satirlariSec(sA, SEC_TEK);
  await sA.getByRole("button", { name: /Alıntı ve atıf ekle/ }).click();
  await sA.waitForSelector(".kaynak-atif .kaynak-dogrulandi, .kaynak-atif .kaynak-hata", { timeout: 60000 });
  const metin = await sA.locator(".kaynak-atif").innerText();
  const dugme = sA.getByRole("button", { name: /İmlece ekle/ });
  const dugmeVar = await dugme.count();
  const etkin = dugmeVar ? await dugme.isEnabled() : false;
  kayit("S8", "Kütüphanede karşılığı olmayan PDF'e atıf eklenmez", "eşleşme yok mesajı; ekleme düğmesi yok ya da kapalı", `${metin.replace(/\s+/g, " ").slice(0, 160)} · düğme ${dugmeVar ? (etkin ? "etkin" : "kapalı") : "yok"}`, !etkin);
});

await senaryo("S9", async () => {
  // Asistan analizi: gerçek kapı/istem/doğrulama/kayıt hattı, model yerine yerel taklit
  // (scripts/yerel-yigin/model-taklidi.mjs). Cevabın KALİTESİ burada ölçülmez.
  await kaynakDegistir(sA, PDF_KESIN);
  await satirlariSec(sA, SEC_TEK);
  const editorOnce = (await sA.locator(".ProseMirror").innerText()).replace(/\s+/g, " ");
  const onceSayi = Number(psql(`select count(*) from public.ai_assistant_runs where user_id='${A.id}'`));
  const onceIstem = istemSayisi();
  await sA.getByRole("button", { name: /Arvo AI ile analiz et/ }).click();
  await sA.waitForSelector(".kaynak-analiz .kaynak-cevap, .kaynak-analiz .kaynak-hata", { timeout: 90000 });
  const metin = (await sA.locator(".kaynak-analiz").innerText()).replace(/\s+/g, " ");
  const cevapVar = (await sA.locator(".kaynak-analiz .kaynak-cevap").count()) > 0;
  const sonraSayi = Number(psql(`select count(*) from public.ai_assistant_runs where user_id='${A.id}'`));
  const istem = sonIstem();
  const sayfalar = [...istem.matchAll(/--- SAYFA (\d+) ---/g)].map((m) => m[1]).join(",");
  const editorSonra = (await sA.locator(".ProseMirror").innerText()).replace(/\s+/g, " ");
  if (!cevapVar && /kapalı|AI_ANAHTAR|AI_TABAN_URL/.test(metin)) {
    kayit("S9", "Seçili pasaj Arvo AI ile analiz edilir", "cevap + PDF s. N alıntısı", `${metin.slice(0, 160)} (model sunucusu tanımlı değil)`, false, "UNVERIFIED");
    return;
  }
  kayit(
    "S9",
    "Seçili pasaj Arvo AI ile analiz edilir (aynı kapı, istem, doğrulama, kayıt); editöre kendiliğinden girmez",
    "cevap + 'PDF s. 1' alıntısı; istemde seçili pasaj ve yalnızca s.1–2; asistan kaydı +1; editör değişmez",
    `${metin.slice(0, 150)} · istem sayfaları ${sayfalar} · pasaj istemde ${istem.includes(SEC_TEK)} · modele istek ${onceIstem}→${istemSayisi()} · kayıt ${onceSayi}→${sonraSayi} · editör değişmedi ${editorOnce === editorSonra}`,
    cevapVar && /PDF s\. 1/.test(metin) && istem.includes(SEC_TEK) && sayfalar === "1,2" && sonraSayi === onceSayi + 1 && editorOnce === editorSonra,
  );
  const kayitSatiri = psql(`select capability || ' · ' || coalesce(status, '') from public.ai_assistant_runs where user_id='${A.id}' order by created_at desc limit 1`);
  kayit("S9a", "Çalışma ai_assistant_runs'a 'kaynak' yeteneğiyle yazılır", "kaynak", kayitSatiri, /^kaynak/.test(kayitSatiri));

  // Alıntı düğmesi PDF'te o sayfaya götürür.
  const girdi = sA.locator(".pdf-sayfa-girdi");
  await girdi.fill("3");
  await girdi.press("Enter");
  await degerBekle(girdi, "3");
  const oncesi = await girdi.inputValue();
  await sA.locator(".kaynak-alintilar button, .kaynak-alintilar .result-link").first().click();
  await degerBekle(girdi, "1");
  kayit("S9b", "Cevaptaki alıntının 'PDF s. N' bağlantısı PDF'te o sayfayı açar", "3 → 1", `${oncesi} → ${await girdi.inputValue()} (girdi sayısı ${await sA.locator(".pdf-sayfa-girdi").count()})`, (await girdi.inputValue()) === "1");

  // Model uydurma alıntı dönerse cevabın tamamı düşer, kullanıcıya gösterilmez.
  const oncekiCevap = await sA.locator(".kaynak-analiz .kaynak-cevap").count();
  await sA.locator(".kaynak-analiz textarea").fill("UYDUR: bu pasaj ne diyor?");
  await sA.locator(".kaynak-analiz textarea").press("Enter");
  await sA.waitForFunction((n) => document.querySelectorAll(".kaynak-analiz .kaynak-analiz-oge").length > n, oncekiCevap, { timeout: 60000 }).catch(() => {});
  await sA.waitForSelector(".kaynak-analiz .kaynak-analiz-oge:last-child .kaynak-hata, .kaynak-analiz .kaynak-analiz-oge:last-child .kaynak-cevap", { timeout: 60000 });
  const son = (await sA.locator(".kaynak-analiz .kaynak-analiz-oge").last().innerText()).replace(/\s+/g, " ");
  kayit("S9c", "Modelin uydurma alıntısı düşer; cevap gösterilmez", "hata mesajı, 'eliminated isolation' görünmez", son.slice(0, 200), !/eliminated isolation/.test(son) && (await sA.locator(".kaynak-analiz .kaynak-analiz-oge").last().locator(".kaynak-cevap").count()) === 0);
});

// ── D: dışa aktarma regresyonu ────────────────────────────────────────────
await senaryo("D1", async () => {
  const p = await baglamA.newPage();
  await p.goto(`/print/manuscript/${PROJE}`, { timeout: 120000 });
  await p.waitForLoadState("networkidle");
  const metin = await p.locator("body").innerText();
  kayit("D1", "PDF/Yazdır çıktısı alıntıyı ve atfı içerir; iz/öneri sızmaz", "“…first-year students…” + Kaya", metin.replace(/\s+/g, " ").slice(0, 200), /isolation among first-year/.test(metin) && /Kaya/.test(metin));
  await p.close();
});
await senaryo("D2", async () => {
  await editoruAc(sA);
  await sA.getByRole("button", { name: /Dışa aktar|Word, PDF ya da LaTeX/ }).first().click();
  const [indirme] = await Promise.all([sA.waitForEvent("download", { timeout: 90000 }), sA.getByRole("button", { name: /Word \(\.docx\)/ }).click()]);
  const hedef = path.join(CIKTI, "d2.docx");
  await indirme.saveAs(hedef);
  const xml = execFileSync("unzip", ["-p", hedef, "word/document.xml"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const duz = xml.replace(/<[^>]+>/g, "");
  kayit("D2", "Word çıktısı alıntıyı ve atfı içerir", "document.xml: first-year students + Kaya", `${(fs.statSync(hedef).size / 1024).toFixed(1)} KB · ${duz.match(/.{0,40}first-year.{0,60}/)?.[0] ?? "-"}`, /isolation among first-year/.test(duz) && /Kaya/.test(duz));
});

await senaryo("P1", async () => {
  // Büyük PDF: açılış ve uzak sayfaya gidiş süresi, tek kanvas, bellek artışı.
  const bellek = () => sA.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  const once = await bellek();
  // D2 editörü yeniden yükledi; panel kapalı. Açılış süresi = paneli aç + kaynağı seç + ilk sayfa çizimi.
  const t0 = Date.now();
  await pdfPaneliniAc(sA, PDF_BUYUK);
  const acilis = Date.now() - t0;
  const sayfaYazisi = await sA.locator(".pdf-goruntuleyici").innerText();
  const girdi = sA.locator(".pdf-sayfa-girdi");
  const t1 = Date.now();
  await girdi.fill("250");
  await girdi.press("Enter");
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Page 250 line 1:"), null, { timeout: 30000 });
  const gidis = Date.now() - t1;
  const kanvas = await sA.locator(".pdf-goruntuleyici canvas").count();
  const sonra = await bellek();
  const mb = (x) => (x / 1048576).toFixed(1);
  kayit(
    "P1",
    "Büyük PDF (300 sayfa): yalnızca görünen sayfa çizilir; açılış ve gidiş makul",
    "/ 300, tek kanvas, açılış < 15 sn, 250. sayfaya gidiş < 5 sn",
    `${(BUYUK.length / 1024).toFixed(0)} KB · ${sayfaYazisi.match(/\/\s*\d+/)?.[0]} · açılış ${acilis} ms · gidiş ${gidis} ms · kanvas ${kanvas} · JS yığını ${mb(once)}→${mb(sonra)} MB`,
    /\/\s*300/.test(sayfaYazisi) && kanvas === 1 && acilis < 15000 && gidis < 5000,
  );
  // Aynı belgede arama: metinler bir kez çıkarılır.
  const t2 = Date.now();
  await sA.fill(".pdf-ara input", "Page 299 line 7:");
  await sA.press(".pdf-ara input", "Enter");
  await degerBekle(girdi, "299", 30000);
  kayit("P1b", "Büyük PDF'te arama (300 sayfa metni)", "299. sayfaya gider", `sayfa ${await girdi.inputValue()} · ${Date.now() - t2} ms`, (await girdi.inputValue()) === "299");
});
await senaryo("G4", async () => {
  // 20 MB üstü dosya depoya hiç girmez (kova sınırı); uç noktanın 413'ü ikinci savunma.
  const iri = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(21 * 1024 * 1024, 0x20)]);
  const r = await fetch(`${GECIT}/storage/v1/object/project-files/${yol("iri")}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${A.erisim}`, "Content-Type": "application/pdf" },
    body: iri,
  });
  kayit("G4", "20 MB üstü PDF depoya yüklenemez", "4xx", String(r.status), r.status >= 400);
});

// ── R: RELEASE CLOSURE 05 — işlem sınırı, sayaç arızası, eşzamanlılık, 20 MB ──
async function kullaniciSayfasi(k, projeId, secenek = {}) {
  const c = await yeniBaglam(secenek);
  const sayfa = await c.newPage();
  await girisYap(sayfa, k);
  await sayfa.goto(`/dashboard/editor/${projeId}/write`, { timeout: 120000 });
  await sayfa.waitForSelector(".ProseMirror", { timeout: 120000 });
  return { c, sayfa };
}
/*
  U3/U4 kanıtı (RC06d, 17.11.2026). İlk ×5 turundaki dört düşmenin gözlenen değerleri
  saklanmamıştı ve nedenleri hâlâ bilinmiyor; bir düşme bir daha "kanıtsız" kalmasın diye her
  adımda viewport, kaydırma, yaprak ve araç çubuğu kutusu, her düğmenin üstündeki öğe ve ekran
  görüntüsü yazılır; senaryo patlarsa hata yığını da. Anlık görüntü EDİLGENDİR: kaydırmaz,
  odak değiştirmez — ölçümün kendisi sonucu etkilemesin. Çıktı depo dışında (CIKTI/kanit/<tur>).
*/
const KANIT_TUR = process.env.STUDYO_TUR ?? new Date().toISOString().replace(/[:.]/g, "-");
const KANIT_DIZIN = path.join(CIKTI, "kanit", KANIT_TUR);
function kanitBaslat(ad, sayfa) {
  fs.mkdirSync(KANIT_DIZIN, { recursive: true });
  const adimlar = [];
  const yaz = (sonuc, ek = {}) =>
    fs.writeFileSync(path.join(KANIT_DIZIN, `${ad}.json`), `${JSON.stringify({ ad, tur: KANIT_TUR, sonuc, ...ek, adimlar }, null, 2)}\n`);
  return {
    async adim(adim) {
      const i = String(adimlar.length + 1).padStart(2, "0");
      const goruntu = `${ad}-${i}.png`;
      const olcum = await sayfa
        .evaluate(() => {
          const kutu = (e) => {
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
          };
          const tanim = (e) => (e ? `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${typeof e.className === "string" && e.className ? `.${e.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}` : null);
          const dugmeler = [...document.querySelectorAll(".manuscript-araclar button")].filter((x) => x.offsetParent).map((x) => {
            const r = x.getBoundingClientRect();
            const ekranda = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
            const ust = ekranda ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
            return { ad: (x.getAttribute("aria-label") || x.textContent.trim()).slice(0, 24), kutu: kutu(x), ekranda, ustte: ekranda ? (ust === x || x.contains(ust) ? "kendisi" : tanim(ust)) : "ekran dışı" };
          });
          const vv = window.visualViewport;
          return {
            viewport: [innerWidth, innerHeight],
            gorselViewport: vv ? [Math.round(vv.width), Math.round(vv.height), Math.round(vv.offsetTop), Math.round(vv.pageTop)] : null,
            kaydirma: [Math.round(scrollX), Math.round(scrollY)],
            belgeYuksekligi: document.documentElement.scrollHeight,
            tasma: document.documentElement.scrollWidth - innerWidth,
            yaprak: kutu(document.querySelector(".yazim-paneli")),
            aracCubugu: kutu(document.querySelector(".manuscript-araclar")),
            odak: tanim(document.activeElement),
            ortulen: dugmeler.filter((d) => d.ekranda && d.ustte !== "kendisi").map((d) => `${d.ad} ← ${d.ustte}`),
            dugmeler,
          };
        })
        .catch((h) => ({ olcumHatasi: String(h?.message ?? h).split("\n")[0] }));
      await sayfa.screenshot({ path: path.join(KANIT_DIZIN, goruntu) }).catch(() => {});
      adimlar.push({ adim, zaman: new Date().toISOString(), goruntu, ...olcum });
      yaz("SÜRÜYOR");
    },
    async hata(h) {
      await this.adim("HATA ANI").catch(() => {});
      yaz("HATA", { hata: String(h?.stack ?? h) });
    },
    bitir(sonuc, ozet) {
      yaz(sonuc, { ozet });
    },
  };
}
const L_SATIR = "Remote learning increased reported isolation among first-year students.";
await senaryo("R1", async () => {
  const { c, sayfa } = await kullaniciSayfasi(L, L_PROJE);
  const id = islemKimligi("kaynak-pdf", "kaynakSecimiDogrula");
  const sonuclar_ = [];
  for (let i = 0; i < SAATLIK; i++) sonuclar_.push(islemSonucu((await islemCagir(sayfa, id, { projectId: L_PROJE, pdfId: L_PDFLER[i], sayfa: 1, metin: L_SATIR })).metin));
  const hepsiGecti = sonuclar_.every((r) => r?.metin === L_SATIR);
  const fazla = islemSonucu((await islemCagir(sayfa, id, { projectId: L_PROJE, pdfId: L_PDFLER[SAATLIK], sayfa: 1, metin: L_SATIR })).metin);
  kayit("R1", `PDF işlem sınırı: saatte ${SAATLIK} yeni PDF, sonraki reddedilir`, `${SAATLIK} kabul, ${SAATLIK + 1}. 'sınıra ulaştınız'`, `${sonuclar_.filter((r) => r?.metin).length}/${SAATLIK} kabul · fazla: ${JSON.stringify(fazla)?.slice(0, 120)} · sayaç ${sayacDegeri(`pdf-islem:${L.id}`)}`, hepsiGecti && /sınır/i.test(fazla?.hata ?? ""));
  // Önbellekteki PDF sınırdan sonra da çalışır (çözümleme yok) ve sayaç artmaz.
  const once = sayacDegeri(`pdf-islem:${L.id}`);
  const onbellekte = islemSonucu((await islemCagir(sayfa, id, { projectId: L_PROJE, pdfId: L_PDFLER[0], sayfa: 1, metin: L_SATIR })).metin);
  kayit("R1b", "Sınır dolduktan sonra önbellekteki PDF'te seçim çalışır, sayaç artmaz", "metin döner, sayaç sabit", `${JSON.stringify(onbellekte)?.slice(0, 80)} · sayaç ${once}→${sayacDegeri(`pdf-islem:${L.id}`)}`, onbellekte?.metin === L_SATIR && sayacDegeri(`pdf-islem:${L.id}`) === once);
  // Kaynak sohbeti de aynı sınırdan geçer: model çağrılmaz, asistan hakkı ve kaydı oluşmaz.
  const sohbetId = islemKimligi("ai-kaynak-sohbeti", "kaynaklaSohbet");
  const istemOnce = istemSayisi();
  const sohbet = islemSonucu((await islemCagir(sayfa, sohbetId, { projectId: L_PROJE, pdfId: L_PDFLER[SAATLIK + 1], soru: "Bu kaynak ne diyor?", gecmis: [] })).metin);
  const asistanSayaci = sayacDegeri(`ai-asistan:${L.id}`);
  const kayitSayisi = psql(`select count(*) from public.ai_assistant_runs where user_id='${L.id}'`);
  kayit("R1c", "Sınır dolunca kaynak sohbeti modele gitmez; asistan hakkı ve kaydı oluşmaz", "sınır hatası; model isteği yok; ai-asistan sayacı 0; kayıt 0", `${JSON.stringify(sohbet)?.slice(0, 100)} · model ${istemOnce}→${istemSayisi()} · ai-asistan ${asistanSayaci} · kayıt ${kayitSayisi}`, /sınır/i.test(sohbet?.hata ?? "") && istemOnce === istemSayisi() && asistanSayaci === 0 && kayitSayisi === "0");
  await c.close();
});

await senaryo("R2", async () => {
  // Sayaç arızası: service_role'ün rate_limit_hit yetkisi geçici olarak alınır (yalnız yerel yığın).
  const { c, sayfa } = await kullaniciSayfasi(C, C_PROJE);
  const id = islemKimligi("kaynak-pdf", "kaynakSecimiDogrula");
  psql("revoke execute on function public.rate_limit_hit(text, integer, interval) from service_role");
  let r;
  try {
    r = islemSonucu((await islemCagir(sayfa, id, { projectId: C_PROJE, pdfId: PDF_IRI, sayfa: 1, metin: "Page 1 line 1: synthetic filler text for the large document" })).metin);
  } finally {
    psql("grant execute on function public.rate_limit_hit(text, integer, interval) to service_role");
  }
  kayit("R2", "Sayaç çalışmazsa pahalı işlem yapılmaz (arızada kapalı), anlaşılır hata", "'sayaca ulaşılamıyor… işlenmedi'", JSON.stringify(r)?.slice(0, 160), /sayac|işlenmedi/i.test(r?.hata ?? "") && !r?.metin);
  await c.close();
});

await senaryo("R3", async () => {
  // 19 MB · 300 sayfa: soğuk çözümleme, sıcak (önbellek) ve 10 eşzamanlı istek tek çözümlemeye iner.
  const { c, sayfa } = await kullaniciSayfasi(C, C_PROJE);
  const id = islemKimligi("kaynak-pdf", "kaynakSecimiDogrula");
  const once = sayacDegeri(`pdf-islem:${C.id}`);
  const zamanli = (arg) => sayfa.evaluate(async ({ kimlik, govde }) => {
    const t0 = performance.now();
    const r = await fetch(location.pathname, { method: "POST", headers: { "Next-Action": kimlik, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body: govde });
    const metin = await r.text();
    return { ms: Math.round(performance.now() - t0), metin };
  }, { kimlik: id, govde: JSON.stringify([arg]) });
  const arg = (n) => ({ projectId: C_PROJE, pdfId: PDF_IRI, sayfa: n, metin: `Page ${n} line 3: synthetic filler text for the large document performance check.` });
  const es = await Promise.all(Array.from({ length: 10 }, (_, i) => zamanli(arg(10 + i * 25))));
  const esGecti = es.filter((x) => islemSonucu(x.metin)?.metin).length;
  const sayacSonra = sayacDegeri(`pdf-islem:${C.id}`);
  const sicak = await zamanli(arg(299));
  const sure = es.map((x) => x.ms).sort((a, b) => a - b);
  kayit(
    "R3",
    "19 MB / 300 sayfa: 10 eşzamanlı seçim tek çözümlemeye iner; önbellekten sıcak yanıt hızlı",
    "10/10 doğrulanır; sayaç +1; sıcak < 1000 ms",
    `${(IRI.length / 1048576).toFixed(1)} MB · eşzamanlı ${esGecti}/10 · süre en az ${sure[0]} / en çok ${sure.at(-1)} ms · sayaç ${once}→${sayacSonra} · sıcak ${sicak.ms} ms (${islemSonucu(sicak.metin)?.metin ? "doğrulandı" : "HATA"})`,
    esGecti === 10 && sayacSonra === once + 1 && sicak.ms < 1000 && Boolean(islemSonucu(sicak.metin)?.metin),
  );
  // Başka kullanıcı (A) C'nin önbellekteki PDF'ine erişemez: yetki önbellekten önce.
  const sA2 = await baglamA.newPage();
  await sA2.goto(EDITOR, { timeout: 120000 });
  await sA2.waitForSelector(".ProseMirror", { timeout: 120000 });
  const yabanci = islemSonucu((await islemCagir(sA2, id, { projectId: C_PROJE, pdfId: PDF_IRI, sayfa: 299, metin: arg(299).metin })).metin);
  const yabanci2 = islemSonucu((await islemCagir(sA2, id, { projectId: PROJE, pdfId: PDF_IRI, sayfa: 299, metin: arg(299).metin })).metin);
  kayit("R3b", "Önbellek kullanıcılar arasında sızmaz (A, C'nin önbellekteki PDF'ini okuyamaz)", "iki çağrıda {hata}, metin yok", `${JSON.stringify(yabanci)?.slice(0, 80)} · ${JSON.stringify(yabanci2)?.slice(0, 80)}`, Boolean(yabanci?.hata) && Boolean(yabanci2?.hata) && !yabanci?.metin && !yabanci2?.metin);
  await sA2.close();

  // Görüntüleyici: 19 MB PDF'in tarayıcıda açılışı ve uzak sayfaya gidiş.
  const t0 = Date.now();
  await pdfPaneliniAc(sayfa, PDF_IRI);
  const acilis = Date.now() - t0;
  const girdi = sayfa.locator(".pdf-sayfa-girdi");
  const t1 = Date.now();
  await girdi.fill("280");
  await girdi.press("Enter");
  await sayfa.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Page 280 line 1:"), null, { timeout: 30000 });
  const gidis = Date.now() - t1;
  const kanvas = await sayfa.locator(".pdf-goruntuleyici canvas").count();
  kayit("R3c", "19 MB PDF tarayıcıda açılır; tek sayfa çizilir", "açılış < 20 sn, 280. sayfa < 5 sn, tek kanvas", `açılış ${acilis} ms · gidiş ${gidis} ms · kanvas ${kanvas}`, acilis < 20000 && gidis < 5000 && kanvas === 1);
  await c.close();
});

// ── U: RELEASE CLOSURE 05 — panel konumu, asistan açıkken araç çubuğu ─────
await senaryo("U1", async () => {
  await editoruAc(sA);
  await pdfPaneliniAc(sA, PDF_KESIN);
  const girdi = sA.locator(".pdf-sayfa-girdi");
  await girdi.fill("3");
  await girdi.press("Enter");
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Discussion"), null, { timeout: 30000 });
  await sA.getByRole("button", { name: /Yakınlaştır$/ }).click();
  await sA.getByRole("button", { name: /Yakınlaştır$/ }).click();
  await sA.waitForTimeout(500);
  const yuzde = await sA.locator(".pdf-yuzde").innerText();
  // Asistanı aç (PDF kapanır), asistanı kapat, PDF'i yeniden aç.
  await sA.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
  await sA.waitForSelector(".yazim-paneli");
  await sA.locator(".yazim-paneli").getByRole("button", { name: /kapat/i }).first().click();
  await sA.getByRole("button", { name: /Kaynak PDF/ }).first().click();
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Discussion"), null, { timeout: 60000 });
  await sA.waitForTimeout(400);
  const sayfaSonra = await girdi.inputValue();
  const yuzdeSonra = await sA.locator(".pdf-yuzde").innerText();
  kayit("U1", "PDF paneli yeniden açılınca son sayfa ve yakınlaştırma korunur", `sayfa 3, ${yuzde}`, `sayfa ${sayfaSonra}, ${yuzdeSonra}`, sayfaSonra === "3" && yuzdeSonra === yuzde);
  // Başka PDF: kendi konumuyla (1. sayfa, varsayılan) açılır; geri dönünce ilk PDF'in konumu yerinde.
  await kaynakDegistir(sA, PDF_BELIRSIZ);
  const digerSayfa = await girdi.inputValue();
  const digerYuzde = await sA.locator(".pdf-yuzde").innerText();
  await kaynakDegistir(sA, PDF_KESIN);
  await sA.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Discussion"), null, { timeout: 30000 });
  const geri = await girdi.inputValue();
  const geriYuzde = await sA.locator(".pdf-yuzde").innerText();
  kayit("U1b", "PDF değişince önceki PDF'in konumu yeni belgeye taşınmaz; geri dönünce korunur", `öteki: 1 ve ≠ ${yuzde}; geri: 3, ${yuzde}`, `öteki: ${digerSayfa}, ${digerYuzde} · geri: ${geri}, ${geriYuzde}`, digerSayfa === "1" && digerYuzde !== yuzde && geri === "3" && geriYuzde === yuzde);
});

for (const genislik of [1440, 1280, 1200]) {
  await senaryo(`U2-${genislik}`, async () => {
    const { c, sayfa } = await kullaniciSayfasi(A, PROJE, { viewport: { width: genislik, height: 900 } });
    await sayfa.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
    await sayfa.waitForSelector(".yazim-paneli");
    await sayfa.waitForTimeout(400);
    const r = await sayfa.evaluate(async () => {
      const dugmeler = [...document.querySelectorAll(".manuscript-araclar button")].filter((x) => x.offsetParent);
      const erisilemeyen = [];
      for (const x of dugmeler) {
        x.scrollIntoView({ block: "nearest", inline: "nearest" });
        await new Promise((r) => requestAnimationFrame(r));
        const k = x.getBoundingClientRect();
        const ust = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
        if (!(ust === x || x.contains(ust))) erisilemeyen.push((x.getAttribute("aria-label") || x.textContent.trim()).slice(0, 24));
      }
      const pm = document.querySelector(".ProseMirror").getBoundingClientRect();
      const panel = document.querySelector(".yazim-paneli").getBoundingClientRect();
      return { dugme: dugmeler.length, erisilemeyen, editor: Math.round(pm.width), editorSag: Math.round(pm.right), panelSol: Math.round(panel.left), tasma: document.documentElement.scrollWidth - innerWidth };
    });
    kayit(
      `U2-${genislik}`,
      `Asistan açıkken araç çubuğu ve metin örtülmez (${genislik} px)`,
      "tüm düğmeler tıklanabilir, editör ≥ 420 px ve panelin solunda, taşma 0",
      `${r.dugme} düğme, erişilemeyen [${r.erisilemeyen.join("; ")}] · editör ${r.editor} px (sağ ${r.editorSag} < panel ${r.panelSol}) · taşma ${r.tasma}`,
      r.erisilemeyen.length === 0 && r.editor >= 420 && r.editorSag <= r.panelSol && r.tasma <= 0,
    );
    await c.close();
  });
}
// U3'ün ölçümü (değişmedi): U3 ve U3K aynı fonksiyonu kullanır.
const u3Olc = (sayfa) => sayfa.evaluate(async () => {
    const dugmeler = [...document.querySelectorAll(".manuscript-araclar button")].filter((x) => x.offsetParent);
    window.scrollTo(0, 0);
    const erisilemeyen = [];
    for (const x of dugmeler) {
      x.scrollIntoView({ block: "nearest", inline: "nearest" });
      await new Promise((r) => requestAnimationFrame(r));
      const k = x.getBoundingClientRect();
      const ust = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
      // Kanıt: düğmenin adı yanında üstündeki öğe, kutusu ve o anki kaydırma da yazılır (RC06d).
      if (!(ust === x || x.contains(ust))) erisilemeyen.push(`${(x.getAttribute("aria-label") || x.textContent.trim()).slice(0, 24)} ← ${ust ? `${ust.tagName.toLowerCase()}.${String(ust.className).trim().split(/\s+/).slice(0, 2).join(".")}` : "yok"} @${Math.round(k.left)},${Math.round(k.top)} y${Math.round(scrollY)}`);
    }
    const p = document.querySelector(".yazim-paneli").getBoundingClientRect();
    return { dugme: dugmeler.length, erisilemeyen, panel: [Math.round(p.top), Math.round(p.width)], tasma: document.documentElement.scrollWidth - innerWidth };
  });
for (const [ad, gorunum] of [["U3-1024", { viewport: { width: 1024, height: 768 } }], ["U3-telefon", { ...devices["iPhone 13"] }]]) await senaryo(ad, async () => {
  // 1180 px ve altında asistan alttan açılan yaprak: araç çubuğu üstte erişilebilir, taşma yok.
  const { c, sayfa } = await kullaniciSayfasi(A, PROJE, gorunum);
  const kanit = kanitBaslat(ad, sayfa);
  try {
    const en = sayfa.viewportSize().width;
    await kanit.adim("editör açıldı");
    await sayfa.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
    await sayfa.waitForSelector(".yazim-paneli");
    await kanit.adim("asistan tıklandı, yaprak DOM'da");
    // Tıklamanın kendi kaydırması: 0 ise U3 "yukarı dönüş" yolunu bu turda hiç sınamaz (RC06d; o yol U3K'da).
    const tikKaydirma = await sayfa.evaluate(() => Math.round(scrollY));
    await sayfa.waitForTimeout(400);
    await kanit.adim("400 ms sonra (ölçüm öncesi)");
    const r = await u3Olc(sayfa);
    await kanit.adim("ölçüm sonrası");
    const gecti = r.erisilemeyen.length === 0 && r.panel[1] === en && r.tasma <= 0;
    kayit(ad, `${en} px: asistan alttan açılır, araç çubuğu erişilebilir, taşma yok`, "erişilemeyen 0, panel tam genişlik, taşma 0", `tıklama sonrası kaydırma ${tikKaydirma} · ${r.dugme} düğme, erişilemeyen [${r.erisilemeyen.join("; ")}] · panel üst ${r.panel[0]} eni ${r.panel[1]} · taşma ${r.tasma}`, gecti);
    kanit.bitir(gecti ? "PASS" : "FAIL", { tikKaydirma, ...r });
  } catch (hata) {
    await kanit.hata(hata);
    throw hata;
  } finally {
    await c.close();
  }
});


/*
  U3K (RC06d): U3-1024'ün 10 turda 7 kez düştüğü DURUMUN kendisi, her seferinde. U3'te o durum
  tıklamanın sayfayı kaydırıp kaydırmamasına bağlıydı (düşen 7 turda 314 px, geçen 3'ünde 0);
  next start altında tıklama çoğu zaman kaydırmıyor ve U3 o yolu hiç sınamadan geçiyor. Burada
  sayfa yaprak açıkken 314 px aşağı alınır, yaprak o konumda oturana kadar (üst kenarı üç kare
  aynı kalana kadar — koşul, süre değil) beklenir, sonra U3'ün AYNI ölçümü AYNI ölçütle yapılır.
  Ölçümün kendisine bekleme eklenmedi.
*/
for (const [ad, gorunum] of [["U3K-1024", { viewport: { width: 1024, height: 768 } }], ["U3K-telefon", { ...devices["iPhone 13"] }]]) await senaryo(ad, async () => {
  const { c, sayfa } = await kullaniciSayfasi(A, PROJE, gorunum);
  const kanit = kanitBaslat(ad, sayfa);
  try {
    const en = sayfa.viewportSize().width;
    await sayfa.evaluate(() => { const b = document.createElement("div"); b.setAttribute("aria-hidden", "true"); b.style.height = "1600px"; document.body.appendChild(b); });
    await sayfa.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
    await sayfa.waitForSelector(".yazim-paneli");
    const kurulum = await sayfa.evaluate(async () => {
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 20 && Math.abs(scrollY - 314) > 1; i++) { window.scrollTo(0, 314); await raf(); }
      let son = null, ayni = 0;
      for (let i = 0; i < 120 && ayni < 3; i++) { await raf(); const t = Math.round(document.querySelector(".yazim-paneli").getBoundingClientRect().top); if (t === son) ayni++; else { ayni = 0; son = t; } }
      return { kaydirma: Math.round(scrollY), yaprakUst: son };
    });
    await kanit.adim(`kurulum: sayfa ${kurulum.kaydirma} px aşağıda, yaprak üstü ${kurulum.yaprakUst}`);
    if (kurulum.kaydirma < 200) {
      kayit(ad, `${en} px: kaydırılmışken açık yaprak, yukarı dönüş`, "sayfa ≥ 200 px aşağı alınır", `senaryo kurulamadı — ${JSON.stringify(kurulum)}`, false, "KURULAMADI");
      kanit.bitir("KURULAMADI", { kurulum });
      return;
    }
    const r = await u3Olc(sayfa);
    await kanit.adim("ölçüm sonrası");
    const gecti = r.erisilemeyen.length === 0 && r.panel[1] === en && r.tasma <= 0;
    kayit(ad, `${en} px: sayfa ${kurulum.kaydirma} px aşağıdayken açık yaprak, yukarı dönüşte araç çubuğu erişilebilir`, "erişilemeyen 0, panel tam genişlik, taşma 0", `kurulum ${JSON.stringify(kurulum)} · ${r.dugme} düğme, erişilemeyen [${r.erisilemeyen.join("; ")}] · panel üst ${r.panel[0]} eni ${r.panel[1]} · taşma ${r.tasma}`, gecti);
    kanit.bitir(gecti ? "PASS" : "FAIL", { kurulum, ...r });
  } catch (hata) {
    await kanit.hata(hata);
    throw hata;
  } finally {
    await c.close();
  }
});

// ── T: telefon ────────────────────────────────────────────────────────────
await senaryo("T1", async () => {
  const c = await yeniBaglam({ ...devices["iPhone 13"] });
  const s = await c.newPage();
  await girisYap(s, A);
  await editoruAc(s);
  const dugme = s.getByRole("button", { name: /Kaynak PDF/ }).first();
  await dugme.scrollIntoViewIfNeeded();
  await dugme.click();
  await s.waitForSelector(".kaynak-pdf-paneli select", { timeout: 60000 });
  await s.selectOption(".kaynak-pdf-paneli select", PDF_KESIN);
  await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 90000 });
  await s.waitForTimeout(500);
  const genislik = 390;
  const olcum = await s.evaluate(() => {
    const p = document.querySelector(".kaynak-pdf-paneli");
    const r = p.getBoundingClientRect();
    const disari = [...p.querySelectorAll("button, input, select, textarea")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
      .map(({ e }) => e.getAttribute("aria-label") || e.textContent?.trim().slice(0, 20) || e.tagName);
    return {
      sayfa: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panel: p.scrollWidth - p.clientWidth,
      kutu: [r.left | 0, r.top | 0, r.width | 0, r.height | 0],
      disari,
    };
  });
  await s.screenshot({ path: path.join(CIKTI, "t1-telefon-pdf.png") });
  kayit(
    "T1",
    "Telefon: tek odak tam ekran PDF, yatay taşma yok, erişilemeyen denetim yok",
    "panel 390 genişlikte, sayfa/panel taşması 0, ekran dışında denetim yok",
    `panel ${olcum.kutu.join(",")} · sayfa taşma ${olcum.sayfa} · panel taşma ${olcum.panel} · ekran dışı [${olcum.disari.join("; ")}]`,
    olcum.sayfa <= 0 && olcum.panel <= 0 && olcum.disari.length === 0 && olcum.kutu[2] <= genislik,
  );
  // Sayfa gezinme ve kapatma dokunmatikte de çalışır.
  await s.getByRole("button", { name: /Sonraki sayfa/ }).tap();
  await s.waitForFunction(() => document.querySelector(".pdf-sayfa .textLayer")?.textContent?.includes("Method"), null, { timeout: 30000 });
  await s.getByRole("button", { name: /Kaynak panelini kapat/ }).first().tap();
  await s.waitForTimeout(400);
  const kapandi = !(await s.locator(".kaynak-pdf-paneli").isVisible().catch(() => false));
  const editorGorunur = await s.locator(".ProseMirror").isVisible();
  kayit("T1b", "Telefon: sayfa değişir, panel kapanır, editöre dönülür", "panel kapalı, editör görünür", `kapandı ${kapandi} · editör ${editorGorunur}`, kapandi && editorGorunur);
  await c.close();
});

kayit("K0", "Sayfa hatası (pageerror) yok", "0", konsolHatalari.length ? konsolHatalari.join(" | ") : "0", konsolHatalari.length === 0);

/*
  U4, K0'dan SONRA koşar (RC06): ana sayfa sA açık kaldıkça uzayan her senaryo, sA'nın oturum
  yoklamasını tek oturum kuralının "başka cihaz" yönlendirmesine denk getirebiliyor; K0 yalnızca
  ana senaryoların sayfa hatalarını ölçer (denetimli deney: U4'süz betik yeni kodda 57/57, K0 dahil).
*/
/*
  U4 (RC06, 17.11.2026): U3'ün aralıklı düşmesinin BELİRLENİMCİ hâli. Yaprak yalnızca
  açılışta ölçülüyordu; sayfa aşağı kaydırılmışken açılıp yukarı dönülünce araç çubuğu
  yaprağın altında kalıyordu. Kaydırılmış açılış → yukarı dönüş → boyut değişimi →
  kapat/aç; her adımda araç çubuğu erişilebilir, taşma yok, masaüstünde editör ≥ 420 px.
*/
const ulasim = async (sayfa) => sayfa.evaluate(async () => {
  const dugmeler = [...document.querySelectorAll(".manuscript-araclar button")].filter((x) => x.offsetParent);
  const erisilemeyen = [];
  for (const x of dugmeler) {
    x.scrollIntoView({ block: "nearest", inline: "nearest" });
    await new Promise((r) => requestAnimationFrame(r));
    const k = x.getBoundingClientRect();
    const ust = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
    if (!(ust === x || x.contains(ust))) erisilemeyen.push((x.getAttribute("aria-label") || x.textContent.trim()).slice(0, 18));
  }
  const ed = document.querySelector(".ProseMirror")?.getBoundingClientRect();
  return { dugme: dugmeler.length, erisilemeyen: erisilemeyen.length, erisilemeyenAdlar: erisilemeyen, tasma: document.documentElement.scrollWidth - innerWidth, editor: ed ? Math.round(ed.width) : 0 };
});
/*
  U4 kendi kullanıcısıyla koşar: aynı kullanıcının yeni bağlamda girişi tek oturum kuralı gereği
  öteki oturumu düşürüyor ("başka cihaz"); A ile koşunca ana sayfanın (sA) bekleyen sunucu işlemi
  yönlendirmeye çarpıp K0'da "An unexpected response was received from the server" bırakıyordu.
*/
const U4K = await kullaniciAc("studyo-u4");
const U4_PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title) values ('${U4K.id}', 'thesis', 'U4 tezi ${ek}') returning id`).split("\n")[0];
for (const [ad, gorunum] of [["U4-1440", { viewport: { width: 1440, height: 900 } }], ["U4-1280", { viewport: { width: 1280, height: 800 } }], ["U4-1024", { viewport: { width: 1024, height: 768 } }], ["U4-telefon", { ...devices["iPhone 13"] }]]) await senaryo(ad, async () => {
  const { c, sayfa } = await kullaniciSayfasi(U4K, U4_PROJE, gorunum);
  const kanit = kanitBaslat(ad, sayfa);
  try {
    const en = sayfa.viewportSize().width;
    const masaustu = en > 1180;
    const adimlar = [];
    const olc = async (adim) => { await sayfa.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await sayfa.waitForTimeout(150); await kanit.adim(`${adim} (ölçüm öncesi)`); const r = await ulasim(sayfa); await sayfa.evaluate(() => window.scrollTo(0, 0)); adimlar.push({ adim, ...r }); };
    const asistan = () => sayfa.getByRole("button", { name: /^Yazım asistanı/ }).first();
    // Belge kısaysa kaydırılacak yer olsun diye alt boşluk; yalnızca bu tarayıcı oturumunda, kaydedilmez.
    await sayfa.evaluate(() => {
      const b = document.createElement("div"); b.className = "u4-dolgu"; b.setAttribute("aria-hidden", "true"); b.style.height = "1600px"; document.body.appendChild(b);
    });
    /*
      Ön koşul (RC06d): yaprak, sayfa GERÇEKTEN aşağıdayken DOM'a girmeli — eski hata açılış
      anındaki ölçümdeydi. Eskiden ön koşul tıklamadan SONRAKİ kaydırmaya bakıyordu; ama
      tıklama, yaprağın metin kutusu odak alınca sayfayı kendisi kaydırıyor (10 turda 0, 65,
      115, 420, 499) ve 0 çıktığında senaryo "kurulamadı"yı FAIL diye yazıyordu. Artık iki şey
      ayrı kaydedilir: yaprağın DOM'a girdiği andaki kaydırma (ön koşul, MutationObserver ile
      eşzamanlı) ve tıklamanın kendi yaptığı kaydırma (bilgi). Ön koşul tutmazsa kurulum en çok
      üç kez denenir; yine tutmazsa sonuç KURULAMADI'dır, PASS sayılmaz.
    */
    const asagiKaydir = () => sayfa.evaluate(async () => {
      for (let i = 0; i < 20 && Math.abs(window.scrollY - 420) > 2; i++) { window.scrollTo(0, 420); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))); }
      return Math.round(window.scrollY);
    });
    const kurulum = [];
    let acilisKaydirma = -1;
    for (let deneme = 1; deneme <= 3 && acilisKaydirma < 200; deneme++) {
      const tiklamaOncesi = await asagiKaydir();
      await sayfa.evaluate(() => {
        window.__u4Acilis = null;
        const g = new MutationObserver(() => {
          if (document.querySelector(".yazim-paneli")) { window.__u4Acilis = Math.round(window.scrollY); g.disconnect(); }
        });
        g.observe(document.body, { childList: true, subtree: true });
      });
      await kanit.adim(`kurulum ${deneme}: dolgu + aşağı kaydırma`);
      await asistan().click();
      await sayfa.waitForSelector(".yazim-paneli");
      // Yaprak odağı kendi rAF'ında veriyor; tıklamanın kaydırma etkisi odaktan sonra okunur.
      await sayfa.waitForFunction(() => document.activeElement?.closest?.(".yazim-paneli"), null, { timeout: 5000 }).catch(() => {});
      acilisKaydirma = await sayfa.evaluate(() => window.__u4Acilis ?? -1);
      const tiklamaSonrasi = await sayfa.evaluate(() => Math.round(window.scrollY));
      kurulum.push({ deneme, tiklamaOncesi, acilisAnindaKaydirma: acilisKaydirma, tiklamaSonrasi, tiklamaninKaydirmasi: tiklamaSonrasi - tiklamaOncesi });
      await kanit.adim(`kurulum ${deneme}: yaprak açıldı (açılış anında kaydırma ${acilisKaydirma})`);
      if (acilisKaydirma < 200) {
        await sayfa.locator(".yazim-paneli .yazim-ikon[aria-label]").first().click();
        await sayfa.waitForSelector(".yazim-paneli", { state: "detached" });
      }
    }
    if (acilisKaydirma < 200) {
      kayit(ad, `${en} px: kaydırılmış açılış senaryosu`, "yaprak sayfa ≥ 200 px aşağıdayken açılır", `senaryo kurulamadı — ${JSON.stringify(kurulum)}`, false, "KURULAMADI");
      kanit.bitir("KURULAMADI", { kurulum });
      return;
    }
    await sayfa.evaluate(() => window.scrollTo(0, 0));
    await olc("kaydırılmış açılış → yukarı");
    await sayfa.setViewportSize({ width: Math.max(360, en - 120), height: gorunum.viewport ? gorunum.viewport.height - 100 : 600 });
    await olc("küçültme");
    await sayfa.setViewportSize(gorunum.viewport ?? { width: en, height: 664 });
    await olc("geri büyütme");
    await sayfa.locator(".yazim-paneli .yazim-ikon[aria-label]").first().click();
    await sayfa.waitForSelector(".yazim-paneli", { state: "detached" });
    await asistan().click();
    await sayfa.waitForSelector(".yazim-paneli");
    await olc("kapat/aç");
    const gecti = adimlar.every((a) => a.erisilemeyen === 0 && a.tasma <= 0 && (!masaustu || a.editor >= 420));
    kayit(ad, `${en} px: kaydırılmış açılış, yukarı dönüş, boyut değişimi ve kapat/aç sonrası araç çubuğu erişilebilir`, "her adımda erişilemeyen 0, taşma 0" + (masaustu ? ", editör ≥ 420 px" : ""), `yaprak açılırken kaydırma ${acilisKaydirma} px (tıklamanın kendi kaydırması ${kurulum.at(-1).tiklamaninKaydirmasi} px, deneme ${kurulum.length}) · ` + adimlar.map((a) => `${a.adim}: ${a.erisilemeyen}/${a.dugme} erişilemez${a.erisilemeyen ? ` [${a.erisilemeyenAdlar.join("; ")}]` : ""}, taşma ${a.tasma}${masaustu ? `, editör ${a.editor}` : ""}`).join(" · "), gecti);
    kanit.bitir(gecti ? "PASS" : "FAIL", { acilisKaydirma, kurulum, adimlar });
  } catch (hata) {
    await kanit.hata(hata);
    throw hata;
  } finally {
    await c.close();
  }
});


/*
  U5 (RC06d, 17.11.2026): NORMAL etkileşimle görünür örtüşme. U3/U4 düğmeyi programla görünüme
  alıp ölçüyor; burada sayfa fare tekerleği ve klavyeyle kaydırılır, kaydırma sürerken HER
  KARENİN çiziminden sonra (rAF → görev) araç çubuğunun ekranda görünen düğmelerinden biri
  yaprağın altında mı diye bakılır, sonunda fare düğmenin üstüne götürülüp gerçek isabet
  (:hover) okunur. Beklemeler süreye değil koşula bağlı: kaydırma beş kare boyunca durana
  kadar. Kompozitörün kendi çizdiği kareler başsız tarayıcıda görülmez — o kısım UNVERIFIED.
*/
for (const [ad, gorunum] of [["U5-1024", { viewport: { width: 1024, height: 768 } }], ["U5-telefon", { ...devices["iPhone 13"] }]]) await senaryo(ad, async () => {
  const { c, sayfa } = await kullaniciSayfasi(U4K, U4_PROJE, gorunum);
  const kanit = kanitBaslat(ad, sayfa);
  try {
    await sayfa.evaluate(() => {
      const b = document.createElement("div"); b.setAttribute("aria-hidden", "true"); b.style.height = "1600px"; document.body.appendChild(b);
    });
    await sayfa.getByRole("button", { name: /^Yazım asistanı/ }).first().click();
    await sayfa.waitForSelector(".yazim-paneli");
    await kanit.adim("asistan normal tıklamayla açıldı");
    const dur = () => sayfa.evaluate(async () => {
      let son = -1, ayni = 0;
      for (let i = 0; i < 600 && ayni < 5; i++) { await new Promise((r) => requestAnimationFrame(r)); if (Math.round(scrollY) === son) ayni++; else { ayni = 0; son = Math.round(scrollY); } }
      return Math.round(scrollY);
    });
    const ornekBaslat = () => sayfa.evaluate(() => {
      const o = { kare: 0, ortukKare: 0, ilk: null };
      window.__u5 = o; window.__u5dur = false;
      const ornek = () => {
        const p = document.querySelector(".yazim-paneli");
        const gorunen = [...document.querySelectorAll(".manuscript-araclar button")].filter((x) => {
          if (!x.offsetParent) return false;
          const k = x.getBoundingClientRect();
          return k.left >= 0 && k.right <= innerWidth && k.top >= 0 && k.bottom <= innerHeight;
        });
        const ortuk = gorunen.filter((x) => { const k = x.getBoundingClientRect(); const u = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2); return !(u === x || x.contains(u)) && p?.contains(u); });
        o.kare++;
        if (ortuk.length) { o.ortukKare++; if (!o.ilk) o.ilk = { kaydirma: Math.round(scrollY), yaprakUst: p ? Math.round(p.getBoundingClientRect().top) : null, dugme: (ortuk[0].getAttribute("aria-label") || "").slice(0, 24) }; }
      };
      const dongu = () => requestAnimationFrame(() => setTimeout(() => { ornek(); if (!window.__u5dur) dongu(); }, 0));
      dongu();
    });
    const ornekBitir = () => sayfa.evaluate(() => { window.__u5dur = true; return window.__u5; });
    // Fare gerçekten düğmenin üstündeyken tarayıcının isabet testi hangi öğeyi seçiyor?
    const isabet = async () => {
      const hedef = await sayfa.evaluate(() => {
        const x = [...document.querySelectorAll(".manuscript-araclar button")].find((d) => { if (!d.offsetParent) return false; const k = d.getBoundingClientRect(); return k.left >= 0 && k.right <= innerWidth && k.top >= 0 && k.bottom <= innerHeight; });
        if (!x) return null;
        const k = x.getBoundingClientRect();
        return { ad: (x.getAttribute("aria-label") || x.textContent.trim()).slice(0, 24), x: k.left + k.width / 2, y: k.top + k.height / 2 };
      });
      if (!hedef) return { hedef: null, isabet: false };
      await sayfa.mouse.move(hedef.x, hedef.y);
      const ok = await sayfa.evaluate(() => { const h = [...document.querySelectorAll(":hover")].at(-1); return !!h?.closest(".manuscript-araclar button") && !h.closest(".yazim-paneli"); });
      return { hedef: hedef.ad, isabet: ok };
    };
    const sonuc = {};
    // Fare tekerleği: aşağı, sonra yukarı (yukarı dönüş, eski hatanın yolu).
    await sayfa.mouse.move(Math.round(sayfa.viewportSize().width / 2), 140);
    await sayfa.mouse.wheel(0, 700);
    const asagi = await dur();
    await kanit.adim(`tekerlek aşağı (kaydırma ${asagi})`);
    await ornekBaslat();
    await sayfa.mouse.wheel(0, -2000);
    const yukari = await dur();
    sonuc.tekerlek = { asagi, yukari, ...(await ornekBitir()), ...(await isabet()) };
    await kanit.adim(`tekerlek yukarı (kaydırma ${yukari})`);
    // Klavye: odak metin kutusundan alınır (End/Home metin içinde imleç oynatmasın), sonra End → Home.
    await sayfa.evaluate(() => document.activeElement?.blur());
    await sayfa.keyboard.press("End");
    const kAsagi = await dur();
    await kanit.adim(`klavye End (kaydırma ${kAsagi})`);
    await ornekBaslat();
    await sayfa.keyboard.press("Home");
    const kYukari = await dur();
    sonuc.klavye = { asagi: kAsagi, yukari: kYukari, ...(await ornekBitir()), ...(await isabet()) };
    await kanit.adim(`klavye Home (kaydırma ${kYukari})`);
    for (const [yol, r] of Object.entries(sonuc)) {
      const kaydi = r.asagi >= 200 && r.yukari <= 5;
      const etiket = `${ad}-${yol}`;
      if (!kaydi) {
        kayit(etiket, `${yol}: kaydırma sırasında görünür örtüşme`, "sayfa ≥ 200 px aşağı iner ve en üste döner", `kaydırma kurulamadı (aşağı ${r.asagi}, yukarı ${r.yukari}) — bu yol bu cihazda sınanamadı`, false, "UNVERIFIED");
        continue;
      }
      kayit(etiket, `${yol}: yukarı dönüşte hiçbir çizilmiş karede araç çubuğu yaprağın altında kalmaz, fare düğmeye isabet eder`, "örtük kare 0, isabet evet", `${r.kare} kare örneklendi, örtük ${r.ortukKare}${r.ilk ? ` (ilk: ${JSON.stringify(r.ilk)})` : ""} · fare "${r.hedef}" → isabet ${r.isabet}`, r.ortukKare === 0 && r.isabet === true);
    }
    kanit.bitir("BİTTİ", sonuc);
  } catch (hata) {
    await kanit.hata(hata);
    throw hata;
  } finally {
    await c.close();
  }
});
await senaryo("U5-dokunma", async () => {
  // Playwright parmakla kaydırmayı (touch scroll) gerçekçi üretemiyor; sınanmadı olarak yazılır.
  kayit("U5-dokunma", "Telefonda parmakla kaydırırken görünür örtüşme", "örtük kare 0", "dokunmatik kaydırma başsız tarayıcıda üretilemedi; kompozitör kareleri görülmüyor", false, "UNVERIFIED");
});

await tarayici.close();
fs.writeFileSync(new URL("./sonuclar/studyo-kabul.json", import.meta.url), `${JSON.stringify(sonuclar, null, 2)}\n`);
const say = (s) => sonuclar.filter((x) => x.sonuc === s).length;
console.log(`\nPASS ${say("PASS")} · FAIL ${say("FAIL")} · KURULAMADI ${say("KURULAMADI")} · UNVERIFIED ${say("UNVERIFIED")}`);
// Kurulamayan senaryo PASS değildir: çıkış kodu FAIL ile aynı (RC06d).
process.exit(say("FAIL") || say("KURULAMADI") ? 1 : 0);
