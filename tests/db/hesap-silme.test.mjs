/*
  Hesap silme gerçekten çalışıyor mu?

  auth.users satırını silmek, altı yabancı anahtar yüzünden HATA veriyordu
  (varsayılan NO ACTION): kullanıcı bir çalışmaya atanmışsa, bir onay
  vermişse ya da başkasının metnine dokunmuşsa silme yarıda kalırdı.
  Yarım kalan bir silme en kötüsü — kullanıcıya "silindi" denir, veri durur.

  Bu testin asıl işi, silmenin EN ZOR durumda bile tamamlandığını
  göstermek: kullanıcının her yerde izi varken.
*/
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const SILINEN = "00000000-0000-4000-8000-0000000000a1";
const BASKASI = "00000000-0000-4000-8000-0000000000a2";
const KURUM = "00000000-0000-4000-8000-0000000000b1";
const KENDI_TEZI = "00000000-0000-4000-8000-0000000000c1";
const BASKA_TEZ = "00000000-0000-4000-8000-0000000000c2";

let db;
before(async () => {
  db = await veritabani();
});

/* Kullanıcının HER YERDE izi olan en zor durum. */
async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum');
    insert into auth.users (id, email) values ('${SILINEN}', 'silinen@x.co'), ('${BASKASI}', 'baska@x.co');
    update public.profiles set organization_id = '${KURUM}' where id in ('${SILINEN}', '${BASKASI}');
    update public.profiles set role = 'academic_manager' where id = '${SILINEN}';

    -- Kendi tezi: silinmeli.
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${KENDI_TEZI}', '${SILINEN}', '${KURUM}', 'Kendi tezim', 'thesis');
    insert into public.project_manuscripts (project_id, content, updated_by)
      values ('${KENDI_TEZI}', '{"type":"doc"}'::jsonb, '${SILINEN}');

    -- BAŞKASININ tezi: kalmalı, yalnızca atıf alanları boşalmalı.
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type,
                                          assignee_id, controller_approved_by)
      values ('${BASKA_TEZ}', '${BASKASI}', '${KURUM}', 'Başkasının tezi', 'thesis',
              '${SILINEN}', '${SILINEN}');
    insert into public.project_manuscripts (project_id, content, updated_by)
      values ('${BASKA_TEZ}', '{"type":"doc"}'::jsonb, '${SILINEN}');

    insert into public.consultancy_requests (requested_by, request_type, status, assigned_expert_id)
      values ('${BASKASI}', 'analysis', 'accepted', '${SILINEN}');
    insert into public.thesis_guidelines (university_name, created_by)
      values ('Örnek Üniversitesi', '${SILINEN}');
    insert into public.literature_sources (owner_id, title) values ('${SILINEN}', 'Kendi kaynağım');
    insert into public.ai_assistant_runs (user_id, capability, status, model)
      values ('${SILINEN}', 'analiz', 'completed', 'test');
  `);
}

const sayi = async (sql, p = []) => Number((await db.query(sql, p)).rows[0].n);

describe("hesap silme", () => {
  test("her yerde izi olan kullanıcı SİLİNEBİLİYOR", () =>
    islem(db, async () => {
      await tohum();
      // Eskiden burada "update or delete violates foreign key constraint" gelirdi.
      await db.query(`delete from auth.users where id = $1`, [SILINEN]);
      assert.equal(await sayi(`select count(*) n from public.profiles where id = $1`, [SILINEN]), 0);
    }));

  test("kendi verisi gidiyor", () =>
    islem(db, async () => {
      await tohum();
      await db.query(`delete from auth.users where id = $1`, [SILINEN]);
      assert.equal(await sayi(`select count(*) n from public.academic_projects where id = $1`, [KENDI_TEZI]), 0, "Kendi tezi");
      assert.equal(await sayi(`select count(*) n from public.project_manuscripts where project_id = $1`, [KENDI_TEZI]), 0, "Kendi metni");
      assert.equal(await sayi(`select count(*) n from public.literature_sources where owner_id = $1`, [SILINEN]), 0, "Kaynakları");
      assert.equal(await sayi(`select count(*) n from public.ai_assistant_runs where user_id = $1`, [SILINEN]), 0, "Asistan kayıtları");
    }));

  test("BAŞKASININ verisi duruyor; yalnızca atıf alanları boşalıyor", () =>
    islem(db, async () => {
      await tohum();
      await db.query(`delete from auth.users where id = $1`, [SILINEN]);

      // Cascade seçilseydi başkasının tezi ve kurumun kılavuzu da gidecekti.
      const { rows } = await db.query(
        `select assignee_id, controller_approved_by from public.academic_projects where id = $1`, [BASKA_TEZ]);
      assert.equal(rows.length, 1, "Başkasının tezi silinmemeli");
      assert.equal(rows[0].assignee_id, null);
      assert.equal(rows[0].controller_approved_by, null);

      const metin = await db.query(`select updated_by from public.project_manuscripts where project_id = $1`, [BASKA_TEZ]);
      assert.equal(metin.rows.length, 1, "Başkasının metni silinmemeli");
      assert.equal(metin.rows[0].updated_by, null);

      const talep = await db.query(`select assigned_expert_id from public.consultancy_requests`);
      assert.equal(talep.rows.length, 1, "Danışmanlık talebi silinmemeli");
      assert.equal(talep.rows[0].assigned_expert_id, null);

      const kilavuz = await db.query(`select created_by from public.thesis_guidelines`);
      assert.equal(kilavuz.rows.length, 1, "Kurumun kılavuzu silinmemeli");
      assert.equal(kilavuz.rows[0].created_by, null);
    }));

  test("silme talebi işaretlenip geri alınabiliyor", () =>
    islem(db, async () => {
      await tohum();
      await db.query(`update public.profiles set silme_talebi_at = now() where id = $1`, [SILINEN]);
      assert.equal(await sayi(`select count(*) n from public.profiles where silme_talebi_at is not null`), 1);
      // 30 gün içinde giriş: işaret temizlenir, hiçbir veri kaybolmamıştır.
      await db.query(`update public.profiles set silme_talebi_at = null where id = $1`, [SILINEN]);
      assert.equal(await sayi(`select count(*) n from public.academic_projects where owner_id = $1`, [SILINEN]), 1);
    }));

  /*
    Talebi kullanıcı KENDİ oturumuyla yazıyor (app/actions/hesap.ts), yönetim
    istemcisiyle değil. O yüzden asıl koruma RLS'te: sunucu eylemindeki
    .eq("id", user.id) bir kolaylık, kapı burada.
  */
  test("kullanıcı yalnızca KENDİ silme talebini yazabiliyor", () =>
    islem(db, async () => {
      await tohum();

      await rol(db, "authenticated", SILINEN);
      const kendi = await db.query(
        `update public.profiles set silme_talebi_at = now() where id = $1 returning id`, [SILINEN]);
      assert.equal(kendi.rows.length, 1, "Kendi talebini yazabilmeli");

      // Başkasının satırı: RLS hata vermez, HİÇBİR satır güncellemez.
      const baskasi = await db.query(
        `update public.profiles set silme_talebi_at = now() where id = $1 returning id`, [BASKASI]);
      assert.equal(baskasi.rows.length, 0, "Başkasının hesabını sildirtmemeli");

      await rol(db, "postgres");
      const { rows } = await db.query(
        `select silme_talebi_at from public.profiles where id = $1`, [BASKASI]);
      assert.equal(rows[0].silme_talebi_at, null);
    }));

  /* Cron'un aday sorgusu (app/api/cron/hesap-silme): yalnızca süresi dolanlar. */
  test("cron 30 günü dolmayanı almıyor, dolanı alıyor", () =>
    islem(db, async () => {
      await tohum();
      await db.query(
        `update public.profiles set silme_talebi_at = now() - interval '29 days' where id = $1`, [SILINEN]);
      await db.query(
        `update public.profiles set silme_talebi_at = now() - interval '31 days' where id = $1`, [BASKASI]);

      const adaylar = await db.query(
        `select id from public.profiles
          where silme_talebi_at is not null
            and silme_talebi_at <= now() - interval '30 days'`);
      assert.deepEqual(adaylar.rows.map((r) => r.id), [BASKASI]);
    }));
});
