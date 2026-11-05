#!/usr/bin/env node
/*
  TEST SUPABASE PROJESİ — ŞEMA KURULUMU (Güvenli Test Ortamı, Aşama 1).
  BU BETİK HENÜZ ÇALIŞTIRILMADI; çalıştırma kararı ve ortamı sizde.

  Ne yapar (sırayla, ilk hatada durur):
    1. Hedef denetimi: SUPABASE_DB_URL TEST projesini göstermeli
       (scripts/supabase-hedef.mjs, --tur sema-kurulumu). Üretimde hiçbir
       koşulda çalışmaz; bilinmeyen projede de çalışmaz.
    2. Boş veritabanı denetimi: public.academic_projects varsa durur
       (dolu bir projeye ikinci kez kurulmaz).
    3. supabase/schema.sql
    4. `project-files` depolama kovası (özel) — boyut ve tür sınırlarını
       20260924100000 migration'ı yazar, kova ondan ÖNCE var olmalı.
    5. supabase/migrations/*.sql, ad sırasıyla (tests/db/ortam.mjs ile
       aynı sıra; veritabanı testleri de şemayı böyle kurar).
    6. Ortam işareti: arvolab_test şeması (API'ye açık değil) ve yalnızca
       servis rolünün çağırabildiği public.arvolab_test_ortami() — sentetik
       veri betiği bunu görmeden yazmaz. Üretimde bu fonksiyon YOK.
    7. İsteğe bağlı (--tohumlar): supabase/seeds/*.sql (kamuya açık
       akademik birim listesi; kişisel veri yok).
    8. Özet: tablo, politika ve fonksiyon sayıları.

  Gerekenler: psql (PostgreSQL istemcisi), Node 22+.
  Ortam: SUPABASE_DB_URL (TEST projesinin bağlantı adresi; parola içerir —
  yalnızca kendi terminalinizde, dosyaya yazmayın), ARVOLAB_TEST_SUPABASE_REF,
  ARVOLAB_URETIM_SUPABASE_REF.

  Kullanım:  node scripts/test-ortami/kur.mjs [--tohumlar]
*/
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { hedefDenetimi } from "../supabase-hedef.mjs";

const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../supabase");

function durdur(mesaj) {
  console.error(`✗ ${mesaj}`);
  process.exit(1);
}

const denetim = hedefDenetimi(["--tur", "sema-kurulumu"], process.env);
if (denetim.tur !== "izin") durdur(`Kurulum durduruldu: ${denetim.mesaj}`);
console.log(`✓ Hedef test projesi: ${denetim.ref}`);

const psql = (argumanlar, girdi) => {
  const s = spawnSync("psql", [process.env.SUPABASE_DB_URL, "-v", "ON_ERROR_STOP=1", "-X", "-q", ...argumanlar], { encoding: "utf8", input: girdi });
  if (s.error) durdur(`psql çalıştırılamadı: ${s.error.message}`);
  if (s.status !== 0) durdur(`psql hata verdi:\n${s.stderr.slice(0, 4000)}`);
  return s.stdout.trim();
};

const dolu = psql(["-t", "-A", "-c", "select to_regclass('public.academic_projects') is not null"]);
if (dolu === "t") durdur("Veritabanı boş değil (academic_projects var). Kurulum yalnızca boş bir test projesine yapılır.");

const dosyalar = [
  path.join(KOK, "schema.sql"),
  ...readdirSync(path.join(KOK, "migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => path.join(KOK, "migrations", f)),
];

console.log("• schema.sql");
psql(["-f", dosyalar[0]]);
console.log("• project-files kovası (özel)");
psql(["-c", "insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false) on conflict (id) do nothing"]);
for (const f of dosyalar.slice(1)) {
  console.log(`• ${path.basename(f)}`);
  psql(["-1", "-f", f]);
}

console.log("• ortam işareti");
psql(
  ["-1"],
  `create schema if not exists arvolab_test;
   revoke all on schema arvolab_test from public, anon, authenticated;
   create table if not exists arvolab_test.ortam_isareti (deger text primary key check (deger = 'test'), kuruldu timestamptz not null default now());
   insert into arvolab_test.ortam_isareti (deger) values ('test') on conflict do nothing;
   create or replace function public.arvolab_test_ortami() returns text
     language sql stable security definer set search_path = arvolab_test, pg_temp
     as $$ select deger from arvolab_test.ortam_isareti limit 1 $$;
   revoke all on function public.arvolab_test_ortami() from public, anon, authenticated;
   grant execute on function public.arvolab_test_ortami() to service_role;`,
);

if (process.argv.includes("--tohumlar")) {
  for (const f of readdirSync(path.join(KOK, "seeds")).filter((f) => f.endsWith(".sql")).sort()) {
    console.log(`• tohum: ${f}`);
    psql(["-1", "-f", path.join(KOK, "seeds", f)]);
  }
}

const ozet = psql(
  ["-t", "-A", "-F", " | ", "-c",
   `select
      (select count(*) from pg_tables where schemaname = 'public') as tablo,
      (select count(*) from pg_policies where schemaname = 'public') as politika,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as fonksiyon,
      (select count(*) from storage.buckets where id = 'project-files') as kova`],
);
console.log(`✓ Kurulum tamam. tablo | politika | fonksiyon | kova = ${ozet}`);
console.log("  Sıradaki adım: node scripts/test-ortami/sentetik-veri.mjs (docs/test-ortami.md).");
