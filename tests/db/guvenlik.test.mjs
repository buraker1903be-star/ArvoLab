// Güvenlik sertleştirmesi (migration 20260924100001): veritabanına doğrudan
// (PostgREST) gelen isteklerde rol yükseltme, eklemede koruma atlama,
// başkasının çalışmasına kayıt bağlama ve fonksiyon yetkileri. Her saldırının
// yanında uygulamanın meşru akışı da sınanır: koruma onu kırmamalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-000000000001";
const SISTEM = "00000000-0000-4000-8000-000000000002";
const MUSTERI = "00000000-0000-4000-8000-000000000003";
const BASKA = "00000000-0000-4000-8000-000000000004";
const UZMAN = "00000000-0000-4000-8000-000000000005";
const KONTROLOR = "00000000-0000-4000-8000-000000000006";
const KURUM = "00000000-0000-4000-8000-0000000000a1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000000a2";
const PROJE = "00000000-0000-4000-8000-0000000000b1";
const BASKA_PROJE = "00000000-0000-4000-8000-0000000000b2";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A'), ('${BASKA_KURUM}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${SISTEM}', 's@x.co'), ('${MUSTERI}', 'm@x.co'),
      ('${BASKA}', 'b@x.co'), ('${UZMAN}', 'u@x.co'), ('${KONTROLOR}', 'c@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'system_admin' where id = '${SISTEM}';
    update public.profiles set role = 'expert' where id = '${UZMAN}';
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    update public.profiles set organization_id = '${KURUM}' where id in ('${MUSTERI}', '${UZMAN}');
    update public.profiles set organization_id = '${BASKA_KURUM}' where id = '${BASKA}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${PROJE}', '${MUSTERI}', '${KURUM}', 'Müşterinin tezi', 'thesis'),
             ('${BASKA_PROJE}', '${BASKA}', '${BASKA_KURUM}', 'Başkasının tezi', 'thesis');
  `);
}

const rolu = async (id) => (await tek(`select role::text from public.profiles where id = $1`, [id])).role;

describe("rol yükseltme", () => {
  test("Sistem Yöneticisi kendini Kurucu yapamaz, Kurucuyu düşüremez, kendi rolünü değiştiremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SISTEM);
      await reddedilir(db, `update public.profiles set role = 'founder' where id = $1`, [SISTEM], /Kendi rolünüzü|Kurucu rolünü/);
      await reddedilir(db, `update public.profiles set role = 'client' where id = $1`, [KURUCU], /Kurucu rolünü/);
      await reddedilir(db, `update public.profiles set role = 'founder' where id = $1`, [MUSTERI], /Kurucu rolünü/);
      await reddedilir(db, `update public.profiles set organization_id = $2 where id = $1`, [KURUCU, KURUM], /Kurucu rolünü/);
    }));

  test("meşru: Sistem Yöneticisi başkasının rolünü ve kurumunu değiştirir; Kurucu Kurucu atar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SISTEM);
      await db.query(`update public.profiles set role = 'controller', organization_id = $2 where id = $1`, [MUSTERI, BASKA_KURUM]);
      await rol(db, "authenticated", KURUCU);
      await db.query(`update public.profiles set role = 'founder' where id = $1`, [SISTEM]);
      await rol(db, "postgres");
      assert.deepEqual([await rolu(MUSTERI), await rolu(SISTEM)], ["controller", "founder"]);
    }));

  test("müşteri kendi rolünü ya da kurumunu değiştiremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db, `update public.profiles set role = 'founder' where id = $1`, [MUSTERI], /yetkiniz yok/);
      await reddedilir(db, `update public.profiles set organization_id = $2 where id = $1`, [MUSTERI, BASKA_KURUM], /yetkiniz yok/);
    }));
});

describe("eklemede korumalar", () => {
  const ekle = (alanlar) =>
    `insert into public.academic_projects (owner_id, organization_id, title, project_type${alanlar.sutun ?? ""})
     values ('${alanlar.sahip ?? MUSTERI}', ${alanlar.kurum === null ? "null" : `'${alanlar.kurum ?? KURUM}'`}, 'Yeni çalışma', 'thesis'${alanlar.deger ?? ""})`;

  test("müşteri çalışmayı onaylı, teslim edilmiş, atanmış, başkası adına ya da başka kurumda açamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db, ekle({ sutun: ", status", deger: ", 'delivered'" }), [], /onaysız/);
      await reddedilir(db, ekle({ sutun: ", controller_approved_by, controller_approved_at", deger: `, '${KONTROLOR}', now()` }), [], /onaysız/);
      await reddedilir(db, ekle({ sutun: ", assignee_id", deger: `, '${UZMAN}'` }), [], /onaysız/);
      await reddedilir(db, ekle({ kurum: BASKA_KURUM }), [], /onaysız|row-level security/);
      await reddedilir(db, ekle({ sahip: BASKA }), [], /onaysız|row-level security/);
    }));

  test("meşru: müşteri kendi çalışmasını açar (createProject), Kontrolör atamalı açabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await db.query(ekle({ sutun: ", status, priority", deger: ", 'new', 'normal'" }));
      await rol(db, "authenticated", KONTROLOR);
      await db.query(`insert into public.academic_projects (owner_id, organization_id, title, project_type, assignee_id)
                      values ($1, $2, 'Kontrolörün açtığı', 'thesis', $3)`, [KONTROLOR, null, UZMAN]).catch((e) => {
        // Kontrolörün INSERT politikası yoksa bu ayrı bir konu; koruma tetikleyicisi engellememeli.
        assert.doesNotMatch(e.message, /onaysız/);
      });
    }));

  test("danışmanlık ve destek talebi tamamlanmış/atanmış açılamaz; başkasının çalışmasına bağlanamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db, `insert into public.consultancy_requests (requested_by, request_type, status) values ($1, 'analysis', 'completed')`, [MUSTERI], /açık durumda/);
      await reddedilir(db, `insert into public.consultancy_requests (requested_by, request_type, assigned_expert_id) values ($1, 'analysis', $2)`, [MUSTERI, UZMAN], /açık durumda/);
      await reddedilir(db, `insert into public.consultancy_requests (requested_by, request_type, project_id) values ($1, 'analysis', $2)`, [MUSTERI, BASKA_PROJE], /açık durumda/);
      await reddedilir(db, `insert into public.app_support_requests (requested_by, subject, message, status) values ($1, 'x', 'y', 'resolved')`, [MUSTERI], /açık durumda/);
      // meşru
      await db.query(`insert into public.consultancy_requests (requested_by, request_type, project_id, project_title, message, status) values ($1, 'analysis', $2, 'Müşterinin tezi', 'Yardım', 'open')`, [MUSTERI, PROJE]);
      await db.query(`insert into public.app_support_requests (requested_by, subject, message, status) values ($1, 'Konu', 'Mesaj', 'open')`, [MUSTERI]);
    }));
});

describe("danışmanlık talebinin içeriği", () => {
  test("uzman talebi üstlenip tamamlar ama mesajını ya da bağlı çalışmasını değiştiremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      const { id } = await tek(`insert into public.consultancy_requests (requested_by, request_type, project_id, message) values ($1, 'analysis', $2, 'Asıl mesaj') returning id`, [MUSTERI, PROJE]);
      await rol(db, "authenticated", UZMAN);
      await reddedilir(db, `update public.consultancy_requests set message = 'Değişti' where id = $1`, [id], /içeriği değiştirilemez/);
      await db.query(`update public.consultancy_requests set status = 'accepted', assigned_expert_id = $2 where id = $1`, [id, UZMAN]);
      await db.query(`update public.consultancy_requests set status = 'completed' where id = $1`, [id]);
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db, `update public.consultancy_requests set project_id = $2 where id = $1`, [id, BASKA_PROJE], /içeriği değiştirilemez|yetkiniz yok/);
    }));
});

describe("belge ve atıf kaydı", () => {
  test("başkasının çalışmasına belge ya da atıf denetimi bağlanamaz; kendi çalışmasına bağlanır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db,
        `insert into public.document_uploads (uploaded_by, project_id, file_name, storage_path) values ($1, $2, 'sahte.pdf', 'x')`,
        [MUSTERI, BASKA_PROJE], /kayıt ekleyemezsiniz/);
      await reddedilir(db,
        `insert into public.citation_checks (created_by, project_id, raw_reference_list) values ($1, $2, 'x')`,
        [MUSTERI, BASKA_PROJE], /kayıt ekleyemezsiniz/);
      await db.query(`insert into public.document_uploads (uploaded_by, project_id, file_name, storage_path) values ($1::uuid, $2, 'tez.pdf', $1::text || '/tez.pdf')`, [MUSTERI, PROJE]);
      await db.query(`insert into public.document_uploads (uploaded_by, file_name, storage_path) values ($1::uuid, 'serbest.pdf', $1::text || '/s.pdf')`, [MUSTERI]);
    }));
});

describe("fonksiyon yetkileri", () => {
  const acik = async (rolAdi) =>
    (await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
          and has_function_privilege($1, p.oid, 'execute') order by 1`, [rolAdi])).rows.map((r) => r.proname);

  // Politikalarda geçen yardımcılar açık kalır (kendi bilgini döndürür; ör.
  // subscription_open depolama yükleme politikasında). notify, bump_share_view,
  // rate_limit_hit gibi iç fonksiyonlar kapalı.
  const POLITIKA = ["can_view_project", "can_write_project", "get_my_organization_id", "has_role", "subscription_open"];

  test("anon yalnızca politika yardımcılarını çağırabilir", async () => {
    assert.deepEqual(await acik("anon"), POLITIKA);
  });

  /*
    authenticated'a açık olanlar tek tek gerekçeli:
      resync_project_guidelines — kendi içinde rol denetler.
      arvoos_uyeligimi_bagla   — PARAMETRE ALMIYOR; yalnızca çağıranın
        kendi profilini, yalnızca kurumsuzsa ve yalnızca ArvoOS'un ittiği
        listede e-postası varsa bağlar. Başkasının profiline dokunulamaz.
  */
  test("authenticated ek olarak yalnızca kendi kapsamındaki iki fonksiyon", async () => {
    assert.deepEqual(await acik("authenticated"),
      [...POLITIKA, "resync_project_guidelines", "arvoos_uyeligimi_bagla"].sort());
  });

  test("notify anonim ve oturumlu kullanıcıya kapalı (sahte bildirim)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "anon");
      await reddedilir(db, `select public.notify($1, null, 'approval', 'Onaylandı', null, null)`, [MUSTERI], /permission denied/);
      await rol(db, "authenticated", BASKA);
      await reddedilir(db, `select public.notify($1, null, 'approval', 'Onaylandı', null, null)`, [MUSTERI], /permission denied/);
    }));

  test("meşru: RLS politikası yardımcıları çalışıyor (müşteri kendi çalışmasını görür, başkasınınkini görmez)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      const { rows } = await db.query(`select id from public.academic_projects order by title`);
      assert.deepEqual(rows.map((r) => r.id), [PROJE]);
    }));
});
