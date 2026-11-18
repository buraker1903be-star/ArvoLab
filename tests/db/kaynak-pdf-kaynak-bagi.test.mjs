// Kaynak PDF'i ile kaynak kaydı arasındaki açık bağ (K2-A, migration
// 20261118125346). Meşru akış (öğrenci kendi çalışmasındaki PDF'i kendi
// kaynağına bağlar, bağı kaldırır) ile kurallar birlikte sınanıyor:
// yabancı anahtarın varlığı yetki sayılmaz — başka çalışmanın ya da başka
// kullanıcının kaynağı bağlanamaz; kaynak silinince PDF yerinde kalır.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000b2d01";
const BASKA = "00000000-0000-4000-8000-0000000b2d02";
const KONTROLOR = "00000000-0000-4000-8000-0000000b2d03";
const KURUM = "00000000-0000-4000-8000-0000000b2da1";
const TEZ = "00000000-0000-4000-8000-0000000b2db1";
const IKINCI_TEZ = "00000000-0000-4000-8000-0000000b2db2";
const BASKA_TEZ = "00000000-0000-4000-8000-0000000b2db3";
const KAYNAK = "00000000-0000-4000-8000-0000000b2dc1";
const IKINCI_KAYNAK = "00000000-0000-4000-8000-0000000b2dc2";
const BASKA_KAYNAK = "00000000-0000-4000-8000-0000000b2dc3";
const PDF = "00000000-0000-4000-8000-0000000b2dd1";
const BASKA_PDF = "00000000-0000-4000-8000-0000000b2dd2";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A');
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${BASKA}', 'b@x.co'), ('${KONTROLOR}', 'k@x.co');
    update public.profiles set organization_id = '${KURUM}' where id in ('${OGRENCI}', '${KONTROLOR}');
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${TEZ}', '${OGRENCI}', '${KURUM}', 'Tez', 'thesis'),
      ('${IKINCI_TEZ}', '${OGRENCI}', '${KURUM}', 'İkinci çalışma', 'article'),
      ('${BASKA_TEZ}', '${BASKA}', null, 'Başka tez', 'thesis');
    insert into public.literature_sources (id, owner_id, project_id, title, authors, year) values
      ('${KAYNAK}', '${OGRENCI}', '${TEZ}', 'Remote learning and student wellbeing', 'Kaya, A.', '2021'),
      ('${IKINCI_KAYNAK}', '${OGRENCI}', '${IKINCI_TEZ}', 'Başka çalışmanın kaynağı', 'Demir, B.', '2019'),
      ('${BASKA_KAYNAK}', '${BASKA}', '${BASKA_TEZ}', 'Başkasının kaynağı', 'Ak, E.', '2018');
    insert into public.kaynak_pdfleri (id, project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu) values
      ('${PDF}', '${TEZ}', '${OGRENCI}', 'kaya 2021', 'Kaya, A. (2021). Remote learning.', 'yuklendi', '${TEZ}/kaynak-pdf/kaya.pdf'),
      ('${BASKA_PDF}', '${BASKA_TEZ}', '${BASKA}', 'ak 2018', 'Ak, E. (2018).', 'yuklendi', '${BASKA_TEZ}/kaynak-pdf/ak.pdf');
  `);
}
const bag = async (id) => (await db.query(`select kaynak_id from public.kaynak_pdfleri where id = $1`, [id])).rows[0]?.kaynak_id ?? null;

test("eski satırlar bağsız kalır (toplu doldurma yok)", () =>
  islem(db, async () => {
    await tohum();
    assert.equal(await bag(PDF), null);
  }));

test("öğrenci kendi çalışmasındaki PDF'i o çalışmanın kaynağına bağlar ve bağı kaldırır", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(`update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, KAYNAK]);
    await rol(db, "postgres");
    assert.equal(await bag(PDF), KAYNAK);
    await rol(db, "authenticated", OGRENCI);
    await db.query(`update public.kaynak_pdfleri set kaynak_id = null where id = $1`, [PDF]);
    await rol(db, "postgres");
    assert.equal(await bag(PDF), null);
  }));

test("başka çalışmanın kaynağı bağlanamaz (aynı kullanıcı olsa da)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await reddedilir(db, `update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, IKINCI_KAYNAK], /bu çalışmaya ait değil/);
  }));

test("başka kullanıcının kaynağı bağlanamaz; yabancı anahtar yetki sayılmaz", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await reddedilir(db, `update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, BASKA_KAYNAK], /bu çalışmaya ait değil/);
    // Ekleme yolu da aynı denetimden geçer.
    await reddedilir(
      db,
      `insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, kaynak_id) values ($1, $2, 'x', 'x', 'bulunamadi', $3)`,
      [TEZ, OGRENCI, BASKA_KAYNAK],
      /bu çalışmaya ait değil/,
    );
  }));

test("çalışmaya yazamayan kullanıcı başkasının PDF bağını değiştiremez (RLS)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", BASKA);
    await db.query(`update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, BASKA_KAYNAK]).catch(() => {});
    await rol(db, "postgres");
    assert.equal(await bag(PDF), null);
  }));

test("kaynak silinince PDF yerinde kalır, bağ düşer", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(`update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, KAYNAK]);
    await db.query(`delete from public.literature_sources where id = $1`, [KAYNAK]);
    await rol(db, "postgres");
    const { rows } = await db.query(`select id, kaynak_id, depo_yolu from public.kaynak_pdfleri where id = $1`, [PDF]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kaynak_id, null);
    assert.ok(rows[0].depo_yolu);
  }));

test("bağ değişmeden yapılan güncelleme yeniden denetlenmez (meşru durum güncellemesi)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(`update public.kaynak_pdfleri set kaynak_id = $2 where id = $1`, [PDF, KAYNAK]);
    await db.query(`update public.kaynak_pdfleri set baslik_eslesti = true where id = $1`, [PDF]);
    await rol(db, "postgres");
    assert.equal(await bag(PDF), KAYNAK);
  }));
