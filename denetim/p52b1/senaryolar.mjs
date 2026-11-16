// P52b-1 — PDF kayıt bütünlüğü ve güvenli telafi: ZORUNLU 10 SENARYO.
//
// GERÇEK: sunucu eylemleri (app/actions/kaynak-pdf.ts), yerel Postgres 17 +
// PostgREST v12 + GoTrue (RLS gerçek, Supabase rolleriyle).
// SAHTE: Storage (bellekte; hata/gecikme enjeksiyonlu, RLS'SİZ) ve
// OpenAlex/indirme. Storage'a dayanan sonuçlar "gerçek Storage kabulü" DEĞİLDİR;
// depolama politikası ayrıca denetim/p52b/depo-rls.sql ile gerçek PG'de sınanır.
// Yalnızca 127.0.0.1; Production/Test Supabase'e bağlanılmaz.
//
//   denetim/p52b/yigin/kur.sh && node denetim/p52b/yigin/gecit.mjs &
//   node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b1/senaryolar.mjs [çıktı.json]
//
// Aynı dosya ESKİ kodda da koşar (eski commit'in çalışma ağacına kopyalanır):
// "FAIL" = beklenen güvenli davranış sağlanmadı.
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { kaynakPdfleriniBul, kaynakPdfiYuklendi, kaynakPdfleri } = await import("../../app/actions/kaynak-pdf.ts");
let yazimi = null;
try {
  yazimi = await import("../../lib/kaynak-pdf-yazimi.ts");
} catch {
  /* eski kodda modül yok: DB düzeyindeki S0b atlanır */
}

const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const ANON = imzala({ role: "anon" });
const PG = ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"];
const PGENV = { ...process.env, PGPASSWORD: "yerel-yigin" };
const psql = (sql) => execFileSync("psql", [...PG, "-c", sql], { env: PGENV, encoding: "utf8" }).trim();
/* Ayrı bir oturumda (ayrı bağlantı) arka planda SQL: eşzamanlı işlem kurmak için. */
const psqlArka = (sql) =>
  new Promise((coz, reddet) => {
    const p = spawn("psql", [...PG, "-c", sql], { env: PGENV });
    let cikti = "";
    p.stdout.on("data", (d) => (cikti += d));
    p.stderr.on("data", (d) => (cikti += d));
    p.on("close", (kod) => (kod === 0 ? coz(cikti.trim()) : reddet(new Error(cikti))));
  });

const kullanici = (ad) => {
  const id = crypto.randomUUID();
  psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${id}', '${ad}-${id.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
  return id;
};
const SAHIP = kullanici("sahip");
const YABANCI = kullanici("yabanci");

/* Ağ kesintisi: tahmin doğruysa istek sunucuya HİÇ gitmez (fetch fırlatır). */
const ag = { kesik: null };
const agFetch = async (url, secenek = {}) => {
  if (ag.kesik?.(String(url), (secenek.method ?? "GET").toUpperCase())) throw new TypeError("fetch failed (enjekte ağ kesintisi)");
  return fetch(url, secenek);
};
const istemci = (uid) =>
  createClient(GECIT, ANON, {
    global: { fetch: agFetch, headers: { Authorization: `Bearer ${imzala({ role: "authenticated", aud: "authenticated", sub: uid })}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

function sahteDepo() {
  const nesneler = new Map();
  const ayar = { yuklemeHatasi: false, silmeHatasi: false, indirmeKancasi: null };
  const erisim = []; // her depo çağrısı: [işlem, yol]
  const kova = {
    async upload(yol, veri, secenek = {}) {
      erisim.push(["upload", yol]);
      if (ayar.yuklemeHatasi) return { data: null, error: { message: "enjekte: yükleme düştü" } };
      if (nesneler.has(yol) && !secenek.upsert) return { data: null, error: { message: "The resource already exists" } };
      nesneler.set(yol, veri instanceof Uint8Array ? veri : new Uint8Array(await new Blob([veri]).arrayBuffer()));
      return { data: { path: yol }, error: null };
    },
    async remove(yollar) {
      for (const y of yollar) erisim.push(["remove", y]);
      if (ayar.silmeHatasi) return { data: null, error: { message: "enjekte: silme düştü" } };
      for (const y of yollar) nesneler.delete(y);
      return { data: yollar.map((name) => ({ name })), error: null };
    },
    async exists(yol) {
      erisim.push(["exists", yol]);
      return nesneler.has(yol) ? { data: true, error: null } : { data: false, error: { message: "not found" } };
    },
    async download(yol) {
      erisim.push(["download", yol]);
      if (ayar.indirmeKancasi) await ayar.indirmeKancasi(yol);
      const v = nesneler.get(yol);
      return v ? { data: new Blob([v]), error: null } : { data: null, error: { message: "Object not found" } };
    },
    async createSignedUrls(yollar) {
      return { data: yollar.map((p) => ({ path: p, signedUrl: `sahte://${p}` })), error: null };
    },
  };
  return { nesneler, ayar, erisim, storage: { from: () => kova } };
}
const baglam = (uid, depo) => {
  const ic = istemci(uid);
  const vekil = new Proxy(ic, { get: (h, a) => (a === "storage" ? depo.storage : typeof h[a] === "function" ? h[a].bind(h) : h[a]) });
  return { supabase: vekil, user: { id: uid }, role: "client" };
};

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const HTML = new TextEncoder().encode("<!doctype html><html><body>Giriş yapın</body></html>");
const proje = (sahip = SAHIP) => {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${sahip}', 'Denetim çalışması', 'thesis')`);
  return id;
};
const KUNYE = "Yılmaz, A. (2020). Denetim başlığı. Dergi, 1(2), 3-4.";
const KUNYE_A = "Ali, B. (2019). A künyesi. Dergi, 2(1), 5-6.";
const KUNYE_B = "Bora, C. (2018). B künyesi. Dergi, 3(1), 7-8.";
const DOI = "10.1/denetim";
const OTO = [{ kunye: KUNYE, doi: DOI, dogrulama: "verified" }];
let sayac = 0;
/* Yeni kalıpta yükleme yolu (lib/kaynak-pdf-yolu.ts → yuklemeYolu). Eski kod önek denetlediği için bunu da kabul eder. */
void sayac;
const yy = (pid, uid = SAHIP) => `${pid}/kaynak-pdf/y-${uid}-${crypto.randomUUID()}.pdf`;
const kayitlar = (pid) => psql(`select durum||'|'||coalesce(depo_yolu,'-') from public.kaynak_pdfleri where project_id='${pid}' order by kunye_anahtari`).split("\n").filter(Boolean);
const yetimler = (depo, pid) => {
  const kayitli = new Set(psql(`select depo_yolu from public.kaynak_pdfleri where project_id='${pid}' and depo_yolu is not null`).split("\n").filter(Boolean));
  return [...depo.nesneler.keys()].filter((y) => y.startsWith(`${pid}/`) && !kayitli.has(y));
};
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
const OA = { durum: 200, veri: { best_oa_location: { pdf_url: "https://oa.ornek/makale.pdf" } } };
const iyiIndir = async () => ({ bayt: PDF, sonAdres: "https://oa.ornek/makale.pdf", tur: "application/pdf" });
const sifirla = () => {
  globalThis.__denetim.dizin = async () => OA;
  globalThis.__denetim.indir = iyiIndir;
  ag.kesik = null;
};
globalThis.__denetim = { ctx: null };
sifirla();

/* console.error yakalanır: "yetim dosya raporlanabilir mi" sorusu günlükte YOLUN geçip geçmediğidir. */
const gunluk = [];
const asilHata = console.error;
console.error = (...a) => {
  gunluk.push(a.map((x) => (typeof x === "string" ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(" "));
};
const gunlukteGeciyor = (bas, yol) => gunluk.slice(bas).some((s) => s.includes(yol));

const sonuclar = [];
async function senaryo(kimlik, ad, fn) {
  const kanit = {};
  const bas = gunluk.length;
  try {
    const sorun = await fn(kanit, bas);
    sonuclar.push({ kimlik, ad, sonuc: sorun ? "FAIL" : "PASS", sorun: sorun ?? null, kanit });
  } catch (h) {
    sonuclar.push({ kimlik, ad, sonuc: "HATA", sorun: String(h?.message ?? h).slice(0, 300), kanit });
  } finally {
    psql("grant select, insert, update, delete on public.kaynak_pdfleri to authenticated");
    sifirla();
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc.padEnd(4)}  ${kimlik}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

/* ============ S0 — veritabanı düzeyi: koşullu yazma gerçekten atomik mi ============ */
const kimlikAyari = (uid) => `select set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true); set local role authenticated;`;

await senaryo("S0a", "DB: kilitli satırda koşullu UPDATE bekler, güncel sürüme göre YENİDEN değerlendirir (iki gerçek oturum, RLS)", async (k) => {
  const pid = proje();
  psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum) values ('${pid}','${SAHIP}','s0a','S0a','bulunamadi')`);
  const P = `${pid}/kaynak-pdf/y-${SAHIP}-0000000000001.pdf`;
  // Oturum 1: öğrencinin yüklemesi — satırı kilitler, 1,5 sn sonra onaylar.
  const o1 = psqlArka(`begin; ${kimlikAyari(SAHIP)} update public.kaynak_pdfleri set durum='yuklendi', depo_yolu='${P}' where project_id='${pid}' and kunye_anahtari='s0a'; select pg_sleep(1.5); commit;`);
  await bekle(300);
  const t0 = Date.now();
  // Oturum 2: otomatik aramanın koşullu yazması (yeni kod) — beklemeli ve 0 satır güncellemeli.
  const o2 = await psqlArka(`begin; ${kimlikAyari(SAHIP)} with g as (update public.kaynak_pdfleri set durum='erisilemedi', depo_yolu=null where project_id='${pid}' and kunye_anahtari='s0a' and not (durum in ('indirildi','yuklendi')) returning 1) select 'guncellenen=' || count(*) from g; commit;`);
  k.bekleme_ms = Date.now() - t0;
  await o1;
  k.oturum2 = o2.split("\n").find((s) => s.startsWith("guncellenen="));
  k.son = kayitlar(pid);
  if (k.oturum2 !== "guncellenen=0") return `koşullu UPDATE satırı ezdi (${k.oturum2})`;
  if (k.bekleme_ms < 900) return `oturum 2 beklemedi (${k.bekleme_ms} ms): yarış penceresi kurulmamış`;
  if (k.son[0] !== `yuklendi|${P}`) return `son kayıt ${k.son[0]}`;
});

await senaryo("S0a-kontrol", "DB (kontrol): aynı yarışta KOŞULSUZ UPDATE (eski kodun upsert'i) yüklemeyi ezer", async (k) => {
  const pid = proje();
  psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum) values ('${pid}','${SAHIP}','s0a','S0a','bulunamadi')`);
  const P = `${pid}/kaynak-pdf/y-${SAHIP}-0000000000001.pdf`;
  const o1 = psqlArka(`begin; ${kimlikAyari(SAHIP)} update public.kaynak_pdfleri set durum='yuklendi', depo_yolu='${P}' where project_id='${pid}' and kunye_anahtari='s0a'; select pg_sleep(1.5); commit;`);
  await bekle(300);
  await psqlArka(`begin; ${kimlikAyari(SAHIP)} update public.kaynak_pdfleri set durum='erisilemedi', depo_yolu=null where project_id='${pid}' and kunye_anahtari='s0a'; commit;`);
  await o1;
  k.son = kayitlar(pid);
  // Bu bir KONTROL: koşulsuz yazmanın ezdiğini göstermesi, S0a'nın ölçtüğü şeyin gerçek olduğunu kanıtlar.
  k.not = "beklenen: ezilir (kontrol deneyi)";
  if (k.son[0] !== "erisilemedi|-") return `kontrol deneyi beklenen ezilmeyi göstermedi: ${k.son[0]}`;
});

if (yazimi) {
  await senaryo("S0b", "DB+PostgREST: öğrencinin kilitli yüklemesi sürerken otomatikSonucuYaz → 'korundu' (supabase-js → PostgREST → PG)", async (k) => {
    const pid = proje();
    psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum) values ('${pid}','${SAHIP}','s0b','S0b','bulunamadi')`);
    const P = `${pid}/kaynak-pdf/y-${SAHIP}-0000000000002.pdf`;
    const o1 = psqlArka(`begin; ${kimlikAyari(SAHIP)} update public.kaynak_pdfleri set durum='yuklendi', depo_yolu='${P}' where project_id='${pid}' and kunye_anahtari='s0b'; select pg_sleep(1.5); commit;`);
    await bekle(300);
    const r = await yazimi.otomatikSonucuYaz(istemci(SAHIP), {
      project_id: pid, olusturan: SAHIP, kunye_anahtari: "s0b", kunye: "S0b", doi: null,
      durum: "erisilemedi", depo_yolu: null, kaynak_adres: "https://x.ornek", baslik_eslesti: null, bakildi: new Date().toISOString(),
    }, "durum, depo_yolu");
    await o1;
    Object.assign(k, { tur: r.tur, satir: r.satir ?? null, son: kayitlar(pid) });
    if (r.tur !== "korundu") return `beklenen 'korundu', gelen '${r.tur}'`;
    if (k.son[0] !== `yuklendi|${P}`) return `son kayıt ${k.son[0]}`;
  });
}

/* ============ 1 — kullanıcı yüklerken otomatik PDF bulma ============ */
await senaryo("S1", "Kullanıcı yüklerken otomatik PDF bulma → öğrencinin yüklemesi korunur, yetim yok", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  globalThis.__denetim.indir = async () => { await bekle(800); return { bayt: HTML, sonAdres: "https://yayinci.ornek/giris", tur: "text/html" }; };
  const bul = kaynakPdfleriniBul(pid, OTO);
  await bekle(150);
  const yol = yy(pid);
  await depo.storage.from().upload(yol, PDF);
  const y = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, doi: DOI, depoYolu: yol });
  const b = await bul;
  Object.assign(k, { yukleme: y.error ?? "başarılı", bul: b.error ?? "başarılı", son: kayitlar(pid), dosyaVar: depo.nesneler.has(yol), yetim: yetimler(depo, pid) });
  if (k.son[0] !== `yuklendi|${yol}`) return `öğrencinin yüklemesi ezildi: "${k.son[0]}"`;
  if (!k.dosyaVar) return "öğrencinin dosyası silindi";
  if (k.yetim.length) return `${k.yetim.length} yetim`;
});

/* ============ 2 — iki eşzamanlı otomatik indirme ============ */
await senaryo("S2", "Aynı kaynak için iki eşzamanlı otomatik indirme → tek kayıt, tek dosya, yetim yok", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  globalThis.__denetim.indir = async () => { await bekle(300); return iyiIndir(); };
  const [r1, r2] = await Promise.all([kaynakPdfleriniBul(pid, OTO), (async () => { await bekle(5); return kaynakPdfleriniBul(pid, OTO); })()]);
  const dosyalar = [...depo.nesneler.keys()].filter((y) => y.startsWith(`${pid}/`));
  Object.assign(k, { r1: r1.error ?? "başarılı", r2: r2.error ?? "başarılı", kayit: kayitlar(pid), dosya: dosyalar.length, yetim: yetimler(depo, pid) });
  if (k.kayit.length !== 1 || !k.kayit[0].startsWith("indirildi|")) return `kayıt: ${k.kayit.join(", ")}`;
  if (k.yetim.length) return `${k.dosya} dosya indirildi, ${k.yetim.length} yetim`;
  if (r1.error || r2.error) return "isteklerden biri hata döndü";
});

/* ============ 3 — başarılı kayıttan sonra geciken başarısız istek ============ */
await senaryo("S3", "Başarılı PDF kaydından sonra geciken başarısız istek dönerse 'indirildi' korunur", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  let cagri = 0;
  globalThis.__denetim.indir = async () => {
    if (++cagri === 1) { await bekle(600); return { bayt: HTML, sonAdres: "https://yayinci.ornek/giris", tur: "text/html" }; }
    return iyiIndir();
  };
  const yavas = kaynakPdfleriniBul(pid, OTO);
  await bekle(100);
  await kaynakPdfleriniBul(pid, OTO);
  k.hizliSonrasi = kayitlar(pid);
  const r = await yavas;
  Object.assign(k, { yavasDonus: r.satirlar?.map((s) => s.durum) ?? r.error, son: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (!k.son[0]?.startsWith("indirildi|") || k.son[0] !== k.hizliSonrasi[0]) return `indirilen PDF'in kaydı ezildi: "${k.son[0]}"`;
  if (k.yetim.length) return `${k.yetim.length} yetim`;
});

/* ============ 4 — Storage başarılı, DB başarısız ============ */
await senaryo("S4a", "Otomatik: dosya depoya yazıldı, DB yazımı düştü → hata döner, bu işlemin dosyası temizlenir", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  const r = await kaynakPdfleriniBul(pid, OTO);
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), yetim: yetimler(depo, pid) });
  if (!r.error) return "başarı bildirildi";
  if (k.yetim.length) return `yetim: ${k.yetim[0]}`;
});

await senaryo("S4b", "Yükleme: dosya depoda, DB yazımı düştü → hata döner, yüklenen dosya temizlenir", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = yy(pid);
  await depo.storage.from().upload(yol, PDF);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  Object.assign(k, { donus: r.error ?? "başarılı", yetim: yetimler(depo, pid) });
  if (!r.error) return "başarı bildirildi";
  if (k.yetim.length) return `yetim: ${k.yetim[0]}`;
});

await senaryo("S4c", "DB düştü VE telafi silmesi de düştü → hata döner (başarı değil), yetim YOLUYLA günlüğe yazılır", async (k, bas) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = yy(pid);
  await depo.storage.from().upload(yol, PDF);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  depo.ayar.silmeHatasi = true;
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  Object.assign(k, { donus: r.error ?? "başarılı", yetim: yetimler(depo, pid), raporlandi: gunlukteGeciyor(bas, yol), silmeDenendi: depo.erisim.some(([i, y]) => i === "remove" && y === yol) });
  if (!r.error) return "başarı bildirildi";
  if (!k.silmeDenendi) return "telafi hiç denenmedi";
  if (k.yetim.length && !k.raporlandi) return "yetim dosya sessizce kaldı (günlükte yolu yok)";
});

/* ============ 5 — DB başarılı, eski dosya temizliği başarısız ============ */
await senaryo("S5a", "PDF değiştirildi, eski dosyanın silinmesi düştü → yeni kayıt geçerli, eski dosya yolu günlükte (sessiz değil)", async (k, bas) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const y1 = yy(pid);
  await depo.storage.from().upload(y1, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y1 });
  const y2 = yy(pid);
  await depo.storage.from().upload(y2, PDF);
  depo.ayar.silmeHatasi = true;
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y2 });
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), yeniVar: depo.nesneler.has(y2), yetim: yetimler(depo, pid), raporlandi: gunlukteGeciyor(bas, y1) });
  if (k.kayit[0] !== `yuklendi|${y2}` || !k.yeniVar) return `yeni PDF kaydedilmedi: ${k.kayit[0]}`;
  if (k.yetim.length && !k.raporlandi) return `eski dosya sessizce yetim kaldı: ${k.yetim[0]}`;
});

await senaryo("S5b", "PDF değiştirilirken DB yazımı düştü → ESKİ PDF silinmez, kayıt eski dosyayı göstermeye devam eder", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const y1 = yy(pid);
  await depo.storage.from().upload(y1, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y1 });
  const y2 = yy(pid);
  await depo.storage.from().upload(y2, PDF);
  psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: y2 });
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), eskiVar: depo.nesneler.has(y1), yetim: yetimler(depo, pid) });
  if (!k.eskiVar) return "eski PDF yenisi sahiplenilmeden silindi";
  if (k.kayit[0] !== `yuklendi|${y1}`) return `kayıt değişti: ${k.kayit[0]}`;
  if (k.yetim.length) return `yeni dosya yetim kaldı: ${k.yetim[0]}`;
});

/* ============ 6 — Kaynak A, Kaynak B'nin dosyasını silmeye çalışır ============ */
await senaryo("S6a", "A'nın yüklemesine B'nin PDF yolu verilir → reddedilir, B'nin dosyası ve kaydı yerinde", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yolB = yy(pid);
  await depo.storage.from().upload(yolB, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: yolB });
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yolB });
  // Sonra A'nın PDF'i değiştirilir: eski kodda A'nın "eski dosyası" B'nin dosyasıdır.
  const yolA2 = yy(pid);
  await depo.storage.from().upload(yolA2, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yolA2 });
  Object.assign(k, { donus: r.error ?? "kabul edildi", kayit: kayitlar(pid), bDosyasiVar: depo.nesneler.has(yolB) });
  if (!k.bDosyasiVar) return "B'nin PDF'i silindi";
  if (!r.error) return "A, B'nin dosyasına bağlandı (iki kayıt aynı dosyayı gösteriyor)";
});

await senaryo("S6b", "A'nın kaydı API'den doğrudan B'nin yoluna çevrilir (RLS izin veriyor), sonra A değiştirilir → B'nin dosyası silinmez", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yolA = yy(pid);
  const yolB = yy(pid);
  await depo.storage.from().upload(yolA, PDF);
  await depo.storage.from().upload(yolB, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yolA });
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE_B, depoYolu: yolB });
  // Saldırgan oturum jetonuyla PostgREST'e doğrudan yazar (tarayıcıdaki istemcinin yapabildiği).
  const { error: kurcalama } = await istemci(SAHIP).from("kaynak_pdfleri").update({ depo_yolu: yolB }).eq("project_id", pid).eq("depo_yolu", yolA);
  k.kurcalama = kurcalama?.message ?? "yazıldı";
  const yolA2 = yy(pid);
  await depo.storage.from().upload(yolA2, PDF);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: yolA2 });
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), bDosyasiVar: depo.nesneler.has(yolB) });
  if (!k.bDosyasiVar) return "A değiştirilince B'nin PDF'i silindi";
});

await senaryo("S6c", "Bozuk/yabancı yollar (.., ters bölü, çift bölü, büyük harf, başka çalışma, otomatik kalıp, başka kullanıcı) depoya HİÇ dokunmadan reddedilir", async (k) => {
  const pid = proje();
  const pid2 = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const z = crypto.randomUUID();
  const yollar = {
    nokta_nokta: `${pid}/kaynak-pdf/../${pid2}/kaynak-pdf/y-${SAHIP}-${z}.pdf`,
    nokta_nokta_ad: `${pid}/kaynak-pdf/y-${SAHIP}-${z}/../../x.pdf`,
    ters_bolu: `${pid}/kaynak-pdf\\y-${SAHIP}-${z}.pdf`,
    cift_bolu: `${pid}/kaynak-pdf//y-${SAHIP}-${z}.pdf`,
    buyuk_harf: `${pid.toUpperCase()}/kaynak-pdf/y-${SAHIP}-${z}.pdf`,
    baska_calisma: `${pid2}/kaynak-pdf/y-${SAHIP}-${z}.pdf`,
    otomatik_kalip: `${pid}/kaynak-pdf/0123456789abcdef-${z}.pdf`,
    kisa_eski_bicim: `${pid}/kaynak-pdf/y-1763200000000.pdf`,
    zamanli_ad: `${pid}/kaynak-pdf/y-${SAHIP}-1763200000000.pdf`,
    baska_kullanici: `${pid}/kaynak-pdf/y-${YABANCI}-${z}.pdf`,
    sondaki_ek: `${pid}/kaynak-pdf/y-${SAHIP}-${z}.pdf.html`,
  };
  for (const y of Object.values(yollar)) depo.nesneler.set(y, PDF);
  const sonuc = {};
  for (const [ad, y] of Object.entries(yollar)) {
    const once = depo.erisim.length;
    const r = await kaynakPdfiYuklendi(pid, { kunye: `${KUNYE} ${ad}`, depoYolu: y });
    sonuc[ad] = { reddedildi: Boolean(r.error), depoyaDokundu: depo.erisim.length > once };
  }
  Object.assign(k, { sonuc, kayit: kayitlar(pid) });
  const kabul = Object.entries(sonuc).filter(([, s]) => !s.reddedildi || s.depoyaDokundu).map(([a]) => a);
  if (kabul.length) return `kabul edilen ya da depoya dokunan: ${kabul.join(", ")}`;
});

/* ============ 7 — başka kullanıcının dosyasına erişim ============ */
await senaryo("S7a", "Yabancı kullanıcı başka çalışmanın PDF kayıtlarını göremez/yazamaz, depoda iz bırakmaz", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = yy(pid);
  await depo.storage.from().upload(yol, PDF);
  await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  globalThis.__denetim.ctx = baglam(YABANCI, depo);
  const gorunen = await kaynakPdfleri(pid);
  const yazma = await kaynakPdfleriniBul(pid, [{ kunye: "Başka (2021). X. Y.", doi: "10.1/x", dogrulama: "verified" }]);
  const yukleme = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  Object.assign(k, { gorunen: gorunen.length, yazma: yazma.error ?? "başarılı", yukleme: yukleme.error ?? "başarılı", kayit: kayitlar(pid), sahibinDosyasi: depo.nesneler.has(yol), yetim: yetimler(depo, pid) });
  if (gorunen.length || !yazma.error || !yukleme.error) return "yabancı erişti";
  if (!k.sahibinDosyasi) return "sahibin dosyası silindi";
  if (k.yetim.length) return `sahte depoda yetim (gerçek depoda politika yüklemeyi reddeder): ${k.yetim.length}`;
});

await senaryo("S7b", "Sahip, başka bir kullanıcının yüklediği dosyanın yolunu kendi künyesine bağlayamaz (yolda kimlik eşleşmeli)", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yabancininYolu = yy(pid, YABANCI);
  depo.nesneler.set(yabancininYolu, PDF);
  const once = depo.erisim.length;
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yabancininYolu });
  Object.assign(k, { donus: r.error ?? "kabul edildi", depoyaDokundu: depo.erisim.length > once, kayit: kayitlar(pid) });
  if (!r.error || k.depoyaDokundu) return "başka kullanıcının yüklemesi kabul edildi";
});

/* ============ 8 — telafi sırasında başka istek tarafından sahiplenilen dosya ============ */
await senaryo("S8a", "Yazma düşerken dosyayı ARADA başka bir kayıt sahiplendi → telafi o dosyayı silmez", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const P = yy(pid);
  await depo.storage.from().upload(P, PDF);
  // Sunucu ön denetimden geçti, dosyayı okurken öteki istek P'yi B künyesine bağlıyor; bu isteğin yazması da düşüyor.
  depo.ayar.indirmeKancasi = async (y) => {
    if (y !== P) return;
    depo.ayar.indirmeKancasi = null;
    psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu) values ('${pid}','${SAHIP}','baska-kunye','B','yuklendi','${P}')`);
    psql("revoke insert, update on public.kaynak_pdfleri from authenticated");
  };
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: P });
  Object.assign(k, { donus: r.error ?? "başarılı", kayit: kayitlar(pid), dosyaVar: depo.nesneler.has(P) });
  if (!k.dosyaVar) return "telafi, başka kaydın sahiplendiği dosyayı sildi";
  if (!r.error) return "başarı bildirildi";
});

await senaryo("S8b", "PDF olmayan dosya için 'temizlik', o yolu gösteren başka kaydın dosyasını silmez", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const P = yy(pid);
  depo.nesneler.set(P, HTML); // B'nin kaydının gösterdiği nesne (bozulmuş ya da beklenmedik içerik)
  psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu) values ('${pid}','${SAHIP}','baska-kunye','B','yuklendi','${P}')`);
  const r = await kaynakPdfiYuklendi(pid, { kunye: KUNYE_A, depoYolu: P });
  Object.assign(k, { donus: r.error ?? "başarılı", dosyaVar: depo.nesneler.has(P), kayit: kayitlar(pid) });
  if (!k.dosyaVar) return "B'nin kaydının gösterdiği dosya silindi";
});

/* ============ 9 — ağ kesintisi ve tekrar deneme ============ */
await senaryo("S9a", "Dizin (OpenAlex) ağ hatası → 'erişilemedi'; ağ gelince tekrar → 'indirildi', tek kayıt, tek dosya", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  globalThis.__denetim.dizin = async () => { throw new TypeError("fetch failed"); };
  const r1 = await kaynakPdfleriniBul(pid, OTO);
  k.ilk = kayitlar(pid);
  globalThis.__denetim.dizin = async () => OA;
  const r2 = await kaynakPdfleriniBul(pid, OTO);
  Object.assign(k, { r1: r1.error ?? r1.sorunlar, r2: r2.error ?? "başarılı", son: kayitlar(pid), dosya: [...depo.nesneler.keys()].length, yetim: yetimler(depo, pid) });
  if (k.ilk[0] !== "erisilemedi|-") return `ilk: ${k.ilk[0]}`;
  if (k.son.length !== 1 || !k.son[0].startsWith("indirildi|") || k.dosya !== 1 || k.yetim.length) return `son: ${k.son.join(",")} dosya ${k.dosya} yetim ${k.yetim.length}`;
});

await senaryo("S9b", "Depo yazıldı, PostgREST'e YAZMA isteği ağda düştü → hata, yetim yok; tekrar → tek kayıt, tek dosya", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  ag.kesik = (url, yontem) => url.includes("/kaynak_pdfleri") && yontem !== "GET";
  const r1 = await kaynakPdfleriniBul(pid, OTO);
  k.ilkYetim = yetimler(depo, pid);
  ag.kesik = null;
  const r2 = await kaynakPdfleriniBul(pid, OTO);
  Object.assign(k, { r1: r1.error ?? "başarılı", r2: r2.error ?? "başarılı", son: kayitlar(pid), dosya: [...depo.nesneler.keys()].length, yetim: yetimler(depo, pid) });
  if (!r1.error) return "kesintide başarı bildirildi";
  if (k.ilkYetim.length) return `kesinti sonrası yetim: ${k.ilkYetim[0]}`;
  if (k.son.length !== 1 || !k.son[0].startsWith("indirildi|") || k.dosya !== 1) return `tekrar: ${k.son.join(",")} dosya ${k.dosya}`;
});

await senaryo("S9c", "PostgREST TAMAMEN kesik (telafinin okuması da düşer) → silinmez (emin olunamıyor), yol günlükte; ağ gelince tekrar başarılı", async (k, bas) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  ag.kesik = (url, yontem) => url.includes("/kaynak_pdfleri") && (yontem !== "GET" || ag.yazmaDustu);
  ag.yazmaDustu = false;
  const asil = ag.kesik;
  ag.kesik = (url, yontem) => {
    const k2 = asil(url, yontem);
    if (k2 && yontem !== "GET") ag.yazmaDustu = true; // ilk yazma düştükten sonra okumalar da düşer
    return k2;
  };
  const r1 = await kaynakPdfleriniBul(pid, OTO);
  const ilkDosyalar = [...depo.nesneler.keys()];
  ag.kesik = null;
  ag.yazmaDustu = false;
  const r2 = await kaynakPdfleriniBul(pid, OTO);
  const raporlanan = ilkDosyalar.filter((y) => gunlukteGeciyor(bas, y));
  Object.assign(k, { r1: r1.error ?? "başarılı", r2: r2.error ?? "başarılı", son: kayitlar(pid), yetim: yetimler(depo, pid), raporlanan: raporlanan.length });
  if (!r1.error) return "kesintide başarı bildirildi";
  if (!k.son[0]?.startsWith("indirildi|")) return `tekrar başarısız: ${k.son[0]}`;
  const sessiz = k.yetim.filter((y) => !gunlukteGeciyor(bas, y));
  if (sessiz.length) return `sessiz yetim: ${sessiz[0]}`;
});

/* ============ 10 — idempotentlik ============ */
await senaryo("S10a", "Aynı kaynakta art arda üç 'PDF'leri bul' → tek kayıt, tek dosya, kayıt ilk başarıdan sonra değişmez", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  await kaynakPdfleriniBul(pid, OTO);
  const ilk = kayitlar(pid);
  await kaynakPdfleriniBul(pid, OTO);
  await kaynakPdfleriniBul(pid, OTO);
  Object.assign(k, { ilk, son: kayitlar(pid), dosya: [...depo.nesneler.keys()].length, yetim: yetimler(depo, pid) });
  if (k.son.length !== 1 || k.son[0] !== ilk[0] || k.dosya !== 1 || k.yetim.length) return `son ${k.son.join(",")} dosya ${k.dosya}`;
});

await senaryo("S10b", "Aynı yükleme bildirimi iki kez (çift tık/tekrar) → tek kayıt, dosya silinmez", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  const yol = yy(pid);
  await depo.storage.from().upload(yol, PDF);
  const [a, b] = await Promise.all([kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol }), kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol })]);
  const c = await kaynakPdfiYuklendi(pid, { kunye: KUNYE, depoYolu: yol });
  Object.assign(k, { donus: [a, b, c].map((x) => x.error ?? "başarılı"), son: kayitlar(pid), dosyaVar: depo.nesneler.has(yol) });
  if (k.son.length !== 1 || k.son[0] !== `yuklendi|${yol}` || !k.dosyaVar) return `son ${k.son.join(",")} dosya ${k.dosyaVar}`;
});

await senaryo("S10c", "Bulunamayan kaynağa art arda bakmak → tek kayıt, depoda dosya yok", async (k) => {
  const pid = proje();
  const depo = sahteDepo();
  globalThis.__denetim.ctx = baglam(SAHIP, depo);
  globalThis.__denetim.indir = async () => ({ bayt: HTML, sonAdres: "https://yayinci.ornek/giris", tur: "text/html" });
  for (let i = 0; i < 3; i++) await kaynakPdfleriniBul(pid, OTO);
  Object.assign(k, { son: kayitlar(pid), dosya: [...depo.nesneler.keys()].length });
  if (k.son.length !== 1 || k.son[0] !== "erisilemedi|-" || k.dosya) return `son ${k.son.join(",")} dosya ${k.dosya}`;
});

console.error = asilHata;
const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(sonuclar, null, 2));
process.exit(0);
