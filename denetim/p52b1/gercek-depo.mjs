// P52b-1 — GERÇEK Supabase Storage kabulü (supabase/storage-api v1.11, dosya
// arka ucu; depolama politikaları proje migration'larından, Storage API'nin
// kendi RLS uygulamasıyla). Sunucu eylemleri gerçek; istemci gerçek
// supabase-js (oturum jetonu yerel yığının sırrıyla imzalı). Yalnızca
// OpenAlex ve dış indirme taklit. Yalnızca 127.0.0.1.
//
//   denetim/p52b1/kur-gercek-depo.sh && node denetim/p52b/yigin/gecit.mjs &
//   node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b1/gercek-depo.mjs [çıktı.json]
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { kaynakPdfleriniBul, kaynakPdfiYuklendi } = await import("../../app/actions/kaynak-pdf.ts");
let yuklemeYolu = (p) => `${p}/kaynak-pdf/y-${Date.now()}.pdf`; // eski istemcinin yolu
try {
  ({ yuklemeYolu } = await import("../../lib/kaynak-pdf-yolu.ts"));
} catch {
  /* eski kod */
}

const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const ANON = imzala({ role: "anon" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();
const kullanici = (ad) => {
  const id = crypto.randomUUID();
  psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${id}', '${ad}-${id.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
  return id;
};
const SAHIP = kullanici("sahip");
const YABANCI = kullanici("yabanci");
/* Depolama yükleme politikası abonelik kapısına bakıyor (subscription_open).
   İki ayrı kurum, lisansı ArvoOS'tan hiç bildirilmemiş: kapı açık
   (lib/license-decision.ts — bilgisizlik kapatmaz). */
for (const [uid, ad] of [[SAHIP, "Kurum S"], [YABANCI, "Kurum Y"]]) {
  const org = crypto.randomUUID();
  psql(`insert into public.organizations (id, name) values ('${org}', '${ad}')`);
  psql(`update public.profiles set organization_id='${org}' where id='${uid}'`);
}
const istemci = (uid) =>
  createClient(GECIT, ANON, {
    global: { headers: { Authorization: `Bearer ${imzala({ role: "authenticated", aud: "authenticated", sub: uid })}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
const baglam = (uid) => ({ supabase: istemci(uid), user: { id: uid }, role: "client" });
const proje = () => {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${SAHIP}', 'Gerçek depo', 'thesis')`);
  return id;
};
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const KUNYE_A = "Ali, B. (2019). A künyesi. Dergi, 2(1), 5-6.";
const KUNYE_B = "Bora, C. (2018). B künyesi. Dergi, 3(1), 7-8.";
const OTO = [{ kunye: KUNYE_A, doi: "10.1/gercek", dogrulama: "verified" }];
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
globalThis.__denetim = {
  ctx: null,
  dizin: async () => ({ durum: 200, veri: { best_oa_location: { pdf_url: "https://oa.ornek/m.pdf" } } }),
  indir: async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" }),
};
/** Gerçek depodaki nesneler (storage.objects, Storage API'nin kendi tablosu). */
const nesneler = (pid) => psql(`select name from storage.objects where bucket_id='project-files' and name like '${pid}/%' order by name`).split("\n").filter(Boolean);
const kayitlar = (pid) => psql(`select durum||'|'||coalesce(depo_yolu,'-') from public.kaynak_pdfleri where project_id='${pid}' order by kunye_anahtari`).split("\n").filter(Boolean);
const yetimler = (pid) => {
  const k = new Set(psql(`select depo_yolu from public.kaynak_pdfleri where project_id='${pid}' and depo_yolu is not null`).split("\n").filter(Boolean));
  return nesneler(pid).filter((n) => !k.has(n));
};
async function tarayiciYuklemesi(uid, pid) {
  const yol = yuklemeYolu(pid, uid);
  const { error } = await istemci(uid).storage.from("project-files").upload(yol, new Blob([PDF], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`depo yüklemesi reddedildi: ${error.message}`);
  await bekle(2); // aynı milisaniyede iki yol üretilmesin
  return yol;
}

const sonuclar = [];
async function senaryo(kimlik, ad, fn) {
  const kanit = {};
  try {
    const sorun = await fn(kanit);
    sonuclar.push({ kimlik, ad, sonuc: sorun ? "FAIL" : "PASS", sorun: sorun ?? null, kanit });
  } catch (h) {
    sonuclar.push({ kimlik, ad, sonuc: "HATA", sorun: String(h?.message ?? h).slice(0, 300), kanit });
  } finally {
    psql("grant select, insert, update, delete on public.kaynak_pdfleri to authenticated");
    globalThis.__denetim.indir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" });
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc.padEnd(4)}  ${kimlik}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

await senaryo("G1", "Meşru yükleme ve değiştirme: yeni nesne kayıtlı, eski nesne gerçek depodan silindi", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  const y1 = await tarayiciYuklemesi(SAHIP, pid);
  const r1 = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: y1 });
  const y2 = await tarayiciYuklemesi(SAHIP, pid);
  const r2 = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: y2 });
  Object.assign(k, { r1: r1.error ?? "başarılı", r2: r2.error ?? "başarılı", kayit: kayitlar(pid), nesne: nesneler(pid) });
  if (r1.error || r2.error) return "meşru yükleme düştü";
  if (k.kayit[0] !== `yuklendi|${y2}` || k.nesne.length !== 1 || k.nesne[0] !== y2) return `kayıt ${k.kayit[0]}, nesneler ${k.nesne.join(",")}`;
});

await senaryo("G2", "Meşru otomatik indirme (gerçek depoya yazar) ve eşzamanlı ikinci arama → tek kayıt, tek nesne", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  globalThis.__denetim.indir = async () => { await bekle(300); return { bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" }; };
  const [a, b] = await Promise.all([kaynakPdfleriniBul(pid, OTO), (async () => { await bekle(5); return kaynakPdfleriniBul(pid, OTO); })()]);
  Object.assign(k, { a: a.error ?? "başarılı", b: b.error ?? "başarılı", kayit: kayitlar(pid), nesne: nesneler(pid) });
  if (k.kayit.length !== 1 || !k.kayit[0].startsWith("indirildi|")) return `kayıt ${k.kayit.join(",")}`;
  if (k.nesne.length !== 1) return `${k.nesne.length} nesne (yetim: ${yetimler(pid).length})`;
});

await senaryo("G3", "Kullanıcı yüklerken otomatik arama (gerçek depo) → yükleme korunur, yetim yok", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  globalThis.__denetim.indir = async () => { await bekle(800); return { bayt: new TextEncoder().encode("<html>giris</html>"), sonAdres: "https://y.ornek/giris", tur: "text/html" }; };
  const bul = kaynakPdfleriniBul(pid, OTO);
  await bekle(150);
  const y = await tarayiciYuklemesi(SAHIP, pid);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, doi: "10.1/gercek", depoYolu: y });
  await bul;
  Object.assign(k, { r: r.error ?? "başarılı", kayit: kayitlar(pid), nesne: nesneler(pid) });
  if (k.kayit[0] !== `yuklendi|${y}`) return `yükleme ezildi: ${k.kayit[0]}`;
  if (yetimler(pid).length) return "yetim nesne";
});

await senaryo("G4", "DB yazımı düştü → yüklenen nesne gerçek depodan temizlendi; hata döndü", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  const y = await tarayiciYuklemesi(SAHIP, pid);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: y });
  Object.assign(k, { r: r.error ?? "başarılı", nesne: nesneler(pid) });
  if (!r.error) return "başarı bildirildi";
  if (k.nesne.length) return `yetim nesne: ${k.nesne[0]}`;
});

await senaryo("G5", "A'nın kaydı API'den B'nin yoluna çevrilip A değiştirilir → B'nin nesnesi gerçek depoda kalır", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  const yA = await tarayiciYuklemesi(SAHIP, pid);
  const yB = await tarayiciYuklemesi(SAHIP, pid);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yA });
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: yB });
  await istemci(SAHIP).from("kaynak_pdfleri").update({ depo_yolu: yB }).eq("project_id", pid).eq("depo_yolu", yA);
  const yA2 = await tarayiciYuklemesi(SAHIP, pid);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yA2 });
  // A'nın yüklemesine doğrudan B'nin yolu da verilir.
  const r2 = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yB });
  Object.assign(k, { r: r.error ?? "başarılı", r2: r2.error ?? "kabul edildi", kayit: kayitlar(pid), nesne: nesneler(pid), bVar: nesneler(pid).includes(yB) });
  if (!k.bVar) return "B'nin PDF'i gerçek depodan silindi";
  if (!r2.error) return "A, B'nin yoluna bağlandı";
});

await senaryo("G6", "Yabancı kullanıcı: çalışmanın klasörüne YÜKLEYEMEZ, sahibin nesnesini SİLEMEZ, eylem reddeder (gerçek depo politikası)", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  const y = await tarayiciYuklemesi(SAHIP, pid);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: y });
  const yabanci = istemci(YABANCI);
  const yYabanci = yuklemeYolu(pid, YABANCI);
  const { error: yuklemeHatasi } = await yabanci.storage.from("project-files").upload(yYabanci, new Blob([PDF]), { contentType: "application/pdf" });
  const { data: silinen } = await yabanci.storage.from("project-files").remove([y]);
  const { error: indirmeHatasi } = await yabanci.storage.from("project-files").download(y);
  globalThis.__denetim.ctx = baglam(YABANCI);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: y });
  Object.assign(k, { yukleme: yuklemeHatasi?.message ?? "YÜKLEDİ", silinen: silinen?.length ?? 0, indirme: indirmeHatasi?.message ?? "İNDİRDİ", eylem: r.error ?? "başarılı", nesne: nesneler(pid), kayit: kayitlar(pid) });
  if (!yuklemeHatasi) return "yabancı çalışmanın klasörüne yükledi";
  if (!indirmeHatasi) return "yabancı sahibin PDF'ini indirdi";
  if (!k.nesne.includes(y)) return "yabancı sahibin PDF'ini sildi";
  if (!r.error) return "eylem yabancıyı kabul etti";
});

await senaryo("G7", "Eski istemcinin yolu (y-<zaman>.pdf) reddedilir, nesneye dokunulmaz (dağıtım geçişi)", async (k) => {
  const pid = proje();
  globalThis.__denetim.ctx = baglam(SAHIP);
  const eski = `${pid}/kaynak-pdf/y-${Date.now()}.pdf`;
  const { error: yh } = await istemci(SAHIP).storage.from("project-files").upload(eski, new Blob([PDF], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  if (yh) throw new Error(`depo yüklemesi reddedildi: ${yh.message}`);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: eski });
  Object.assign(k, { r: r.error ?? "kabul edildi", nesne: nesneler(pid), kayit: kayitlar(pid) });
  k.not = "Yeni kodda reddedilir ve nesne yetim kalır: dağıtım sırasında açık kalmış eski sekmenin tek yüklemesi. Eski kodda kabul edilir (beklenen).";
  if (!r.error) return "eski biçim kabul edildi (eski kodda beklenen)";
});

const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(sonuclar, null, 2));
process.exit(0);
