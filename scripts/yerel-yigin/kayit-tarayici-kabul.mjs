// P52a2 tarayıcı kabulü: GERÇEK Next uygulaması (next dev) → yerel geçit →
// GoTrue + PostgREST + Postgres 17. Sunucu eylemleri (saveManuscript,
// restoreManuscriptVersion) gerçekten çalışır; sahte istemci YOK. Sentetik
// hesap ve metin; yalnızca 127.0.0.1. CI'da koşmaz (docker + sunucu ister).
//
//   node scripts/yerel-yigin/kayit-tarayici-kabul.mjs <uygulama-adresi> [çıktı.json]
//
// "Öteki sekme" yazmaları GoTrue oturumu açmadan, aynı kullanıcı adına
// basılmış bir erişim belirteciyle PostgREST'e gider: uygulama girişte öteki
// oturumları kapatıyor (lib/tek-oturum.ts) ve ikinci bir tarayıcı girişi
// birincisini düşürürdü. Belirteç yalnızca yerel yığının sırrıyla imzalı.
//
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

// Playwright önceden kurulu (global); require ile çözülüyor (scripts/onizleme ile aynı).
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const UYGULAMA = process.argv[2] ?? "http://localhost:3124";
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

try {
  if (!(await fetch(`${GECIT}/rest/v1/`, { headers: { apikey: ANON } })).ok) throw new Error("rest");
  if ((await fetch(UYGULAMA)).status >= 500) throw new Error("uygulama");
} catch (hata) {
  console.error(`ÖN KOŞUL YOK: ${hata.message} (kur.sh, gecit.mjs ve next dev çalışmalı)`);
  process.exit(2);
}
const tetikleyiciVar = psql("select count(*) from pg_trigger where tgname = 'metin_surum_damgasi'") === "1";

// ---------- tohum ----------
const ek = Date.now().toString(36);
const EMAIL = `tarayici-${ek}@yerel.test`;
const r = await fetch(`${GECIT}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVIS, authorization: `Bearer ${SERVIS}`, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: SIFRE, email_confirm: true }),
});
const KULLANICI = (await r.json()).id;
const OTEKI = imzala({ role: "authenticated", aud: "authenticated", sub: KULLANICI });
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values ('${KULLANICI}', 'kullanim_sozlesmesi', '2026-10-29.3', 'tr', '${"0".repeat(64)}', 'giris', true)`);

const doc = (metin) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: metin }] }] });
function proje(baslangic) {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${KULLANICI}', 'Tarayıcı ${id.slice(0, 6)}', 'thesis')`);
  psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by) values ('${id}', '${JSON.stringify(doc(baslangic))}'::jsonb, '${baslangic}', 2, '${KULLANICI}')`);
  return id;
}
const metin = (id) => psql(`select plain_text from public.project_manuscripts where project_id = '${id}'`);
const damga = (id) => psql(`select to_json(updated_at)#>>'{}' from public.project_manuscripts where project_id = '${id}'`);
const surumler = (id) =>
  psql(`select plain_text from public.project_manuscript_versions where project_id = '${id}' order by created_at`).split("\n").filter(Boolean);
const korunduMu = (id, m) => metin(id) === m || surumler(id).includes(m);
const otekiSatir = (m) => ({ content: doc(m), plain_text: m, word_count: 3, updated_by: KULLANICI, updated_at: new Date().toISOString() });
/** Öteki sekme: güncel damgaya koşullu kaydeder (meşru bir kayıt). */
async function otekiKaydetsin(id, m) {
  const res = await fetch(`${GECIT}/rest/v1/project_manuscripts?project_id=eq.${id}&updated_at=eq.${encodeURIComponent(damga(id))}`, {
    method: "PATCH",
    headers: { apikey: ANON, authorization: `Bearer ${OTEKI}`, "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify(otekiSatir(m)),
  });
  const govde = await res.json();
  if (!res.ok || !govde.length) throw new Error(`öteki sekme yazamadı: ${res.status} ${JSON.stringify(govde).slice(0, 200)}`);
}
const kanca = (k) => fetch(`${GECIT}/__gecit/kanca`, { method: "POST", body: JSON.stringify(k) });
const kancaSil = () => fetch(`${GECIT}/__gecit/kanca`, { method: "DELETE" });

// ---------- tarayıcı ----------
const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const sayfa = await baglam.newPage();
const toastlar = [];
sayfa.on("dialog", (d) => d.accept());
await sayfa.goto(UYGULAMA + "/");
await sayfa.fill('input[name="email"]', EMAIL);
await sayfa.fill('input[name="password"]', SIFRE);
await sayfa.press('input[name="password"]', "Enter");
await sayfa.waitForURL(/\/dashboard/, { timeout: 90000 });

async function editoruAc(id) {
  await sayfa.waitForLoadState("load").catch(() => {});
  await bekle(1500); // önceki senaryonun yenilemesi bitsin
  await sayfa.goto(`${UYGULAMA}/dashboard/editor/${id}/write`, { timeout: 120000 });
  await sayfa.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 120000 });
}
async function yaz(m) {
  await sayfa.click(".ProseMirror");
  await sayfa.keyboard.press("Control+End");
  await sayfa.keyboard.type(` ${m}`);
}
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
/** Bant "kaydediliyor" durumunda hemen gizlenir: sonucu veritabanından bekle. */
async function belgeBekle(id, kosul, ms = 30000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    if (kosul(metin(id))) return true;
    await bekle(300);
  }
  return false;
}
async function bildirimBekle(desen, ms = 30000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    // Başarılı geri yükleme sayfayı yeniler; o sırada okuma düşerse yeniden denenir.
    const metinler = await sayfa
      .locator("[role=status], [role=alert], .toast, [data-toast]")
      .allTextContents()
      .catch(() => []);
    const bulunan = metinler.find((x) => desen.test(x));
    if (bulunan) {
      toastlar.push(bulunan.trim().slice(0, 240));
      return bulunan;
    }
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
  } catch (hata) {
    sonuclar.push({ ad, sonuc: "FAIL", sorun: `istisna: ${hata.message.split("\n")[0]}`, kanit });
  } finally {
    await kancaSil();
    psql("grant insert on public.project_manuscript_versions to authenticated");
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

await senaryo("T1 zorla kayıt, öteki sürüm yedeklenemiyor: öteki sekmenin metni silinmez", async (k) => {
  const id = proje("Başlangıç metni");
  await editoruAc(id);
  await otekiKaydetsin(id, "Öteki sekmenin kaydettiği metin");
  await yaz("tarayıcıda yazılan");
  await sayfa.getByRole("button", { name: "Benim sürümümü kaydet" }).waitFor({ timeout: 30000 });
  psql("revoke insert on public.project_manuscript_versions from authenticated");
  await sayfa.getByRole("button", { name: "Benim sürümümü kaydet" }).click();
  await bekle(4000);
  k.bandHala = await sayfa.getByRole("button", { name: "Benim sürümümü kaydet" }).isVisible();
  k.bildirim = await bildirimBekle(/kaydedilmedi|yedeklenemedi/i, 4000);
  psql("grant insert on public.project_manuscript_versions to authenticated");
  Object.assign(k, { belge: metin(id), surumler: surumler(id) });
  if (!korunduMu(id, "Öteki sekmenin kaydettiği metin")) return `öteki sekmenin metni ne belgede ne sürüm geçmişinde (belge: "${k.belge}")`;
  if (!k.bandHala) return "çakışma bandı kayboldu";
  if (!k.bildirim) return "kullanıcıya bildirim gösterilmedi";
  // Yedek yeniden mümkün: aynı düğme bu kez yazar, öteki sürüm geçmişte.
  await sayfa.getByRole("button", { name: "Benim sürümümü kaydet" }).click();
  await belgeBekle(id, (m) => m.includes("tarayıcıda yazılan"));
  Object.assign(k, { ikinciBelge: metin(id), ikinciSurumler: surumler(id) });
  if (!k.ikinciBelge.includes("tarayıcıda yazılan")) return `ikinci deneme yazmadı: "${k.ikinciBelge}"`;
  if (!surumler(id).includes("Öteki sekmenin kaydettiği metin")) return "ikinci denemede öteki sürüm yedeklenmedi";
});

await senaryo("T2 meşru zorla kayıt: benim sürümüm yazılır, öteki sürüm geçmişte", async (k) => {
  const id = proje("Başlangıç metni");
  await editoruAc(id);
  await otekiKaydetsin(id, "Öteki sekme ikinci");
  await yaz("benim sürümüm");
  await sayfa.getByRole("button", { name: "Benim sürümümü kaydet" }).click({ timeout: 30000 });
  await belgeBekle(id, (m) => m.includes("benim sürümüm"));
  Object.assign(k, { belge: metin(id), surumler: surumler(id) });
  if (!k.belge.includes("benim sürümüm") || !k.surumler.includes("Öteki sekme ikinci")) return JSON.stringify(k);
});

await senaryo("T3 sürüm geri yükleme yarışı: yedekten sonra öteki sekmenin kaydettiği metin silinmez", async (k) => {
  const id = proje("Başlangıç metni");
  psql(`insert into public.project_manuscript_versions (project_id, content, plain_text, word_count, kind, label, created_by, created_at)
        values ('${id}', '${JSON.stringify(doc("Geri yüklenecek eski sürüm"))}'::jsonb, 'Geri yüklenecek eski sürüm', 3, 'manual', 'Eski', '${KULLANICI}', now() - interval '1 hour')`);
  await editoruAc(id);
  // Sunucu yedeği aldığı anda öteki sekme kaydeder.
  await kanca({
    yontem: "POST",
    yolIcerir: "/rest/v1/project_manuscript_versions",
    eylem: {
      yontem: "PATCH",
      yol: `/rest/v1/project_manuscripts?project_id=eq.${id}&updated_at=eq.${encodeURIComponent(damga(id))}`,
      basliklar: { apikey: ANON, authorization: `Bearer ${OTEKI}`, prefer: "return=representation" },
      govde: otekiSatir("Öteki sekme: yedekten sonra"),
    },
  });
  await sayfa.getByRole("button", { name: "Sayfa ayarı, kapak, paylaş, sürümler, kısayollar" }).click();
  await sayfa.getByRole("button", { name: "Sürüm geçmişi" }).click();
  const dlg = sayfa.locator("[role=dialog]");
  await dlg.getByRole("button", { name: "Geri yükle" }).first().click({ timeout: 30000 });
  k.bildirim = await bildirimBekle(/geri yükle/i, 20000);
  await bekle(3000);
  const gecmis = await (await fetch(`${GECIT}/__gecit/kanca`)).json();
  k.kancaTetiklendi = gecmis.kancaGecmisi.some((x) => x.eylemSonucu.govde.includes("yedekten sonra"));
  Object.assign(k, { belge: metin(id), surumler: surumler(id) });
  if (!k.kancaTetiklendi) return "yarış kurulamadı (kanca tetiklenmedi)";
  if (!korunduMu(id, "Öteki sekme: yedekten sonra")) return `öteki sekmenin metni kayboldu (belge: "${k.belge}")`;
});

await senaryo("T4 meşru sürüm geri yükleme: sürüm yazılır, önceki hâl yedekte", async (k) => {
  const id = proje("Geri yüklemeden önceki metin");
  psql(`insert into public.project_manuscript_versions (project_id, content, plain_text, word_count, kind, label, created_by, created_at)
        values ('${id}', '${JSON.stringify(doc("Eski sürüm T4"))}'::jsonb, 'Eski sürüm T4', 3, 'manual', 'Eski', '${KULLANICI}', now() - interval '1 hour')`);
  await editoruAc(id);
  await sayfa.getByRole("button", { name: "Sayfa ayarı, kapak, paylaş, sürümler, kısayollar" }).click();
  await sayfa.getByRole("button", { name: "Sürüm geçmişi" }).click();
  await sayfa.locator("[role=dialog]").getByRole("button", { name: "Geri yükle" }).first().click({ timeout: 30000 });
  const son = Date.now() + 30000;
  while (Date.now() < son && metin(id) !== "Eski sürüm T4") await bekle(300);
  Object.assign(k, { belge: metin(id), surumler: surumler(id) });
  if (k.belge !== "Eski sürüm T4" || !k.surumler.includes("Geri yüklemeden önceki metin")) return JSON.stringify(k);
});

await tarayici.close();
const fail = sonuclar.filter((s) => s.sonuc === "FAIL").length;
console.log(`\ntarayıcı (${tetikleyiciVar ? "tetikleyicili" : "tetikleyicisiz"} veritabanı, ${UYGULAMA}): ${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (CIKTI) fs.writeFileSync(CIKTI, JSON.stringify({ uygulama: UYGULAMA, tetikleyiciVar, zaman: new Date().toISOString(), toastlar, sonuclar }, null, 2));
process.exit(fail ? 1 : 0);
