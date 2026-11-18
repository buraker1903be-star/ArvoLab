// S1.1 kabulü: editör resmi imzalama yalnızca çalışmanın KENDİ klasörlerini
// kabul eder. Dört yol, gerçek Next uygulamasında (next dev) ve yerel yığında
// (PG17 + GoTrue + PostgREST + storage-api, yalnızca 127.0.0.1) sınanır:
// editör, yazdırma, Word dışa aktarma ve paylaşım bağlantısı.
//
// Senaryo: A'nın çalışmasına B atanmış. Metinde üç resim var:
//   calisma: <çalışma>/editor-images/…  (yetkili, imzalanmalı)
//   sahip:   <A>/editor-images/…        (yetkili, eski yükleme yolu; imzalanmalı)
//   yabanci: <B>/editor-images/…        (B'nin dosyası; HİÇBİR yolda imzalanmamalı)
// Kullanıcılar ve dosyalar sentetik. Silme yok.
//
// Kullanım: node --import ./tests/register.mjs denetim/s11/resim-imza-kabul.mjs http://localhost:3127 [etiket] [çıktı.json]
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const { unzipSync } = require("fflate");

const UYGULAMA = process.argv[2] ?? "http://localhost:3127";
const ETIKET = process.argv[3] ?? "?";
const CIKTI = process.argv[4];
// Yığın adresi. Paylaşım ve yazdırma HTML'i yalnızca https resim adresi çiziyor
// (lib/tiptap-html.ts safeImageSrc); yerelde bu yüzden kendinden imzalı bir https
// vekili kullanılır (YIGIN_URL=https://127.0.0.1:54443, NODE_TLS_REJECT_UNAUTHORIZED=0).
const GECIT = process.env.YIGIN_URL ?? "http://127.0.0.1:54401";
for (const a of [UYGULAMA, GECIT]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(a).hostname)) {
    console.error(`GÜVENLİK: ${a} yerel değil.`);
    process.exit(2);
  }
}
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const SIFRE = "yerel-Sentetik-1";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();
const servis = createClient(GECIT, SERVIS, { auth: { persistSession: false, autoRefreshToken: false } });

/* ---------- tohum ---------- */
const ek = Date.now().toString(36);
async function kullanici(ad) {
  const email = `s11-${ad}-${ek}@yerel.test`;
  const y = await fetch(`${GECIT}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVIS, authorization: `Bearer ${SERVIS}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password: SIFRE, email_confirm: true }),
  });
  const id = (await y.json()).id;
  const org = crypto.randomUUID();
  psql(`insert into public.organizations (id, name) values ('${org}', 'S11 ${ad}')`);
  psql(`update public.profiles set organization_id='${org}' where id='${id}'`);
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values ('${id}', 'kullanim_sozlesmesi', '2026-10-29.3', 'tr', '${"0".repeat(64)}', 'giris', true)`);
  return { id, email };
}
const A = await kullanici("sahip");
const B = await kullanici("atanan");
const P = crypto.randomUUID();
psql(`insert into public.academic_projects (id, owner_id, assignee_id, title, project_type, citation_style)
      values ('${P}', '${A.id}', '${B.id}', 'S11 kabul ${ek}', 'thesis', 'apa7')`);

// Üç ayrı PNG (baytları farklı: Word içindeki resim hangisi, özetinden anlaşılsın)
const png = (n) => {
  const taban = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  return Buffer.concat([taban, Buffer.from(`-s11-${n}-${ek}`)]); // IEND sonrası ek bayt: görüntüyü bozmaz, özeti ayırır
};
const RESIM = {
  calisma: { yol: `${P}/editor-images/${ek}-calisma.png`, bayt: png("calisma"), yetkili: true },
  sahip: { yol: `${A.id}/editor-images/${ek}-sahip.png`, bayt: png("sahip"), yetkili: true },
  yabanci: { yol: `${B.id}/editor-images/${ek}-gizli.png`, bayt: png("yabanci"), yetkili: false },
};
for (const r of Object.values(RESIM)) {
  const { error } = await servis.storage.from("project-files").upload(r.yol, new Blob([r.bayt], { type: "image/png" }), { contentType: "image/png", upsert: false });
  if (error) throw new Error(`tohum yüklemesi: ${error.message}`);
}
const ozet = (b) => crypto.createHash("sha256").update(b).digest("hex");
const icerik = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: `S11 kabul metni ${ek}` }] },
    ...Object.values(RESIM).map((r) => ({ type: "image", attrs: { src: `${GECIT}/storage/v1/object/sign/project-files/${r.yol}?token=eski` } })),
  ],
};
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
      values ('${P}', '${JSON.stringify(icerik).replace(/'/g, "''")}'::jsonb, 'S11 kabul metni', 3, '${A.id}')`);
const paylasimBelirteci = crypto.randomBytes(32).toString("base64url");
const belirtecOzeti = crypto.createHash("sha256").update(paylasimBelirteci).digest("hex");
psql(`insert into public.manuscript_share_links (project_id, token_hash, created_by, expires_at)
      values ('${P}', '${belirtecOzeti}', '${A.id}', now() + interval '7 days')`);

/* ---------- ölçüm ---------- */
// Metindeki imzalı adresler: geçerli belirteç taşıyanlar ve depodan GERÇEKTEN indirilebilenler.
async function imzalilar(metin) {
  const dz = /\/storage\/v1\/object\/sign\/project-files\/([^?"'\\\s]+)\?token=([A-Za-z0-9._-]+)/g;
  const sonuc = {};
  for (const ad of Object.keys(RESIM)) sonuc[ad] = "imzasiz";
  for (const m of metin.replaceAll("\\u0026", "&").matchAll(dz)) {
    const yol = decodeURIComponent(m[1]);
    const ad = Object.keys(RESIM).find((k) => RESIM[k].yol === yol);
    if (!ad || m[2] === "eski") continue;
    const y = await fetch(`${GECIT}/storage/v1/object/sign/project-files/${m[1]}?token=${m[2]}`);
    if (y.ok) sonuc[ad] = "imzali_indirilebilir";
  }
  return sonuc;
}
const sonuclar = [];
function degerlendir(yolAdi, durum) {
  for (const [ad, r] of Object.entries(RESIM)) {
    const imzali = durum[ad] === "imzali_indirilebilir" || durum[ad] === "word_icinde";
    const beklenen = r.yetkili;
    const gecti = imzali === beklenen;
    sonuclar.push({ yol: yolAdi, resim: ad, yetkili: r.yetkili, gozlenen: durum[ad], sonuc: gecti ? "PASS" : "FAIL" });
    console.log(`${gecti ? "PASS" : "FAIL"}  [${ETIKET}] ${yolAdi.padEnd(9)} ${ad.padEnd(8)} ${r.yetkili ? "yetkili " : "YABANCI "} → ${durum[ad]}`);
  }
}

// Paylaşım bağlantısı: oturumsuz
const paylasim = await fetch(`${UYGULAMA}/share/${paylasimBelirteci}`).then((r) => r.text());
if (!paylasim.includes(`S11 kabul metni ${ek}`)) console.error("UYARI: paylaşım sayfası metni göstermedi");
if (!GECIT.startsWith("https:")) console.error("UYARI: http yığın — paylaşım/yazdırma HTML'i resim çizmez (safeImageSrc yalnızca https); YIGIN_URL ile https vekili verin");
degerlendir("paylasim", await imzalilar(paylasim));

// Editör, yazdırma, Word: A olarak oturum
const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ locale: "tr-TR", ignoreHTTPSErrors: true });
const s = await baglam.newPage();
await s.goto(UYGULAMA + "/");
await s.fill('input[name="email"]', A.email);
await s.fill('input[name="password"]', SIFRE);
await s.press('input[name="password"]', "Enter");
await s.waitForURL(/\/dashboard/, { timeout: 180000 });

await s.goto(`${UYGULAMA}/dashboard/editor/${P}/write`, { timeout: 180000 });
await s.locator(".ProseMirror").first().waitFor({ timeout: 120000 });
degerlendir("editor", await imzalilar(await s.content()));

await s.goto(`${UYGULAMA}/print/manuscript/${P}`, { timeout: 180000 });
await s.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
degerlendir("yazdirma", await imzalilar(await s.content()));

const cevap = await baglam.request.get(`${UYGULAMA}/api/manuscripts/${P}/export`, { timeout: 180000 });
let docx = Buffer.from(await cevap.body());
if ((cevap.headers()["content-type"] ?? "").includes("json")) {
  const j = JSON.parse(docx.toString());
  docx = Buffer.from(await (await fetch(j.url ?? j.adres)).arrayBuffer());
}
const parcalar = unzipSync(new Uint8Array(docx));
const medya = Object.entries(parcalar).filter(([ad]) => ad.startsWith("word/media/")).map(([, b]) => ozet(Buffer.from(b)));
const wordDurum = {};
for (const [ad, r] of Object.entries(RESIM)) wordDurum[ad] = medya.includes(ozet(r.bayt)) ? "word_icinde" : "word_disinda";
degerlendir("word", wordDurum);

await tarayici.close();
const fail = sonuclar.filter((x) => x.sonuc === "FAIL").length;
console.log(`\n[${ETIKET}] ${sonuclar.length - fail}/${sonuclar.length} PASS (yetkili resim imzalanmalı, yabancı resim hiçbir yolda imzalanmamalı)`);
if (CIKTI) fs.writeFileSync(CIKTI, JSON.stringify({ etiket: ETIKET, sonuclar }, null, 2) + "\n");
process.exit(fail ? 1 : 0);
