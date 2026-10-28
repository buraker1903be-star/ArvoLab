// Tez takvimi (migration 20261028035441): öğrenci bölüm bölüm hedef tarih
// koyar, tamamlar. Meşru akış ve sınırlar (yapılacaklarla aynı desen).
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000501";
const BASKA = "00000000-0000-4000-8000-000000000502";
const KONTROLOR = "00000000-0000-4000-8000-000000000503";
const YABANCI_KONTROLOR = "00000000-0000-4000-8000-000000000504";
const KURUM = "00000000-0000-4000-8000-0000000005a1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000005a2";
const TEZ = "00000000-0000-4000-8000-0000000005b1";

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

const EKLE = `insert into public.calisma_takvimi (project_id, olusturan, baslik, hedef_tarih) values ($1, $2, $3, $4) returning id`;
const ekle = (baslik = "Literatür taraması", tarih = "2026-11-15") => db.query(EKLE, [TEZ, OGRENCI, baslik, tarih]);

test("öğrenci kendi tezine taş ekler, tarihini değiştirir, tamamlar ve siler", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await ekle();
    await db.query(`update public.calisma_takvimi set hedef_tarih = '2026-11-20' where id = $1`, [rows[0].id]);
    await db.query(`update public.calisma_takvimi set tamamlandi = now() where id = $1`, [rows[0].id]);
    const { rows: okunan } = await db.query(`select hedef_tarih::text as t, tamamlandi from public.calisma_takvimi`);
    assert.equal(okunan[0].t, "2026-11-20");
    assert.ok(okunan[0].tamamlandi);
    await db.query(`delete from public.calisma_takvimi where id = $1`, [rows[0].id]);
    assert.equal((await db.query(`select id from public.calisma_takvimi`)).rows.length, 0);
  }));

test("aynı adlı açık taş iki kez eklenmez (büyük/küçük harf ve boşluk farkı da); tamamlanınca eklenebilir", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await ekle("Yöntem");
    await reddedilir(db, EKLE, [TEZ, OGRENCI, " yöntem ", "2026-12-01"], /duplicate key|unique/);
    await db.query(`update public.calisma_takvimi set tamamlandi = now() where id = $1`, [rows[0].id]);
    await ekle("Yöntem", "2026-12-10");
  }));

test("başlıksız taş ya da tarihsiz taş eklenmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "  ", "2026-11-15"], /check constraint/);
    await reddedilir(db, EKLE, [TEZ, OGRENCI, "Bulgular", null], /null value/);
  }));

test("başkasının tezine eklenemez ve görülmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await ekle();
    await rol(db, "authenticated", BASKA);
    await reddedilir(db, EKLE, [TEZ, BASKA, "x", "2026-11-15"], /row-level security/);
    assert.equal((await db.query(`select id from public.calisma_takvimi`)).rows.length, 0);
    const { rows } = await db.query(`update public.calisma_takvimi set hedef_tarih = '2030-01-01' returning id`);
    assert.equal(rows.length, 0);
  }));

test("kendi kurumunun kontrolörü takvimi görür, başka kurumunki görmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await ekle();
    await rol(db, "authenticated", KONTROLOR);
    assert.equal((await db.query(`select id from public.calisma_takvimi`)).rows.length, 1);
    await rol(db, "authenticated", YABANCI_KONTROLOR);
    assert.equal((await db.query(`select id from public.calisma_takvimi`)).rows.length, 0);
  }));

test("anonim hiçbir şey okuyamaz", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "anon");
    await reddedilir(db, `select id from public.calisma_takvimi`, [], /permission denied/);
  }));
