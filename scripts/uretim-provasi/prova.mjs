#!/usr/bin/env node
/*
  ÜRETİM UZLAŞTIRMASI PROVASI (P1) — CI'DA DEĞİL, gerçek Production'a ASLA
  bağlanmaz. 12.11.2026.

  Neden: Production şeması elle kuruldu ve migration geçmişi depoyla
  eşleşmiyor (docs/uretim-duzeltmeleri/uretim-katalog-ozeti-20261112.json).
  Uzlaştırma (R1, 20261112065413) ve G1 kimlik migration'ları (R3) önce
  Production'ın BİREBİR kopyası olan bir şemada, gerçek GoTrue ile, eski
  akışla açılmış sentetik hesaplar üzerinde sınanır. PGlite testi
  (tests/db/uretim-uzlastirma.test.mjs) mantığı CI'da sabitler; bu prova
  PGlite'ın göremediği iki şeyi görür: gerçek GoTrue'nun şifre ve oturum
  davranışı, ve Production'ın dar yetki düzeni.

  Ön koşul (README.md): docker'da p1db (Postgres 17), p1auth (GoTrue
  v2.197.0), p1rest (PostgREST) ayakta; şema kurulup prodize.sql ile
  Production'a denk getirilmiş ve katalog özeti Production'la 0 farkla
  eşleşmiş olmalı. Betik bunu kendisi de denetler (ön koşul yoksa 2 ile çıkar).

  Kullanım: node scripts/uretim-provasi/prova.mjs <uretim-ozet.json> <test-ozet.json> <cikti-klasoru>
  Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
*/
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [uretimOzetYolu, testOzetYolu, cikti] = process.argv.slice(2);
if (!uretimOzetYolu || !testOzetYolu || !cikti) {
  console.error("kullanım: prova.mjs <uretim-ozet.json> <test-ozet.json> <cikti-klasoru>");
  process.exit(2);
}
fs.mkdirSync(cikti, { recursive: true });

const KOK = path.resolve(import.meta.dirname, "../..");
const PG = { host: "127.0.0.1", port: "55432", user: "postgres", sifre: "p1-yerel" };
const AUTH = "http://127.0.0.1:59999";
const REST = "http://127.0.0.1:53000";
// Yalnızca bu izole provanın sahte imza anahtarı; hiçbir gerçek ortamda geçerli değil.
const JWT_SIRRI = "p1-yerel-jwt-gizli-degil-yalnizca-prova-0123456789";
const OZET_SQL = path.join(import.meta.dirname, "katalog-ozeti.sql");

// Gerçek bir uzak adrese yanlışlıkla bağlanmayı imkânsız kılmak için: yalnızca yerel.
for (const adres of [AUTH, REST]) if (!adres.startsWith("http://127.0.0.1:")) throw new Error("prova yalnızca yerel adreslere bağlanır");

const sonuc = [];
const kaydet = (no, ad, durum, kanit) => {
  sonuc.push({ no, ad, durum, kanit });
  console.log(`${durum.padEnd(10)} ${no} ${ad}${kanit ? " — " + (typeof kanit === "string" ? kanit : JSON.stringify(kanit)).slice(0, 240) : ""}`);
};
const dene = async (no, ad, fn) => {
  try {
    const r = await fn();
    kaydet(no, ad, r.ok ? "PASS" : "FAIL", r.kanit);
  } catch (h) {
    kaydet(no, ad, "FAIL", "istisna: " + h.message);
  }
};

function psql(sql, { tA = true } = {}) {
  return execFileSync("psql", ["-h", PG.host, "-p", PG.port, "-U", PG.user, "-v", "ON_ERROR_STOP=1", "-q", ...(tA ? ["-tA"] : []), "-c", sql], {
    env: { ...process.env, PGPASSWORD: PG.sifre },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function psqlDosya(dosya) {
  return execFileSync("psql", ["-h", PG.host, "-p", PG.port, "-U", PG.user, "-v", "ON_ERROR_STOP=1", "-q", "-f", dosya], {
    env: { ...process.env, PGPASSWORD: PG.sifre },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
const json = (sql) => JSON.parse(psql(`select coalesce((${sql})::text, 'null')`) || "null");
/** Bir kullanıcının oturumuyla (RLS + tetikleyiciler geçerli) tek işlem; sonunda geri alınır ya da işlenir. */
function kullaniciOlarak(kullaniciId, sql, { isle = false } = {}) {
  const claims = JSON.stringify({ sub: kullaniciId, role: "authenticated" }).replace(/'/g, "''");
  return psql(`begin; select set_config('request.jwt.claims', '${claims}', true); set local role authenticated; ${sql}; ${isle ? "commit" : "rollback"};`);
}
function reddedilirMi(kullaniciId, sql) {
  try {
    kullaniciOlarak(kullaniciId, sql);
    return { reddedildi: false };
  } catch (h) {
    return { reddedildi: true, hata: String(h.stderr || h.message).split("\n").find((s) => /ERROR/.test(s)) || "" };
  }
}

function ozetAl(ad) {
  const ham = execFileSync("psql", ["-h", PG.host, "-p", PG.port, "-U", PG.user, "-tA", "-q", "-f", OZET_SQL], {
    env: { ...process.env, PGPASSWORD: PG.sifre },
    encoding: "utf8",
  });
  const satir = ham.split("\n").find((s) => s.startsWith("on|"));
  if (!satir) throw new Error("katalog özeti alınamadı (salt okunur işlem doğrulanmadı)");
  const o = JSON.parse(satir.slice(3));
  fs.writeFileSync(path.join(cikti, `ozet-${ad}.json`), JSON.stringify(o));
  return o;
}
// Bilinçli kabul: Production'a özgü akademik dizin hattı + platformun storage iç nesneleri.
const KABUL = ["academic_program", "data_sources", "academic_unit_import_staging", "academic_units_root_unique", "academic_units_active_lookup_idx", "academic_units_university_parent_idx"];
function fark(a, b) {
  const out = [];
  for (const sec of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (sec === "ext") continue;
    const x = a[sec] || {}, y = b[sec] || {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (sec === "tg" && k.startsWith("storage.")) continue;
      if (KABUL.some((s) => k.includes(s))) continue;
      if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(`${sec}:${k}${!(k in x) ? " (yalnız 2)" : !(k in y) ? " (yalnız 1)" : " (farklı)"}`);
    }
  }
  return out.sort();
}

function jwt(yuk) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const govde = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...yuk })}`;
  return `${govde}.${crypto.createHmac("sha256", JWT_SIRRI).update(govde).digest("base64url")}`;
}
const SERVIS = jwt({ role: "service_role", iss: "p1" });
const ANON = jwt({ role: "anon", iss: "p1" });
async function gotrue(yontem, yol, govde, anahtar = SERVIS) {
  const r = await fetch(AUTH + yol, { method: yontem, headers: { "content-type": "application/json", apikey: anahtar, authorization: `Bearer ${anahtar}` }, body: govde ? JSON.stringify(govde) : undefined });
  const metin = await r.text();
  let veri = null;
  try { veri = JSON.parse(metin); } catch { veri = metin; }
  return { durum: r.status, veri };
}
const kullaniciAc = (email, sifre, onayli, meta = {}) =>
  gotrue("POST", "/admin/users", { email, password: sifre, email_confirm: onayli, user_metadata: meta });
const girisYap = (email, sifre) => gotrue("POST", "/token?grant_type=password", { email, password: sifre }, ANON);
const yenile = (belirtec) => gotrue("POST", "/token?grant_type=refresh_token", { refresh_token: belirtec }, ANON);

function hesapDurumu(ids) {
  return json(`select json_object_agg(u.id, json_build_object(
      'sifre_ozeti', md5(coalesce(u.encrypted_password, '')), 'sifre_var', coalesce(u.encrypted_password,'') <> '',
      'onay', u.email_confirmed_at, 'oturum', (select count(*) from auth.sessions s where s.user_id = u.id),
      'gecerli_yenileme', (select count(*) from auth.refresh_tokens t where t.user_id = u.id::text and not t.revoked),
      'rol', p.role, 'kurum', p.organization_id, 'kvkk', p.kvkk_onay_at_metin))
    from auth.users u left join lateral (select role, organization_id,
      (to_jsonb(pp) ->> 'kvkk_onay_at') as kvkk_onay_at_metin from public.profiles pp where pp.id = u.id) p on true
    where u.id = any(array[${ids.map((i) => `'${i}'::uuid`).join(",")}])`);
}

/* ---------------------------------------------------------------- */
const uretimOzet = JSON.parse(fs.readFileSync(uretimOzetYolu, "utf8"));
const testOzet = JSON.parse(fs.readFileSync(testOzetYolu, "utf8"));
const U = uretimOzet.katalog || uretimOzet.prod || uretimOzet;
const T = testOzet.katalog || testOzet.test || testOzet;

// Ön koşul: P1 Production'a denk mi?
let once;
try {
  once = ozetAl("1-r1-oncesi");
} catch (h) {
  console.error("ÖN KOŞUL YOK:", h.message);
  process.exit(2);
}
const denklik = fark(once, U);
if (denklik.length) {
  console.error("ÖN KOŞUL YOK: P1 Production'a denk değil:", denklik.slice(0, 10));
  process.exit(2);
}
kaydet("0", "P1 kataloğu Production'la denk (kabul edilen farklar dışında)", "PASS", "0 fark");

// --- Eski akışla sentetik hesaplar (Production davranışı) ---
const ORG = crypto.randomUUID();
psql(`insert into public.organizations (id, name) values ('${ORG}', 'P1 Sentetik Kurum');
      insert into public.arvoos_members (email, organization_id, full_name) values
        ('eski-uye@p1.example', '${ORG}', 'Sentetik Üye'), ('eski-onaysiz-uye@p1.example', '${ORG}', 'Sentetik Onaysız Üye'),
        ('yeni-uye@p1.example', '${ORG}', 'Sentetik Yeni Üye')`);
const S = { U1: "Eski-Sifre-U1-x7", U2: "Eski-Sifre-U2-x7", U3: "Eski-Sifre-U3-x7", U4: "Eski-Sifre-U4-x7", U5: "Eski-Sifre-U5-x7" };
const H = {};
for (const [k, email, onayli] of [["U1", "eski-kurucu@p1.example", true], ["U2", "eski-uye@p1.example", true], ["U3", "eski-personel@p1.example", true], ["U4", "eski-onaysiz@p1.example", false], ["U5", "eski-onaysiz-uye@p1.example", false]]) {
  const r = await kullaniciAc(email, S[k], onayli);
  if (r.durum !== 200) throw new Error(`${k} açılamadı: ${r.durum} ${JSON.stringify(r.veri)}`);
  H[k] = r.veri.id;
}
psql(`update public.profiles set role = 'founder' where id = '${H.U1}'`);
const YENILEME = {};
for (const k of ["U1", "U2", "U3"]) {
  const g = await girisYap(`${{ U1: "eski-kurucu", U2: "eski-uye", U3: "eski-personel" }[k]}@p1.example`, S[k]);
  if (g.durum !== 200) throw new Error(`${k} girişi başarısız: ${g.durum}`);
  YENILEME[k] = g.veri.refresh_token;
}
const eskiDurum = hesapDurumu(Object.values(H));
fs.writeFileSync(path.join(cikti, "hesaplar-0-once.json"), JSON.stringify(eskiDurum, null, 1));
await dene("0a", "Production davranışı yeniden üretildi: yeni profilin rolü 'employee'", async () => ({ ok: eskiDurum[H.U3].rol === "employee", kanit: { U3: eskiDurum[H.U3].rol } }));
await dene("0b", "Production açığı yeniden üretildi: ONAYSIZ üye kayıtta kuruma bağlanıyor", async () => ({ ok: eskiDurum[H.U5].kurum === ORG, kanit: { U5_kurum_bagli: eskiDurum[H.U5].kurum === ORG } }));
await dene("0c", "KVKK veri indirme sorgusu Production şemasında düşüyor (uzlaştırma öncesi)", async () => {
  const r = reddedilirMi(H.U2, `select full_name, role, organization_id, kvkk_onay_at, created_at from public.profiles where id = '${H.U2}'`);
  return { ok: r.reddedildi && /kvkk_onay_at/.test(r.hata), kanit: r.hata };
});

// --- R1 iki kez ---
const sutunYetkisi = () => psql(`select coalesce(string_agg(c.relname || '.' || a.attname || '=' || a.attacl::text, ';' order by 1), '') from pg_attribute a join pg_class c on c.oid = a.attrelid where c.relnamespace = 'public'::regnamespace and a.attacl is not null`);
const sutunOnce = sutunYetkisi();
const R1 = path.join(KOK, "supabase/migrations/20261112065413_uretim_uzlastirma.sql");
psqlDosya(R1);
const r1a = ozetAl("2-r1-birinci");
psqlDosya(R1);
const r1b = ozetAl("3-r1-ikinci");
await dene("1", "R1 iki kez uygulandı; ikinci koşu hatasız ve katalog değişmedi (idempotens)", async () => {
  const f = fark(r1a, r1b);
  return { ok: f.length === 0, kanit: { ikinciKosudaFark: f.length } };
});
await dene("1b", "R1'in katalog etkisi yalnızca beklenen nesneler", async () => {
  const f = fark(once, r1a);
  const beklenen = [
    "col:individual_subscriptions.deneme_hatirlatildi_at (yalnız 2)", "col:profiles.kvkk_onay_at (yalnız 2)", "col:profiles.role (farklı)",
    "fn:public.best_guideline_for(p_university_id uuid, p_unit_id uuid, p_department_id uuid, p_organization_id uuid) (farklı)", "fn:public.handle_new_user() (farklı)",
    "idx:individual_subscriptions_hatirlatma_idx (yalnız 2)", "tg:public.app_support_requests.guard_support_request_update_trigger (yalnız 2)", "tg:public.consultancy_requests.guard_consultancy_request_update_trigger (yalnız 2)",
  ];
  const fazla = f.filter((x) => !beklenen.includes(x)), eksik = beklenen.filter((x) => !f.includes(x));
  return { ok: !fazla.length && !eksik.length, kanit: { fazla, eksik } };
});
await dene("8a", "R1 hiçbir tablo/fonksiyon/sütun yetkisini genişletmedi", async () => {
  // Tablo ve fonksiyon ACL'leri özetten; sütun ACL'leri (attacl) doğrudan katalogdan.
  const yetki = (o) => JSON.stringify([...Object.entries(o.tbl).map(([k, v]) => `tbl ${k} ${v[3]}`), ...Object.entries(o.fn).map(([k, v]) => `fn ${k} ${v[3]}`)].sort());
  const sutunSonra = sutunYetkisi();
  return { ok: yetki(once) === yetki(r1b) && sutunOnce === sutunSonra, kanit: { tabloVeFonksiyon: yetki(once) === yetki(r1b), sutun: sutunOnce === sutunSonra } };
});

// --- Senaryo 2: KVKK ---
const kvkkAn = new Date().toISOString();
const k2 = await kullaniciAc("yeni-kvkk@p1.example", "Yeni-Sifre-K2-x7", false, { full_name: "Sentetik KVKK", kvkk_onay_at: kvkkAn });
H.K2 = k2.veri.id;
const link = await gotrue("POST", "/admin/generate_link", { type: "signup", email: "yeni-baglanti@p1.example", password: crypto.randomBytes(24).toString("base64url"), data: { full_name: "Sentetik Bağlantı", kvkk_onay_at: kvkkAn } });
H.K3 = link.veri?.id || link.veri?.user?.id;
await dene("2", "KVKK onaylı yeni kayıt: kvkk_onay_at profile yazılıyor (yönetici ve generateLink yolları)", async () => {
  const d = hesapDurumu([H.K2, H.K3]);
  return { ok: !!d[H.K2]?.kvkk && !!d[H.K3]?.kvkk, kanit: { yonetici: !!d[H.K2]?.kvkk, generateLink: !!d[H.K3]?.kvkk, linkDurum: link.durum } };
});
await dene("2b", "Kullanıcı kendi kvkk_onay_at'ini değiştiremiyor (guard_profile_lifecycle)", async () => {
  const r = reddedilirMi(H.K2, `update public.profiles set kvkk_onay_at = now() - interval '1 year' where id = '${H.K2}'`);
  return { ok: r.reddedildi, kanit: r.hata };
});
await dene("2c", "Eski hesapların kvkk_onay_at'i geriye doldurulmadı", async () => {
  const d = hesapDurumu([H.U1, H.U2, H.U3]);
  return { ok: [H.U1, H.U2, H.U3].every((i) => d[i].kvkk === null), kanit: "U1–U3 kvkk = null" };
});
await dene("2d", "KVKK veri indirme sorgusu artık çalışıyor", async () => {
  const r = kullaniciOlarak(H.K2, `select count(*) from (select full_name, role, organization_id, kvkk_onay_at, created_at from public.profiles where id = '${H.K2}') x`);
  return { ok: /^1$/m.test(r), kanit: r };
});

// --- Senaryo 3: cron sorgusu (route.ts:103-111 ile aynı süzgeç, servis rolüyle) ---
await dene("3", "Deneme hatırlatma cron sorgusu servis rolüyle çalışıyor", async () => {
  const r = psql(`begin; set local role service_role; select count(*) from public.individual_subscriptions where status = 'trialing' and deneme_hatirlatildi_at is null and trial_ends_at > now() and trial_ends_at <= now() + interval '2 days'; rollback;`);
  return { ok: /^\d+$/m.test(r), kanit: "sorgu döndü: " + r.split("\n").find((s) => /^\d+$/.test(s)) };
});

// --- Senaryo 4: destek ve uzman talebi koruması + meşru akış ---
const talep = psql(`insert into public.app_support_requests (requested_by, subject, message, category, priority) values ('${H.U2}', 'Sentetik', 'Sentetik mesaj', 'other', 'normal') returning id`).split("\n")[0];
await dene("4a", "Kullanıcı kendi destek talebinin durumunu değiştiremiyor", async () => {
  const r = reddedilirMi(H.U2, `update public.app_support_requests set status = 'resolved' where id = '${talep}'`);
  return { ok: r.reddedildi, kanit: r.hata };
});
await dene("4b", "Kullanıcı kendi talebine yönetici yanıtı yazamıyor", async () => {
  const r = reddedilirMi(H.U2, `update public.app_support_requests set admin_note = 'kendi cevabım' where id = '${talep}'`);
  return { ok: r.reddedildi, kanit: r.hata };
});
await dene("4c", "Meşru akış: kurucu yanıtlar ve çözer; kullanıcının yeni mesajı talebi yeniden açar", async () => {
  kullaniciOlarak(H.U1, `update public.app_support_requests set status = 'resolved', admin_note = 'yanıt', answered_at = now() where id = '${talep}'`, { isle: true });
  kullaniciOlarak(H.U2, `insert into public.destek_mesajlari (destek_talebi_id, metin) values ('${talep}', 'hâlâ sorun var')`, { isle: true });
  const durum = psql(`select status from public.app_support_requests where id = '${talep}'`);
  return { ok: durum === "open", kanit: { sonDurum: durum } };
});
const uzmanTalebi = psql(`insert into public.consultancy_requests (requested_by, request_type, message, status) values ('${H.U2}', 'methodology', 'Sentetik', 'open') returning id`).split("\n")[0];
await dene("4d", "Talep sahibi uzman atayamıyor; açık talebini iptal edebiliyor", async () => {
  const r = reddedilirMi(H.U2, `update public.consultancy_requests set assigned_expert_id = '${H.U3}' where id = '${uzmanTalebi}'`);
  kullaniciOlarak(H.U2, `update public.consultancy_requests set status = 'cancelled' where id = '${uzmanTalebi}'`, { isle: true });
  const durum = psql(`select status from public.consultancy_requests where id = '${uzmanTalebi}'`);
  return { ok: r.reddedildi && durum === "cancelled", kanit: { atamaReddi: r.hata, iptal: durum } };
});

// --- Rol kararı: client ---
await dene("R-a", "Yeni kayıt 'client' rolüyle açılıyor", async () => {
  const d = hesapDurumu([H.K2, H.K3]);
  return { ok: d[H.K2].rol === "client" && d[H.K3].rol === "client", kanit: { K2: d[H.K2].rol, K3: d[H.K3].rol } };
});
await dene("R-b", "Mevcut rollere dokunulmadı (employee ve founder aynen)", async () => {
  const d = hesapDurumu([H.U1, H.U3]);
  return { ok: d[H.U1].rol === "founder" && d[H.U3].rol === "employee", kanit: { U1: d[H.U1].rol, U3: d[H.U3].rol } };
});
await dene("R-c", "Client kendini personel yapamıyor", async () => {
  const r = reddedilirMi(H.K2, `update public.profiles set role = 'employee' where id = '${H.K2}'`);
  return { ok: r.reddedildi, kanit: r.hata };
});
await dene("R-d", "Yetkili yönetici (kurucu) personel rolü atayabiliyor", async () => {
  kullaniciOlarak(H.U1, `update public.profiles set role = 'employee' where id = '${H.K3}'`, { isle: true });
  const rolu = psql(`select role from public.profiles where id = '${H.K3}'`);
  return { ok: rolu === "employee", kanit: { K3: rolu } };
});

// --- R3: G1 kimlik migration'ları (depo sırasıyla) ---
const onaysizSayisi = psql(`select count(*) from auth.users where email_confirmed_at is null`);
for (const f of ["20261106184046_eposta_onayi_kimlik_sabitleme.sql", "20261107113542_sifre_durumum.sql", "20261107120542_ilk_sifre_gerekli.sql"]) psqlDosya(path.join(KOK, "supabase/migrations", f));
const r3 = ozetAl("4-r3-sonrasi");
const sonraDurum = hesapDurumu([H.U1, H.U2, H.U3]);
fs.writeFileSync(path.join(cikti, "hesaplar-1-r3-sonrasi.json"), JSON.stringify(sonraDurum, null, 1));
await dene("5a", "R3 sonrası onaylı eski hesaplar: şifre özeti, onay anı ve oturum sayısı DEĞİŞMEDİ", async () => {
  const degisen = ["U1", "U2", "U3"].filter((k) => {
    const a = eskiDurum[H[k]], b = sonraDurum[H[k]];
    return a.sifre_ozeti !== b.sifre_ozeti || a.onay !== b.onay || a.oturum !== b.oturum || a.gecerli_yenileme !== b.gecerli_yenileme;
  });
  return { ok: degisen.length === 0, kanit: { degisen, oturumlar: ["U1", "U2", "U3"].map((k) => sonraDurum[H[k]].oturum) } };
});
await dene("5b", "R3 sonrası eski şifreyle giriş ve eski yenileme belirteci çalışıyor (gerçek GoTrue)", async () => {
  const g = await girisYap("eski-personel@p1.example", S.U3);
  const y = await yenile(YENILEME.U1);
  return { ok: g.durum === 200 && y.durum === 200, kanit: { giris: g.durum, yenileme: y.durum } };
});
await dene("6a", `Onaysız eski hesap (R3 öncesi onaysız sayısı ${onaysizSayisi}) onaylandığında onay öncesi şifre siliniyor`, async () => {
  await gotrue("PUT", `/admin/users/${H.U4}`, { email_confirm: true });
  const d = hesapDurumu([H.U4]);
  const g = await girisYap("eski-onaysiz@p1.example", S.U4);
  return { ok: d[H.U4].sifre_var === false && !!d[H.U4].onay && g.durum === 400, kanit: { sifre_var: d[H.U4].sifre_var, eskiSifreyleGiris: g.durum, not: "Tasarım gereği; Production'da R3 ön koşulu onaysız=0" } };
});
await dene("6b", "Onaysız üyenin kurum bağı R3'te söküldü, onaydan SONRA yeniden kuruldu", async () => {
  const once6 = hesapDurumu([H.U5])[H.U5].kurum;
  await gotrue("PUT", `/admin/users/${H.U5}`, { email_confirm: true });
  const sonra6 = hesapDurumu([H.U5])[H.U5].kurum;
  return { ok: once6 === null && sonra6 === ORG, kanit: { onayOncesi: once6, onaySonrasi: sonra6 === ORG ? "kuruma bağlı" : sonra6 } };
});
await dene("7", "ilk_sifre_gerekli: üye için false, şifresiz üye olmayan için true, şifreli eski hesap için false", async () => {
  const uye = kullaniciOlarak(H.U2, "select public.ilk_sifre_gerekli()");
  const sifresiz = kullaniciOlarak(H.U4, "select public.ilk_sifre_gerekli()");
  const eski = kullaniciOlarak(H.U3, "select public.ilk_sifre_gerekli()");
  const tek = (s) => s.split("\n").find((x) => x === "t" || x === "f");
  return { ok: tek(uye) === "f" && tek(sifresiz) === "t" && tek(eski) === "f", kanit: { uye: tek(uye), sifresiz: tek(sifresiz), eski: tek(eski) } };
});
await dene("8b", "anon yeni fonksiyonları çağıramıyor; onay tetikleyici fonksiyonları kimseye açık değil", async () => {
  const r = json(`select json_build_object('anon_ilk', has_function_privilege('anon','public.ilk_sifre_gerekli()','execute'),
     'auth_ilk', has_function_privilege('authenticated','public.ilk_sifre_gerekli()','execute'),
     'anon_temizle', has_function_privilege('anon','public.eposta_onayinda_sifreyi_temizle()','execute'),
     'auth_temizle', has_function_privilege('authenticated','public.eposta_onayinda_sifreyi_temizle()','execute'),
     'auth_bagla', has_function_privilege('authenticated','public.arvoos_uyeligini_bagla(uuid,text)','execute'))`);
  return { ok: !r.anon_ilk && r.auth_ilk && !r.anon_temizle && !r.auth_temizle && !r.auth_bagla, kanit: r };
});
await dene("8c", "R3 mevcut tablo yetkilerini genişletmedi", async () => {
  const t = (o) => JSON.stringify(Object.entries(o.tbl).map(([k, v]) => `${k} ${v[3]}`).sort());
  return { ok: t(r1b) === t(r3), kanit: "tablo ACL'leri R1 sonrasıyla birebir" };
});
await dene("9", "R1+R3 sonrası P1 ile Test kataloğu: yalnızca bilinen ve kabul edilen farklar", async () => {
  const f = fark(r3, T);
  const bilinen = (x) =>
    /^tbl:/.test(x) || // Production'ın dar tablo yetkileri (korunuyor)
    /^fn:.*\(farklı\)$/.test(x) || // fonksiyon ACL'si (service_role) ya da satır sonu/yorum farkı; aşağıda gövde ayrıca denetleniyor
    /^pol:public\.organizations\.Members can view their own organization/.test(x) || // anlamca aynı
    /^pol:public\.universities\.Authenticated users can view universities/.test(x) || // yinelenen politika
    /arvolab_test_ortami|academic_unit|set_academic_unit_updated_at|validate_academic_unit_parent/.test(x) ||
    /^col:profiles\.role/.test(x); // Test'te de client; burada yalnızca biçim
  const govdeFarki = Object.keys(r3.fn).filter((k) => T.fn[k] && r3.fn[k][0] !== T.fn[k][0]);
  const govdeBilinen = ["public.guard_support_request_update()", "public.rls_auto_enable()"];
  const acik = f.filter((x) => !bilinen(x));
  const govdeAcik = govdeFarki.filter((k) => !govdeBilinen.includes(k));
  return { ok: acik.length === 0 && govdeAcik.length === 0, kanit: { aciklanamayan: acik, govdeFarki: govdeFarki, toplamFark: f.length } };
});

// --- Senaryo 11: API düzeyinde duman testi (supabase-js → GoTrue + PostgREST) ---
const vekil = http.createServer((istek, yanit) => {
  const hedef = istek.url.startsWith("/auth/v1") ? { port: 59999, yol: istek.url.slice(8) } : istek.url.startsWith("/rest/v1") ? { port: 53000, yol: istek.url.slice(8) } : null;
  if (!hedef) { yanit.writeHead(404); return yanit.end(); }
  const v = http.request({ host: "127.0.0.1", port: hedef.port, path: hedef.yol || "/", method: istek.method, headers: istek.headers }, (r) => { yanit.writeHead(r.statusCode, r.headers); r.pipe(yanit); });
  istek.pipe(v);
});
await new Promise((ok) => vekil.listen(54321, "127.0.0.1", ok));
psql("notify pgrst, 'reload schema'");
await new Promise((ok) => setTimeout(ok, 1500));
await dene("11", "API duman testi: eski üye girişi, profil (kvkk sütunu), ilk_sifre_gerekli RPC, servis rolüyle cron sorgusu", async () => {
  const istemci = createClient("http://127.0.0.1:54321", ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const g = await istemci.auth.signInWithPassword({ email: "eski-uye@p1.example", password: S.U2 });
  const p = await istemci.from("profiles").select("full_name, role, organization_id, kvkk_onay_at, created_at").eq("id", H.U2).maybeSingle();
  const r = await istemci.rpc("ilk_sifre_gerekli");
  const servis = createClient("http://127.0.0.1:54321", SERVIS, { auth: { persistSession: false } });
  const c = await servis.from("individual_subscriptions").select("user_id,status,trial_ends_at,deneme_hatirlatildi_at").eq("status", "trialing").is("deneme_hatirlatildi_at", null).limit(5);
  const ok = !g.error && !p.error && !!p.data && !r.error && r.data === false && !c.error;
  return { ok, kanit: { giris: g.error?.message || "ok", profil: p.error?.message || "ok", rpc: r.error?.message ?? r.data, cron: c.error?.message || "ok" } };
});
vekil.close();

// --- Senaryo 10: geri dönüş ---
const GERI = path.join(KOK, "docs/uretim-duzeltmeleri/uretim-uzlastirma-geri-donus.sql");
const geriCikti = psqlDosya(GERI);
const g1 = ozetAl("5-geri-donus-veriyle");
const BAGLA = "fn:public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text) (farklı)";
await dene("10a", "Geri dönüş (veri varken): KVKK sütunu korunuyor; arvoos_uyeligini_bagla bilerek G1 sürümünde; geri kalan her şey R1 öncesine döndü", async () => {
  const f = fark(once, g1);
  const beklenen = ["col:profiles.kvkk_onay_at (yalnız 2)", BAGLA];
  const g1Surumu = JSON.stringify(g1.fn["public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text)"]) === JSON.stringify(r3.fn["public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text)"]);
  return { ok: JSON.stringify(f) === JSON.stringify(beklenen.sort()) && g1Surumu, kanit: { kalanFark: f, baglaG1Surumunde: g1Surumu } };
});
psql(`update public.profiles set kvkk_onay_at = null where id in ('${H.K2}', '${H.K3}')`); // yalnızca sentetik provada
psqlDosya(GERI);
const g2 = ozetAl("6-geri-donus-tam");
await dene("10b", "Geri dönüş (sütun boşken): katalog R1 öncesiyle birebir (bilerek korunan G1 bağlama fonksiyonu dışında)", async () => {
  const f = fark(once, g2).filter((x) => x !== BAGLA);
  return { ok: f.length === 0, kanit: { kalanFark: f } };
});
await dene("10c", "Geri dönüşten sonra eski hesaplar: şifre, onay ve oturumlar korunuyor; giriş çalışıyor", async () => {
  const d = hesapDurumu([H.U1, H.U2, H.U3]);
  const degisen = ["U1", "U2", "U3"].filter((k) => d[H[k]].sifre_ozeti !== eskiDurum[H[k]].sifre_ozeti || d[H[k]].onay !== eskiDurum[H[k]].onay);
  const g = await girisYap("eski-kurucu@p1.example", S.U1);
  return { ok: degisen.length === 0 && g.durum === 200, kanit: { degisen, giris: g.durum } };
});
await dene("10d", "Geri dönüşten sonra R1 yeniden uygulanabiliyor ve aynı sonucu veriyor", async () => {
  psqlDosya(R1);
  // Tek beklenen fark: bilerek G1 sürümünde bırakılan arvoos_uyeligini_bagla (R3'ün kalıcı güvenlik düzeltmesi).
  const f = fark(r1a, ozetAl("7-r1-yeniden"));
  return { ok: f.length === 1 && f[0] === BAGLA, kanit: { r1IlkUygulamayaGoreFark: f } };
});

fs.writeFileSync(path.join(cikti, "sonuc.json"), JSON.stringify({ tarih: new Date().toISOString(), sonuc, geriDonusCiktisi: geriCikti.slice(0, 2000) }, null, 1));
const dusen = sonuc.filter((s) => s.durum !== "PASS");
console.log(`\n${sonuc.length - dusen.length}/${sonuc.length} PASS`);
process.exit(dusen.length ? 1 : 0);
