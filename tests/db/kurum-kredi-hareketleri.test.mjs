// Kurumun AI kredi defteri: son hareketler (migration 20261028180659).
//
// Kurum yöneticisi krediyi artık ArvoLab'dan alıyor ve son hareketleri
// görüyor. Defter tablosunun authenticated için politikası yok; okuma
// ai_kurum_kredi_hareketleri'nden ve yetki faturaları görmekle aynı:
// kendi kurumunun Akademik Yöneticisi ya da iç ekip. Meşru akış (yönetici
// görür) ile reddedilmesi gerekenler (öğrenci, başka kurumun yöneticisi,
// bireysel abone) birlikte sınanıyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-00000000d201";
const BASKA_KURUM = "00000000-0000-4000-8000-00000000d202";
const YONETICI = "00000000-0000-4000-8000-00000000d101";
const OGRENCI = "00000000-0000-4000-8000-00000000d102";
const BASKA_YONETICI = "00000000-0000-4000-8000-00000000d103";
const KURUCU = "00000000-0000-4000-8000-00000000d104";
const BIREYSEL = "00000000-0000-4000-8000-00000000d105";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name, ai_credit_limit, synced_at)
      values ('${KURUM}', 'A Kurumu', 100, now()), ('${BASKA_KURUM}', 'B Kurumu', 100, now());
    insert into auth.users (id, email) values
      ('${YONETICI}', 'y@a.co'), ('${OGRENCI}', 'o@a.co'), ('${BASKA_YONETICI}', 'y@b.co'),
      ('${KURUCU}', 'k@arvo.co'), ('${BIREYSEL}', 'b@x.co');
    update public.profiles set organization_id = '${KURUM}', role = 'academic_manager' where id = '${YONETICI}';
    update public.profiles set organization_id = '${KURUM}' where id = '${OGRENCI}';
    update public.profiles set organization_id = '${BASKA_KURUM}', role = 'academic_manager' where id = '${BASKA_YONETICI}';
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    select public.ai_kredi_yukle('${KURUM}', 500, 'odeme-1');
    select public.ai_kredi_yukle('${BASKA_KURUM}', 900, 'odeme-2');
  `);
}

const hareketler = async (kisi, kurum = KURUM) => {
  await rol(db, "authenticated", kisi);
  const { rows } = await db.query(`select tur, kredi from public.ai_kurum_kredi_hareketleri($1)`, [kurum]);
  return rows.map((r) => `${r.tur}:${Number(r.kredi)}`);
};

describe("kurum kredi hareketleri", () => {
  test("kurumun Akademik Yöneticisi kendi kurumunun defterini görür", () =>
    islem(db, async () => {
      await tohum();
      const satirlar = await hareketler(YONETICI);
      assert.ok(satirlar.includes("yukleme:500"), satirlar.join(","));
      assert.ok(!satirlar.includes("yukleme:900"), "başka kurumun yüklemesi karışmamalı");
    }));

  test("iç ekip seçtiği kurumu görür", () =>
    islem(db, async () => {
      await tohum();
      assert.ok((await hareketler(KURUCU, BASKA_KURUM)).includes("yukleme:900"));
    }));

  test("öğrenci, başka kurumun yöneticisi ve bireysel abone boş liste alır", () =>
    islem(db, async () => {
      await tohum();
      assert.deepEqual(await hareketler(OGRENCI), []);
      assert.deepEqual(await hareketler(BASKA_YONETICI), []);
      assert.deepEqual(await hareketler(BIREYSEL), []);
      // NULL kurum asla eşleşmez: bireysel abonenin kurumu da NULL.
      assert.deepEqual(await hareketler(BIREYSEL, null), []);
    }));

  test("tablo authenticated'a hâlâ kapalı", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI);
      await reddedilir(db, `select * from public.ai_kredi_hareketleri`, [], /permission denied/);
    }));
});
