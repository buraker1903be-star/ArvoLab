// Kullanım geri bildirimi tablosu (migration 20260924100019).
//
// Geri bildirim kişiseldir: kullanıcı yalnızca kendi satırını yazar ve
// görür. Akademik Yönetici KENDİ KURUMUNUN cevaplarını, iç ekip (Sistem
// Yöneticisi, Kurucu) hepsini okur — ürün kararını onlar verecek. Kontrolör
// bilerek dışarıda. Kurum sınırı 20260924100028 ile geldi: eskiden herhangi
// bir müşterinin yöneticisi bütün müşterilerin cevabını okuyordu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-000000000001";
const YONETICI = "00000000-0000-4000-8000-000000000002";
const KONTROLOR = "00000000-0000-4000-8000-000000000003";
const PERSONEL = "00000000-0000-4000-8000-000000000004";
const BASKA = "00000000-0000-4000-8000-000000000005";
const YABANCI_YONETICI = "00000000-0000-4000-8000-000000000006";
const KURUM = "00000000-0000-4000-8000-0000000000a1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000000a2";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values
      ('${KURUM}', 'AkademikMerkez'), ('${BASKA_KURUM}', 'Başka Merkez');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${YONETICI}', 'y@x.co'), ('${KONTROLOR}', 'c@x.co'),
      ('${PERSONEL}', 'p@x.co'), ('${BASKA}', 'b@x.co'), ('${YABANCI_YONETICI}', 'yy@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM}' where id = '${YONETICI}';
    update public.profiles set role = 'academic_manager', organization_id = '${BASKA_KURUM}' where id = '${YABANCI_YONETICI}';
    update public.profiles set role = 'controller', organization_id = '${KURUM}' where id = '${KONTROLOR}';
    update public.profiles set organization_id = '${KURUM}' where id in ('${PERSONEL}', '${BASKA}');
  `);
}

const cevapla = async (kullanici, puan) => {
  await rol(db, "authenticated", kullanici);
  await db.query(
    `insert into public.product_feedback (user_id, organization_id, status, score, comment)
     values ($1, $2, 'answered', $3, 'Kaynakça denetimi işimi gördü.')`,
    [kullanici, KURUM, puan],
  );
};

const gorulen = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  return (await db.query(`select user_id from public.product_feedback order by user_id`)).rows.map((r) => r.user_id);
};

describe("kullanım geri bildirimi", () => {
  test("personel kendi cevabını yazar; sonra güncelleyebilir", () =>
    islem(db, async () => {
      await tohum();
      await cevapla(PERSONEL, 4);
      await rol(db, "authenticated", PERSONEL);
      const guncel = await db.query(
        `update public.product_feedback set score = 5 where user_id = $1 returning score`,
        [PERSONEL],
      );
      assert.equal(guncel.rows[0].score, 5);
    }));

  test("sınır: başkasının adına geri bildirim yazılamaz, başkasınınki güncellenemez", () =>
    islem(db, async () => {
      await tohum();
      await cevapla(PERSONEL, 3);
      await rol(db, "authenticated", BASKA);
      await reddedilir(
        db,
        `insert into public.product_feedback (user_id, status, score) values ($1, 'answered', 1)`,
        [PERSONEL],
        /row-level security/,
      );
      const guncel = await db.query(`update public.product_feedback set score = 1 where user_id = $1 returning user_id`, [PERSONEL]);
      assert.equal(guncel.rows.length, 0, "Başkasının cevabı değiştirilebiliyor");
    }));

  test("personel yalnızca kendi cevabını görür; yönetim kendi kurumunun hepsini görür", () =>
    islem(db, async () => {
      await tohum();
      await cevapla(PERSONEL, 4);
      await cevapla(BASKA, 2);
      assert.deepEqual(await gorulen(PERSONEL), [PERSONEL]);
      assert.equal((await gorulen(YONETICI)).length, 2);
      assert.equal((await gorulen(KURUCU)).length, 2);
      // Kontrolör akademik denetim yapar; ürün geri bildirimi onun işi değil.
      assert.deepEqual(await gorulen(KONTROLOR), []);
      // Başka kurumun yöneticisi bu kurumun cevaplarını göremez.
      assert.deepEqual(await gorulen(YABANCI_YONETICI), []);
    }));

  test("cevap puansız olamaz; erteleme puansız olabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", PERSONEL);
      await reddedilir(
        db,
        `insert into public.product_feedback (user_id, status) values ($1, 'answered')`,
        [PERSONEL],
        /product_feedback_cevap_puanli/,
      );
      const ertelendi = await db.query(
        `insert into public.product_feedback (user_id, status) values ($1, 'postponed') returning status`,
        [PERSONEL],
      );
      assert.equal(ertelendi.rows[0].status, "postponed");
    }));

  test("verilen cevap silinemez", () =>
    islem(db, async () => {
      await tohum();
      await cevapla(PERSONEL, 5);
      await rol(db, "authenticated", PERSONEL);
      await reddedilir(db, `delete from public.product_feedback where user_id = $1`, [PERSONEL], /permission denied/);
    }));
});
