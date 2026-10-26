// Çalışmanın yapılacakları (migration 20261026101921): asistan bulgusu
// yapılacaklara eklenir, öğrenci "Yaptım" der. Meşru akış ve sınırlar.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000401";
const BASKA = "00000000-0000-4000-8000-000000000402";
const KONTROLOR = "00000000-0000-4000-8000-000000000403";
const YABANCI_KONTROLOR = "00000000-0000-4000-8000-000000000404";
const KURUM = "00000000-0000-4000-8000-0000000004a1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000004a2";
const TEZ = "00000000-0000-4000-8000-0000000004b1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A'), ('${BASKA_KURUM}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${OGRENCI}', 'o@x.co'), ('${BASKA}', 'b@x.co'), ('${KONTROLOR}', 'k@x.co'), ('${YABANCI_KONTROLOR}', 'y@x.co');
    update public.profiles set organization_id = '${KURUM}' where id in ('${OGRENCI}', '${KONTROLOR}');
    update public.profiles set organization_id = '${BASKA_KURUM}' where id in ('${BASKA}', '${YABANCI_KONTROLOR}');
    update public.profiles set role = 'controller' where id in ('${KONTROLOR}', '${YABANCI_KONTROLOR}');
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${TEZ}', '${OGRENCI}', '${KURUM}', 'Öğrencinin tezi', 'thesis');
  `);
}

const EKLE = `insert into public.calisma_yapilacaklari (project_id, olusturan, baslik, aciklama) values ($1, $2, $3, 'Kaynakçada var, metinde yok.') returning id`;
const ekle = (baslik = "Pesaran (2001) metinde atıfsız") => db.query(EKLE, [TEZ, OGRENCI, baslik]);

test("öğrenci kendi çalışmasına ekler, okur ve tamamlar", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await ekle();
    await db.query(`update public.calisma_yapilacaklari set tamamlandi = now() where id = $1`, [rows[0].id]);
    const { rows: okunan } = await db.query(`select tamamlandi from public.calisma_yapilacaklari where project_id = $1`, [TEZ]);
    assert.equal(okunan.length, 1);
    assert.ok(okunan[0].tamamlandi);
  }));

test("aynı açık bulgu iki kez eklenmez; tamamlanınca yeniden eklenebilir", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await ekle();
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "Pesaran (2001) metinde atıfsız"], /duplicate key|unique/);
    await db.query(`update public.calisma_yapilacaklari set tamamlandi = now() where id = $1`, [rows[0].id]);
    await ekle();
  }));

test("başkasının çalışmasına eklenemez, görülmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await ekle();
    await rol(db, "authenticated", BASKA);
    await reddedilir(
      db,
      `insert into public.calisma_yapilacaklari (project_id, olusturan, baslik) values ($1, $2, 'x')`,
      [TEZ, BASKA],
      /row-level security/,
    );
    const { rows } = await db.query(`select id from public.calisma_yapilacaklari`);
    assert.equal(rows.length, 0);
  }));

test("kendi kurumunun kontrolörü görür, başka kurumunki görmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await ekle();
    await rol(db, "authenticated", KONTROLOR);
    assert.equal((await db.query(`select id from public.calisma_yapilacaklari`)).rows.length, 1);
    await rol(db, "authenticated", YABANCI_KONTROLOR);
    assert.equal((await db.query(`select id from public.calisma_yapilacaklari`)).rows.length, 0);
  }));

test("anonim hiçbir şey okuyamaz", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "anon");
    await reddedilir(db, `select id from public.calisma_yapilacaklari`, [], /permission denied/);
  }));
