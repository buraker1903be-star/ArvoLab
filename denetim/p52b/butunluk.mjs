// P52b DENETİMİ — Storage/DB bütünlüğü ve yetki senaryoları.
// GERÇEK sunucu eylemleri (app/actions/kaynak-pdf.ts, değiştirilmeden) + GERÇEK
// yerel Postgres 17/PostgREST/GoTrue (RLS gerçek) + SAHTE Storage (bellekte,
// hata enjeksiyonlu) + kontrollü OpenAlex/indirme taklidi. Dış ağa çıkılmaz;
// Production/Test Supabase'e bağlanılmaz (yalnızca 127.0.0.1).
//
//   node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b/butunluk.mjs [çıktı.json]
//
// Her senaryo BUGÜNKÜ davranışı ölçer; "FAIL" = bulgunun yeniden üretildiği,
// beklenen güvenli davranışın sağlanmadığı durum.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { kaynakPdfleriniBul, kaynakPdfiYuklendi, kaynakPdfleri } = await import("../../app/actions/kaynak-pdf.ts");

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

// ---------- hesaplar (GoTrue şeması varken auth.users'a doğrudan; profil tetikleyicisi çalışır) ----------
const kullanici = (ad) => {
  const id = crypto.randomUUID();
  psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${id}', '${ad}-${id.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
  return id;
};
const SAHIP = kullanici("sahip");
const YABANCI = kullanici("yabanci");
const istemci = (uid) => createClient(GECIT, ANON, { global: { headers: { Authorization: `Bearer ${imzala({ role: "authenticated", aud: "authenticated", sub: uid })}` } }, auth: { persistSession: false, autoRefreshToken: false } });

// ---------- sahte Storage ----------
function sahteDepo() {
  const nesneler = new Map();
  const ayar = { yuklemeHatasi: false, silmeHatasi: false, yuklemeGecikmesi: 0 };
  const kova = {
    async upload(yol, veri, secenek = {}) {
      if (ayar.yuklemeGecikmesi) await new Promise((c) => setTimeout(c, ayar.yuklemeGecikmesi));
      if (ayar.yuklemeHatasi) return { data: null, error: { message: "enjekte: yükleme düştü" } };
      if (nesneler.has(yol) && !secenek.upsert) return { data: null, error: { message: "The resource already exists" } };
      nesneler.set(yol, veri instanceof Uint8Array ? veri : new Uint8Array(await new Blob([veri]).arrayBuffer()));
      return { data: { path: yol }, error: null };
    },
    async remove(yollar) {
      if (ayar.silmeHatasi) return { data: null, error: { message: "enjekte: silme düştü" } };
      for (const y of yollar) nesneler.delete(y);
      return { data: yollar.map((name) => ({ name })), error: null };
    },
    async download(yol) {
      const v = nesneler.get(yol);
      return v ? { data: new Blob([v]), error: null } : { data: null, error: { message: "Object not found" } };
    },
    async createSignedUrls(yollar) {
      return { data: yollar.map((p) => ({ path: p, signedUrl: `sahte://${p}` })), error: null };
    },
  };
  return { nesneler, ayar, storage: { from: () => kova } };
}
const baglam = (uid, depo) => {
  const ic = istemci(uid);
  const vekil = new Proxy(ic, { get: (h, a) => (a === "storage" ? depo.storage : typeof h[a] === "function" ? h[a].bind(h) : h[a]) });
  return { supabase: vekil, user: { id: uid }, role: "client" };
};

// ---------- veri ----------
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const HTML = new TextEncoder().encode("<!doctype html><html><body>Giriş yapın</body></html>");
const proje = (sahip = SAHIP) => {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${sahip}', 'Denetim çalışması', 'thesis')`);
  return id;
};
const KUNYE = "Yılmaz, A. (2020). Denetim başlığı. Dergi, 1(2), 3-4.";
const kayitlar = (pid) => psql(`select durum||'|'||coalesce(depo_yolu,'-') from public.kaynak_pdfleri where project_id='${pid}'`).split("\n").filter(Boolean);
const yetimler = (depo, pid) => {
  const kayitli = new Set(psql(`select depo_yolu from public.kaynak_pdfleri where project_id='${pid}' and depo_yolu is not null`).split("\n").filter(Boolean));
  return [...depo.nesneler.keys()].filter((y) => y.startsWith(`${pid}/`) && !kayitli.has(y));
};
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
const OA = { durum: 200, veri: { best_oa_location: { pdf_url: "https://oa.ornek/makale.pdf" } } };

globalThis.__denetim = { ctx: null, dizin: async () => OA, indir: async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" }) };

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
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc.padEnd(4)}  ${kimlik}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

await senaryo("B-DB-1", "PDF depoya yazıldı, DB kaydı düştü → depoda yetim dosya kalmamalı", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated"); // DB yazımı düşer (okuma açık)
  const r = await kaynakPdfleriniBul(pid, [{ kunye: KUNYE, doi: "10.1/denetim", dogrulama: "verified" }]);
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (k.yetim.length) return `${k.yetim.length} yetim dosya: ${k.yetim[0]}`;
});

await senaryo("B-RACE-1", "'PDF'leri bul' sürerken öğrenci aynı künyeye PDF yükledi → öğrencinin yüklemesi korunmalı", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  // Otomatik arama yavaş bir arşivden HTML (giriş sayfası) alıyor.
  globalThis.__denetim.indir = async () => { await bekle(800); return { bayt: HTML, sonAdres: "https://yayinci.ornek/giris", tur: "text/html" }; };
  const bul = kaynakPdfleriniBul(pid, [{ kunye: KUNYE, doi: "10.1/denetim", dogrulama: "verified" }]);
  await bekle(150);
  const yol = `${pid}/kaynak-pdf/y-${Date.now()}.pdf`;
  await depo.storage.from().upload(yol, PDF);
  const y = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, doi: "10.1/denetim", depoYolu: yol });
  k.yuklemeSonrasi = kayitlar(pid);
  await bul;
  Object.assign(k, { yukleme: y.error ?? "başarılı", son: kayitlar(pid), yetim: yetimler(depo, pid) });
  globalThis.__denetim.indir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" });
  if (!k.son[0]?.startsWith("yuklendi|")) return `öğrencinin yüklemesi ezildi: kayıt "${k.son[0]}", yüklenen dosya yetim (${k.yetim.length})`;
});

await senaryo("B-RACE-2", "Aynı künye için eşzamanlı iki 'PDF'leri bul' → tek dosya, yetim yok", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  globalThis.__denetim.indir = async () => { await bekle(300); return { bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" }; };
  const kunye = [{ kunye: KUNYE, doi: "10.1/denetim", dogrulama: "verified" }];
  await Promise.all([kaynakPdfleriniBul(pid, kunye), (async () => { await bekle(5); return kaynakPdfleriniBul(pid, kunye); })()]);
  globalThis.__denetim.indir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" });
  Object.assign(k, { kayit: kayitlar(pid), depodaki: [...depo.nesneler.keys()].length, yetim: yetimler(depo, pid) });
  if (k.yetim.length) return `${k.depodaki} dosya indirildi, ${k.yetim.length} yetim`;
});

await senaryo("B-RACE-3", "İndirilmiş PDF varken ikinci sekme eski okumayla bitirirse 'indirildi' kaydı başarısızlıkla ezilmemeli", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  let cagri = 0;
  // 1. çağrı yavaş ve başarısız (HTML), 2. çağrı hızlı ve başarılı (PDF).
  globalThis.__denetim.indir = async () => {
    const n = ++cagri;
    if (n === 1) { await bekle(600); return { bayt: HTML, sonAdres: "https://yayinci.ornek/giris", tur: "text/html" }; }
    return { bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" };
  };
  const kunye = [{ kunye: KUNYE, doi: "10.1/denetim", dogrulama: "verified" }];
  const yavas = kaynakPdfleriniBul(pid, kunye);
  await bekle(100);
  await kaynakPdfleriniBul(pid, kunye);
  k.hizliSonrasi = kayitlar(pid);
  await yavas;
  globalThis.__denetim.indir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" });
  Object.assign(k, { son: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (!k.son[0]?.startsWith("indirildi|")) return `indirilen PDF'in kaydı ezildi: "${k.son[0]}", dosya yetim (${k.yetim.length})`;
});

await senaryo("B-DEL-1", "PDF değiştirilirken eski dosyanın silinmesi düşerse hata görülmeli / yetim kalmamalı", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const y1 = `${pid}/kaynak-pdf/y-1.pdf`;
  await depo.storage.from().upload(y1, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y1 });
  const y2 = `${pid}/kaynak-pdf/y-2.pdf`;
  await depo.storage.from().upload(y2, PDF);
  depo.ayar.silmeHatasi = true;
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y2 });
  Object.assign(k, { donus: r.error ?? "başarılı (hata bildirilmedi)", kayit: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (k.yetim.length) return `eski dosya silinemedi ve sessizce yetim kaldı: ${k.yetim[0]}`;
});

await senaryo("B-DB-2", "Öğrenci PDF yükledi, DB kaydı düştü → yüklenen dosya yetim kalmamalı", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = `${pid}/kaynak-pdf/y-${Date.now()}.pdf`;
  await depo.storage.from().upload(yol, PDF);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  Object.assign(k, { donus: r.error ?? "başarılı", yetim: yetimler(depo, pid) });
  if (k.yetim.length) return `yüklenen dosya yetim: ${k.yetim[0]}`;
});

await senaryo("B-PATH-1", "Yükleme kaydı aynı çalışmadaki BAŞKA bir künyenin dosyasını gösterebiliyor mu", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yolA = `${pid}/kaynak-pdf/y-A.pdf`;
  await depo.storage.from().upload(yolA, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: "Ali, B. (2019). A künyesi. Dergi.", depoYolu: yolA });
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yolA }); // B künyesi A'nın dosyasını gösteriyor
  Object.assign(k, { donus: r.error ?? "kabul edildi", kayit: kayitlar(pid) });
  if (!r.error) return "iki künye aynı dosyayı gösteriyor; biri değiştirilince ötekinin dosyası silinir";
});

await senaryo("B-AUTH-1", "Yabancı kullanıcı başka çalışmanın PDF kayıtlarını göremez ve yazamaz", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = `${pid}/kaynak-pdf/y-1.pdf`;
  await depo.storage.from().upload(yol, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  globalThis.__denetim.ctx = baglam(YABANCI, depo);
  const gorunen = await kaynakPdfleri(pid);
  const yazma = await kaynakPdfleriniBul(pid, [{ kunye: "Başka (2021). X. Y.", doi: "10.1/x", dogrulama: "verified" }]);
  Object.assign(k, { gorunen: gorunen.length, yazma: yazma.error ?? "başarılı", kayit: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (gorunen.length || !yazma.error) return "yabancı erişti";
  if (k.yetim.length) return `yetki reddinden önce dosya depoya yazıldı (sahte depo RLS'siz; gerçek depoda politika reddeder): ${k.yetim.length}`;
});

const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(sonuclar, null, 2));
process.exit(0);
