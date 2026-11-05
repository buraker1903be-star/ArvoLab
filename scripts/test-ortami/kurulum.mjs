/*
  TEST PROJESİ KURULUMU — ÇEKİRDEK (Durak 0, 05.11.2026).
  kur.mjs hedef denetimini yapar, sonra buradaki `kur()`'u gerçek psql ile
  çalıştırır. Çekirdek ayrı, çünkü aynı adımlar izole bir veritabanında da
  sınanabilmeli (tests/db/test-ortami-kurulum.test.mjs). Hedef denetimi
  BURADA YOK: bu modülü doğrudan çağıran bir betik denetimi atlamış olur;
  üretime giden tek yol kur.mjs'dir ve denetim oradadır.

  MİGRATION GEÇMİŞİ. Eskiden kurulum migration'ları doğrudan uyguluyor ama
  Supabase CLI'ın geçmiş tablosuna (supabase_migrations.schema_migrations)
  yazmıyordu. Sonraki `npm run db:push:test` tabloyu boş görüp 104
  migration'ın HEPSİNİ yeniden uygulamaya kalkar ve ilk `create table`'da
  düşerdi. Artık her migration, geçmiş kaydıyla AYNI işlemde uygulanır:
  yarıda kalan bir kurulumda "uygulandı" yazıp uygulanmamış migration
  olmaz, ya da tersi.

  Sürüm/ad ayrımı CLI ile aynı: `<rakamlar>_<ad>.sql`. CLI `db push`
  sırasında yalnızca SÜRÜMLERİ karşılaştırır; `statements` boş bırakılır
  (CLI'ın kendi yazdığı satırlarda dosyanın ifadeleri durur, karşılaştırmada
  kullanılmaz).
*/
import { readdirSync } from "node:fs";
import path from "node:path";

/* Supabase CLI'ın migration dosya adı deseni. */
const MIGRATION_ADI = /^([0-9]+)_(.*)\.sql$/;

/** "20260924100000_project_files_bucket_limits.sql" → { surum, ad, dosya }. Desene uymayan ad için null. */
export function migrationKimligi(dosyaAdi) {
  const m = MIGRATION_ADI.exec(dosyaAdi);
  return m ? { surum: m[1], ad: m[2], dosya: dosyaAdi } : null;
}

/**
 * Klasördeki .sql dosyalarından sıralı migration listesi. CLI'ın atlayacağı
 * (desene uymayan) ya da aynı sürümü taşıyan dosya varsa FIRLATIR: geçmişe
 * yanlış sürüm yazmak, push'un o dosyayı sonsuza dek "bekliyor" görmesi demek.
 */
export function migrationListesi(dosyaAdlari) {
  const liste = dosyaAdlari.filter((f) => f.endsWith(".sql")).sort().map((f) => {
    const k = migrationKimligi(f);
    if (!k) throw new Error(`Migration adı Supabase desenine uymuyor: ${f}`);
    return k;
  });
  const gorulen = new Set();
  for (const m of liste) {
    if (gorulen.has(m.surum)) throw new Error(`Aynı sürüm iki dosyada: ${m.surum}`);
    gorulen.add(m.surum);
  }
  return liste;
}

/** `db push`'un uygulamaya kalkacağı migration'lar: yerelde olup geçmişte olmayanlar. */
export function bekleyenMigrationlar(yerel, uygulanmisSurumler) {
  const uygulanmis = new Set(uygulanmisSurumler);
  return yerel.filter((m) => !uygulanmis.has(m.surum));
}

/** Geçmişte olup yerelde olmayan sürümler: CLI bunu görünce push'u durdurur. */
export function yereldeOlmayanSurumler(yerel, uygulanmisSurumler) {
  const yerelSurumler = new Set(yerel.map((m) => m.surum));
  return uygulanmisSurumler.filter((s) => !yerelSurumler.has(s));
}

/* CLI'ın tablosunun çekirdek sütunları. CLI sonradan eksik sütunları (created_by, idempotency_key …) kendisi ekler. */
export const GECMIS_TABLOSU_SQL = `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);`;

const metin = (s) => `'${String(s).replaceAll("'", "''")}'`;

/** Tek migration'ın geçmiş kaydı. Yeniden çalıştırılabilir: aynı sürüm ikinci kez yazılmaz. */
export function gecmisKaydiSql(m) {
  return `insert into supabase_migrations.schema_migrations (version, name, statements) values (${metin(m.surum)}, ${metin(m.ad)}, '{}') on conflict (version) do nothing;`;
}

export const DOLU_MU_SQL = "select to_regclass('public.academic_projects') is not null";
export const GECMIS_SURUMLERI_SQL = "select version from supabase_migrations.schema_migrations order by version";

export const ORTAM_ISARETI_SQL = `create schema if not exists arvolab_test;
revoke all on schema arvolab_test from public, anon, authenticated;
create table if not exists arvolab_test.ortam_isareti (deger text primary key check (deger = 'test'), kuruldu timestamptz not null default now());
insert into arvolab_test.ortam_isareti (deger) values ('test') on conflict do nothing;
create or replace function public.arvolab_test_ortami() returns text
  language sql stable security definer set search_path = arvolab_test, pg_temp
  as $$ select deger from arvolab_test.ortam_isareti limit 1 $$;
revoke all on function public.arvolab_test_ortami() from public, anon, authenticated;
grant execute on function public.arvolab_test_ortami() to service_role;`;

export const OZET_SQL = `select
  (select count(*) from pg_tables where schemaname = 'public') as tablo,
  (select count(*) from pg_policies where schemaname = 'public') as politika,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as fonksiyon,
  (select count(*) from storage.buckets where id = 'project-files') as kova,
  (select count(*) from supabase_migrations.schema_migrations) as gecmis`;

/**
 * Kurulumun kendisi. `vt` bir yürütücü:
 *   sorgu(sql) → satırların İLK sütunu (string[])
 *   dosya(yol, ekSql?) → dosyayı (ve varsa ekSql'i) TEK işlemde uygular
 *   sql(metin, tekIslem?) → metni uygular
 * kur.mjs bunu psql ile, veritabanı testi PGlite ile sağlar.
 */
export async function kur(vt, { kok, tohumlar = false, gunluk = console.log } = {}) {
  const dolu = await vt.sorgu(DOLU_MU_SQL);
  if (dolu[0] === "t" || dolu[0] === "true" || dolu[0] === true) {
    throw new Error("Veritabanı boş değil (academic_projects var). Kurulum yalnızca boş bir test projesine yapılır.");
  }
  const migrationlar = migrationListesi(readdirSync(path.join(kok, "migrations")));

  gunluk("• schema.sql");
  await vt.dosya(path.join(kok, "schema.sql"));
  gunluk("• project-files kovası (özel)");
  await vt.sql("insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false) on conflict (id) do nothing");
  gunluk("• migration geçmişi tablosu");
  await vt.sql(GECMIS_TABLOSU_SQL, true);
  for (const m of migrationlar) {
    gunluk(`• ${m.dosya}`);
    await vt.dosya(path.join(kok, "migrations", m.dosya), gecmisKaydiSql(m));
  }

  gunluk("• ortam işareti");
  await vt.sql(ORTAM_ISARETI_SQL, true);

  if (tohumlar) {
    for (const f of readdirSync(path.join(kok, "seeds")).filter((f) => f.endsWith(".sql")).sort()) {
      gunluk(`• tohum: ${f}`);
      await vt.dosya(path.join(kok, "seeds", f));
    }
  }

  /* Son denetim: push'un yeniden uygulamaya kalkacağı tek bir migration kalmamalı. */
  const gecmis = await vt.sorgu(GECMIS_SURUMLERI_SQL);
  const bekleyen = bekleyenMigrationlar(migrationlar, gecmis);
  const fazla = yereldeOlmayanSurumler(migrationlar, gecmis);
  if (bekleyen.length || fazla.length) {
    throw new Error(`Migration geçmişi tutarsız: ${bekleyen.length} bekleyen, ${fazla.length} yerelde olmayan sürüm.`);
  }
  return { migrationSayisi: migrationlar.length, gecmisSayisi: gecmis.length };
}
