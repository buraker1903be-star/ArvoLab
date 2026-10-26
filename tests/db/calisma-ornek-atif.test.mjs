// Çalışmanın örnek atıfı (migration 20261026120339): öğrenci kendi
// çalışmasına yazar, başkasınınkine yazamaz; uzunluk sınırlı.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000601";
const BASKA = "00000000-0000-4000-8000-000000000602";
const TEZ = "00000000-0000-4000-8000-0000000006b1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${BASKA}', 'b@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type) values ('${TEZ}', '${OGRENCI}', 'Tez', 'thesis');
  `);
}

test("öğrenci kendi çalışmasına örnek atıf yazar", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(`update public.academic_projects set ornek_atif = '(Yılmaz, 2020: 14)' where id = $1`, [TEZ]);
    const { rows } = await db.query(`select ornek_atif from public.academic_projects where id = $1`, [TEZ]);
    assert.equal(rows[0].ornek_atif, "(Yılmaz, 2020: 14)");
    await reddedilir(db, `update public.academic_projects set ornek_atif = $2 where id = $1`, [TEZ, "x".repeat(301)], /check constraint/);
  }));

test("başkasının çalışmasına yazılamaz (satır görünmez, güncellenmez)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", BASKA);
    const { rows } = await db.query(`update public.academic_projects set ornek_atif = '(X, 2020)' where id = $1 returning id`, [TEZ]);
    assert.equal(rows.length, 0);
  }));
