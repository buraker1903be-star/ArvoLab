// Ortak referans verisi ve yorum silme kapsamı (migration 20260924100033).
//
// 100028 okumaları, 100031 çalışma yazmayı, 100032 puanlama kriterlerini
// kuruma bağladı. Denetimde üç yol daha açık çıktı ve hepsi SÜZGEÇSİZ
// istekte görünüyordu: "where ..." yazan bir istek SELECT politikasını da
// işletir, süzgeçsiz istek yalnızca yazma politikasına bakar. A kurumunun
// Akademik Yöneticisi tek istekle bütün müsvedde yorumlarını siliyor,
// herhangi bir üniversitenin kılavuzunu değiştirip siliyor ve YÖK birim
// dizininin tamamını eziyordu.
//
// Testler bu yüzden süzgeçsiz. MEŞRU AKIŞ da sınanıyor: koruma eklerken
// uygulamanın kendi yolunu kırmak bu depoda daha önce yaşandı (AGENTS.md).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-000000009001";
const YONETICI_A = "00000000-0000-4000-8000-000000009002";
const SAHIP_B = "00000000-0000-4000-8000-000000009003";

const KURUM_A = "00000000-0000-4000-8000-00000000a0a1";
const KURUM_B = "00000000-0000-4000-8000-00000000a0a2";

const PROJE_B = "00000000-0000-4000-8000-00000000b0b1";
const UNI = "00000000-0000-4000-8000-00000000c0c1";
const KILAVUZ_GENEL = "00000000-0000-4000-8000-00000000d0d1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'kurucu@x.co'), ('${YONETICI_A}', 'ya@x.co'), ('${SAHIP_B}', 'sb@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    update public.profiles set organization_id = '${KURUM_B}' where id = '${SAHIP_B}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${PROJE_B}', '${SAHIP_B}', '${KURUM_B}', 'B kurumunun tezi', 'thesis');
    insert into public.project_manuscripts (project_id, content) values ('${PROJE_B}', '{"type":"doc"}'::jsonb);
    insert into public.manuscript_comments (project_id, author_id, body)
      values ('${PROJE_B}', '${SAHIP_B}', 'B kurumunun yorumu');
    insert into public.universities (id, name, university_type) values ('${UNI}', 'B Üniversitesi', 'devlet');
    insert into public.academic_units (university_id, name, unit_type) values ('${UNI}', 'B Fakültesi', 'fakulte');
    insert into public.thesis_guidelines (id, university_name, citation_style, organization_id)
      values ('${KILAVUZ_GENEL}', 'B Üniversitesi', 'apa7', null);
  `);
}

/* Süzgeçsiz: hangi satıra dokunulabildiğini yalnızca yazma politikası belirler. */
const dene = async (kullanici, sql, params = []) => {
  await rol(db, "authenticated", kullanici);
  return (await db.query(sql, params)).affectedRows;
};

describe("ortak veri ve yorum yazma kapsamı", () => {
  test("başka kurumun müsvedde yorumu silinemiyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await dene(YONETICI_A, `delete from public.manuscript_comments`), 0);
    }));

  test("yorumun yazarı kendi yorumunu silmeye devam ediyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await dene(SAHIP_B, `delete from public.manuscript_comments`), 1);
    }));

  test("YÖK birim dizini kurum yöneticisine kapalı", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await dene(YONETICI_A, `update public.academic_units set name = 'EZİLDİ'`), 0);
      assert.equal(await dene(YONETICI_A, `delete from public.academic_units`), 0);
    }));

  test("üniversite listesine kurum yöneticisi ekleyemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await reddedilir(db,
        `insert into public.universities (name, university_type) values ('Sahte Üniversite', 'vakif')`,
        [], /row-level security/i);
    }));

  test("genel kılavuz kurum yöneticisine kapalı", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await dene(YONETICI_A, `update public.thesis_guidelines set citation_style = 'ieee'`), 0);
      assert.equal(await dene(YONETICI_A, `delete from public.thesis_guidelines`), 0);
    }));

  /*
    MEŞRU AKIŞ: kurum yöneticisi KENDİ kurumuna kılavuz ekleyip
    düzenleyebilmeli. createGuideline organization_id'yi profilinden
    damgalıyor; bu olmasaydı koruma, uygulamanın kendi yolunu kapatırdı.
  */
  test("kurum yöneticisi kendi kurumunun kılavuzunu ekler ve düzenler", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      const eklendi = await db.query(
        `insert into public.thesis_guidelines (university_name, citation_style, organization_id)
         values ('A Üniversitesi', 'apa7', $1)`, [KURUM_A]);
      assert.equal(eklendi.affectedRows, 1);
      // Süzgeçsiz düzenleme yalnızca kendi kurumunun satırına dokunuyor.
      assert.equal(await dene(YONETICI_A, `update public.thesis_guidelines set citation_style = 'ieee'`), 1);
      await rol(db, "postgres");
      const { rows } = await db.query(
        `select citation_style from public.thesis_guidelines where id = $1`, [KILAVUZ_GENEL]);
      assert.equal(rows[0].citation_style, "apa7");
    }));

  test("kurum yöneticisi genel kılavuz açamıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await reddedilir(db,
        `insert into public.thesis_guidelines (university_name, citation_style, organization_id)
         values ('Genel olmaya çalışıyor', 'apa7', null)`,
        [], /row-level security/i);
    }));

  test("iç ekip genel kayıtları yönetmeye devam ediyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await dene(KURUCU, `update public.thesis_guidelines set citation_style = 'ieee'`), 1);
      /* Birim sayısı şemadan gelen tohumla değişebiliyor; sayı yerine
         satırın gerçekten değiştiği doğrulanıyor. */
      assert.ok((await dene(KURUCU, `update public.academic_units set name = 'İç ekip düzeltti'`)) > 0);
      await rol(db, "postgres");
      const { rows } = await db.query(
        `select count(*)::int as n from public.academic_units where name <> 'İç ekip düzeltti'`);
      assert.equal(rows[0].n, 0);
    }));

  /* Kılavuzların OKUNMASI değişmedi: kimsenin kılavuzu kaybolmamalı. */
  test("kılavuz okuması herkese açık kalıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP_B);
      const { rows } = await db.query(`select id from public.thesis_guidelines`);
      assert.equal(rows.length, 1);
    }));
});
