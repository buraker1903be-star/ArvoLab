// Harvard atıf stili (migration 20261029113842).
//
// Çalışma ve kılavuz Harvard'ı saklayabilmeli; listede olmayan değer yine
// reddedilir (kısıt düşürülüp yeniden kuruluyor — boşta kalmamalı). Stil
// değişince giden bildirim "harvard" değil "Harvard" yazmalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000e1";
const UNI = "00000000-0000-4000-8000-0000000000e2";
const PROJE = "00000000-0000-4000-8000-0000000000e3";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co');
    insert into public.universities (id, name, university_type) values ('${UNI}', 'X University', 'devlet');
    insert into public.academic_projects (id, owner_id, university_id, title, project_type, citation_style)
      values ('${PROJE}', '${OGRENCI}', '${UNI}', 'My thesis', 'thesis', 'apa7');
  `);
}

describe("Harvard atıf stili", () => {
  test("öğrenci çalışmasının stilini Harvard yapabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.academic_projects set citation_style = 'harvard' where id = $1`, [PROJE]);
      await rol(db, "postgres");
      const { rows } = await db.query(`select citation_style from public.academic_projects where id = $1`, [PROJE]);
      assert.equal(rows[0].citation_style, "harvard");
    }));

  test("listede olmayan stil hâlâ reddedilir (çalışma ve kılavuz)", () =>
    islem(db, async () => {
      await tohum();
      await reddedilir(db, `update public.academic_projects set citation_style = 'oxford' where id = $1`, [PROJE], /check constraint/);
      await reddedilir(
        db,
        `insert into public.thesis_guidelines (university_id, university_name, citation_style) values ($1, 'X', 'oxford')`,
        [UNI],
        /check constraint/,
      );
    }));

  test("bildirim etiketi", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      const { rows } = await db.query(`select public.citation_style_label('harvard') as ad`);
      assert.equal(rows[0].ad, "Harvard");
    }));
});
