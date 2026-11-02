// Etik kurul başvurusu kaydı (migration 20261102134543). Meşru akış (öğrenci
// kendi çalışmasına yazar, kendi kurumunun kontrolörü okur) ile kurallar
// (yabancı yazamaz/okuyamaz, onaylandı karar bilgisi ister, tarih sırası)
// birlikte sınanıyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000e01";
const BASKA = "00000000-0000-4000-8000-000000000e02";
const KONTROLOR = "00000000-0000-4000-8000-000000000e03";
const YABANCI_KONTROLOR = "00000000-0000-4000-8000-000000000e04";
const KURUM = "00000000-0000-4000-8000-000000000ea1";
const BASKA_KURUM = "00000000-0000-4000-8000-000000000ea2";
const TEZ = "00000000-0000-4000-8000-000000000eb1";

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
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${TEZ}', '${OGRENCI}', '${KURUM}', 'Öğrencinin tezi', 'thesis');
  `);
}

describe("etik kurul kaydı", () => {
  test("öğrenci kendi çalışmasına yazar; kendi kurumunun kontrolörü okur, yabancılar göremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.etik_kurul (project_id, durum, kurul_adi, belgeler)
         values ($1, 'hazirlaniyor', 'Sosyal Bilimler Etik Kurulu', '[{"anahtar":"onam_formu","ad":"Onam formu","durum":"eksik","kaynak":"yonerge"}]')`,
        [TEZ],
      );
      await db.query(`update public.etik_kurul set durum = 'onaylandi', onay_tarihi = '2026-10-01', karar_no = '2026/45' where project_id = $1`, [TEZ]);

      await rol(db, "authenticated", KONTROLOR);
      assert.equal((await db.query(`select karar_no from public.etik_kurul`)).rows[0]?.karar_no, "2026/45");

      for (const yabanci of [BASKA, YABANCI_KONTROLOR]) {
        await rol(db, "authenticated", yabanci);
        assert.equal((await db.query(`select 1 from public.etik_kurul`)).rows.length, 0, yabanci);
        await db.query(`update public.etik_kurul set karar_no = 'sahte' where project_id = $1`, [TEZ]);
      }
      await rol(db, "postgres");
      assert.equal((await db.query(`select karar_no from public.etik_kurul`)).rows[0].karar_no, "2026/45");

      await rol(db, "authenticated", BASKA);
      await reddedilir(db, `insert into public.etik_kurul (project_id) values ($1)`, [TEZ], /row-level security|duplicate/);
    }));

  test("onaylandı karar tarihi ve sayısı ister; başvuru onaydan sonra olamaz; belge listesi dizi", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db, `insert into public.etik_kurul (project_id, durum) values ($1, 'onaylandi')`, [TEZ], /etik_onay_bilgisi/);
      await reddedilir(
        db,
        `insert into public.etik_kurul (project_id, basvuru_tarihi, onay_tarihi) values ($1, '2026-10-05', '2026-10-01')`,
        [TEZ],
        /etik_tarih_sirasi/,
      );
      await reddedilir(db, `insert into public.etik_kurul (project_id, belgeler) values ($1, '{}'::jsonb)`, [TEZ], /check constraint|violates/);
      await db.query(`insert into public.etik_kurul (project_id, durum, gerekmeme_gerekcesi) values ($1, 'gerekmiyor', 'Yalnızca yayımlanmış veri')`, [TEZ]);
    }));

  test("Destek'te 'Etik kurul başvurusu' konusu açılabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.consultancy_requests (requested_by, project_id, request_type, message) values ($1, $2, 'ethics', 'Onam formuma bakar mısınız?')`,
        [OGRENCI, TEZ],
      );
    }));
});
