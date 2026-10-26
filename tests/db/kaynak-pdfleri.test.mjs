// Kaynak PDF'leri (migration 20261026110024): durum ve dosya yolu
// tutarlılığı, çalışmanın klasörü dışına yol yazılamaması ve RLS.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000501";
const BASKA = "00000000-0000-4000-8000-000000000502";
const KONTROLOR = "00000000-0000-4000-8000-000000000503";
const KURUM = "00000000-0000-4000-8000-0000000005a1";
const TEZ = "00000000-0000-4000-8000-0000000005b1";
const BASKA_TEZ = "00000000-0000-4000-8000-0000000005b2";

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
      ('${BASKA_TEZ}', '${BASKA}', null, 'Başka tez', 'thesis');
  `);
}

const EKLE = `insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu)
  values ($1, $2, $3, 'Pesaran (2001). Bounds testing.', $4, $5)`;

test("öğrenci indirilen ve bulunamayan PDF'i kaydeder, günceller", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE, [TEZ, OGRENCI, "pesaran 2001", "indirildi", `${TEZ}/kaynak-pdf/Pesaran_2001.pdf`]);
    await db.query(EKLE, [TEZ, OGRENCI, "wooldridge 2016", "bulunamadi", null]);
    await db.query(
      `update public.kaynak_pdfleri set durum = 'yuklendi', depo_yolu = $2, baslik_eslesti = true where kunye_anahtari = $1`,
      ["wooldridge 2016", `${TEZ}/kaynak-pdf/Wooldridge_2016.pdf`],
    );
    const { rows } = await db.query(`select durum from public.kaynak_pdfleri order by kunye_anahtari`);
    assert.deepEqual(rows.map((r) => r.durum), ["indirildi", "yuklendi"]);
  }));

test("dosyası olan durumda yol şart, olmayanda yasak", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "a", "indirildi", null], /check constraint/);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "b", "bulunamadi", `${TEZ}/kaynak-pdf/x.pdf`], /check constraint/);
  }));

test("yol çalışmanın kaynak-pdf klasörü dışını gösteremez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "c", "indirildi", `${BASKA_TEZ}/kaynak-pdf/x.pdf`], /check constraint/);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "d", "indirildi", `${OGRENCI}/kilavuz/x.pdf`], /check constraint/);
  }));

test("başkasının çalışmasına yazılamaz ve görülmez; kurumun kontrolörü görür", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE, [TEZ, OGRENCI, "pesaran 2001", "kayit_yok", null]);
    await rol(db, "authenticated", BASKA);
    await reddedilir(db, EKLE, [TEZ, BASKA, "x", "kayit_yok", null], /row-level security/);
    assert.equal((await db.query(`select id from public.kaynak_pdfleri`)).rows.length, 0);
    await rol(db, "authenticated", KONTROLOR);
    assert.equal((await db.query(`select id from public.kaynak_pdfleri`)).rows.length, 1);
  }));
