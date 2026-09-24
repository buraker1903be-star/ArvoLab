// Kılavuz eşleştirmesi kurumu gözetir (migration 20260924100034).
//
// 20260924100033 kılavuzlara organization_id ekledi ama eşleştirmeyi yapan
// best_guideline_for yalnızca university_id'ye bakıyordu. A kurumunun kendi
// kılavuzu, aynı üniversitedeki B kurumunun ve bireysel abonenin tezine de
// uygulanıyordu — sessizce, çünkü bağı veritabanı kuruyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const SAHIP_A = "00000000-0000-4000-8000-00000000e101";
const SAHIP_B = "00000000-0000-4000-8000-00000000e102";
const BIREYSEL = "00000000-0000-4000-8000-00000000e103";

const KURUM_A = "00000000-0000-4000-8000-00000000e201";
const KURUM_B = "00000000-0000-4000-8000-00000000e202";

const UNI = "00000000-0000-4000-8000-00000000e301";
const K_GENEL = "00000000-0000-4000-8000-00000000e401";
const K_A = "00000000-0000-4000-8000-00000000e402";

let db;
before(async () => {
  db = await veritabani();
});

const ONAY = `'{"citation_style":"apa7","required_sections":["Giriş","Yöntem","Bulgular","Sonuç"],"extracted_rules":{"font_size_pt":12},"approved_at":"2026-09-01T00:00:00Z"}'::jsonb`;
const ONAY_A = `'{"citation_style":"mla","required_sections":["Giriş","Yöntem","Bulgular","Sonuç"],"extracted_rules":{"font_size_pt":11},"approved_at":"2026-09-02T00:00:00Z"}'::jsonb`;

async function tohum({ kurumKilavuzu = true } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${SAHIP_A}', 'sa@x.co'), ('${SAHIP_B}', 'sb@x.co'), ('${BIREYSEL}', 'bi@x.co');
    update public.profiles set organization_id = '${KURUM_A}' where id = '${SAHIP_A}';
    update public.profiles set organization_id = '${KURUM_B}' where id = '${SAHIP_B}';
    insert into public.universities (id, name, university_type) values ('${UNI}', 'X Üniversitesi', 'devlet');
    insert into public.thesis_guidelines
      (id, university_id, university_name, citation_style, organization_id, analysis_status, approved_snapshot)
      values ('${K_GENEL}', '${UNI}', 'X Üniversitesi', 'apa7', null, 'approved', ${ONAY});
    ${kurumKilavuzu ? `
    insert into public.thesis_guidelines
      (id, university_id, university_name, citation_style, organization_id, analysis_status, approved_snapshot)
      values ('${K_A}', '${UNI}', 'X Üniversitesi', 'mla', '${KURUM_A}', 'approved', ${ONAY_A});` : ""}
  `);
}

const tezAc = async (sahip, kurum) => {
  await rol(db, "postgres");
  const { rows } = await db.query(
    `insert into public.academic_projects (owner_id, organization_id, university_id, title, project_type)
     values ($1, $2, '${UNI}', 'Tez', 'thesis') returning guideline_id, citation_style`,
    [sahip, kurum],
  );
  return rows[0];
};

describe("kılavuz eşleştirmesi kurumu gözetir", () => {
  test("kurum kendi kılavuzunu alır", () =>
    islem(db, async () => {
      await tohum();
      const tez = await tezAc(SAHIP_A, KURUM_A);
      assert.equal(tez.guideline_id, K_A);
      // Atıf sistemi de kurumun kendi kılavuzundan geliyor.
      assert.equal(tez.citation_style, "mla");
    }));

  test("başka kurumun kılavuzu uygulanmıyor", () =>
    islem(db, async () => {
      await tohum();
      const tez = await tezAc(SAHIP_B, KURUM_B);
      assert.equal(tez.guideline_id, K_GENEL, "B kurumuna ortak katalog uygulanmalı");
      assert.equal(tez.citation_style, "apa7");
    }));

  /*
    Bireysel abonenin kurumu NULL. İki NULL'ı eşit saymak bütün bireysel
    aboneleri herhangi bir müşteri kurumun kurallarına bağlardı.
  */
  test("bireysel aboneye yalnızca ortak katalog uygulanır", () =>
    islem(db, async () => {
      await tohum();
      const tez = await tezAc(BIREYSEL, null);
      assert.equal(tez.guideline_id, K_GENEL);
    }));

  test("kurumun kendi kılavuzu yoksa ortak katalog uygulanır", () =>
    islem(db, async () => {
      await tohum({ kurumKilavuzu: false });
      const tez = await tezAc(SAHIP_A, KURUM_A);
      assert.equal(tez.guideline_id, K_GENEL);
    }));

  /*
    Kurumun kendi kılavuzu ortak katalogdaki DAHA DAR kapsamlı kayıttan da
    önce gelmeli: kurum kendi kılavuzunu bilerek yükledi.
  */
  test("kurumun kılavuzu ortak katalogdaki bölüm kaydını da geçer", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      const { rows: birim } = await db.query(
        `insert into public.academic_units (university_id, name, unit_type)
         values ('${UNI}', 'Eğitim Fakültesi', 'fakulte') returning id`);
      await db.query(
        `insert into public.thesis_guidelines
           (university_id, university_name, citation_style, academic_unit_id, organization_id, analysis_status, approved_snapshot)
         values ('${UNI}', 'X Üniversitesi', 'ieee', $1, null, 'approved', ${ONAY})`,
        [birim[0].id]);
      const { rows } = await db.query(
        `insert into public.academic_projects (owner_id, organization_id, university_id, academic_unit_id, title, project_type)
         values ($1, $2, '${UNI}', $3, 'Tez', 'thesis') returning guideline_id`,
        [SAHIP_A, KURUM_A, birim[0].id]);
      assert.equal(rows[0].guideline_id, K_A);
    }));
});
