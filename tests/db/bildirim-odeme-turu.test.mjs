// Ödeme bildirimi türü (migration 20261028174054).
//
// ArvoOS kartla ödemenin ve otomatik yenilemenin sonucunu bireysel abonenin
// zilinde göstermek için service role ile 'billing' satırı yazıyor. Kısıt
// bu türü tanımadığı sürece her ekleme check ihlaliyle düşüyordu. Eski
// türlerin hâlâ geçtiği de sınanıyor: kısıt yeniden yazılırken bir türü
// unutmak o türün bütün bildirimlerini sessizce durdururdu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const ABONE = "00000000-0000-4000-8000-00000000b101";

let db;
before(async () => {
  db = await veritabani();
});

const ekle = (tur) =>
  db.query(
    `insert into public.notifications (user_id, kind, title, link) values ($1, $2, 'Ödemeniz alındı', '/dashboard/abonelik') returning kind`,
    [ABONE, tur],
  );

describe("ödeme bildirimi", () => {
  test("service role 'billing' bildirimi yazabiliyor, abone kendininkini okuyabiliyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(`insert into auth.users (id, email) values ($1, 'abone@x.co')`, [ABONE]);
      await rol(db, "service_role");
      const { rows } = await ekle("billing");
      assert.equal(rows[0].kind, "billing");
      await rol(db, "authenticated", ABONE);
      const { rows: gorunen } = await db.query(`select kind, link from public.notifications`);
      assert.deepEqual(gorunen, [{ kind: "billing", link: "/dashboard/abonelik" }]);
    }));

  test("önceki türler hâlâ geçiyor, tanınmayan tür reddediliyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(`insert into auth.users (id, email) values ($1, 'abone@x.co')`, [ABONE]);
      await rol(db, "service_role");
      for (const tur of ["comment", "assignment", "status", "approval", "guideline_update", "share_view"]) {
        const { rows } = await ekle(tur);
        assert.equal(rows[0].kind, tur);
      }
      await reddedilir(db, `insert into public.notifications (user_id, kind, title) values ($1, 'odeme', 'x')`, [ABONE], /notifications_kind_check/);
    }));

  test("abone kendi adına bildirim yazamıyor (yetki değişmedi)", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(`insert into auth.users (id, email) values ($1, 'abone@x.co')`, [ABONE]);
      await rol(db, "authenticated", ABONE);
      await reddedilir(db, `insert into public.notifications (user_id, kind, title) values ($1, 'billing', 'x')`, [ABONE], /permission denied/);
    }));
});
