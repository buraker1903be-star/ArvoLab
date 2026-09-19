// Veritabanı testlerinin ortamı: supabase/schema.sql ve ardından
// supabase/migrations/*.sql (sırayla) PGlite'a kurulur; üstüne Supabase'in
// sağladığı parçalar (roller, auth, storage) taklit edilir. Supabase'in yeni
// tablo ve fonksiyonları anon/authenticated'a açan varsayılan yetkileri de
// taklit ediliyor: bir migration bunu kapatmayı unutursa testte görünsün.
// (ArvoRandevu/tests/db/ortam.mjs'in bu projeye uyarlanmışı.)
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

const KOK = path.resolve(import.meta.dirname, "../../supabase");

const SUPABASE_KABUGU = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema auth, extensions, public, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

/** schema.sql + bütün migration'lar uygulanmış, boş bir veritabanı. */
export async function veritabani() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_KABUGU);
  const dosyalar = [
    path.join(KOK, "schema.sql"),
    ...fs.readdirSync(path.join(KOK, "migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => path.join(KOK, "migrations", f)),
  ];
  for (const dosya of dosyalar) {
    try {
      await db.exec(fs.readFileSync(dosya, "utf8"));
    } catch (hata) {
      throw new Error(`${path.basename(dosya)}: ${hata.message}`);
    }
  }
  return db;
}

/** Tek işlem içinde rol değiştirerek ilerleyen akışlar; sonunda geri alınır. */
export async function islem(db, isle) {
  await db.exec("begin");
  try {
    return await isle();
  } finally {
    await db.exec("rollback");
  }
}

/** "postgres" = veritabanı sahibi (tohum ve doğrulama). */
export async function rol(db, ad, kullaniciId = null) {
  await db.exec("reset role");
  const claims = ad === "postgres" ? "" : JSON.stringify({ sub: kullaniciId ?? "", role: ad });
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
  if (ad !== "postgres") await db.exec(`set local role ${ad}`);
}

/** Sorgunun hata vermesini bekler; işlemi bozmadan (savepoint) döner. */
export async function reddedilir(db, sql, params, desen) {
  await db.exec("savepoint beklenen_hata");
  try {
    await db.query(sql, params);
  } catch (hata) {
    await db.exec("rollback to savepoint beklenen_hata");
    if (!desen.test(hata.message)) throw new Error(`Beklenmeyen hata: ${hata.message} (beklenen ${desen})`);
    return;
  }
  await db.exec("release savepoint beklenen_hata");
  throw new Error(`Hata bekleniyordu (${desen}), sorgu başarılı oldu: ${sql}`);
}
