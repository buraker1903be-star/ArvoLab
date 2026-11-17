// P52a2 veri bütünlüğü senaryoları: GERÇEK Postgres 17 + PostgREST + GoTrue
// (scripts/yerel-yigin/kur.sh), sentetik hesaplar ve sentetik metin.
// Gerçek bir Supabase projesine bağlanmaz: adresler sabit 127.0.0.1.
// CI'da koşmaz (docker ister).
//
//   node --import ./tests/register.mjs scripts/yerel-yigin/kayit-butunlugu.mjs <yeni|eski> [çıktı.json]
//
// "yeni": lib/metin-yazimi.ts — sunucu eylemlerinin (saveManuscript,
//   restoreManuscriptVersion) kullandığı AYNI kod, gerçek PostgREST'e karşı.
// "eski": 97a2943'teki eylem gövdelerinin birebir aktarımı (yazma dizisi
//   app/actions/manuscript.ts ve manuscript-versions.ts'ten kopyalandı;
//   değiştirilmedi). Hataların düzeltmeden ÖNCE gerçekten var olduğunu
//   göstermek için; veritabanı da damga tetikleyicisi OLMADAN kurulmalı:
//   scripts/yerel-yigin/kur.sh 20261115203504_metin_surum_damgasi.sql
//
// Değişmez: onaylanmış (kullanıcıya "kaydedildi" denmiş) hiçbir metin, onu
// GÖRMEMİŞ bir yazarın kaydıyla yok olmaz; ya belgede ya sürüm geçmişinde
// kalır. Her senaryo bunu veritabanındaki gerçek satırlara bakarak sınar.
//
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { kosulluYaz, zorlaKayitIcinYedekle, surumuGeriYukle } from "../../lib/metin-yazimi.ts";
import { snapshotManuscript, AUTO_VERSION_INTERVAL_MS } from "../../lib/manuscript-versions.ts";

const KIP = process.argv[2];
const CIKTI = process.argv[3];
if (KIP !== "yeni" && KIP !== "eski") {
  console.error("kullanım: kayit-butunlugu.mjs <yeni|eski> [çıktı.json]");
  process.exit(2);
}
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const SIFRE = "yerel-Sentetik-1";

const jwt = (rol) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ role: rol, iss: "yerel-yigin", iat: 1763200000, exp: 2079000000 });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const ANON = jwt("anon");
const SERVIS = jwt("service_role");

const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();

// ---------- ön koşullar ----------
try {
  const saglik = await fetch(`${GECIT}/rest/v1/`, { headers: { apikey: ANON } });
  if (!saglik.ok) throw new Error(`rest ${saglik.status}`);
  psql("select 1");
} catch (hata) {
  console.error(`ÖN KOŞUL YOK: yerel yığın/geçit çalışmıyor (${hata.message}). kur.sh ve gecit.mjs'i başlatın.`);
  process.exit(2);
}
const tetikleyiciVar = psql("select count(*) from pg_trigger where tgname = 'metin_surum_damgasi'") === "1";
// MIGRATIONSIZ=1: yeni kod, damga tetikleyicisi henüz uygulanmamış veritabanında
// (dağıtım sırası: kod migration'dan önce canlıya çıkabilir). S4 ve S11
// tetikleyiciye bağlı; ötekiler yalnızca kodla kapanmalı.
const MIGRATIONSIZ = process.env.MIGRATIONSIZ === "1";
if (!MIGRATIONSIZ && (KIP === "yeni") !== tetikleyiciVar) {
  console.error(`ÖN KOŞUL YOK: "${KIP}" kipi damga tetikleyicisi ${KIP === "yeni" ? "İSTER" : "OLMADAN kurulmuş veritabanı ister"} (şu an: ${tetikleyiciVar ? "var" : "yok"}).`);
  process.exit(2);
}

// ---------- hesaplar ----------
async function hesap(email) {
  const r = await fetch(`${GECIT}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVIS, authorization: `Bearer ${SERVIS}`, "content-type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const govde = await r.json();
  if (r.ok) {
    // Şifre ONAYDAN SONRA konur. Eskiden şifre ve onay tek istekte gidiyordu: GoTrue onayı ayrı
    // bir güncellemeyle yazıyor, G1 tetikleyicisi (20261106184046) o anda şifreyi siliyor ve
    // G1'li veritabanında (RC06 provası) her giriş "Invalid login credentials" ile düşüyordu.
    const s = await fetch(`${GECIT}/auth/v1/admin/users/${govde.id}`, {
      method: "PUT",
      headers: { apikey: SERVIS, authorization: `Bearer ${SERVIS}`, "content-type": "application/json" },
      body: JSON.stringify({ password: SIFRE }),
    });
    if (!s.ok) throw new Error(`şifre konamadı: ${email}: ${s.status}`);
    return govde.id;
  }
  // Daha önce açılmış: kimliği veritabanından al.
  return psql(`select id from auth.users where email = '${email}'`);
}
async function oturum(email) {
  const c = createClient(GECIT, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: SIFRE });
  if (error) throw new Error(`giriş: ${email}: ${error.message}`);
  return c;
}
const ek = Date.now().toString(36);
const SAHIP = await hesap(`sahip-${ek}@yerel.test`);
await hesap(`yabanci-${ek}@yerel.test`);
// Aynı kullanıcının iki ayrı oturumu (iki sekme/cihaz) ve bir yabancı.
const A = await oturum(`sahip-${ek}@yerel.test`);
const B = await oturum(`sahip-${ek}@yerel.test`);
const C = await oturum(`yabanci-${ek}@yerel.test`);
const tokenA = (await A.auth.getSession()).data.session.access_token;

// ---------- veri yardımcıları ----------
const doc = (metin) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: metin }] }] });
const satir = (metin, sabitDamga) => ({
  content: doc(metin),
  plain_text: metin,
  word_count: metin.split(/\s+/).length,
  updated_by: SAHIP,
  updated_at: sabitDamga ?? new Date().toISOString(),
});
function yeniProje(baslangic = "Başlangıç metni") {
  const id = crypto.randomUUID();
  psql(`insert into public.academic_projects (id, owner_id, title, project_type) values ('${id}', '${SAHIP}', 'Sentetik ${id.slice(0, 8)}', 'thesis')`);
  if (baslangic !== null) {
    psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by) values ('${id}', '${JSON.stringify(doc(baslangic))}'::jsonb, '${baslangic}', 2, '${SAHIP}')`);
  }
  return id;
}
const damga = (id) => psql(`select to_json(updated_at)#>>'{}' from public.project_manuscripts where project_id = '${id}'`);
const metin = (id) => psql(`select plain_text from public.project_manuscripts where project_id = '${id}'`);
const surumler = (id) =>
  psql(`select plain_text from public.project_manuscript_versions where project_id = '${id}' order by created_at`).split("\n").filter(Boolean);
const korunduMu = (id, m) => metin(id) === m || surumler(id).includes(m);
const kanca = (k) => fetch(`${GECIT}/__gecit/kanca`, { method: "POST", body: JSON.stringify(k) });
const kancaSil = () => fetch(`${GECIT}/__gecit/kanca`, { method: "DELETE" });
/** Yedek alındıktan hemen sonra A oturumu (öteki sekme) koşullu kaydeder. */
const yedektenSonraAKaydetsin = (id, beklenen, m) =>
  kanca({
    yontem: "POST",
    yolIcerir: "/rest/v1/project_manuscript_versions",
    eylem: {
      yontem: "PATCH",
      yol: `/rest/v1/project_manuscripts?project_id=eq.${id}&updated_at=eq.${encodeURIComponent(beklenen)}`,
      basliklar: { apikey: ANON, authorization: `Bearer ${tokenA}`, prefer: "return=representation" },
      govde: satir(m),
    },
  });

// ---------- iki kip: aynı arayüz ----------
// Sonuç: { tur: "basarili", updatedAt } | { tur: "cakisma" | "reddedildi" | "yedek-alinamadi" | "hata" | ... }
const yeni = {
  async kaydet(c, id, row, beklenen, { force = false } = {}) {
    let kosul = beklenen;
    if (force) {
      const h = await zorlaKayitIcinYedekle(c, id, SAHIP, "Üzerine yazılmadan önce (öteki sürüm)");
      if (h.tur === "yedek-alinamadi") return h;
      kosul = h.beklenen;
    }
    const s = await kosulluYaz(c, id, row, kosul);
    if (s.tur === "basarili") await snapshotManuscript(c, id, SAHIP, { kind: "auto", onlyIfOlderThanMs: AUTO_VERSION_INTERVAL_MS });
    return s;
  },
  geriYukle: (c, id, versionId) => surumuGeriYukle(c, { projectId: id, userId: SAHIP, versionId, yedekEtiketi: "Geri yüklemeden önceki hâl" }),
};

// 97a2943: app/actions/manuscript.ts saveManuscript → write() ve force yolu (birebir).
const eski = {
  async kaydet(c, id, row, expectedUpdatedAt, { force = false } = {}) {
    const cakismaMi = async (expected) => {
      const { data } = await c.from("project_manuscripts").select("updated_at").eq("project_id", id).maybeSingle();
      if (!data) return { tur: "cakisma" };
      return data.updated_at === expected ? { tur: "reddedildi" } : { tur: "cakisma" };
    };
    const write = async () => {
      if (force) {
        const { data, error } = await c.from("project_manuscripts").upsert({ project_id: id, ...row }, { onConflict: "project_id" }).select("updated_at").single();
        if (error?.code === "42501") return { tur: "reddedildi" };
        if (error || !data) return { tur: "hata", hata: error };
        return { tur: "basarili", updatedAt: data.updated_at };
      }
      if (expectedUpdatedAt) {
        const { data, error } = await c.from("project_manuscripts").update(row).eq("project_id", id).eq("updated_at", expectedUpdatedAt).select("updated_at");
        if (error?.code === "42501") return { tur: "reddedildi" };
        if (error) return { tur: "hata", hata: error };
        if (!data?.length) return cakismaMi(expectedUpdatedAt);
        return { tur: "basarili", updatedAt: data[0].updated_at };
      }
      const { data, error } = await c.from("project_manuscripts").insert({ project_id: id, ...row }).select("updated_at").single();
      if (error?.code === "42501") return { tur: "reddedildi" };
      if (error?.code === "23505") return { tur: "cakisma" };
      if (error || !data) return { tur: "hata", hata: error };
      return { tur: "basarili", updatedAt: data.updated_at };
    };
    // Eskiden: yedeğin sonucu okunmuyordu.
    if (force) await snapshotManuscript(c, id, SAHIP, { kind: "manual", label: "Üzerine yazılmadan önce (öteki sürüm)" });
    const s = await write();
    if (s.tur === "basarili") await snapshotManuscript(c, id, SAHIP, { kind: "auto", onlyIfOlderThanMs: AUTO_VERSION_INTERVAL_MS });
    return s;
  },
  // 97a2943: app/actions/manuscript-versions.ts restoreManuscriptVersion (birebir).
  async geriYukle(c, id, versionId) {
    const { data: version, error: versionError } = await c
      .from("project_manuscript_versions")
      .select("project_id, content, plain_text, word_count, settings, created_at")
      .eq("id", versionId)
      .maybeSingle();
    if (versionError || !version || version.project_id !== id) return { tur: "surum-yok" };
    const backedUp = await snapshotManuscript(c, id, SAHIP, { kind: "restore", label: "Geri yüklemeden önceki hâl" });
    if (!backedUp) return { tur: "yedek-alinamadi" };
    const { data, error } = await c
      .from("project_manuscripts")
      .update({ content: version.content, plain_text: version.plain_text, word_count: version.word_count ?? 0, updated_by: SAHIP, updated_at: new Date().toISOString() })
      .eq("project_id", id)
      .select("updated_at");
    if (error || !data?.length) return { tur: "reddedildi" };
    return { tur: "basarili", updatedAt: data[0].updated_at };
  },
};
const K = KIP === "yeni" ? yeni : eski;

// ---------- senaryolar ----------
const sonuclar = [];
async function senaryo(ad, fn) {
  const kanit = {};
  try {
    const sorun = await fn(kanit);
    sonuclar.push({ ad, sonuc: sorun ? "FAIL" : "PASS", sorun: sorun ?? null, kanit });
  } catch (hata) {
    sonuclar.push({ ad, sonuc: "FAIL", sorun: `istisna: ${hata.message}`, kanit });
  } finally {
    await kancaSil();
    psql("grant insert on public.project_manuscript_versions to authenticated");
  }
  const s = sonuclar.at(-1);
  console.log(`${s.sonuc}  ${ad}${s.sorun ? `  — ${s.sorun}` : ""}`);
}
const versiyonIcin = (id, m) => {
  // Geri yüklenecek eski sürüm: doğrudan sürüm tablosuna (sahip olarak değil, tohum).
  return psql(
    `insert into public.project_manuscript_versions (project_id, content, plain_text, word_count, kind, label, created_by, created_at)
     values ('${id}', '${JSON.stringify(doc(m))}'::jsonb, '${m}', 2, 'manual', 'Eski sürüm', '${SAHIP}', now() - interval '1 hour') returning id`,
  ).split("\n")[0];
};

await senaryo("S1 iki oturum sırayla: eski damgalı ikinci kayıt çakışmaya düşer", async (k) => {
  const id = yeniProje();
  const t0 = damga(id);
  k.a = (await K.kaydet(A, id, satir("A oturumunun metni"), t0)).tur;
  k.b = (await K.kaydet(B, id, satir("B oturumunun metni"), t0)).tur;
  k.son = metin(id);
  if (k.a !== "basarili" || k.b !== "cakisma") return `beklenen basarili/cakisma, gelen ${k.a}/${k.b}`;
  if (k.son !== "A oturumunun metni") return `belge: ${k.son}`;
});

await senaryo("S2 eşzamanlı iki oturum (25 tur, aynı anda): her turda tek kazanan, kayıp yok", async (k) => {
  let anomali = 0;
  for (let i = 0; i < 25; i++) {
    const id = yeniProje();
    const t0 = damga(id);
    const [a, b] = await Promise.all([K.kaydet(A, id, satir(`A-${i}`), t0), K.kaydet(B, id, satir(`B-${i}`), t0)]);
    const kazanan = a.tur === "basarili" ? `A-${i}` : b.tur === "basarili" ? `B-${i}` : null;
    const tekKazanan = [a.tur, b.tur].filter((x) => x === "basarili").length === 1 && [a.tur, b.tur].includes("cakisma");
    if (!tekKazanan || metin(id) !== kazanan) anomali++;
  }
  k.anomali = anomali;
  if (anomali) return `${anomali}/25 turda tek kazanan kuralı bozuldu`;
});

await senaryo("S3 eski sürümden yazma: üç kayıt sonra eski damgayla yazan reddedilir", async (k) => {
  const id = yeniProje();
  const t0 = damga(id);
  let t = t0;
  const ilk = [];
  for (const m of ["A-1", "A-2", "A-3"]) {
    const s = await K.kaydet(A, id, satir(m), t);
    t = s.updatedAt;
    ilk.push(t);
  }
  k.t0 = (await K.kaydet(B, id, satir("B eski t0"), t0)).tur;
  k.t1 = (await K.kaydet(B, id, satir("B eski t1"), ilk[0])).tur;
  k.son = metin(id);
  if (k.t0 !== "cakisma" || k.t1 !== "cakisma" || k.son !== "A-3") return `t0=${k.t0} t1=${k.t1} belge=${k.son}`;
});

await senaryo("S4 aynı milisaniyede iki kayıt (sunucu saatleri çakışır): eski oturum öteki metni ezemez", async (k) => {
  // İki uygulama sunucusunun saati aynı milisaniyeyi yazıyor (ya da biri geride).
  const SABIT = "2026-11-15T12:00:00.000Z";
  const id = yeniProje();
  const s1 = await K.kaydet(A, id, satir("A-ilk", SABIT), damga(id));
  const bGordu = damga(id); // B sayfayı A'nın kaydından sonra açtı
  const s2 = await K.kaydet(B, id, satir("B'nin metni", SABIT), bGordu);
  // A'nın editörü hâlâ kendi kaydının damgasını tutuyor; B'nin metnini görmedi.
  const s3 = await K.kaydet(A, id, satir("A-ikinci", SABIT), s1.updatedAt);
  Object.assign(k, { a1: s1.tur, a1Damga: s1.updatedAt, b: s2.tur, bDamga: s2.updatedAt, a2: s3.tur, son: metin(id), surumler: surumler(id) });
  if (s2.tur !== "basarili") return `B'nin kaydı geçmedi (${s2.tur})`;
  if (!korunduMu(id, "B'nin metni")) return `B'nin onaylanmış metni kayboldu (A'nın eski oturumu ${s3.tur}; damgalar A=${s1.updatedAt} B=${s2.updatedAt})`;
});

await senaryo("S5 zorla kayıt, yedek ALINAMIYOR: öteki sürüm ezilmez", async (k) => {
  const id = yeniProje();
  const t0 = damga(id);
  const a1 = await K.kaydet(A, id, satir("A-v1"), t0); // ilk kayıt otomatik sürümü alır
  await K.kaydet(A, id, satir("A-v2"), a1.updatedAt); // on dakika dolmadı: sürüm yok
  k.b = (await K.kaydet(B, id, satir("B eski"), t0)).tur;
  psql("revoke insert on public.project_manuscript_versions from authenticated");
  k.zorla = (await K.kaydet(B, id, satir("B zorla"), t0, { force: true })).tur;
  psql("grant insert on public.project_manuscript_versions to authenticated");
  Object.assign(k, { son: metin(id), surumler: surumler(id) });
  if (!korunduMu(id, "A-v2")) return `A'nın onaylanmış metni (A-v2) ne belgede ne sürüm geçmişinde (zorla: ${k.zorla})`;
});

await senaryo("S6 zorla kayıt yarışı: yedekten SONRA kaydedilen metin ezilmez", async (k) => {
  const id = yeniProje();
  const t0 = damga(id);
  const a1 = await K.kaydet(A, id, satir("A-v1"), t0);
  const a2 = await K.kaydet(A, id, satir("A-v2"), a1.updatedAt);
  await K.kaydet(B, id, satir("B eski"), t0);
  await yedektenSonraAKaydetsin(id, a2.updatedAt, "A-v3 (yedekten sonra)");
  k.zorla = (await K.kaydet(B, id, satir("B zorla"), t0, { force: true })).tur;
  Object.assign(k, { son: metin(id), surumler: surumler(id) });
  if (!korunduMu(id, "A-v3 (yedekten sonra)")) return `A-v3 kayboldu: belge="${k.son}", zorla=${k.zorla}`;
  if (KIP === "yeni") {
    // Kullanıcı yeniden dener: bu kez A-v3 yedeklenip üzerine yazılır.
    k.yeniden = (await K.kaydet(B, id, satir("B zorla 2"), t0, { force: true })).tur;
    if (k.yeniden !== "basarili" || !surumler(id).includes("A-v3 (yedekten sonra)")) return `yeniden deneme: ${k.yeniden}`;
  }
});

await senaryo("S7 sürüm geri yükleme yarışı: yedekten SONRA kaydedilen metin ezilmez", async (k) => {
  const id = yeniProje();
  const v = versiyonIcin(id, "Eski sürüm metni");
  const a1 = await K.kaydet(A, id, satir("A-v1"), damga(id));
  const a2 = await K.kaydet(A, id, satir("A-v2"), a1.updatedAt);
  await yedektenSonraAKaydetsin(id, a2.updatedAt, "A-v3 (yedekten sonra)");
  k.geri = (await K.geriYukle(B, id, v)).tur;
  Object.assign(k, { son: metin(id), surumler: surumler(id) });
  if (!korunduMu(id, "A-v3 (yedekten sonra)")) return `A-v3 kayboldu: belge="${k.son}", geri yükleme=${k.geri}`;
});

await senaryo("S8 sürüm geri yükleme, yedek ALINAMIYOR: belge değişmez", async (k) => {
  const id = yeniProje();
  const v = versiyonIcin(id, "Eski sürüm metni");
  const a1 = await K.kaydet(A, id, satir("A-v1"), damga(id));
  await K.kaydet(A, id, satir("A-v2"), a1.updatedAt);
  psql("revoke insert on public.project_manuscript_versions from authenticated");
  k.geri = (await K.geriYukle(B, id, v)).tur;
  psql("grant insert on public.project_manuscript_versions to authenticated");
  k.son = metin(id);
  if (k.geri !== "yedek-alinamadi" || k.son !== "A-v2") return `geri=${k.geri} belge=${k.son}`;
});

await senaryo("S9 meşru sürüm geri yükleme: yazılır, önceki hâl yedekte, damga ilerler", async (k) => {
  const id = yeniProje();
  const v = versiyonIcin(id, "Eski sürüm metni");
  const a1 = await K.kaydet(A, id, satir("A-v1"), damga(id));
  const once = damga(id);
  const s = await K.geriYukle(B, id, v);
  Object.assign(k, { geri: s.tur, son: metin(id), once, sonra: damga(id), surumler: surumler(id) });
  if (s.tur !== "basarili" || k.son !== "Eski sürüm metni" || !surumler(id).includes("A-v1")) return JSON.stringify(k);
  if (!(Date.parse(k.sonra) > Date.parse(once)) && k.sonra === once) return "damga ilerlemedi";
  // Geri yüklemeden sonra A'nın eski damgalı kaydı çakışmaya düşmeli.
  k.aEski = (await K.kaydet(A, id, satir("A eski damgayla"), a1.updatedAt)).tur;
  if (k.aEski !== "cakisma") return `geri yüklemeden sonra eski damgalı kayıt: ${k.aEski}`;
});

await senaryo("S10 meşru zorla kayıt: yazılır, öteki sürüm yedekte", async (k) => {
  const id = yeniProje();
  const t0 = damga(id);
  const a1 = await K.kaydet(A, id, satir("A-v1"), t0);
  await K.kaydet(A, id, satir("A-v2"), a1.updatedAt);
  k.zorla = (await K.kaydet(B, id, satir("B zorla"), t0, { force: true })).tur;
  Object.assign(k, { son: metin(id), surumler: surumler(id) });
  if (k.zorla !== "basarili" || k.son !== "B zorla" || !surumler(id).includes("A-v2")) return JSON.stringify(k);
});

await senaryo("S11 damga doğrudan API'den geri çekilemez (kilit tek yönlü)", async (k) => {
  const id = yeniProje();
  const once = damga(id);
  const { error } = await A.from("project_manuscripts").update({ updated_at: "2000-01-01T00:00:00Z" }).eq("project_id", id);
  Object.assign(k, { hata: error?.message ?? null, once, sonra: damga(id) });
  if (k.sonra.startsWith("2000")) return `damga 2000'e çekildi (${k.sonra})`;
});

await senaryo("S12 yabancı kullanıcı doğru damgayla bile yazamaz (RLS korunuyor)", async (k) => {
  const id = yeniProje();
  k.c = (await K.kaydet(C, id, satir("yabancı"), damga(id))).tur;
  k.son = metin(id);
  if (k.c === "basarili" || k.son !== "Başlangıç metni") return JSON.stringify(k);
});

await senaryo("S13 ilk kayıt yarışı (satır yok): tek ekleme kazanır", async (k) => {
  const id = yeniProje(null);
  const [a, b] = await Promise.all([K.kaydet(A, id, satir("A ilk"), null), K.kaydet(B, id, satir("B ilk"), null)]);
  Object.assign(k, { a: a.tur, b: b.tur, son: metin(id) });
  const kazanan = a.tur === "basarili" ? "A ilk" : "B ilk";
  if ([a.tur, b.tur].sort().join() !== "basarili,cakisma" || k.son !== kazanan) return JSON.stringify(k);
});

await senaryo("S14 hızlı ardışık kayıtlar (30): sahte çakışma yok, damgalar kesin artar", async (k) => {
  const id = yeniProje();
  let t = damga(id);
  const damgalar = [t];
  for (let i = 0; i < 30; i++) {
    const s = await K.kaydet(A, id, satir(`hızlı-${i}`), t);
    if (s.tur !== "basarili") return `${i}. kayıt: ${s.tur}`;
    t = s.updatedAt;
    damgalar.push(t);
  }
  k.benzersiz = new Set(damgalar).size;
  k.ornek = damgalar.slice(0, 3);
  if (k.benzersiz !== damgalar.length) return `${damgalar.length - k.benzersiz} tekrar eden damga`;
});

const fail = sonuclar.filter((s) => s.sonuc === "FAIL").length;
console.log(`\n${KIP}: ${sonuclar.length - fail}/${sonuclar.length} PASS`);
if (CIKTI) fs.writeFileSync(CIKTI, JSON.stringify({ kip: KIP, migrationsiz: MIGRATIONSIZ, tetikleyiciVar, zaman: new Date().toISOString(), sonuclar }, null, 2));
process.exit(fail ? 1 : 0);
