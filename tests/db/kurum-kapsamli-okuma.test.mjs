// Denetim rolleri kendi kurumunun dışını okuyamaz (migration 20260924100028).
//
// Eskiden okuma politikalarındaki rol kontrolü kurumdan bağımsızdı: A
// kurumunun Kontrolörü B kurumunun çalışmalarını, metinlerini, yüklediği
// dosyaları ve asistan kayıtlarını okuyabiliyordu. Kurumu olmayan bireysel
// abonenin tezi de herhangi bir müşteri kurumun kontrolörüne açıktı.
//
// Burada üç şey birden sabitleniyor: kendi kurumunu görmeye devam etmeli,
// başka kurumu görmemeli, bireysel aboneyi hiç görmemeli. İç ekip
// (system_admin, founder) her yeri görmeye devam eder.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-0000000000f1";
const KONTROLOR_A = "00000000-0000-4000-8000-0000000000f2";
const SAHIP_A = "00000000-0000-4000-8000-0000000000f3";
const KONTROLOR_B = "00000000-0000-4000-8000-0000000000f4";
const SAHIP_B = "00000000-0000-4000-8000-0000000000f5";
const BIREYSEL = "00000000-0000-4000-8000-0000000000f6";
const UZMAN_A = "00000000-0000-4000-8000-0000000000f7";

const KURUM_A = "00000000-0000-4000-8000-0000000000e1";
const KURUM_B = "00000000-0000-4000-8000-0000000000e2";

const PROJE_A = "00000000-0000-4000-8000-0000000000d1";
const PROJE_B = "00000000-0000-4000-8000-0000000000d2";
const PROJE_BIREYSEL = "00000000-0000-4000-8000-0000000000d3";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'kurucu@x.co'), ('${KONTROLOR_A}', 'ka@x.co'), ('${SAHIP_A}', 'sa@x.co'),
      ('${KONTROLOR_B}', 'kb@x.co'), ('${SAHIP_B}', 'sb@x.co'), ('${BIREYSEL}', 'bi@x.co'),
      ('${UZMAN_A}', 'ua@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'controller', organization_id = '${KURUM_A}' where id = '${KONTROLOR_A}';
    update public.profiles set role = 'controller', organization_id = '${KURUM_B}' where id = '${KONTROLOR_B}';
    update public.profiles set role = 'expert', organization_id = '${KURUM_A}' where id = '${UZMAN_A}';
    update public.profiles set organization_id = '${KURUM_A}' where id = '${SAHIP_A}';
    update public.profiles set organization_id = '${KURUM_B}' where id = '${SAHIP_B}';
    -- Bireysel abonenin kurumu yok; profili varsayılan haliyle kalıyor.
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${PROJE_A}', '${SAHIP_A}', '${KURUM_A}', 'A kurumunun tezi', 'thesis'),
      ('${PROJE_B}', '${SAHIP_B}', '${KURUM_B}', 'B kurumunun tezi', 'thesis'),
      ('${PROJE_BIREYSEL}', '${BIREYSEL}', null, 'Bireysel abonenin tezi', 'thesis');
    insert into public.project_manuscripts (project_id, content) values
      ('${PROJE_A}', '{"type":"doc"}'::jsonb),
      ('${PROJE_B}', '{"type":"doc"}'::jsonb),
      ('${PROJE_BIREYSEL}', '{"type":"doc"}'::jsonb);
    insert into public.literature_sources (owner_id, title) values
      ('${SAHIP_B}', 'B kurumunun kaynağı'), ('${BIREYSEL}', 'Bireysel abonenin kaynağı');
    insert into public.consultancy_requests (requested_by, request_type, message, status) values
      ('${SAHIP_B}', 'analysis', 'B kurumunun talebi', 'open'),
      ('${BIREYSEL}', 'analysis', 'Bireysel abonenin talebi', 'open');
  `);
}

const gorunenCalismalar = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  const { rows } = await db.query(`select id from public.academic_projects order by title`);
  return rows.map((r) => r.id);
};

const sayi = async (kullanici, sorgu) => {
  await rol(db, "authenticated", kullanici);
  const { rows } = await db.query(sorgu);
  return Number(rows[0].n);
};

describe("kurum kapsamlı okuma", () => {
  test("Kontrolör kendi kurumunun çalışmasını görür, başka kurumunkini görmez", async () => {
    await islem(db, async () => {
      await tohum();
      assert.deepEqual(await gorunenCalismalar(KONTROLOR_A), [PROJE_A]);
      assert.deepEqual(await gorunenCalismalar(KONTROLOR_B), [PROJE_B]);
    });
  });

  test("Bireysel abonenin tezi hiçbir müşteri kurumun kontrolörüne görünmez", async () => {
    await islem(db, async () => {
      await tohum();
      for (const kontrolor of [KONTROLOR_A, KONTROLOR_B]) {
        assert.equal((await gorunenCalismalar(kontrolor)).includes(PROJE_BIREYSEL), false);
      }
      // Sahibi kendi tezini görmeye devam ediyor: koruma meşru yolu kapatmadı.
      assert.deepEqual(await gorunenCalismalar(BIREYSEL), [PROJE_BIREYSEL]);
    });
  });

  test("İç ekip (Kurucu) bütün kurumları görmeye devam eder", async () => {
    await islem(db, async () => {
      await tohum();
      const hepsi = await gorunenCalismalar(KURUCU);
      assert.equal(hepsi.length, 3);
    });
  });

  test("Metin, kaynak ve analiz kayıtları da kurumla sınırlı", async () => {
    await islem(db, async () => {
      await tohum();
      assert.equal(await sayi(KONTROLOR_A, `select count(*) n from public.project_manuscripts`), 1);
      assert.equal(await sayi(KONTROLOR_A, `select count(*) n from public.literature_sources`), 0);
      assert.equal(await sayi(KURUCU, `select count(*) n from public.project_manuscripts`), 3);
    });
  });

  test("Danışmanlık talebi yalnızca kendi kurumunun uzmanına düşer", async () => {
    await islem(db, async () => {
      await tohum();
      // A kurumunun uzmanı B kurumunun da bireysel abonenin de talebini görmez.
      assert.equal(await sayi(UZMAN_A, `select count(*) n from public.consultancy_requests`), 0);
      // Bireysel abonenin talebi iç ekibe düşer; yoksa kimseye ulaşmazdı.
      assert.equal(await sayi(KURUCU, `select count(*) n from public.consultancy_requests`), 2);
    });
  });

  test("Depodaki ham dosya başka kurumun kontrolörüne kapalı", async () => {
    await islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await db.exec(`
        insert into storage.buckets (id, name) values ('project-files', 'project-files')
          on conflict (id) do nothing;
        insert into storage.objects (bucket_id, name, owner) values
          ('project-files', '${SAHIP_B}/tez.docx', '${SAHIP_B}'),
          ('project-files', '${BIREYSEL}/tez.docx', '${BIREYSEL}');
      `);
      assert.equal(await sayi(KONTROLOR_A, `select count(*) n from storage.objects`), 0);
      assert.equal(await sayi(KONTROLOR_B, `select count(*) n from storage.objects`), 1);
      assert.equal(await sayi(BIREYSEL, `select count(*) n from storage.objects`), 1);
    });
  });
});
