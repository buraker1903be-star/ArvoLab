// Kılavuz ve kaynakça kontrolü geçmişi (migration 20261026202222): metni
// yazabilen kendi adına kaydeder, çalışmayı göremeyen okuyamaz, kayıt
// sonradan değiştirilemez.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000801";
const BASKA = "00000000-0000-4000-8000-000000000802";
const TEZ = "00000000-0000-4000-8000-0000000008b1";

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
}

const EKLE = `insert into public.yazim_kontrolleri (project_id, owner_id, hata, uyari, kelime, sonuc, yapi)
     values ($1, $2, 1, 3, 2400, '{"wordCount": 2400}', '[]') returning id`;
const kaydet = (sahip = OGRENCI) => db.query(EKLE, [TEZ, sahip]);

test("öğrenci kendi çalışmasının kontrolünü kaydeder ve okur", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await kaydet();
    const { rows } = await db.query(`select hata, uyari, kelime from public.yazim_kontrolleri where project_id = $1`, [TEZ]);
    assert.deepEqual(rows, [{ hata: 1, uyari: 3, kelime: 2400 }]);
  }));

test("başkası ne okur ne yazar; başkası adına da kayıt açılamaz", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await kaydet();
    await reddedilir(db, EKLE, [TEZ, BASKA], /row-level security/);
    await rol(db, "authenticated", BASKA);
    const { rows } = await db.query(`select id from public.yazim_kontrolleri`);
    assert.equal(rows.length, 0);
    await reddedilir(db, EKLE, [TEZ, BASKA], /row-level security/);
  }));

test("kayıt sonradan değiştirilemez ve silinemez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await kaydet();
    await reddedilir(db, `update public.yazim_kontrolleri set hata = 0 where id = $1`, [rows[0].id], /permission denied/);
    await reddedilir(db, `delete from public.yazim_kontrolleri where id = $1`, [rows[0].id], /permission denied/);
  }));
