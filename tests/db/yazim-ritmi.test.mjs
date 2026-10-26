// Yazım ritmi (migration 20261026075358): gün başına son kelime sayısı,
// pencere öncesi taban ve RLS.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000301";
const BASKA = "00000000-0000-4000-8000-000000000302";
const PROJE = "00000000-0000-4000-8000-0000000003b1";

let db;
before(async () => {
  db = await veritabani();
});

const gunOnce = (n, saat) => `((now() at time zone 'Europe/Istanbul')::date - ${n} + time '${saat}') at time zone 'Europe/Istanbul'`;

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${BASKA}', 'b@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type) values ('${PROJE}', '${OGRENCI}', 'Tez', 'thesis');
    insert into public.project_manuscript_versions (project_id, content, word_count, created_at) values
      ('${PROJE}', '{}', 1000, ${gunOnce(30, "10:00")}),
      ('${PROJE}', '{}', 1200, ${gunOnce(2, "09:00")}),
      ('${PROJE}', '{}', 1500, ${gunOnce(2, "23:30")}),
      ('${PROJE}', '{}', 1450, ${gunOnce(0, "08:00")});
  `);
}

test("taban + gün başına günün SON sayısı", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await db.query(`select kelime from public.yazim_ritmi($1, 14)`, [PROJE]);
    assert.deepEqual(rows.map((r) => r.kelime), [1000, 1500, 1450]);
  }));

test("görülemeyen çalışmada satır yok", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", BASKA);
    const { rows } = await db.query(`select * from public.yazim_ritmi($1, 14)`, [PROJE]);
    assert.equal(rows.length, 0);
  }));
