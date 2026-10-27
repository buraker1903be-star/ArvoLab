// Doçentlik: hedef puanlar, ortak yazarlık, belge ve doktora tarihi
// (migration 20261027081037).
//
// Hedefler kriterlerle aynı kapsam kuralında: genel liste iç ekipte,
// kurum listesi kurum yöneticisinde. Doktora tarihi ve belge yolu kişiye
// ait. Süzgeçsiz UPDATE/DELETE: hangi satıra dokunulabildiğini yalnızca
// politika belirlesin (puanlama-kriterleri-kuruma-ait.test.mjs).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-00000000a101";
const YONETICI_A = "00000000-0000-4000-8000-00000000a102";
const AKADEMISYEN_A = "00000000-0000-4000-8000-00000000a103";
const YONETICI_B = "00000000-0000-4000-8000-00000000a104";
const KURUM_A = "00000000-0000-4000-8000-00000000b101";
const KURUM_B = "00000000-0000-4000-8000-00000000b102";
const KRITER = "00000000-0000-4000-8000-00000000c101";

let db;
before(async () => {
  db = await veritabani();
});

const satirlar = async (sql, p = []) => (await db.query(sql, p)).rows;

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${YONETICI_A}', 'ya@x.co'), ('${AKADEMISYEN_A}', 'aa@x.co'), ('${YONETICI_B}', 'yb@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_B}' where id = '${YONETICI_B}';
    update public.profiles set role = 'expert', organization_id = '${KURUM_A}' where id = '${AKADEMISYEN_A}';
    insert into public.scoring_criteria (id, code, label, points_per_unit, baslica_yazar_katsayisi, diger_yazar_katsayisi)
      values ('${KRITER}', 'A1', 'Makale', 20, 0.8, 0.5);
    insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values
      (null, null, 100), ('${KURUM_A}', null, 120), ('${KURUM_B}', 'Makaleler', 40);
  `);
}

describe("doçentlik hedefleri", () => {
  test("akademisyen genel ve kendi kurumunun hedefini görür, başka kurumunkini görmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", AKADEMISYEN_A);
      const gorunen = await satirlar(`select organization_id, asgari_puan from public.docentlik_hedefleri order by asgari_puan`);
      assert.deepEqual(gorunen.map((r) => Number(r.asgari_puan)), [100, 120]);
    }));

  test("kurum yöneticisi yalnızca kendi kurumunun hedefini değiştirir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      const { affectedRows } = await db.query(`update public.docentlik_hedefleri set asgari_puan = 999`);
      assert.equal(affectedRows, 1, "genel ve B kurumunun hedefi değişmemeli");
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values (null, 'Atıflar', 10)`,
        [], /row-level security/);
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values ('${KURUM_B}', 'Atıflar', 10)`,
        [], /row-level security/);
      await db.query(`insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values ('${KURUM_A}', 'Atıflar', 10)`);
    }));

  test("akademisyen hedef yazamaz ve silemez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", AKADEMISYEN_A);
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values ('${KURUM_A}', null, 1)`,
        [], /row-level security/);
      const { affectedRows } = await db.query(`delete from public.docentlik_hedefleri`);
      assert.equal(affectedRows, 0);
    }));

  test("iç ekip genel hedefi değiştirir; aynı kapsamda aynı grup iki kez açılmaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      await db.query(`update public.docentlik_hedefleri set asgari_puan = 110 where organization_id is null and grup is null`);
      await reddedilir(db,
        `insert into public.docentlik_hedefleri (organization_id, grup, asgari_puan) values (null, null, 50)`,
        [], /duplicate key|unique/);
    }));
});

describe("doçentlik kaydı ve doktora tarihi", () => {
  test("faaliyet ortak yazar bilgisi, tarih ve kendi klasöründe belgeyle yazılır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", AKADEMISYEN_A);
      await db.query(
        `insert into public.academic_score_entries
           (owner_id, criteria_id, title, unit_count, computed_points, yazar_sayisi, baslica_yazar, paylasim_katsayisi, faaliyet_tarihi, belge_yolu)
         values ($1, $2, 'Ortak makale', 1, 10, 3, false, 0.5, '2024-05-01', $3)`,
        [AKADEMISYEN_A, KRITER, `${AKADEMISYEN_A}/docentlik/kanit.pdf`]);
      const [k] = await satirlar(`select computed_points, yazar_sayisi from public.academic_score_entries`);
      assert.equal(Number(k.computed_points), 10);
      assert.equal(k.yazar_sayisi, 3);
    }));

  test("belge yolu başkasının klasörünü gösteremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", AKADEMISYEN_A);
      await reddedilir(db,
        `insert into public.academic_score_entries (owner_id, criteria_id, title, unit_count, computed_points, belge_yolu)
         values ($1, $2, 'x', 1, 20, $3)`,
        [AKADEMISYEN_A, KRITER, `${YONETICI_A}/docentlik/kanit.pdf`], /check constraint/);
    }));

  test("doktora tarihini yalnızca sahibi okur ve yazar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", AKADEMISYEN_A);
      await db.query(`insert into public.docentlik_profili (doktora_tarihi) values ('2020-06-15')`);
      assert.equal((await satirlar(`select 1 from public.docentlik_profili`)).length, 1);
      await rol(db, "authenticated", YONETICI_A);
      assert.equal((await satirlar(`select 1 from public.docentlik_profili`)).length, 0);
      await reddedilir(db,
        `insert into public.docentlik_profili (owner_id, doktora_tarihi) values ('${AKADEMISYEN_A}', '1999-01-01')`,
        [], /row-level security|duplicate key/);
    }));

  test("katsayı 1'den büyük olamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      await reddedilir(db, `update public.scoring_criteria set diger_yazar_katsayisi = 1.5`, [], /check constraint/);
    }));
});
