// Analiz sonucunu teze ekleme sırası (migration 20261026131044): yalnızca
// sıra sütunları güncellenir; sonucun içeriği (APA metni) hâlâ değişmez.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000701";
const BASKA = "00000000-0000-4000-8000-000000000702";
const TEZ = "00000000-0000-4000-8000-0000000007b1";
const SONUC = "00000000-0000-4000-8000-0000000007c1";

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
  await rol(db, "authenticated", OGRENCI);
  await db.query(
    `insert into public.analiz_sonuclari (id, owner_id, project_id, analiz_turu, baslik, apa_metni, teze_eklenecek)
     values ($1, $2, $3, 'ttest', 'Bağımsız Örneklem t-Testi: puan ~ grup', 't(48) = 2.10, p = .041', true)`,
    [SONUC, OGRENCI, TEZ],
  );
}

test("öğrenci sırayı ve eklendi bilgisini günceller", () =>
  islem(db, async () => {
    await tohum();
    await db.query(`update public.analiz_sonuclari set teze_eklendi = now() where id = $1`, [SONUC]);
    await db.query(`update public.analiz_sonuclari set teze_eklenecek = false where id = $1`, [SONUC]);
    const { rows } = await db.query(`select teze_eklenecek, teze_eklendi from public.analiz_sonuclari where id = $1`, [SONUC]);
    assert.equal(rows[0].teze_eklenecek, false);
    assert.ok(rows[0].teze_eklendi);
  }));

test("sonucun içeriği güncellenemez", () =>
  islem(db, async () => {
    await tohum();
    await reddedilir(db, `update public.analiz_sonuclari set apa_metni = 'uydurma' where id = $1`, [SONUC], /permission denied/);
    await reddedilir(db, `update public.analiz_sonuclari set baslik = 'x' where id = $1`, [SONUC], /permission denied/);
  }));

test("başkası sırayı değiştiremez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", BASKA);
    const { rows } = await db.query(`update public.analiz_sonuclari set teze_eklendi = now() where id = $1 returning id`, [SONUC]);
    assert.equal(rows.length, 0);
  }));
