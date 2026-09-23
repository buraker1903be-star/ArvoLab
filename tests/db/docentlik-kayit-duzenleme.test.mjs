// Doçentlik faaliyet kaydının düzenlenmesi (migration 20260924100023).
//
// Tabloda UPDATE ne grant'lenmişti ne de politikası vardı; ekrana düzenleme
// düğmesi konsaydı veritabanı sessizce reddederdi. Burada hem yeni yolun
// çalıştığı hem de açılan yolun yalnızca kayıt sahibine açıldığı sabitleniyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000000e1";
const BASKASI = "00000000-0000-4000-8000-0000000000e2";
const KURUM = "00000000-0000-4000-8000-0000000000e3";
const KRITER = "00000000-0000-4000-8000-0000000000e8";
const KAYIT = "00000000-0000-4000-8000-0000000000e9";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum({ lisans = null } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${SAHIP}', 'sahip@example.com'),
      ('${BASKASI}', 'baskasi@example.com');
    insert into public.scoring_criteria (id, code, label, points_per_unit)
      values ('${KRITER}', 'A1', 'SCI-E makale', 12);
    insert into public.academic_score_entries (id, owner_id, criteria_id, title, unit_count, computed_points)
      values ('${KAYIT}', '${SAHIP}', '${KRITER}', 'Makelae', 2, 24);
  `);
  if (lisans) {
    await db.exec(`
      insert into public.organizations (id, name, license_status, synced_at)
        values ('${KURUM}', 'Kurum', '${lisans}', now());
      update public.profiles set organization_id = '${KURUM}' where id = '${SAHIP}';
    `);
  }
}

describe("doçentlik kaydı düzenleme", () => {
  test("sahibi başlığı ve adedi düzeltebiliyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      const { rows } = await db.query(
        `update public.academic_score_entries
            set title = 'Makale', unit_count = 3, computed_points = 36
          where id = $1 returning id`,
        [KAYIT],
      );
      assert.equal(rows.length, 1);
      const satir = await tek(`select title, unit_count from public.academic_score_entries where id = $1`, [KAYIT]);
      assert.equal(satir.title, "Makale");
      assert.equal(Number(satir.unit_count), 3);
    }));

  test("başkasının kaydı düzenlenemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", BASKASI);
      const { rows } = await db.query(
        `update public.academic_score_entries set title = 'Benim artık' where id = $1 returning id`,
        [KAYIT],
      );
      // RLS USING satırı hiç göstermiyor: hata değil, SIFIR satır.
      assert.equal(rows.length, 0);
      await rol(db, "postgres");
      const satir = await tek(`select title from public.academic_score_entries where id = $1`, [KAYIT]);
      assert.equal(satir.title, "Makelae");
    }));

  /*
    WITH CHECK olmasaydı sahibi kaydı başkasının üzerine geçirebilirdi:
    RLS "kim yazabilir"i söyler, "neyi"yi söylemez. Ayrı bir tetikleyici
    yazmak yerine politikanın kendisine bırakıldı; burası o kararı sabitliyor.
  */
  test("kayıt başkasının üzerine geçirilemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await reddedilir(db,
        `update public.academic_score_entries set owner_id = $2 where id = $1`,
        [KAYIT, BASKASI], /row-level security/i);
    }));

  test("aboneliği biten düzenleyemiyor ama kendi kaydını silebiliyor", () =>
    islem(db, async () => {
      await tohum({ lisans: "past_due" });
      await rol(db, "authenticated", SAHIP);
      await reddedilir(db,
        `update public.academic_score_entries set unit_count = 99, computed_points = 1188 where id = $1`,
        [KAYIT], /Aboneliğiniz sona erdi/);
      // Silme bilerek kapının dışında: kendi verisini her zaman kaldırabilmeli.
      const { rows } = await db.query(`delete from public.academic_score_entries where id = $1 returning id`, [KAYIT]);
      assert.equal(rows.length, 1);
    }));
});
