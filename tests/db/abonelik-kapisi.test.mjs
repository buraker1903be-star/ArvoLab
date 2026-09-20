// Abonelik kapısı veritabanında (migration 20260924100003): aboneliği biten
// kullanıcı PostgREST'e doğrudan istek atarak yazmaya devam edemez. Kapının
// yalnızca net bir "aboneliğin yok" cevabıyla kapandığı da sınanır: geçici
// bilgisizlik (ayna yok, ArvoOS hiç bildirmedi) kimseyi engellememeli.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-000000000001";
const KURUM_UYESI = "00000000-0000-4000-8000-000000000002";
const BIREYSEL = "00000000-0000-4000-8000-000000000003";
const KURUM = "00000000-0000-4000-8000-0000000000a1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum({ lisans = "active", donemSonu = null, senkron = "now()" } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name, license_status, current_period_end, synced_at)
      values ('${KURUM}', 'Kurum', '${lisans}', ${donemSonu ?? "null"}, ${senkron});
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${KURUM_UYESI}', 'u@x.co'), ('${BIREYSEL}', 'b@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set organization_id = '${KURUM}' where id = '${KURUM_UYESI}';
  `);
}

const calismaAc = (kullanici) =>
  db.query(`insert into public.academic_projects (owner_id, organization_id, title, project_type)
            values ($1, (select organization_id from public.profiles where id = $1), 'Yeni çalışma', 'thesis') returning id`, [kullanici]);

const yazabilirMi = async () => (await db.query(`select public.subscription_open() as acik`)).rows[0].acik;

describe("kurum üyesi", () => {
  test("lisans bitince yeni çalışma, metin, paylaşım ve belge yazılamaz", () =>
    islem(db, async () => {
      await tohum({ lisans: "past_due" });
      await rol(db, "authenticated", KURUM_UYESI);
      assert.equal(await yazabilirMi(), false);
      await reddedilir(db, `insert into public.academic_projects (owner_id, organization_id, title, project_type)
                            values ($1, $2, 'Kaçak', 'thesis')`, [KURUM_UYESI, KURUM], /Aboneliğiniz sona erdi/);
    }));

  test("dönem sonu geçmişse de kapalı; aktif ve süresi geçmemişse açık", () =>
    islem(db, async () => {
      await tohum({ lisans: "active", donemSonu: "now() - interval '1 day'" });
      await rol(db, "authenticated", KURUM_UYESI);
      assert.equal(await yazabilirMi(), false);
      await rol(db, "postgres");
      await db.query(`update public.organizations set current_period_end = now() + interval '10 days' where id = $1`, [KURUM]);
      await rol(db, "authenticated", KURUM_UYESI);
      assert.equal(await yazabilirMi(), true);
      const { rows } = await calismaAc(KURUM_UYESI);
      assert.equal(rows.length, 1);
    }));

  test("ArvoOS bu kurumu hiç bildirmediyse engellenmez", () =>
    islem(db, async () => {
      await tohum({ lisans: "inactive", senkron: "null" });
      await rol(db, "authenticated", KURUM_UYESI);
      assert.equal(await yazabilirMi(), true);
      assert.equal((await calismaAc(KURUM_UYESI)).rows.length, 1);
    }));
});

describe("bireysel abone", () => {
  const ayna = (durum, alan = "current_period_end", deger = "now() + interval '10 days'") =>
    db.query(`insert into public.individual_subscriptions (user_id, status, ${alan}) values ($1, $2, ${deger})
              on conflict (user_id) do update set status = excluded.status, ${alan} = excluded.${alan}`, [BIREYSEL, durum]);

  test("deneme ya da dönem bitince kapalı, sürüyorsa açık", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await ayna("trialing", "trial_ends_at", "now() - interval '1 hour'");
      await rol(db, "authenticated", BIREYSEL);
      assert.equal(await yazabilirMi(), false);
      await reddedilir(db, `insert into public.literature_sources (owner_id, title) values ($1, 'Kaçak kaynak')`, [BIREYSEL], /Aboneliğiniz sona erdi/);

      await rol(db, "postgres");
      await ayna("active");
      await rol(db, "authenticated", BIREYSEL);
      assert.equal(await yazabilirMi(), true);
    }));

  test("ayna yoksa (ArvoOS'a hiç sorulmamış) engellenmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", BIREYSEL);
      assert.equal(await yazabilirMi(), true);
    }));

  test("iptal edilmiş abonelik kapalı", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await ayna("canceled");
      await rol(db, "authenticated", BIREYSEL);
      assert.equal(await yazabilirMi(), false);
    }));
});

describe("kapının dışında kalanlar", () => {
  test("iç ekip hiçbir koşulda engellenmez", () =>
    islem(db, async () => {
      await tohum({ lisans: "canceled" });
      await rol(db, "postgres");
      await db.query(`update public.profiles set organization_id = $2 where id = $1`, [KURUCU, KURUM]);
      await rol(db, "authenticated", KURUCU);
      assert.equal(await yazabilirMi(), true);
    }));

  test("okuma, silme ve mevcut kaydı güncelleme açık kalır", () =>
    islem(db, async () => {
      await tohum({ lisans: "active", donemSonu: "now() + interval '10 days'" });
      await rol(db, "authenticated", KURUM_UYESI);
      const { rows } = await calismaAc(KURUM_UYESI);
      const proje = rows[0].id;
      await rol(db, "postgres");
      await db.query(`update public.organizations set license_status = 'canceled' where id = $1`, [KURUM]);
      await rol(db, "authenticated", KURUM_UYESI);
      assert.equal(await yazabilirMi(), false);
      // kendi çalışmasını görebilir, düzeltebilir ve silebilir
      assert.equal((await db.query(`select id from public.academic_projects where id = $1`, [proje])).rows.length, 1);
      await db.query(`update public.academic_projects set notes = 'not' where id = $1`, [proje]);
      await db.query(`delete from public.academic_projects where id = $1`, [proje]);
    }));

  test("servis anahtarı (köprü, cron) kapıdan etkilenmez", () =>
    islem(db, async () => {
      await tohum({ lisans: "canceled" });
      await rol(db, "postgres");
      assert.equal(await yazabilirMi(), true);
    }));
});
