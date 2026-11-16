// P52b-2D: yeni yükleme adlarının gerçek yerel yığında (PG17 + storage-api +
// PostgREST) uyumluluğu. Yalnızca sentetik kullanıcı ve sentetik dosya;
// yalnızca 127.0.0.1. Silme yok: oluşturulan nesneler `@yerel.test`
// kullanıcısının klasöründe kalır, bir sonraki 2A kabul koşusu (kabul.mjs)
// temiz başlangıçta onları da kaldırır.
//
// Sınananlar:
//  U1  Eski biçim aynı milisaniye + aynı ad: ikinci yükleme "already exists" (çakışma yeniden üretildi)
//  U2  Yeni biçim aynı milisaniye + aynı ad: iki yükleme de geçer, iki ayrı yol
//  U3  Beş akışın yeni yolu, OTURUM AÇMIŞ kullanıcı olarak depo politikasından geçer
//  U4  Veritabanı kısıtları yeni yolu kabul eder: academic_score_entries.belge_yolu,
//      uak_tablolari.depo_yolu (işlem içinde, geri alınarak)
//
// Kullanım: node --import ./tests/register.mjs denetim/p52b2d/uuid-uyum.mjs
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { benzersizDosyaAdi, guvenliAd } from "../../lib/depo-dosya-adi.ts";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (yuk) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "HS256", typ: "JWT" }) + "." + b({ iss: "yerel-yigin", iat: 1763200000, exp: 2079000000, ...yuk });
  return g + "." + crypto.createHmac("sha256", SIR).update(g).digest("base64url");
};
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" },
    encoding: "utf8",
  }).trim();

if (!(await fetch(`${GECIT}/storage/v1/status`).then((r) => r.ok).catch(() => false))) {
  console.error("ÖN KOŞUL YOK: yerel yığın ve gecit.mjs çalışmalı");
  process.exit(2);
}

// Sentetik kullanıcı; depo yükleme politikası abonelik kapısına bakıyor: lisanssız kurum = açık.
const uid = crypto.randomUUID();
const org = crypto.randomUUID();
psql(`insert into auth.users (id, email, aud, role, instance_id) values ('${uid}', 'uuid-${uid.slice(0, 6)}@yerel.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`);
psql(`insert into public.organizations (id, name) values ('${org}', 'uuid-uyum')`);
psql(`update public.profiles set organization_id='${org}' where id='${uid}'`);
const sb = createClient(GECIT, imzala({ role: "anon" }), {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${imzala({ role: "authenticated", aud: "authenticated", sub: uid })}` } },
});
const PDF = new Blob([new TextEncoder().encode("%PDF-1.7\n%%EOF\n")], { type: "application/pdf" });
const DOCX_TUR = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const yukle = (yol, tur = "application/pdf") => sb.storage.from("project-files").upload(yol, new Blob([PDF], { type: tur }), { contentType: tur, upsert: false });

const sonuc = [];
const kayit = (kimlik, ad, gecti, ayrinti) => {
  sonuc.push({ kimlik, ad, sonuc: gecti ? "PASS" : "FAIL", ayrinti });
  console.log(`${gecti ? "PASS" : "FAIL"}  ${kimlik}  ${ad} — ${ayrinti}`);
};
const ZAMAN = Date.now();

// U1: eski biçimin çakışması (yeniden üretim; BEKLENEN sonuç: ikinci yükleme düşer)
{
  const eski = `${uid}/${ZAMAN}-${guvenliAd("tez.pdf")}`;
  const a = await yukle(eski);
  const b = await yukle(eski);
  kayit("U1", "ESKİ biçim, aynı ms + aynı ad → ikinci yükleme düşer (çakışma yeniden üretildi)", !a.error && !!b.error, `1.: ${a.error ? a.error.message : "geçti"}; 2.: ${b.error ? b.error.message : "geçti"}`);
}
// U2: yeni biçim
{
  const y1 = `${uid}/${benzersizDosyaAdi(guvenliAd("tez.pdf"), { simdi: ZAMAN })}`;
  const y2 = `${uid}/${benzersizDosyaAdi(guvenliAd("tez.pdf"), { simdi: ZAMAN })}`;
  const a = await yukle(y1);
  const b = await yukle(y2);
  kayit("U2", "YENİ biçim, aynı ms + aynı ad → ikisi de geçer, iki ayrı yol", !a.error && !b.error && y1 !== y2, `1.: ${a.error?.message ?? "geçti"}; 2.: ${b.error?.message ?? "geçti"}`);
}
// U3: beş akışın yeni yolu, oturum açmış kullanıcı olarak
const giris = crypto.randomUUID();
const akislar = [
  ["belge", `${uid}/${benzersizDosyaAdi(guvenliAd("Tez Taslağı.pdf"))}`, "application/pdf"],
  ["imports", `${uid}/imports/${benzersizDosyaAdi(guvenliAd("bölüm 1.docx"))}`, DOCX_TUR],
  ["etik", `${uid}/etik/${benzersizDosyaAdi(guvenliAd("yönerge.pdf"))}`, "application/pdf"],
  ["uak", `${uid}/uak/${benzersizDosyaAdi(".pdf")}`, "application/pdf"],
  ["docentlik", `${uid}/docentlik/${benzersizDosyaAdi(".pdf", { on: giris })}`, "application/pdf"],
];
for (const [ad, yol, tur] of akislar) {
  const r = await yukle(yol, tur);
  kayit(`U3-${ad}`, `${ad}: yeni yol depo politikasından geçer`, !r.error, r.error?.message ?? "yüklendi");
}
// U4: veritabanı kısıtları (işlem içinde, geri alınır)
{
  const doc = akislar.find((x) => x[0] === "docentlik")[1];
  const uak = akislar.find((x) => x[0] === "uak")[1];
  // Yerel yığında scoring_criteria boş: satır eklenemiyor, bu yüzden kısıtın KENDİ
  // ifadesi (katalogdan okunan: belge_yolu LIKE owner_id || '/docentlik/%') yeni yolla
  // ve olumsuz bir örnekle (başka sahibin öneki) değerlendiriliyor.
  const kisit = psql(`select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.academic_score_entries'::regclass and pg_get_constraintdef(oid) ~ 'belge_yolu'`);
  const baska = crypto.randomUUID();
  const a = psql(`select ('${doc}' ~~ ('${uid}'::uuid::text || '/docentlik/%')) || '/' || ('${doc}' ~~ ('${baska}'::uuid::text || '/docentlik/%'))`);
  const b = psql(`select ('${uak}' ~~ ('${uid}' || '/uak/%')) and char_length('${uak}') <= 500`);
  kayit("U4-docentlik", "academic_score_entries.belge_yolu kısıt ifadesi yeni yolu kabul eder, başka sahibin önekini reddeder", a === "true/false", `${a} (kısıt: ${kisit})`);
  kayit("U4-uak", "uak_tablolari.depo_yolu (≤500) ve önek", b === "t", b);
}

const fail = sonuc.filter((s) => s.sonuc !== "PASS").length;
console.log(`\n${sonuc.length - fail}/${sonuc.length} PASS`);
fs.writeFileSync(new URL("./sonuclar/uuid-uyum.json", import.meta.url), JSON.stringify(sonuc.map((s) => ({ ...s, ayrinti: s.ayrinti.replaceAll(uid, "<kullanici>").replaceAll(giris, "<giris>") })), null, 2) + "\n");
process.exit(fail ? 1 : 0);
