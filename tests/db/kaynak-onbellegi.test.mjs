// Akademik doğrulama önbelleği (migration 20260924100021).
//
// Bu tablo "bu künye doğrulandı" diyor. İstemciye açık olsaydı kullanıcı
// uydurma bir kaynağı kendi eliyle doğrulanmış gösterebilirdi — akademik
// denetimde bundan ağır bir açık yok. Testler kapının kapalı olduğunu
// sabitliyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const UYE = "00000000-0000-4000-8000-0000000000c1";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${UYE}', 'ogrenci@example.com');
    insert into public.kaynak_dogrulama_onbellegi (anahtar, durum, eslesmeler, en_iyi, gecerlilik)
    values ('orgutsel baglılık|2020', 'verified', '[]'::jsonb, null, now() + interval '90 days');
  `);
}

describe("kaynak doğrulama önbelleği", () => {
  test("oturumlu kullanıcı okuyamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", UYE);
      await reddedilir(db, `select * from public.kaynak_dogrulama_onbellegi`, [], /permission denied/);
    }));

  test("anonim kullanıcı okuyamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "anon");
      await reddedilir(db, `select * from public.kaynak_dogrulama_onbellegi`, [], /permission denied/);
    }));

  /*
    Asıl tehlike bu: kullanıcı kendi uydurma kaynağını "doğrulandı" diye
    yazabilseydi denetim anlamını yitirirdi.
  */
  test("oturumlu kullanıcı doğrulanmış kayıt yazamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", UYE);
      await reddedilir(db,
        `insert into public.kaynak_dogrulama_onbellegi (anahtar, durum, gecerlilik)
         values ('uydurma kaynak|2024', 'verified', now() + interval '90 days')`,
        [], /permission denied/);
    }));

  test("sunucu okuyup yazabiliyor (meşru akış)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      const okunan = await tek(`select durum from public.kaynak_dogrulama_onbellegi where anahtar = $1`, ["orgutsel baglılık|2020"]);
      assert.equal(okunan.durum, "verified");

      // Aynı künyeye ikinci kez bakılabilir; çakışma düşürmemeli.
      await db.query(
        `insert into public.kaynak_dogrulama_onbellegi (anahtar, durum, gecerlilik)
         values ($1, 'not_found', now() + interval '7 days')
         on conflict (anahtar) do update set durum = excluded.durum, gecerlilik = excluded.gecerlilik`,
        ["orgutsel baglılık|2020"],
      );
      const yeni = await tek(`select durum from public.kaynak_dogrulama_onbellegi where anahtar = $1`, ["orgutsel baglılık|2020"]);
      assert.equal(yeni.durum, "not_found");
    }));

  test("bilinmeyen durum kabul edilmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      await reddedilir(db,
        `insert into public.kaynak_dogrulama_onbellegi (anahtar, durum, gecerlilik)
         values ('x y|2020', 'kesin dogru', now())`,
        [], /kaynak_dogrulama_onbellegi_durum_check/);
    }));

  test("temizlik yalnızca süresi 30 günden fazla geçmişleri siler", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await db.exec(`
        insert into public.kaynak_dogrulama_onbellegi (anahtar, durum, gecerlilik) values
          ('eski kayit|2019', 'not_found', now() - interval '40 days'),
          ('yeni gecmis|2019', 'not_found', now() - interval '3 days');
      `);
      await rol(db, "service_role");
      const silinen = await tek(`select public.kaynak_onbellegini_temizle() as n`);
      assert.equal(silinen.n, 1);
      const kalan = await tek(`select count(*)::int as n from public.kaynak_dogrulama_onbellegi`);
      // Süresi yeni geçmiş satır DURUYOR: doğrulama yolu onu zaten yok
      // sayıyor, üstüne yazılarak tazelenebilir.
      assert.equal(kalan.n, 2);
    }));
});
