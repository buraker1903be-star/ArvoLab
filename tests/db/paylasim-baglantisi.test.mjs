// Danışman paylaşım bağlantısının süre sınırı (20260920090000,
// 20261029133812). Sınır created_at'e göre yazılmış bir check; created_at
// istemciden yazılabildiği sürece kısıt hiçbir şeyi sınırlamıyordu.
import { before, describe, test } from "node:test";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-000000000011";
const CALISMA = "00000000-0000-4000-8000-0000000000d1";
const OZET = "a".repeat(64);

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 'p@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type)
      values ('${CALISMA}', '${SAHIP}', 'Tez', 'thesis');
  `);
}

describe("paylaşım bağlantısı", () => {
  test("uygulamanın eklemesi geçer (meşru akış)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      // app/actions/share-links.ts'in yazdığı sütunlar, birebir.
      await db.query(
        `insert into public.manuscript_share_links (project_id, token_hash, label, created_by, expires_at)
           values ($1, $2, 'Danışman', $3, now() + interval '30 days')`,
        [CALISMA, OZET, SAHIP],
      );
    }));

  test("created_at yazılarak 90 gün sınırı aşılamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await reddedilir(
        db,
        `insert into public.manuscript_share_links (project_id, token_hash, created_by, created_at, expires_at)
           values ($1, $2, $3, '2199-01-01', '2199-03-31')`,
        [CALISMA, OZET, SAHIP],
        /permission denied/i,
      );
    }));

  test("sayaç ve iptal de eklemede yazılamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await reddedilir(
        db,
        `insert into public.manuscript_share_links (project_id, token_hash, created_by, expires_at, view_count)
           values ($1, $2, $3, now() + interval '7 days', 5)`,
        [CALISMA, OZET, SAHIP],
        /permission denied/i,
      );
    }));
});
