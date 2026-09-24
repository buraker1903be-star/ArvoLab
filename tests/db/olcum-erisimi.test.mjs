// Ölçüm için bireysel abonelik aynasını kim okuyabilir (20260924100029).
//
// Tablo yalnızca kişinin kendisine açıktı; doğru bir varsayılandı ama ürünün
// en temel sorusu — denemeyi başlatanın kaçı ödedi — ArvoLab tarafında
// cevaplanamıyordu. Erişim İÇ EKİPLE sınırlı açıldı: bireysel abone hiçbir
// kuruma ait değil, müşteri kurumların gözetim rolleri onu görmemeli.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

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
      let hata = null;
      try {
        await db.query(`update public.individual_subscriptions set status = 'active' where user_id = $1`, [BIREYSEL]);
      } catch (e) {
        hata = e.message;
      }
      assert.match(hata ?? "", /permission denied/);
    }));
});
