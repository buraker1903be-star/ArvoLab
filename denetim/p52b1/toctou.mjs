// P52b-1 son güvenlik incelemesi: iki ek riskin BELİRLENİMCİ yeniden üretimi.
//
//   Y1  sahipsizseSil TOCTOU (silen taraf): kullanım denetimi "boş" dedikten
//       SONRA, Storage silmesinden ÖNCE başka bir kayıt aynı yolu sahipleniyor.
//   Y2  sahipsizseSil TOCTOU (bağlayan taraf): silen tarafın bütün denetimleri
//       bittikten SONRA başka bir kayıt aynı yolu sahipleniyor.
//   Y3  Milisaniyelik zamanla üretilen yol: aynı milisaniyede iki işlem aynı
//       adı üretir; ikincinin yüklemesi "zaten var" ile düşer.
//
// GERÇEK: sunucu eylemleri, Postgres 17 + PostgREST + GoTrue + Storage API
// (supabase/storage-api v1.11.13, proje depolama politikaları). Sıra, istemcinin
// fetch katmanındaki KAPILARLA kuruluyor: belirli bir istekten hemen önce
// ötekinin eylemi çalıştırılıyor, zamanlama tahmini yok. Yalnızca 127.0.0.1.
//
//   denetim/p52b1/kur-gercek-depo.sh && node denetim/p52b/yigin/gecit.mjs &
//   node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b1/toctou.mjs [çıktı.json]
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { kaynakPdfleriniBul, kaynakPdfiYuklendi } = await import("../../app/actions/kaynak-pdf.ts");
const { yuklemeYolu } = await import("../../lib/kaynak-pdf-yolu.ts");

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
const SAHIP = crypto.randomUUID();
psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${SAHIP}', 'toctou-${SAHIP.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
const ORG = crypto.randomUUID();
psql(`insert into public.organizations (id, name) values ('${ORG}', 'TOCTOU kurumu')`); // lisans bildirilmemiş: kapı açık
psql(`update public.profiles set organization_id='${ORG}' where id='${SAHIP}'`);

/*
  Kapılı istemci: her istemcinin kendi kapı listesi var. Bir kapı, eşleşen İLK
  istekte bir kez çalışır: `once` istekten önce (await edilir), `yerine`
  isteği hiç göndermeden bir ağ hatası fırlatır.
*/
function istemci(kapilar = []) {
  const kapiliFetch = async (url, secenek = {}) => {
    const yontem = (secenek.method ?? "GET").toUpperCase();
    const k = kapilar.find((x) => !x.kullanildi && x.eslesir(String(url), yontem));
    if (k) {
      k.kullanildi = !k.surekli;
      if (k.once) await k.once();
      if (k.yerine) throw new TypeError(`fetch failed (enjekte: ${k.ad})`);
    }
    return fetch(url, secenek);
  };
  return createClient(GECIT, ANON, {
    global: { fetch: kapiliFetch, headers: { Authorization: `Bearer ${imzala({ role: "authenticated", aud: "authenticated", sub: SAHIP })}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const baglam = (sb) => ({ supabase: sb, user: { id: SAHIP }, role: "client" });
const proje = () => {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${SAHIP}', 'TOCTOU', 'thesis')`);
  return id;
};
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const KUNYE_A = "Ali, B. (2019). A künyesi. Dergi, 2(1), 5-6.";
const KUNYE_B = "Bora, C. (2018). B künyesi. Dergi, 3(1), 7-8.";
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
globalThis.__denetim = {
  ctx: null,
  dizin: async () => ({ durum: 200, veri: { best_oa_location: { pdf_url: "https://oa.ornek/m.pdf" } } }),
  indir: async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" }),
};
const nesneVar = (yol) => psql(`select count(*) from storage.objects where bucket_id='project-files' and name='${yol}'`) === "1";
const kayitlar = (pid) => psql(`select durum||'|'||coalesce(depo_yolu,'-') from public.kaynak_pdfleri where project_id='${pid}' order by kunye_anahtari`).split("\n").filter(Boolean);
/** Kayıt gösterdiği halde depoda olmayan yollar: kullanıcının "PDF'i aç" deyip hata aldığı durum. */
const sarkanlar = (pid) =>
  psql(`select depo_yolu from public.kaynak_pdfleri where project_id='${pid}' and depo_yolu is not null`).split("\n").filter(Boolean).filter((y) => !nesneVar(y));
const yaz = (url, yontem) => url.includes("/rest/v1/kaynak_pdfleri") && (yontem === "POST" || yontem === "PATCH");
const depoSil = (url, yontem) => url.includes("/storage/v1/object/project-files") && yontem === "DELETE";
async function yukle(sb, yol) {
  const { error } = await sb.storage.from("project-files").upload(yol, new Blob([PDF], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  return error?.message ?? null;
}

const sonuclar = [];
async function senaryo(kimlik, ad, fn) {
  const kanit = {};
  try {
    const sorun = await fn(kanit);
    sonuclar.push({ kimlik, ad, sonuc: sorun ? "FAIL" : "PASS", sorun: sorun ?? null, kanit });
  } catch (h) {
    sonuclar.push({ kimlik, ad, sonuc: "HATA", sorun: String(h?.stack ?? h).slice(0, 400), kanit });
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc.padEnd(4)}  ${kimlik}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

await senaryo("Y1", "TOCTOU (silen taraf): A'nın telafisi 'kullanılmıyor' dedikten sonra, silmeden hemen önce B aynı yolu sahipleniyor", async (k) => {
  const pid = proje();
  const P = yuklemeYolu(pid, SAHIP);
  await yukle(istemci(), P);
  const sbB = istemci();
  const sbA = istemci([
    { ad: "A'nın yazması ağda düşer", eslesir: yaz, yerine: true, surekli: true },
    {
      ad: "A'nın Storage silmesinden hemen önce B sahiplenir",
      eslesir: depoSil,
      once: async () => {
        globalThis.__denetim.ctx = baglam(sbB);
        k.b = (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: P })).error ?? "başarılı";
        k.bSonrasiNesne = nesneVar(P);
      },
    },
  ]);
  globalThis.__denetim.ctx = baglam(sbA);
  k.a = (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: P })).error ?? "başarılı";
  Object.assign(k, { kayit: kayitlar(pid), nesneVar: nesneVar(P), sarkan: sarkanlar(pid) });
  if (k.b !== "başarılı") return `ön koşul kurulamadı: B bağlanamadı (${k.b})`;
  if (k.sarkan.length) return `B'nin kaydı depoda olmayan dosyayı gösteriyor: ${k.sarkan[0]}`;
});

await senaryo("Y2", "TOCTOU (bağlayan taraf): B dosyayı okudu, A'nın telafisi tamamen bitti (sildi), sonra B kaydını yazıyor", async (k) => {
  const pid = proje();
  const P = yuklemeYolu(pid, SAHIP);
  await yukle(istemci(), P);
  const sbA = istemci([{ ad: "A'nın yazması ağda düşer", eslesir: yaz, yerine: true, surekli: true }]);
  const sbB = istemci([
    {
      ad: "B'nin kaydı yazılmadan hemen önce A baştan sona çalışır",
      eslesir: (url, yontem) => url.includes("/rest/v1/kaynak_pdfleri") && yontem === "POST",
      once: async () => {
        globalThis.__denetim.ctx = baglam(sbA);
        k.a = (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: P })).error ?? "başarılı";
        k.aSonrasiNesne = nesneVar(P);
      },
    },
  ]);
  globalThis.__denetim.ctx = baglam(sbB);
  k.b = (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: P })).error ?? "başarılı";
  Object.assign(k, { kayit: kayitlar(pid), nesneVar: nesneVar(P), sarkan: sarkanlar(pid) });
  if (k.aSonrasiNesne !== false) return "ön koşul kurulamadı: A'nın telafisi dosyayı silmedi";
  if (k.b !== "başarılı") return `B bağlanamadı (${k.b})`;
  if (k.sarkan.length) return `B'nin kaydı depoda olmayan dosyayı gösteriyor: ${k.sarkan[0]}`;
});

await senaryo("Y3a", "Aynı milisaniyede iki yükleme yolu (iki künye, iki sekme) → ikinci yükleme 'zaten var' ile düşmemeli", async (k) => {
  const pid = proje();
  const asil = Date.now;
  Date.now = () => 1763200000000;
  let y1, y2;
  try {
    y1 = yuklemeYolu(pid, SAHIP);
    y2 = yuklemeYolu(pid, SAHIP);
  } finally {
    Date.now = asil;
  }
  const sb = istemci();
  Object.assign(k, { y1, y2, ayni: y1 === y2, h1: await yukle(sb, y1), h2: await yukle(sb, y2) });
  if (k.ayni || k.h2) return `iki işlem aynı adı üretti, ikinci yükleme düştü: ${k.h2}`;
});

await senaryo("Y3b", "Aynı milisaniyede İKİ künyeye EŞZAMANLI iki yükleme (iki sekme) → her künye kendi PDF'ini taşımalı", async (k) => {
  const pid = proje();
  const asil = Date.now;
  Date.now = () => 1763200000000;
  let yA, yB;
  try {
    yA = yuklemeYolu(pid, SAHIP);
    yB = yuklemeYolu(pid, SAHIP);
  } finally {
    Date.now = asil;
  }
  const icerikA = new TextEncoder().encode("%PDF-1.7\n% A künyesinin PDF'i\n%%EOF\n");
  const icerikB = new TextEncoder().encode("%PDF-1.7\n% B künyesinin PDF'i\n%%EOF\n");
  const sb = istemci();
  const yukleIcerik = (yol, bayt) => sb.storage.from("project-files").upload(yol, new Blob([bayt], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false }).then((r) => r.error?.message ?? null);
  const [hA, hB] = await Promise.all([yukleIcerik(yA, icerikA), yukleIcerik(yB, icerikB)]);
  globalThis.__denetim.ctx = baglam(istemci());
  const rA = hA ? "yüklenmedi" : (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yA })).error ?? "başarılı";
  const rB = hB ? "yüklenmedi" : (await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: yB })).error ?? "başarılı";
  const oku = async (yol) => {
    const { data } = await sb.storage.from("project-files").download(yol);
    return data ? new TextDecoder().decode(new Uint8Array(await data.arrayBuffer())) : null;
  };
  const satirlar = psql(`select kunye, depo_yolu from public.kaynak_pdfleri where project_id='${pid}' order by kunye`).split("\n").filter(Boolean).map((x) => x.split("\t"));
  const icerikler = {};
  for (const [kunye, yol] of satirlar) icerikler[kunye.slice(0, 8)] = (await oku(yol))?.includes(kunye.startsWith("Ali") ? "A künyesinin" : "B künyesinin") ?? false;
  Object.assign(k, { ayniYol: yA === yB, hA, hB, rA, rB, kayit: kayitlar(pid), kendiPdfi: icerikler });
  const yanlis = Object.entries(icerikler).filter(([, dogru]) => !dogru).map(([a]) => a);
  if (yanlis.length) return `künye BAŞKA künyenin PDF'ini gösteriyor: ${yanlis.join(", ")}`;
  if (rA !== "başarılı" || rB !== "başarılı") return `yüklemelerden biri düştü (A: ${rA}, B: ${rB})`;
});

await senaryo("Y3c", "Aynı milisaniyede aynı künyeye iki otomatik indirme → ikisi de depoya yazabilmeli, sonuç tek kayıt, yetim yok", async (k) => {
  const pid = proje();
  const asil = Date.now;
  Date.now = () => 1763200000000;
  // İki istek de "hazır değil" görsün ve indirmeleri örtüşsün: ikisi de dış indirmede bekler.
  globalThis.__denetim.indir = async () => { await bekle(300); return { bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" }; };
  try {
    globalThis.__denetim.ctx = baglam(istemci());
    const p1 = kaynakPdfleriniBul(pid, [{ kunye: KUNYE_A, doi: "10.1/y3", dogrulama: "verified" }]);
    globalThis.__denetim.ctx = baglam(istemci());
    const p2 = kaynakPdfleriniBul(pid, [{ kunye: KUNYE_A, doi: "10.1/y3", dogrulama: "verified" }]);
    const [r1, r2] = await Promise.all([p1, p2]);
    Object.assign(k, { r1: r1.error ?? r1.sorunlar, r2: r2.error ?? r2.sorunlar });
  } finally {
    Date.now = asil;
    globalThis.__denetim.indir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/m.pdf", tur: "application/pdf" });
  }
  const nesneler = psql(`select name from storage.objects where bucket_id='project-files' and name like '${pid}/%'`).split("\n").filter(Boolean);
  Object.assign(k, { kayit: kayitlar(pid), nesne: nesneler.length, sarkan: sarkanlar(pid) });
  const depoSorunu = [k.r1, k.r2].some((r) => r && typeof r === "object" && r.depo > 0);
  if (depoSorunu) return "bir istek 'depoya yazılamadı' aldı (ad çakışması)";
  if (k.kayit.length !== 1 || !k.kayit[0].startsWith("indirildi|") || k.nesne !== 1 || k.sarkan.length) return `kayıt ${k.kayit.join(",")}, nesne ${k.nesne}`;
});

const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(sonuclar, null, 2));
process.exit(0);
