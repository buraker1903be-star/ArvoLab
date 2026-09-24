// Çalışmayı değiştirme de kurumla sınırlı (migration 20260924100031).
//
// 20260924100028 OKUMALARI kuruma bağladı ama academic_projects'in kendi
// UPDATE politikası çıplak has_role(...) ile kaldı. İlk bakışta zararsız
// görünüyordu çünkü `where id = ...` yazan bir istek SELECT politikasını da
// işletiyor ve orada kurum kontrolü var.
//
// SÜZGEÇSİZ istekte o koruma yok: "update academic_projects set ..." hiçbir
// sütun okumadığı için yalnızca UPDATE politikası çalışıyordu ve A kurumunun
// Kontrolörü B kurumunun (ve bireysel abonenin) tezini eziyordu.
//
// Bu yüzden testler BİLEREK süzgeçsiz yazıldı. Süzgeçli hâlleriyle yazılmış
// ilk sürüm migration olmadan da geçiyordu — yani hiçbir şey sınamıyordu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-00000000a001";
const YONETICI_A = "00000000-0000-4000-8000-00000000a002";
const KONTROLOR_A = "00000000-0000-4000-8000-00000000a003";
const SAHIP_A = "00000000-0000-4000-8000-00000000a004";
const SAHIP_B = "00000000-0000-4000-8000-00000000a005";
const BIREYSEL = "00000000-0000-4000-8000-00000000a006";

const KURUM_A = "00000000-0000-4000-8000-00000000b001";
const KURUM_B = "00000000-0000-4000-8000-00000000b002";

const PROJE_A = "00000000-0000-4000-8000-00000000c001";
const PROJE_B = "00000000-0000-4000-8000-00000000c002";
const PROJE_BIREYSEL = "00000000-0000-4000-8000-00000000c003";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'kurucu@x.co'), ('${YONETICI_A}', 'ya@x.co'), ('${KONTROLOR_A}', 'ka@x.co'),
      ('${SAHIP_A}', 'sa@x.co'), ('${SAHIP_B}', 'sb@x.co'), ('${BIREYSEL}', 'bi@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    update public.profiles set role = 'controller', organization_id = '${KURUM_A}' where id = '${KONTROLOR_A}';
    update public.profiles set organization_id = '${KURUM_A}' where id = '${SAHIP_A}';
    update public.profiles set organization_id = '${KURUM_B}' where id = '${SAHIP_B}';
    -- Bireysel abonenin kurumu yok.
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${PROJE_A}', '${SAHIP_A}', '${KURUM_A}', 'A kurumunun tezi', 'thesis'),
      ('${PROJE_B}', '${SAHIP_B}', '${KURUM_B}', 'B kurumunun tezi', 'thesis'),
      ('${PROJE_BIREYSEL}', '${BIREYSEL}', null, 'Bireysel abonenin tezi', 'thesis');
  `);
}

/* Süzgeçsiz: hangi satırlara dokunulabildiğini YALNIZCA politika belirler. */
const hepsiniEz = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  return (await db.query(`update public.academic_projects set title = 'EZİLDİ'`)).affectedRows;
};

const baslik = async (proje) => {
  await rol(db, "postgres");
  const { rows } = await db.query(`select title from public.academic_projects where id = $1`, [proje]);
  return rows[0].title;
};

describe("çalışma yazma kurumla sınırlı", () => {
  test("Kontrolör yalnızca kendi kurumunun çalışmasına dokunabiliyor", () =>
    islem(db, async () => {
      await tohum();
      // Üç çalışma var; yalnızca A kurumununki değişmeli.
      assert.equal(await hepsiniEz(KONTROLOR_A), 1);
      assert.equal(await baslik(PROJE_A), "EZİLDİ");
      assert.equal(await baslik(PROJE_B), "B kurumunun tezi");
      // İki NULL kurumu eşit saymak bütün bireysel aboneleri açardı.
      assert.equal(await baslik(PROJE_BIREYSEL), "Bireysel abonenin tezi");
    }));

  test("Akademik Yönetici de kurumunun dışına çıkamıyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await hepsiniEz(YONETICI_A), 1);
      assert.equal(await baslik(PROJE_B), "B kurumunun tezi");
    }));

  test("sahibi kendi çalışmasını düzenlemeye devam ediyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await hepsiniEz(SAHIP_B), 1);
      assert.equal(await baslik(PROJE_B), "EZİLDİ");
      assert.equal(await baslik(PROJE_A), "A kurumunun tezi");
    }));

  test("iç ekip bütün kurumlarda çalışmaya devam ediyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await hepsiniEz(KURUCU), 3);
    }));

  /*
    Silme zaten kapalıydı (DELETE, süzgeçsiz bile olsa SELECT politikasını
    işletiyor) ama politika yine de kuruma bağlandı: iki katmanın aynı şeyi
    söylemesi, birinin ileride gevşemesine karşı ucuz bir sigorta.
  */
  test("Akademik Yönetici başka kurumun çalışmasını silemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      assert.equal((await db.query(`delete from public.academic_projects`)).affectedRows, 1);
      assert.equal(await baslik(PROJE_B), "B kurumunun tezi");
    }));

  /*
    Burada SIFIR SATIR değil HATA bekleniyor: satır gözetim kapsamında
    (USING geçiyor), reddeden WITH CHECK — yani satırın YENİ hali. Bu olmasa
    kendi kurumunun çalışması başka bir kuruma taşınabilirdi.
  */
  test("çalışma başka bir kuruma taşınamıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KONTROLOR_A);
      await reddedilir(db,
        `update public.academic_projects set organization_id = $1`,
        [KURUM_B], /row-level security/i);
      await rol(db, "postgres");
      const { rows } = await db.query(`select organization_id from public.academic_projects where id = $1`, [PROJE_A]);
      assert.equal(rows[0].organization_id, KURUM_A);
    }));
});
