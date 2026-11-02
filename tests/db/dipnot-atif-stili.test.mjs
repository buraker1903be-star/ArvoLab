// Dipnot (klasik) atıf stili (migration 20261102151330).
//
// Çalışma ve kılavuz dipnot stilini saklayabilmeli; listede olmayan değer yine
// reddedilir (kısıt düşürülüp yeniden kuruluyor — boşta kalmamalı). Stil
// değişince giden bildirim "dipnot" değil "Dipnot (klasik)" yazmalı; eski stiller kısıttan düşmemeli.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000f1";
const UNI = "00000000-0000-4000-8000-0000000000f2";
const PROJE = "00000000-0000-4000-8000-0000000000f3";

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

describe("Dipnot atıf stili", () => {
  test("öğrenci çalışmasının stilini dipnot yapabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.academic_projects set citation_style = 'dipnot' where id = $1`, [PROJE]);
      await rol(db, "postgres");
      const { rows } = await db.query(`select citation_style from public.academic_projects where id = $1`, [PROJE]);
      assert.equal(rows[0].citation_style, "dipnot");
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

  test("kısıt yeniden kurulurken eski stiller düşmedi", () =>
    islem(db, async () => {
      await tohum();
      for (const stil of ["apa7", "harvard", "vancouver", "chicago", "ieee", "mla"]) {
        await db.query(`update public.academic_projects set citation_style = $2 where id = $1`, [PROJE, stil]);
      }
      await db.query(
        `insert into public.thesis_guidelines (university_id, university_name, citation_style) values ($1, 'X', 'dipnot')`,
        [UNI],
      );
    }));

  test("bildirim etiketi", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      const { rows } = await db.query(`select public.citation_style_label('dipnot') as ad`);
      assert.equal(rows[0].ad, "Dipnot (klasik)");
    }));
});
