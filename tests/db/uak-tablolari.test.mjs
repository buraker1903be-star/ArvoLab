// ÜAK tabloları ve temel alan (migration 20261027083309).
//
// Yüklenen tabloyu yalnızca kurumun Yöneticisi ve iç ekip görür ve
// yönetir; akademisyen ve başka kurumun yöneticisi göremez. Kriter kodu
// artık kurum + temel alan içinde benzersiz: her alanın kendi "A1"i var.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const YONETICI_A = "00000000-0000-4000-8000-00000000a201";
const AKADEMISYEN_A = "00000000-0000-4000-8000-00000000a202";
const YONETICI_B = "00000000-0000-4000-8000-00000000a203";
const KURUM_A = "00000000-0000-4000-8000-00000000b201";
const KURUM_B = "00000000-0000-4000-8000-00000000b202";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'A'), ('${KURUM_B}', 'B');
    insert into auth.users (id, email) values ('${YONETICI_A}', 'ya@x.co'), ('${AKADEMISYEN_A}', 'aa@x.co'), ('${YONETICI_B}', 'yb@x.co');
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    update public.profiles set role = 'expert', organization_id = '${KURUM_A}' where id = '${AKADEMISYEN_A}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_B}' where id = '${YONETICI_B}';
  `);
}

const ekle = (alan) =>
  db.query(
    `insert into public.uak_tablolari (organization_id, temel_alan, donem, depo_yolu) values ($1, $2, '2026 Mart', 'x/uak/a.pdf')`,
    [KURUM_A, alan]);

describe("ÜAK tabloları", () => {
  test("kurum yöneticisi kendi kurumuna yükler; akademisyen ve başka kurum göremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await ekle("Sağlık Bilimleri");
      assert.equal((await db.query(`select 1 from public.uak_tablolari`)).rows.length, 1);
      await rol(db, "authenticated", AKADEMISYEN_A);
      assert.equal((await db.query(`select 1 from public.uak_tablolari`)).rows.length, 0);
      await reddedilir(db,
        `insert into public.uak_tablolari (organization_id, temel_alan, donem, depo_yolu) values ($1, 'Hukuk', '2026 Mart', 'x')`,
        [KURUM_A], /row-level security/);
      await rol(db, "authenticated", YONETICI_B);
      assert.equal((await db.query(`select 1 from public.uak_tablolari`)).rows.length, 0);
      await reddedilir(db,
        `insert into public.uak_tablolari (organization_id, temel_alan, donem, depo_yolu) values ($1, 'Hukuk', '2026 Mart', 'x')`,
        [KURUM_A], /row-level security/);
    }));

  test("aynı kurum ve temel alanda tek tablo", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await ekle("Hukuk");
      await reddedilir(db,
        `insert into public.uak_tablolari (organization_id, temel_alan, donem, depo_yolu) values ($1, 'Hukuk', '2026 Ekim', 'x')`,
        [KURUM_A], /duplicate key|unique/);
    }));

  test("aynı kod farklı temel alanlarda açılabilir, aynı alanda açılamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      const kriter = (alan) =>
        db.query(`insert into public.scoring_criteria (code, label, points_per_unit, organization_id, temel_alan) values ('A1', 'x', 10, $1, $2)`, [KURUM_A, alan]);
      await kriter("Hukuk");
      await kriter("Sağlık Bilimleri");
      await reddedilir(db,
        `insert into public.scoring_criteria (code, label, points_per_unit, organization_id, temel_alan) values ('A1', 'y', 5, $1, 'Hukuk')`,
        [KURUM_A], /duplicate key|unique/);
    }));

  test("asistan kaydı 'uak' yeteneğini kabul ediyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await db.query(`insert into public.ai_assistant_runs (user_id, capability, status) values ($1, 'uak', 'completed')`, [YONETICI_A]);
    }));
});

describe("tavan ve doktora sonrası hedef (20261027122336)", () => {
  test("aynı grupta bütün faaliyet ve doktora sonrası iki ayrı satır; sınırsız satır reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await db.query(`insert into public.docentlik_hedefleri (organization_id, temel_alan, grup, asgari_puan, azami_puan) values ($1, 'Hukuk', 'Atıf', null, 10)`, [KURUM_A]);
      await db.query(`insert into public.docentlik_hedefleri (organization_id, temel_alan, grup, asgari_puan, doktora_sonrasi) values ($1, 'Hukuk', 'Atıf', 5, true)`, [KURUM_A]);
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, temel_alan, grup, asgari_puan, doktora_sonrasi) values ($1, 'Hukuk', 'Atıf', 7, true)`,
        [KURUM_A], /duplicate key|unique/);
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, temel_alan, grup) values ($1, 'Hukuk', 'Ödül')`,
        [KURUM_A], /docentlik_hedefleri_sinir_var|check constraint/);
    }));

  test("kriter eşit bölüşüm işareti taşır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await db.query(`insert into public.scoring_criteria (code, label, points_per_unit, organization_id, esit_bolusum) values ('1.a', 'Makale', 30, $1, true)`, [KURUM_A]);
      const { rows } = await db.query(`select esit_bolusum from public.scoring_criteria where code = '1.a'`);
      assert.equal(rows[0].esit_bolusum, true);
    }));
});
