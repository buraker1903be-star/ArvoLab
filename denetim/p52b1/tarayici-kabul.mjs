// P52b-1 tarayıcı kabulü: GERÇEK Next uygulaması (next dev) → yerel geçit →
// GoTrue + PostgREST + GERÇEK Storage API + Postgres 17. Kaynakça penceresindeki
// "PDF yükle" / "Değiştir" düğmeleri gerçek tarayıcı istemcisiyle depoya yükler,
// sunucu eylemi kaydı yazar. Sentetik hesap; yalnızca 127.0.0.1.
//
//   denetim/p52b1/kur-gercek-depo.sh && node denetim/p52b/yigin/gecit.mjs &
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54401 … npx next dev -p 3125
//   node denetim/p52b1/tarayici-kabul.mjs http://localhost:3125 [çıktı.json]
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const UYGULAMA = process.argv[2] ?? "http://localhost:3125";
const CIKTI = process.argv[3];
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const SIFRE = "yerel-Sentetik-1";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const ANON = imzala({ role: "anon" });
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();
const sq = (s) => s.replace(/'/g, "''");

try {
  if (!(await fetch(`${GECIT}/rest/v1/`, { headers: { apikey: ANON } })).ok) throw new Error("rest");
  if (!(await fetch(`${GECIT}/storage/v1/status`)).ok) throw new Error("storage");
  if ((await fetch(UYGULAMA)).status >= 500) throw new Error("uygulama");
} catch (hata) {
  console.error(`ÖN KOŞUL YOK: ${hata.message} (kur-gercek-depo.sh, gecit.mjs ve next dev çalışmalı)`);
  process.exit(2);
}

// ---------- tohum ----------
const { kunyeleriAyristir } = await import("../../lib/atif/kunye.ts");
const ek = Date.now().toString(36);
const EMAIL = `pdf-${ek}@yerel.test`;
const yanit = await fetch(`${GECIT}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVIS, authorization: `Bearer ${SERVIS}`, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: SIFRE, email_confirm: true }),
});
const KULLANICI = (await yanit.json()).id;
const ORG = crypto.randomUUID();
psql(`insert into public.organizations (id, name) values ('${ORG}', 'Tarayıcı kurumu')`); // lisans bildirilmemiş: kapı açık
psql(`update public.profiles set organization_id='${ORG}' where id='${KULLANICI}'`);
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values ('${KULLANICI}', 'kullanim_sozlesmesi', '2026-10-29.3', 'tr', '${"0".repeat(64)}', 'giris', true)`);
const KUNYE = "Yılmaz, A. (2020). Tarayıcı kabul başlığı. Dergi Adı, 1(2), 3-4.";
function proje() {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type, citation_style) values ('${id}', '${KULLANICI}', 'PDF kabul ${id.slice(0, 6)}', 'thesis', 'apa7')`);
  const ayrik = JSON.stringify(kunyeleriAyristir([KUNYE], "apa7"));
  psql(`insert into public.citation_checks (project_id, project_title, raw_reference_list, parsed_references, in_text_citations, cross_check, compliance_score, created_by)
        values ('${id}', 'PDF kabul', '${sq(KUNYE)}', '${sq(ayrik)}'::jsonb, '[]'::jsonb, '{"academicVerification": []}'::jsonb, 90, '${KULLANICI}')`);
  return id;
}
const kayitlar = (pid) => psql(`select durum||'|'||coalesce(depo_yolu,'-') from public.kaynak_pdfleri where project_id='${pid}'`).split("\n").filter(Boolean);
const nesneler = (pid) => psql(`select name from storage.objects where bucket_id='project-files' and name like '${pid}/kaynak-pdf/%' order by name`).split("\n").filter(Boolean);
const PDF_DOSYA = (ad) => ({ name: ad, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
async function kosulBekle(fn, ms = 30000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    if (fn()) return true;
    await bekle(300);
  }
  return false;
}

// ---------- tarayıcı ----------
const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const sayfa = await baglam.newPage();
sayfa.on("dialog", (d) => d.accept());
const konsol = [];
sayfa.on("console", (m) => { if (m.type() === "error") konsol.push(m.text().slice(0, 300)); });
sayfa.on("requestfailed", (r) => konsol.push(`istek düştü: ${r.method()} ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
await sayfa.goto(UYGULAMA + "/");
await sayfa.fill('input[name="email"]', EMAIL);
await sayfa.fill('input[name="password"]', SIFRE);
await sayfa.press('input[name="password"]', "Enter");
await sayfa.waitForURL(/\/dashboard/, { timeout: 120000 });

async function pencereyiAc(pid) {
  await sayfa.goto(`${UYGULAMA}/dashboard/editor/${pid}`, { timeout: 180000 });
  await sayfa.getByRole("button", { name: /^Kaynakça/ }).first().click({ timeout: 120000 });
  await sayfa.locator(".kaynak-pdf-satiri").first().waitFor({ timeout: 60000 });
}
async function dosyaSec(ad) {
  await sayfa.locator('.kaynak-pdf-satiri input[type="file"]').first().setInputFiles(PDF_DOSYA(ad));
}
async function bildirim(desen, ms = 20000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    const metinler = await sayfa.locator("[role=status], [role=alert], .toast, [data-toast]").allTextContents().catch(() => []);
    const b = metinler.find((x) => desen.test(x));
    if (b) return b.trim().slice(0, 200);
    await bekle(250);
  }
  return null;
}

const sonuclar = [];
async function senaryo(ad, fn) {
  const kanit = {};
  try {
    const sorun = await fn(kanit);
    sonuclar.push({ ad, sonuc: sorun ? "FAIL" : "PASS", sorun: sorun ?? null, kanit });
  } catch (h) {
    sonuclar.push({ ad, sonuc: "FAIL", sorun: `istisna: ${h.message.split("\n")[0]}`, kanit });
    await sayfa.screenshot({ path: `${process.env.EKRAN ?? "/tmp"}/hata-${sonuclar.length}.png` }).catch(() => {});
  } finally {
    psql("grant select, insert, update, delete on public.kaynak_pdfleri to authenticated");
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

const PID = proje();
await senaryo("T1 PDF yükle: gerçek depoya yüklenir, kayıt 'yuklendi', yol kullanıcıya bağlı kalıpta", async (k) => {
  await pencereyiAc(PID);
  await dosyaSec("kaynak.pdf");
  const tamam = await kosulBekle(() => kayitlar(PID)[0]?.startsWith("yuklendi|"));
  Object.assign(k, { kayit: kayitlar(PID), nesne: nesneler(PID), bildirim: await bildirim(/PDF yüklendi/) });
  if (!tamam) return "kayıt yazılmadı";
  const yol = k.kayit[0].split("|")[1];
  if (!new RegExp(`^${PID}/kaynak-pdf/y-${KULLANICI}-\\d{13}\\.pdf$`).test(yol)) return `yol kalıp dışı: ${yol}`;
  if (k.nesne.length !== 1 || k.nesne[0] !== yol) return `nesneler: ${k.nesne.join(",")}`;
  if (!(await sayfa.locator(".kaynak-pdf-satiri").first().textContent()).includes("PDF yüklendi")) return "satır durumu güncellenmedi";
});

await senaryo("T2 Değiştir: yeni nesne kayıtlı, eski nesne depodan silindi, yetim yok", async (k) => {
  const once = kayitlar(PID)[0].split("|")[1];
  await dosyaSec("yeni.pdf");
  const tamam = await kosulBekle(() => { const s = kayitlar(PID)[0]; return s && !s.endsWith(once); });
  await kosulBekle(() => nesneler(PID).length === 1, 10000);
  Object.assign(k, { once, kayit: kayitlar(PID), nesne: nesneler(PID) });
  if (!tamam) return "kayıt değişmedi";
  if (k.nesne.includes(once)) return "eski nesne depoda kaldı";
  if (k.nesne.length !== 1 || k.nesne[0] !== k.kayit[0].split("|")[1]) return `nesneler: ${k.nesne.join(",")}`;
});

await senaryo("T3 PDF'i aç: imzalı bağlantı gerçek depodan alınır ve PDF döner", async (k) => {
  // window.open(..., "noopener") ile açılan sekmenin adresi Playwright'ta boş görünebiliyor; isteğin kendisi beklenir.
  const [istek] = await Promise.all([
    baglam.waitForEvent("request", { predicate: (r) => r.method() === "GET" && /\/object\/sign\/project-files\/.*[?&]token=/.test(r.url()), timeout: 20000 }),
    sayfa.locator(".kaynak-pdf-satiri").first().getByRole("button", { name: "PDF'i aç" }).click(),
  ]);
  const cevap = await fetch(istek.url());
  const bas = Buffer.from(await cevap.arrayBuffer()).subarray(0, 5).toString();
  k.adres = istek.url().replace(/token=[^&]+/, "token=…");
  Object.assign(k, { durum: cevap.status, bas });
  if (cevap.status !== 200 || bas !== "%PDF-") return `imzalı bağlantı PDF döndürmedi (${cevap.status}, ${bas})`;
});

await senaryo("T4 DB yazımı düşerken Değiştir: hata bildirimi, eski PDF ve kayıt yerinde, yeni nesne temizlendi", async (k) => {
  const once = kayitlar(PID)[0];
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  await dosyaSec("dusecek.pdf");
  k.bildirim = await bildirim(/Kaydedilemedi|tekrar deneyin|yetkiniz yok/i, 30000);
  await bekle(1500);
  psql("grant select, insert, update, delete on public.kaynak_pdfleri to authenticated");
  Object.assign(k, { once, kayit: kayitlar(PID), nesne: nesneler(PID), basariBildirimi: await bildirim(/^PDF yüklendi\.?$/, 500) });
  if (!k.bildirim) return "hata bildirimi görünmedi";
  if (k.kayit[0] !== once) return `kayıt değişti: ${k.kayit[0]}`;
  if (!k.nesne.includes(once.split("|")[1])) return "eski PDF silindi";
  if (k.nesne.length !== 1) return `yetim nesne: ${k.nesne.filter((n) => n !== once.split("|")[1]).join(",")}`;
});

await tarayici.close();
const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (konsol.length) console.log("tarayıcı konsolu:\n" + konsol.slice(0, 15).join("\n"));
if (CIKTI) fs.writeFileSync(CIKTI, JSON.stringify({ sonuclar, konsol }, null, 2));
process.exit(fail ? 1 : 0);
