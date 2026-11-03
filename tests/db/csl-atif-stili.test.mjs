// CSL atıf stilleri (migration 20261103162214).
//
// Çalışma ve kılavuz "csl:<kod>:<ad>" saklayabilmeli; desene uymayan değer
// (bilinmeyen kod, büyük harf, boşluk, kodsuz) yine reddedilir. Yerleşik
// stiller kısıttan düşmemeli; bildirim etiketi ham kimliği yazmamalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000c1";
const UNI = "00000000-0000-4000-8000-0000000000c2";
const PROJE = "00000000-0000-4000-8000-0000000000c3";

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

describe("CSL atıf stilleri", () => {
  test("öğrenci çalışmasının stilini bir CSL stili yapabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.academic_projects set citation_style = 'csl:s:american-medical-association' where id = $1`, [PROJE]);
      await rol(db, "postgres");
      const { rows } = await db.query(`select citation_style from public.academic_projects where id = $1`, [PROJE]);
      assert.equal(rows[0].citation_style, "csl:s:american-medical-association");
      await db.query(
        `insert into public.thesis_guidelines (university_id, university_name, citation_style) values ($1, 'X', 'csl:a:elsevier-harvard')`,
        [UNI],
      );
    }));

  test("desene uymayan değer reddedilir", () =>
    islem(db, async () => {
      await tohum();
      for (const deger of ["csl:x:apa", "csl:a:APA", "csl:a:a b", "csl::apa", "csl:a:", "oxford"]) {
        await reddedilir(db, `update public.academic_projects set citation_style = $2 where id = $1`, [PROJE, deger], /check constraint/);
      }
    }));

  test("yerleşik stiller kısıttan düşmedi", () =>
    islem(db, async () => {
      await tohum();
      for (const stil of ["apa7", "harvard", "vancouver", "chicago", "ieee", "mla", "dipnot"]) {
        await db.query(`update public.academic_projects set citation_style = $2 where id = $1`, [PROJE, stil]);
      }
    }));

  test("bildirim etiketi", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      const { rows } = await db.query(
        `select public.citation_style_label('csl:s:american-medical-association') as csl, public.citation_style_label('dipnot') as dipnot`,
      );
      assert.equal(rows[0].csl, "American Medical Association");
      assert.equal(rows[0].dipnot, "Dipnot (klasik)");
    }));
});
