// Ölçüm için bireysel abonelik aynasını kim okuyabilir (20260924100029).
//
// Tablo yalnızca kişinin kendisine açıktı; doğru bir varsayılandı ama ürünün
// en temel sorusu — denemeyi başlatanın kaçı ödedi — ArvoLab tarafında
// cevaplanamıyordu. Erişim İÇ EKİPLE sınırlı açıldı: bireysel abone hiçbir
// kuruma ait değil, müşteri kurumların gözetim rolleri onu görmemeli.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-0000000000c1";
const YONETICI = "00000000-0000-4000-8000-0000000000c2";
const KONTROLOR = "00000000-0000-4000-8000-0000000000c3";
const BIREYSEL = "00000000-0000-4000-8000-0000000000c4";
const BASKA_BIREYSEL = "00000000-0000-4000-8000-0000000000c5";
const KURUM = "00000000-0000-4000-8000-0000000000b9";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${YONETICI}', 'y@x.co'), ('${KONTROLOR}', 'c@x.co'),
      ('${BIREYSEL}', 'b@x.co'), ('${BASKA_BIREYSEL}', 'b2@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM}' where id = '${YONETICI}';
    update public.profiles set role = 'controller', organization_id = '${KURUM}' where id = '${KONTROLOR}';
    insert into public.individual_subscriptions (user_id, status, trial_ends_at, current_period_end) values
      ('${BIREYSEL}', 'trialing', now() + interval '3 days', now() + interval '3 days'),
      ('${BASKA_BIREYSEL}', 'active', now() - interval '20 days', now() + interval '10 days');
  `);
}

const sayi = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  const { rows } = await db.query(`select count(*) n from public.individual_subscriptions`);
  return Number(rows[0].n);
};

describe("ölçüm erişimi", () => {
  test("iç ekip bütün bireysel abonelikleri okur", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await sayi(KURUCU), 2);
    }));

  test("müşteri kurumun yöneticisi ve kontrolörü hiçbirini görmez", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await sayi(YONETICI), 0);
      assert.equal(await sayi(KONTROLOR), 0);
    }));

  test("abone yalnızca kendi kaydını görmeye devam eder", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await sayi(BIREYSEL), 1);
    }));

  test("kimse aynaya yazamaz; yalnızca köprü (service_role) yazar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      // grant yalnızca select: yazma denemesi yetki hatasına düşmeli.
      await reddedilir(
        db,
        `update public.individual_subscriptions set status = 'active' where user_id = $1`,
        [BIREYSEL],
        /permission denied/,
      );
    }));

  test("olcum_ozeti yalnızca iç ekibe cevap verir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      const { rows } = await db.query(`select public.olcum_ozeti() as o`);
      assert.equal(Number(rows[0].o.denemeBaslatan), 2);

      for (const kullanici of [YONETICI, KONTROLOR, BIREYSEL]) {
        await rol(db, "authenticated", kullanici);
        await reddedilir(db, `select public.olcum_ozeti()`, [], /yalnızca iç ekibe/);
      }
    }));

  /*
    Sayımın iki inceliği burada sabitleniyor. İkisi de sessizce yanlış sayı
    üretir, yani testle tutulmazsa kimse fark etmez.
  */
  test("ödeme ölçütü durum alanına değil tarihe bakar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      // ArvoOS denemeyi başlatırken iki tarihi de aynı yazıyor ve durumu
      // 'active' yapabiliyor; durum ölçüt olsaydı bu abone "ödedi" sayılırdı.
      await db.exec(`
        update public.individual_subscriptions
        set status = 'active', current_period_end = trial_ends_at
        where user_id = '${BIREYSEL}';
      `);
      await rol(db, "authenticated", KURUCU);
      const { rows } = await db.query(`select public.olcum_ozeti() as o`);
      assert.equal(Number(rows[0].o.odemeyeGecen), 1, "Yalnızca dönemi denemenin ötesine uzayan abone ödemiş sayılır");
    }));

  test("aktivasyon kişi sayar, satır değil", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      // Tek kişinin üç çalışması: satır sayılsaydı oran %100'ü aşardı.
      await db.exec(`
        insert into public.academic_projects (owner_id, title, project_type) values
          ('${BIREYSEL}', 'Birinci çalışma', 'thesis'),
          ('${BIREYSEL}', 'İkinci çalışma', 'article'),
          ('${BIREYSEL}', 'Üçüncü çalışma', 'project');
      `);
      await rol(db, "authenticated", KURUCU);
      const { rows } = await db.query(`select public.olcum_ozeti() as o`);
      assert.equal(Number(rows[0].o.calismaAcan), 1);
      // Kayıt paydası: kurumsuz ve 'client' rollü profiller (iki bireysel).
      assert.equal(Number(rows[0].o.kayit), 2);
    }));

  test("iç ekibin kendi kurumsuz hesabı abone adayı sayılmaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      const { rows } = await db.query(`select public.olcum_ozeti() as o`);
      // KURUCU kurumsuz ama rolü 'founder'; paydaya girseydi dönüşüm
      // olduğundan kötü görünürdü.
      assert.equal(Number(rows[0].o.kayit), 2);
    }));
});
