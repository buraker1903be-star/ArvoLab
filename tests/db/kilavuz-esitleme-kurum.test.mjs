// Kılavuz eşitlemesi kurum sınırında (20261029143810).
//
// resync_project_guidelines çıplak has_role ile açıktı ve "eski davranış"
// dalı kılavuzun kurumuna bakmadan, üniversite adı eşleşen her bağsız teze
// kılavuzu bağlıyordu: A kurumunun yöneticisi çağırınca B'nin tezi ve
// bireysel abonenin tezi A'nın kılavuzuna geçiyor, atıf stilleri değişiyordu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM_A = "00000000-0000-4000-8000-00000000e001";
const KURUM_B = "00000000-0000-4000-8000-00000000e002";
const YONETICI_A = "00000000-0000-4000-8000-00000000e101";
const YONETICI_B = "00000000-0000-4000-8000-00000000e102";
const OGRENCI_A = "00000000-0000-4000-8000-00000000e201";
const OGRENCI_B = "00000000-0000-4000-8000-00000000e202";
const BIREYSEL = "00000000-0000-4000-8000-00000000e203";
const KILAVUZ_A = "00000000-0000-4000-8000-00000000e301";
const GENEL = "00000000-0000-4000-8000-00000000e302";
const TEZ_A = "00000000-0000-4000-8000-00000000e401";
const TEZ_B = "00000000-0000-4000-8000-00000000e402";
const TEZ_BIREYSEL = "00000000-0000-4000-8000-00000000e403";

const ONAY = `'{"citation_style":"mla","required_sections":["Giriş"],"extracted_rules":{"font_size_pt":12},"approved_at":"2026-09-01T00:00:00Z"}'::jsonb`;

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'A'), ('${KURUM_B}', 'B');
    insert into auth.users (id, email) values
      ('${YONETICI_A}', 'ya@x.co'), ('${YONETICI_B}', 'yb@x.co'),
      ('${OGRENCI_A}', 'oa@x.co'), ('${OGRENCI_B}', 'ob@x.co'), ('${BIREYSEL}', 'bi@x.co');
    update public.profiles set organization_id = '${KURUM_A}' where id in ('${YONETICI_A}', '${OGRENCI_A}');
    update public.profiles set organization_id = '${KURUM_B}' where id in ('${YONETICI_B}', '${OGRENCI_B}');
    update public.profiles set role = 'academic_manager' where id in ('${YONETICI_A}', '${YONETICI_B}');
    insert into public.academic_projects (id, owner_id, organization_id, university, title, project_type, citation_style) values
      ('${TEZ_A}', '${OGRENCI_A}', '${KURUM_A}', 'Ortak Üniversitesi', 'A tezi', 'thesis', 'apa7'),
      ('${TEZ_B}', '${OGRENCI_B}', '${KURUM_B}', 'Ortak Üniversitesi', 'B tezi', 'thesis', 'apa7'),
      ('${TEZ_BIREYSEL}', '${BIREYSEL}', null, 'Ortak Üniversitesi', 'Bireysel tez', 'thesis', 'apa7');
    insert into public.thesis_guidelines (id, organization_id, university_name, citation_style, analysis_status, is_active, approved_snapshot) values
      ('${KILAVUZ_A}', '${KURUM_A}', 'Ortak Üniversitesi', 'mla', 'approved', true, ${ONAY}),
      ('${GENEL}', null, 'Ortak Üniversitesi', 'mla', 'approved', true, ${ONAY});
  `);
}

const bag = async () => {
  await rol(db, "postgres");
  const { rows } = await db.query(
    `select id, guideline_id, citation_style from public.academic_projects where id in ($1, $2, $3) order by title`,
    [TEZ_A, TEZ_B, TEZ_BIREYSEL],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
};

describe("kılavuz eşitlemesi kurum sınırında", () => {
  test("kurumun kılavuzu yalnızca o kurumun tezine bağlanır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_A);
      await db.query(`select public.resync_project_guidelines($1)`, [KILAVUZ_A]);
      const b = await bag();
      assert.equal(b[TEZ_A].guideline_id, KILAVUZ_A);
      // Eskiden ikisi de A'nın kılavuzuna bağlanıp mla'ya dönüyordu.
      assert.equal(b[TEZ_B].guideline_id, null);
      assert.equal(b[TEZ_B].citation_style, "apa7");
      assert.equal(b[TEZ_BIREYSEL].guideline_id, null);
    }));

  test("başka kurumun yöneticisi eşitleyemez, genel kılavuzu yalnızca iç ekip eşitler", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI_B);
      await reddedilir(db, `select public.resync_project_guidelines($1)`, [KILAVUZ_A], /kendi kurumunun/);
      await reddedilir(db, `select public.resync_project_guidelines($1)`, [GENEL], /iç ekip/);
    }));
});

describe("geri bildirim kuyruğu", () => {
  test("geri bildirimin kurumu yazanın kurumundan gelir, istemciden değil", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI_A);
      await db.query(
        `insert into public.product_feedback (user_id, organization_id, status, score) values ($1, $2, 'answered', 4)`,
        [OGRENCI_A, KURUM_B],
      );
      await rol(db, "postgres");
      const { rows } = await db.query(`select organization_id from public.product_feedback where user_id = $1`, [OGRENCI_A]);
      assert.equal(rows[0].organization_id, KURUM_A);
    }));
});
