// Bir çalışmanın METNİNİ kim değiştirebilir (migration 20260924100018).
//
// Kural okuma ile yazma arasında ayrışmıştı: denetim rolleri (Kontrolör,
// Akademik Yönetici, Sistem Yöneticisi, Kurucu) başkasının tezini editörde
// açıp yazabiliyor ama kaydedemiyordu — güncelleme hiçbir satıra değmiyor,
// ekleme RLS'e takılıyordu. Canlıda "Kaydedilirken bir hata oluştu" olarak
// göründü ve yazılanlar kayboldu (23.09.2026).
//
// Burada hem o akış hem de korunması gereken sınır sabitleniyor: başka bir
// müşteri hiçbir koşulda başkasının metnine dokunamaz.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-000000000001";
const KONTROLOR = "00000000-0000-4000-8000-000000000002";
const SAHIP = "00000000-0000-4000-8000-000000000003";
const UZMAN = "00000000-0000-4000-8000-000000000004";
const YABANCI = "00000000-0000-4000-8000-000000000005";
const KURUM = "00000000-0000-4000-8000-0000000000a1";
const PROJE = "00000000-0000-4000-8000-0000000000b1";

const METIN = `'{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb`;

let db;
before(async () => {
  db = await veritabani();
});

async function tohum({ metinVar = true } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${KONTROLOR}', 'c@x.co'), ('${SAHIP}', 's@x.co'),
      ('${UZMAN}', 'u@x.co'), ('${YABANCI}', 'y@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    update public.profiles set role = 'expert' where id = '${UZMAN}';
    update public.profiles set organization_id = '${KURUM}' where id in ('${SAHIP}', '${UZMAN}', '${YABANCI}');
    insert into public.academic_projects (id, owner_id, assignee_id, organization_id, title, project_type)
      values ('${PROJE}', '${SAHIP}', '${UZMAN}', '${KURUM}', 'Personelin tezi', 'thesis');
  `);
  if (metinVar) {
    await db.exec(`insert into public.project_manuscripts (project_id, content) values ('${PROJE}', ${METIN});`);
  }
}

const yazabildi = async (kullanici) => {
  await rol(db, "authenticated", kullanici);
  const sonuc = await db.query(
    `update public.project_manuscripts set word_count = word_count + 1
     where project_id = $1 returning project_id`,
    [PROJE],
  );
  return sonuc.rows.length === 1;
};

describe("çalışma metnini kaydetme", () => {
  test("denetim rolleri başkasının metnini güncelleyebilir", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await yazabildi(KURUCU), true, "Kurucu kaydedemedi");
      assert.equal(await yazabildi(KONTROLOR), true, "Kontrolör kaydedemedi");
    }));

  test("meşru yollar: sahip ve atanan uzman kaydedebilir", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await yazabildi(SAHIP), true, "Sahip kaydedemedi");
      assert.equal(await yazabildi(UZMAN), true, "Atanan uzman kaydedemedi");
    }));

  test("metin satırı hiç yokken de eklenebilir (editörün ilk kaydı)", () =>
    islem(db, async () => {
      await tohum({ metinVar: false });
      await rol(db, "authenticated", KURUCU);
      const eklendi = await db.query(
        `insert into public.project_manuscripts (project_id, content) values ($1, ${METIN}) returning project_id`,
        [PROJE],
      );
      assert.equal(eklendi.rows.length, 1);
    }));

  test("sürüm geçmişi de yazılabilir (otomatik anlık görüntü kaydı kırmasın)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KONTROLOR);
      const surum = await db.query(
        `insert into public.project_manuscript_versions (project_id, content, created_by)
         values ($1, ${METIN}, $2) returning id`,
        [PROJE, KONTROLOR],
      );
      assert.equal(surum.rows.length, 1);
    }));

  test("sınır: başka bir müşteri metni ne görür ne yazar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      const gorunen = await db.query(`select project_id from public.project_manuscripts where project_id = $1`, [PROJE]);
      assert.equal(gorunen.rows.length, 0, "Yabancı metni görebiliyor");
      assert.equal(await yazabildi(YABANCI), false, "Yabancı metni değiştirebiliyor");
      await rol(db, "authenticated", YABANCI);
      await reddedilir(
        db,
        `insert into public.project_manuscripts (project_id, content) values ($1, ${METIN})`,
        [PROJE],
        /row-level security/,
      );
    }));
});

describe("editör resimlerinin depo klasörü", () => {
  const yukle = async (kullanici, ad) => {
    await rol(db, "authenticated", kullanici);
    await db.query(`insert into storage.objects (bucket_id, name, owner) values ('project-files', $1, $2)`, [ad, kullanici]);
  };

  test("denetim rolü çalışmanın klasörüne resim yükleyebilir; sahibi onu görebilir", () =>
    islem(db, async () => {
      await tohum();
      await yukle(KURUCU, `${PROJE}/editor-images/1-sekil.png`);
      await rol(db, "authenticated", SAHIP);
      const gorunen = await db.query(`select name from storage.objects where name = $1`, [`${PROJE}/editor-images/1-sekil.png`]);
      assert.equal(gorunen.rows.length, 1, "Sahip, denetim rolünün eklediği resmi göremiyor");
    }));

  test("sınır: yabancı ne çalışmanın klasörüne yükleyebilir ne de denetim rolü başkasının klasörüne", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      await reddedilir(
        db,
        `insert into storage.objects (bucket_id, name, owner) values ('project-files', $1, $2)`,
        [`${PROJE}/editor-images/sahte.png`, YABANCI],
        /row-level security/,
      );
      // calisma_klasoru null döndüğünde can_write_project denetim rolüne "evet"
      // der; politika bu yüzden null'ı ayrıca eliyor.
      await rol(db, "authenticated", KURUCU);
      await reddedilir(
        db,
        `insert into storage.objects (bucket_id, name, owner) values ('project-files', $1, $2)`,
        [`${SAHIP}/imports/baskasinin-dosyasi.docx`, KURUCU],
        /row-level security/,
      );
    }));
});
