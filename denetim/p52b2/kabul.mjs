// P52b-2A kabul — depo envanteri, GERÇEK Storage API (supabase/storage-api,
// yerel) + Postgres 17 + PostgREST, SENTETİK veri. Yalnızca 127.0.0.1.
//
//   denetim/p52b1/kur-gercek-depo.sh && node denetim/p52b/yigin/gecit.mjs &
//   node --import ./tests/register.mjs denetim/p52b2/kabul.mjs [çıktı.json]
//
// Tohumlama (dosya yükleme, satır ekleme) bu düzeneğin işi ve yalnızca yerel
// yığında yapılır; envanterin KENDİSİ salt okunur istemciyle çalışır ve her
// senaryodan sonra depodaki nesne sayısının ve tabloların özetinin
// değişmediği doğrulanır.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { calistir, saltOkunurFetch } from "../../scripts/depo-envanteri.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();
const tohumcu = createClient(GECIT, SERVIS, { auth: { persistSession: false, autoRefreshToken: false } });
const PDF = new TextEncoder().encode("%PDF-1.7\n%%EOF\n");

try {
  if (!(await fetch(`${GECIT}/storage/v1/status`)).ok) throw new Error("storage");
} catch {
  console.error("ÖN KOŞUL YOK: kur-gercek-depo.sh ve gecit.mjs çalışmalı");
  process.exit(2);
}

/* ---------- temiz başlangıç: önceki koşuların sentetik nesneleri sayımı bozmasın ---------- */
// Yalnızca yerel sentetik yığın: önceki koşuların nesneleri ve satırları sayımı bozmasın.
psql("delete from storage.objects where bucket_id = 'project-files'");
psql("delete from public.document_uploads; delete from public.academic_projects; delete from auth.users where email like '%@yerel.test'");

const kullanici = () => {
  const id = crypto.randomUUID();
  psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${id}', 'env-${id.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
  return id;
};
const calisma = (sahip) => {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${sahip}', 'Envanter', 'thesis')`);
  return id;
};
async function yukle(yol, gunOnce = 3) {
  const tur = yol.endsWith(".png") ? "image/png" : yol.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
  const { error } = await tohumcu.storage.from("project-files").upload(yol, new Blob([PDF], { type: tur }), { contentType: tur, upsert: false });
  if (error) throw new Error(`tohum yüklemesi düştü: ${error.message}`);
  if (gunOnce) psql(`update storage.objects set created_at = now() - interval '${gunOnce} days' where bucket_id='project-files' and name='${yol}'`);
}

const U1 = kullanici();
const U2 = kullanici();
const U_SIL = kullanici();
const P1 = calisma(U1);
const P_BUYUK = calisma(U1);
const P_SIL = calisma(U1);

const Y = {
  ref: `${P1}/kaynak-pdf/ref.pdf`,
  yetim: `${P1}/kaynak-pdf/yetim.pdf`,
  taze: `${P1}/kaynak-pdf/taze.pdf`,
  gec: `${P1}/kaynak-pdf/gec.pdf`,
  kutuphane: `${P1}/editor-images/kutuphane.png`,
  metinde: `${P1}/editor-images/metinde.png`,
  silCalismaPdf: `${P_SIL}/kaynak-pdf/x.pdf`,
  silCalismaGorsel: `${P_SIL}/editor-images/y.png`,
  silKullaniciImport: `${U_SIL}/imports/1-z.docx`,
  silKullaniciKilavuz: `${U_SIL}/kilavuz/k.pdf`,
  importEski: `${U1}/imports/1-eski.docx`,
  importTaze: `${U1}/imports/2-taze.docx`,
  baskaKilavuz: `${U2}/kilavuz/k.pdf`,
  baskaBelge: `${U2}/1763-belge.pdf`,
};
for (const [ad, yol] of Object.entries(Y)) await yukle(yol, ad === "taze" || ad === "importTaze" ? 0 : 3);

// Referanslar
psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu) values
  ('${P1}','${U1}','ref','Ref','yuklendi','${Y.ref}'),
  ('${P1}','${U1}','kayip','Kayıp','yuklendi','${P1}/kaynak-pdf/kayip.pdf')`);
psql(`insert into public.document_uploads (uploaded_by, file_name, storage_path) values ('${U2}', 'belge.pdf', '${Y.baskaBelge}')`);
const gorsel = (yol) => ({ type: "image", attrs: { src: `${GECIT}/storage/v1/object/sign/project-files/${yol}?token=x` } });
const icerik = JSON.stringify({ type: "doc", content: [gorsel(Y.metinde), gorsel(`${P1}/editor-images/kayip.png`)] }).replace(/'/g, "''");
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by) values ('${P1}', '${icerik}'::jsonb, '', 0, '${U1}')`);

// Büyük klasör: 2500 nesne (sayfalama). Satırlar Storage'ın kendi tablosuna; listeleme oradan okur.
psql(`insert into storage.objects (bucket_id, name, owner, metadata, created_at)
      select 'project-files', '${P_BUYUK}/editor-images/g' || lpad(i::text, 5, '0') || '.png', '${U1}', '{"size": 7, "mimetype": "image/png"}'::jsonb, now() - interval '3 days'
      from generate_series(1, 2500) i`);

// Silinen çalışma ve silinen hesap (kaskat: satırlar gider, DOSYALAR kalır — bugünkü davranış).
psql(`delete from public.academic_projects where id = '${P_SIL}'`);
psql(`delete from auth.users where id = '${U_SIL}'`);

/* ---------- salt okunurluk kanıtı: koşu öncesi/sonrası özet ---------- */
const ozet = () =>
  psql(`select (select count(*) from storage.objects where bucket_id='project-files') || ':' ||
        (select md5(string_agg(name || coalesce(metadata::text,''), ',' order by name)) from storage.objects where bucket_id='project-files') || ':' ||
        (select md5(coalesce(string_agg(id::text || coalesce(depo_yolu,'') || durum, ',' order by id), '')) from public.kaynak_pdfleri) || ':' ||
        (select md5(coalesce(string_agg(id::text || storage_path, ',' order by id), '')) from public.document_uploads) || ':' ||
        (select md5(coalesce(string_agg(id::text || content::text, ',' order by id), '')) from public.project_manuscripts)`);

const sonuclar = [];
async function senaryo(kimlik, ad, fn) {
  const kanit = {};
  const once = ozet();
  try {
    const sorun = await fn(kanit);
    const sonra = ozet();
    kanit.salt_okunur = once === sonra;
    sonuclar.push({ kimlik, ad, sonuc: sorun ? "FAIL" : kanit.salt_okunur ? "PASS" : "FAIL", sorun: sorun ?? (kanit.salt_okunur ? null : "depo ya da tablolar DEĞİŞTİ"), kanit });
  } catch (h) {
    sonuclar.push({ kimlik, ad, sonuc: "HATA", sorun: String(h?.message ?? h).slice(0, 300), kanit });
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc.padEnd(4)}  ${kimlik}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}

const temelAyar = { ikinciGecisBeklemesiMs: 1, istekAraligiMs: 0, sayfa: 1000 };

await senaryo("E1", "Uçtan uca envanter: sınıflar ve sebepler beklendiği gibi, yol rapora girmiyor", async (k) => {
  const { rapor, ayrinti } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar });
  Object.assign(k, { rapor });
  const s = rapor.sebep;
  const beklenen = {
    "SAHIPLI:referansli": 3, // ref.pdf, metindeki görsel, başka kullanıcının belgesi
    "SAHIPLI:kutuphane": 2501, // metinde geçmeyen kütüphane görseli + 2500 nesnelik büyük klasör
    "ADAY_YETIM:referanssiz": 2, // yetim.pdf, gec.pdf
    "ADAY_YETIM:sahip_yok": 4, // silinen çalışmanın 2 dosyası + silinen hesabın 2 dosyası
    "ADAY_YETIM:gecici_eski": 1, // geride kalmış içe aktarma
    "DOGRULANAMADI:taze": 2, // yaş eşiğinin altındaki 2 dosya
    "DOGRULANAMADI:kapsam_disi": 1, // başka kullanıcının kılavuzu
  };
  const fark = Object.entries(beklenen).filter(([key, v]) => (s[key] ?? 0) !== v).map(([key, v]) => `${key}: ${s[key] ?? 0} ≠ ${v}`);
  if (fark.length) return fark.join("; ");
  if (rapor.aday_kayip !== 2) return `aday kayıp ${rapor.aday_kayip} ≠ 2 (kaynak PDF + metindeki görsel)`;
  if (rapor.toplam_dosya !== 14 + 2500) return `toplam ${rapor.toplam_dosya}`;
  // P52b-2D: değişiklik olmayan taramada rapor kesin, tekrar ve kayan klasör yok.
  if (!rapor.kesin || rapor.tekrar_ayiklanan !== 0 || rapor.degisen_klasor !== 0) return `kesinlik: ${JSON.stringify({ kesin: rapor.kesin, nedenler: rapor.kesin_degil_cunku, tekrar: rapor.tekrar_ayiklanan, degisen: rapor.degisen_klasor })}`;
  const metin = JSON.stringify({ rapor, ayrinti });
  for (const id of [U1, U2, U_SIL, P1, P_BUYUK, P_SIL]) if (metin.includes(id)) return "rapor kimlik/yol içeriyor";
});

await senaryo("E2", "Sayfalama: 2500 nesnelik klasör eksiksiz sayıldı (sayfa=1000 → 3 istek)", async (k) => {
  const { rapor } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar });
  k.listeleme = rapor.istek.listeleme;
  if ((rapor.kategori["editor-images"]?.SAHIPLI?.adet ?? 0) !== 2502) return `editor-images sahipli ${rapor.kategori["editor-images"]?.SAHIPLI?.adet}`;
});

await senaryo("E3", "Eşzamanlı yükleme: ilk geçişte referanssız, ikinci geçiş beklemesinde bağlanan dosya YETİM SAYILMAZ", async (k) => {
  const BEKLEME = 7777;
  const { rapor } = await calistir({
    url: GECIT,
    anahtar: SERVIS,
    ayar: {
      ...temelAyar,
      ikinciGecisBeklemesiMs: BEKLEME,
      uyu: async (ms) => {
        if (ms === BEKLEME) psql(`insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu) values ('${P1}','${U1}','gec','Geç','yuklendi','${Y.gec}')`);
      },
    },
  });
  psql(`delete from public.kaynak_pdfleri where kunye_anahtari='gec' and project_id='${P1}'`); // senaryo öncesine dön
  k.sebep = rapor.sebep;
  if (rapor.sebep["SAHIPLI:ikinci_geciste_referansli"] !== 1) return "ikinci geçişte bağlanan dosya sahipli sayılmadı";
  if (rapor.sebep["ADAY_YETIM:referanssiz"] !== 1) return `referanssız aday ${rapor.sebep["ADAY_YETIM:referanssiz"]} ≠ 1`;
});

await senaryo("E4", "Storage kapalı: hiç aday yok, her şey okunamadı", async (k) => {
  const dusuk = (url, o) => (String(url).includes("/storage/v1/") ? Promise.reject(new TypeError("fetch failed (enjekte)")) : fetch(url, o));
  const { rapor } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: { ...temelAyar, geriCekilmeTabanMs: 1 }, icFetch: dusuk });
  Object.assign(k, { toplam: rapor.toplam_dosya, okunamayan: rapor.okunamayan_klasor, kayip: rapor.aday_kayip, kayip_dogrulanamadi: rapor.kayip_dogrulanamadi, yeniden: rapor.istek.yeniden_deneme });
  if (rapor.sinif.ADAY_YETIM.adet || rapor.aday_kayip) return "Storage kapalıyken aday üretildi";
  if (!rapor.okunamayan_klasor) return "okunamayan klasör bildirilmedi";
});

await senaryo("E5", "Bir klasör okunamazsa (kalıcı 403) içindeki referans KAYIP değil, DOĞRULANAMADI", async (k) => {
  const hedef = `${P1}/kaynak-pdf`;
  const kismi = async (url, o) => {
    if (String(url).includes("/object/list/") && o?.body && JSON.parse(o.body).prefix === hedef) {
      return new Response(JSON.stringify({ statusCode: "403", error: "Unauthorized", message: "enjekte" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return fetch(url, o);
  };
  const { rapor } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar, icFetch: kismi });
  Object.assign(k, { kayip: rapor.aday_kayip, sebep: rapor.sebep });
  if (rapor.aday_kayip !== 1) return `aday kayıp ${rapor.aday_kayip} ≠ 1 (yalnızca metindeki görsel)`;
  if (rapor.sebep["KAYIP_DOGRULANAMADI:klasor_okunamadi"] !== 2) return "okunamayan klasördeki referanslar DOĞRULANAMADI sayılmadı";
});

await senaryo("E6", "İdempotentlik: art arda iki tarama aynı raporu verir, depo ve tablolar değişmez", async (k) => {
  const a = (await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar })).rapor;
  const b = (await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar })).rapor;
  delete a.istek;
  delete b.istek;
  k.ayni = JSON.stringify(a) === JSON.stringify(b);
  if (!k.ayni) return "iki tarama farklı rapor verdi";
});

await senaryo("E7", "Salt okunur istemci: silme ve güncelleme isteği AĞA ÇIKMADAN reddedilir", async (k) => {
  const sb = createClient(GECIT, SERVIS, { global: { fetch: saltOkunurFetch() }, auth: { persistSession: false, autoRefreshToken: false } });
  const silme = await sb.storage.from("project-files").remove([Y.yetim]).catch((h) => ({ error: h }));
  const guncelle = await sb.from("kaynak_pdfleri").update({ durum: "erisilemedi" }).eq("project_id", P1).then((r) => r).catch((h) => ({ error: h }));
  Object.assign(k, { silme: String(silme.error?.message ?? "hatasız").slice(0, 80), guncelle: String(guncelle.error?.message ?? "hatasız").slice(0, 80) });
  if (!silme.error || !guncelle.error) return "yazma isteği reddedilmedi";
});

await senaryo("E8", "Uzak adres reddedilir; komut çıktısında yol/kimlik yok", async (k) => {
  const uzak = await calistir({ url: "https://ornek.supabase.co", anahtar: "x" }).then(() => "çalıştı").catch((h) => h.message);
  const cikti = spawnSync(process.execPath, ["--import", "./tests/register.mjs", "scripts/depo-envanteri.mjs", "--ikinci-gecis-sn", "0", "--istek-araligi-ms", "0"], {
    env: { ...process.env, SUPABASE_URL: GECIT, SUPABASE_SERVICE_ROLE_KEY: SERVIS },
    encoding: "utf8",
  });
  Object.assign(k, { uzak: uzak.slice(0, 80), cikis: cikti.status, uzunluk: cikti.stdout.length });
  if (uzak === "çalıştı") return "uzak adreste çalıştı";
  if (cikti.status !== 0) return `komut çıkış kodu ${cikti.status}: ${cikti.stderr.slice(0, 200)}`;
  for (const id of [U1, U2, U_SIL, P1, P_BUYUK, P_SIL]) if ((cikti.stdout + cikti.stderr).includes(id)) return "komut çıktısı kimlik içeriyor";
  JSON.parse(cikti.stdout);
});

/* ---------- P52b-2D: tarama sırasında eşzamanlı değişiklik (gerçek Storage API) ----------
   Eşzamanlı "yazar", 2500 nesnelik klasörün listeleme isteklerinden (ofset > 0)
   hemen ÖNCE storage.objects'e sentetik satır ekler ya da siler. Yazar düzeneğin
   kendisidir, tarayıcı değil; senaryo sonunda her şeyi geri koyar, böylece
   koşu öncesi/sonrası özet yine aynı çıkmalıdır. Silinen ya da eklenen yalnızca
   bu düzeneğin kendi oluşturduğu sentetik satırlardır. */
const BUYUK = `${P_BUYUK}/editor-images`;
const buyukSatiri = (ad, gun = 3) =>
  `insert into storage.objects (bucket_id, name, owner, metadata, created_at) values ('project-files', '${BUYUK}/${ad}', '${U1}', '{"size": 7, "mimetype": "image/png"}'::jsonb, now() - interval '${gun} days')`;
const yolOzeti = (y) => createHash("sha256").update(y).digest("hex").slice(0, 16);
const eszamanli = (yazar) => async (url, o) => {
  if (String(url).includes("/object/list/") && o?.body) {
    const b = JSON.parse(o.body);
    if (b.prefix === BUYUK && (b.offset ?? 0) > 0 && !b.search) yazar();
  }
  return fetch(url, o);
};
const tumAdlar = Array.from({ length: 2500 }, (_, i) => `g${String(i + 1).padStart(5, "0")}.png`);
/** Yol düzeyinde: aynı yol iki kez sayıldı mı, verilen (tarama boyunca var olan) adlardan görülmeyen var mı? */
function yolDuzeyi(ayrinti, hepVar) {
  const oz = ayrinti.map((x) => x.ozet);
  const gorulen = new Set(oz);
  return { iki_kez: oz.length - gorulen.size, gorulmeyen: hepVar.filter((a) => !gorulen.has(yolOzeti(`${BUYUK}/${a}`))).length };
}

await senaryo("E9", "Tarama sırasında TEK ekleme (2. sayfadan önce, sınırın önüne): klasör yeniden listelenir, her yol bir kez, rapor kesin", async (k) => {
  let yapildi = false;
  const yazar = () => { if (!yapildi) { yapildi = true; psql(buyukSatiri("g00000a.png")); } };
  try {
    const { rapor, ayrinti } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar, icFetch: eszamanli(yazar) });
    const y = yolDuzeyi(ayrinti, tumAdlar);
    Object.assign(k, { toplam: rapor.toplam_dosya, ...y, degisen: rapor.degisen_klasor, tekrar: rapor.tekrar_ayiklanan, kesin: rapor.kesin });
    if (!yapildi) return "eşzamanlı ekleme tetiklenmedi";
    if (y.iki_kez) return `${y.iki_kez} yol iki kez sayıldı`;
    if (y.gorulmeyen) return `${y.gorulmeyen} var olan yol görülmedi`;
    if (rapor.toplam_dosya !== 14 + 2501) return `toplam ${rapor.toplam_dosya} ≠ 2515`;
    if (rapor.degisen_klasor !== 0 || !rapor.kesin) return "yeniden listeleme kararlı olmalıydı";
    if (rapor.tekrar_ayiklanan < 1) return "kayan sayfadaki tekrar ayıklanmadı (ekleme etkisizdi)";
  } finally {
    psql(`delete from storage.objects where bucket_id='project-files' and name = '${BUYUK}/g00000a.png'`);
  }
});

await senaryo("E10", "Tarama sırasında SÜREKLİ silme (her ara sayfadan önce baştan bir nesne): görülen her yol bir kez, kalanların hepsi görüldü, rapor KESİN DEĞİL", async (k) => {
  const kurbanlar = tumAdlar.slice(0, 40);
  const silinen = [];
  const yazar = () => {
    const ad = kurbanlar[silinen.length];
    if (!ad) return;
    psql(`delete from storage.objects where bucket_id='project-files' and name = '${BUYUK}/${ad}'`);
    silinen.push(ad);
  };
  try {
    const { rapor, ayrinti } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar, icFetch: eszamanli(yazar) });
    const kalan = tumAdlar.filter((a) => !silinen.includes(a));
    const y = yolDuzeyi(ayrinti, kalan);
    Object.assign(k, { silinen: silinen.length, toplam: rapor.toplam_dosya, ...y, degisen: rapor.degisen_klasor, kesin: rapor.kesin, nedenler: rapor.kesin_degil_cunku });
    if (!silinen.length) return "eşzamanlı silme tetiklenmedi";
    if (y.iki_kez) return `${y.iki_kez} yol iki kez sayıldı`;
    if (y.gorulmeyen) return `${y.gorulmeyen} hep var olan yol görülmedi`;
    if (rapor.kesin || rapor.degisen_klasor < 1) return "kayan klasör raporu kesin göstermemeliydi";
    if (!rapor.kesin_degil_cunku.includes("tarama_sirasinda_degisen_klasor")) return "neden yazılmadı";
  } finally {
    for (const ad of silinen) psql(buyukSatiri(ad));
  }
});

await senaryo("E11", "Tarama sırasında SÜREKLİ ekleme (her ara sayfadan önce önde yeni nesne): aynı yol iki kez sayılmaz, başlangıçtakilerin hepsi görüldü, rapor KESİN DEĞİL", async (k) => {
  const eklenen = [];
  const yazar = () => {
    if (eklenen.length >= 40) return;
    const ad = `g00000-${String(eklenen.length).padStart(2, "0")}.png`;
    psql(buyukSatiri(ad));
    eklenen.push(ad);
  };
  try {
    const { rapor, ayrinti } = await calistir({ url: GECIT, anahtar: SERVIS, ayar: temelAyar, icFetch: eszamanli(yazar) });
    const y = yolDuzeyi(ayrinti, tumAdlar);
    Object.assign(k, { eklenen: eklenen.length, toplam: rapor.toplam_dosya, ...y, degisen: rapor.degisen_klasor, tekrar: rapor.tekrar_ayiklanan, kesin: rapor.kesin });
    if (!eklenen.length) return "eşzamanlı ekleme tetiklenmedi";
    if (y.iki_kez) return `${y.iki_kez} yol iki kez sayıldı`;
    if (y.gorulmeyen) return `${y.gorulmeyen} başlangıçtaki yol görülmedi`;
    if (rapor.toplam_dosya > 14 + 2500 + eklenen.length) return "sayım var olan nesne sayısını aştı";
    if (rapor.kesin || rapor.degisen_klasor < 1) return "kayan klasör raporu kesin göstermemeliydi";
  } finally {
    for (const ad of eklenen) psql(`delete from storage.objects where bucket_id='project-files' and name = '${BUYUK}/${ad}'`);
  }
});

const fail = sonuclar.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(sonuclar, null, 2));
process.exit(fail ? 1 : 0);
