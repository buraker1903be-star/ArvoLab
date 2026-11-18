// Çalışma başına belge dili (K1-A, migration 20261118122556). Kurallar:
// mevcut çalışmalar NULL kalır (toplu doldurma yok), yalnızca tr/en
// kabul edilir, sahibi kendi çalışmasında seçer ve seçimi kaldırabilir,
// yabancı kullanıcı değiştiremez (RLS).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000b1d01";
const YABANCI = "00000000-0000-4000-8000-0000000b1d02";
const TEZ = "00000000-0000-4000-8000-0000000b1db1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 's@x.co'), ('${YABANCI}', 'y@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type) values ('${TEZ}', '${SAHIP}', 'Tez', 'thesis');
  `);
}

describe("çalışma belge dili", () => {
  test("yeni sütun boş başlar: kayıt eklerken yazılmadıysa NULL (bugünkü türetme)", () =>
    islem(db, async () => {
      await tohum();
      const { rows } = await db.query(`select belge_dili from public.academic_projects where id = $1`, [TEZ]);
      assert.equal(rows[0].belge_dili, null);
    }));

  test("migration mevcut satırları doldurmuyor (update yok)", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261118122556_calisma_belge_dili.sql"), "utf8");
    const kod = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(kod, /\bupdate\b/i);
    assert.doesNotMatch(kod, /\bdefault\b/i);
  });

  test("sahibi tr/en seçer ve seçimi kaldırabilir; desteklenmeyen dil reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(`update public.academic_projects set belge_dili = 'en' where id = $1`, [TEZ]);
      assert.equal((await db.query(`select belge_dili from public.academic_projects where id = $1`, [TEZ])).rows[0].belge_dili, "en");
      await db.query(`update public.academic_projects set belge_dili = null where id = $1`, [TEZ]);
      assert.equal((await db.query(`select belge_dili from public.academic_projects where id = $1`, [TEZ])).rows[0].belge_dili, null);
      await reddedilir(db, `update public.academic_projects set belge_dili = 'de' where id = $1`, [TEZ], /belge_dili_check/);
      await reddedilir(db, `update public.academic_projects set belge_dili = 'diger' where id = $1`, [TEZ], /belge_dili_check/);
    }));

  test("yabancı kullanıcı başkasının çalışmasının dilini değiştiremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      await db.query(`update public.academic_projects set belge_dili = 'en' where id = $1`, [TEZ]);
      await rol(db, "postgres");
      assert.equal((await db.query(`select belge_dili from public.academic_projects where id = $1`, [TEZ])).rows[0].belge_dili, null);
    }));

  test("yeni çalışma seçilen dille oluşturulur", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      const { rows } = await db.query(
        `insert into public.academic_projects (owner_id, title, project_type, belge_dili) values ($1, 'Makale', 'article', 'en') returning belge_dili`,
        [SAHIP],
      );
      assert.equal(rows[0].belge_dili, "en");
    }));
});
