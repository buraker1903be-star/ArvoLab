// Kâğıt boyutu (migration 20261029115836).
//
// Mevcut ve yeni metinler A4 başlar (bütün eski belgeler A4'te dizildi);
// öğrenci kendi metnini Letter yapabilir; listede olmayan değer reddedilir.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000f1";
const TEZ = "00000000-0000-4000-8000-0000000000f2";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type) values ('${TEZ}', '${OGRENCI}', 'Tez', 'thesis');
    insert into public.project_manuscripts (project_id, content, updated_by) values ('${TEZ}', '{"type":"doc"}'::jsonb, '${OGRENCI}');
  `);
}

const kagit = async () => (await db.query(`select page_size from public.project_manuscripts where project_id = $1`, [TEZ])).rows[0].page_size;

describe("kâğıt boyutu", () => {
  test("varsayılan A4", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await kagit(), "a4");
    }));

  test("öğrenci kendi metnini US Letter yapabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.project_manuscripts set page_size = 'letter' where project_id = $1`, [TEZ]);
      await rol(db, "postgres");
      assert.equal(await kagit(), "letter");
    }));

  test("listede olmayan boyut reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await reddedilir(db, `update public.project_manuscripts set page_size = 'legal' where project_id = $1`, [TEZ], /check constraint/);
    }));
});
