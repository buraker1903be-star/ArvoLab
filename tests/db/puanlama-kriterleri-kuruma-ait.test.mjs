// Puanlama kriterleri kuruma ait (migration 20260924100032).
//
// Eskiden tablo tekti ve politika çıplak has_role(...) idi: HERHANGİ bir
// kurumun Akademik Yöneticisi bütün kurumların ve bütün bireysel abonelerin
// doçentlik puanlarını değiştirebiliyordu. Ekran ise kullanıcıya
// "kurumunuzun girdiği kriterler" diyordu.
//
// Testler süzgeçsiz yazıldı: süzgeçli bir UPDATE, SELECT politikasını da
// işletir ve gerçekte yazma politikasını sınamaz (bkz.
// calisma-yazma-kurumla-sinirli.test.mjs).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-00000000d001";
const YONETICI_A = "00000000-0000-4000-8000-00000000d002";
const OGRENCI_A = "00000000-0000-4000-8000-00000000d003";
const YONETICI_B = "00000000-0000-4000-8000-00000000d004";
const BIREYSEL = "00000000-0000-4000-8000-00000000d005";

const KURUM_A = "00000000-0000-4000-8000-00000000e001";
const KURUM_B = "00000000-0000-4000-8000-00000000e002";

const GENEL = "00000000-0000-4000-8000-00000000f001";
const KRITER_A = "00000000-0000-4000-8000-00000000f002";
const KRITER_B = "00000000-0000-4000-8000-00000000f003";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'kurucu@x.co'), ('${YONETICI_A}', 'ya@x.co'), ('${OGRENCI_A}', 'oa@x.co'),
      ('${YONETICI_B}', 'yb@x.co'), ('${BIREYSEL}', 'bi@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_B}' where id = '${YONETICI_B}';
    update public.profiles set organization_id = '${KURUM_A}' where id = '${OGRENCI_A}';
    insert into public.scoring_criteria (id, code, label, points_per_unit, organization_id) values
      ('${GENEL}', 'A1', 'ÜAK genel', 12, null),
      ('${KRITER_A}', 'A1', 'A kurumunun kriteri', 20, '${KURUM_A}'),
      ('${KRITER_B}', 'A1', 'B kurumunun kriteri', 30, '${KURUM_B}');
  `);
}

const gorunen = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  const { rows } = await db.query(`select id from public.scoring_criteria order by label`);
  return rows.map((r) => r.id);
};

/* Süzgeçsiz: hangi satıra dokunulabildiğini yalnızca politika belirler. */
const hepsiniEz = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  return (await db.query(`update public.scoring_criteria set points_per_unit = 999`)).affectedRows;
};

const puan = async (kriter) => {
  await rol(db, "postgres");
  const { rows } = await db.query(`select points_per_unit from public.scoring_criteria where id = $1`, [kriter]);
  return Number(rows[0].points_per_unit);
};

describe("puanlama kriterleri kuruma ait", () => {
  test("kurum üyesi genel listeyi ve kendi kurumununkini görür", () =>
    islem(db, async () => {
      await tohum();
      const gorulen = await gorunen(OGRENCI_A);
      assert.deepEqual(gorulen.sort(), [GENEL, KRITER_A].sort());
    }));

  test("bireysel abone yalnızca genel listeyi görür", () =>
    islem(db, async () => {
      await tohum();
      assert.deepEqual(await gorunen(BIREYSEL), [GENEL]);
    }));

  test("iç ekip hepsini görür", () =>
    islem(db, async () => {
      await tohum();
      assert.equal((await gorunen(KURUCU)).length, 3);
    }));

  test("Akademik Yönetici yalnızca kendi kurumunun kriterini değiştirebiliyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await hepsiniEz(YONETICI_A), 1);
      assert.equal(await puan(KRITER_A), 999);
      assert.equal(await puan(KRITER_B), 30);
      // Genel liste artık bir kurumun yöneticisine kapalı.
      assert.equal(await puan(GENEL), 12);
    }));

  test("Akademik Yönetici genel listeye kriter ekleyemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await reddedilir(db,
        `insert into public.scoring_criteria (code, label, points_per_unit, organization_id)
         values ('Z9', 'Genel olmaya çalışıyor', 5, null)`,
        [], /row-level security/i);
    }));

  test("Akademik Yönetici kriteri başka kuruma taşıyamıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await reddedilir(db,
        `update public.scoring_criteria set organization_id = $1`,
        [KURUM_B], /row-level security/i);
    }));

  test("iç ekip genel listeyi düzenleyebiliyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await hepsiniEz(KURUCU), 3);
      assert.equal(await puan(GENEL), 999);
    }));

  /*
    Aynı kod iki kurumda birlikte durabilmeli (tohum bunu zaten kuruyor),
    ama GENEL listede iki kez açılamamalı: NULLS NOT DISTINCT olmasaydı
    Postgres iki NULL kurumu farklı sayar ve kaçak geçerdi.
  */
  test("genel listede aynı kod iki kez açılamıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await reddedilir(db,
        `insert into public.scoring_criteria (code, label, points_per_unit, organization_id)
         values ('A1', 'İkinci genel A1', 7, null)`,
        [], /duplicate key|unique/i);
    }));
});
