// Test projesi kurulumunun migration geçmişi (Durak 0, 05.11.2026).
// Eskiden kurulum betiği migration'ları uyguluyor ama Supabase CLI'ın geçmiş
// tablosuna yazmıyordu: sonraki `db:push:test` 104 migration'ın hepsini
// yeniden uygulamaya kalkıp ilk `create table`'da düşerdi. Burada GERÇEK
// kurulum çekirdeği (kurulum.mjs → kur) izole bir PGlite'ta çalışır; hiçbir
// Supabase projesine bağlanılmaz.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { kabukVeritabani } from "./ortam.mjs";
import {
  bekleyenMigrationlar,
  gecmisKaydiSql,
  GECMIS_SURUMLERI_SQL,
  kur,
  migrationKimligi,
  migrationListesi,
  yereldeOlmayanSurumler,
} from "../../scripts/test-ortami/kurulum.mjs";

const KOK = path.resolve(import.meta.dirname, "../../supabase");
const yerel = migrationListesi(readdirSync(path.join(KOK, "migrations")));

/* kur.mjs'in psql yürütücüsünün PGlite karşılığı: dosya + geçmiş kaydı TEK işlemde. */
function pgliteYurutucu(db) {
  const tekIslem = async (metin) => {
    await db.exec("begin");
    try {
      await db.exec(metin);
      await db.exec("commit");
    } catch (hata) {
      await db.exec("rollback");
      throw hata;
    }
  };
  return {
    sorgu: async (sql) => (await db.query(sql, [], { rowMode: "array" })).rows.map((r) => (typeof r[0] === "boolean" ? (r[0] ? "t" : "f") : String(r[0]))),
    dosya: async (yol, ekSql) => tekIslem(`${readFileSync(yol, "utf8")}\n;\n${ekSql ?? ""}`),
    sql: async (metin, ayri) => (ayri ? tekIslem(metin) : db.exec(metin)),
  };
}

let db;
let sonuc;
before(async () => {
  db = await kabukVeritabani();
  sonuc = await kur(pgliteYurutucu(db), { kok: KOK, gunluk: () => {} });
});

test("her migration geçmişe yazıldı; sayı dosya sayısıyla birebir (en az 104)", async () => {
  assert.ok(yerel.length >= 104, `beklenen en az 104 migration, bulunan ${yerel.length}`);
  assert.equal(sonuc.migrationSayisi, yerel.length);
  assert.equal(sonuc.gecmisSayisi, yerel.length);
  const gecmis = (await db.query(GECMIS_SURUMLERI_SQL)).rows.map((r) => r.version);
  assert.deepEqual(gecmis, yerel.map((m) => m.surum));
});

test("kurulumdan sonra `db push`'un uygulayacağı migration YOK; fazladan sürüm de yok", async () => {
  const gecmis = (await db.query(GECMIS_SURUMLERI_SQL)).rows.map((r) => r.version);
  assert.deepEqual(bekleyenMigrationlar(yerel, gecmis), []);
  assert.deepEqual(yereldeOlmayanSurumler(yerel, gecmis), []);
});

test("sonradan eklenen bir migration yalnızca KENDİSİ bekleyen görünür", async () => {
  const gecmis = (await db.query(GECMIS_SURUMLERI_SQL)).rows.map((r) => r.version);
  const yeni = migrationKimligi("29991231000000_yeni_ozellik.sql");
  assert.deepEqual(bekleyenMigrationlar([...yerel, yeni], gecmis), [yeni]);
});

test("geçmiş kaydı yeniden yazılabilir (aynı sürüm ikinci kez eklenmez)", async () => {
  await db.exec(gecmisKaydiSql(yerel[0]));
  const { rows } = await db.query("select count(*)::int as n from supabase_migrations.schema_migrations");
  assert.equal(rows[0].n, yerel.length);
});

test("dolu veritabanına ikinci kurulum reddedilir ve hiçbir migration yeniden uygulanmaz", async () => {
  await assert.rejects(() => kur(pgliteYurutucu(db), { kok: KOK, gunluk: () => {} }), /boş değil/);
  const { rows } = await db.query("select count(*)::int as n from supabase_migrations.schema_migrations");
  assert.equal(rows[0].n, yerel.length);
});

test("ortam işareti kuruldu ve yalnızca servis rolüne açık", async () => {
  const { rows } = await db.query("select public.arvolab_test_ortami() as d");
  assert.equal(rows[0].d, "test");
  const yetki = await db.query(
    "select has_function_privilege('anon', 'public.arvolab_test_ortami()', 'execute') as anon, has_function_privilege('authenticated', 'public.arvolab_test_ortami()', 'execute') as auth, has_function_privilege('service_role', 'public.arvolab_test_ortami()', 'execute') as servis",
  );
  assert.deepEqual(yetki.rows[0], { anon: false, auth: false, servis: true });
});

test("migration adı denetimi: CLI desenine uymayan ad ya da çift sürüm reddedilir", () => {
  assert.deepEqual(migrationKimligi("20260924100000_project_files_bucket_limits.sql"), { surum: "20260924100000", ad: "project_files_bucket_limits", dosya: "20260924100000_project_files_bucket_limits.sql" });
  assert.equal(migrationKimligi("ozel.sql"), null);
  assert.throws(() => migrationListesi(["ozel.sql"]), /desenine uymuyor/);
  assert.throws(() => migrationListesi(["1_a.sql", "1_b.sql"]), /Aynı sürüm/);
});

test("migration ile geçmiş kaydı aynı işlemde: migration düşerse kaydı da yazılmaz", async () => {
  const bos = await kabukVeritabani();
  const vt = pgliteYurutucu(bos);
  await vt.sql("create schema if not exists supabase_migrations; create table supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);", true);
  const sahte = path.join(import.meta.dirname, "../fixtures/bozuk-migration.sql");
  await assert.rejects(() => vt.dosya(sahte, gecmisKaydiSql({ surum: "1", ad: "bozuk" })));
  const { rows } = await bos.query("select count(*)::int as n from supabase_migrations.schema_migrations");
  assert.equal(rows[0].n, 0);
});
