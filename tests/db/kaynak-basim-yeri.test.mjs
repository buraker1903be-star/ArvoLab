// Kaynağın basım yeri (migration 20261102175708).
//
// Sahibi kendi kaynağına yazabilmeli (meşru akış: kaynak formu, atıf
// penceresi, RIS/BibTeX içe aktarma); başkasının kaynağına yazamamalı (RLS
// değişmedi); 200 karakterden uzun değer reddedilir.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000000a1";
const YABANCI = "00000000-0000-4000-8000-0000000000a2";
const KAYNAK = "00000000-0000-4000-8000-0000000000a3";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 's@x.co'), ('${YABANCI}', 'y@x.co');
    insert into public.literature_sources (id, owner_id, title, source_type) values ('${KAYNAK}', '${SAHIP}', 'Kitap', 'book');
  `);
}

describe("kaynak basım yeri", () => {
  test("sahibi basım yerini yazar ve okur", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(`update public.literature_sources set publication_place = 'Ankara' where id = $1`, [KAYNAK]);
      const { rows } = await db.query(`select publication_place from public.literature_sources where id = $1`, [KAYNAK]);
      assert.equal(rows[0].publication_place, "Ankara");
    }));

  test("başkasının kaynağına yazılamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      await db.query(`update public.literature_sources set publication_place = 'İzmir' where id = $1`, [KAYNAK]);
      await rol(db, "postgres");
      const { rows } = await db.query(`select publication_place from public.literature_sources where id = $1`, [KAYNAK]);
      assert.equal(rows[0].publication_place, null);
    }));

  test("200 karakterden uzun değer reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await reddedilir(db, `update public.literature_sources set publication_place = repeat('a', 201) where id = $1`, [KAYNAK], /check constraint/);
    }));
});
