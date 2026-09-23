// Kaydedilen analiz sonuçları (migration 20260924100024).
//
// Tablo kullanıcının ham verisini değil, ekranda zaten gördüğü APA metnini
// tutuyor; yine de başkasının analizini okumak ya da yapılmış bir hesabın
// tutanağını sonradan değiştirmek mümkün olmamalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000000f1";
const BASKASI = "00000000-0000-4000-8000-0000000000f2";
const KURUM = "00000000-0000-4000-8000-0000000000f3";
const SONUC = "00000000-0000-4000-8000-0000000000f9";

let db;
before(async () => {
  db = await veritabani();
});

const sayi = async () =>
  (await db.query(`select count(*)::int as n from public.analiz_sonuclari`)).rows[0].n;

async function tohum({ lisans = null } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${SAHIP}', 'sahip@example.com'),
      ('${BASKASI}', 'baskasi@example.com');
    insert into public.analiz_sonuclari (id, owner_id, analiz_turu, baslik, apa_metni)
      values ('${SONUC}', '${SAHIP}', 'ttest', 'puan ~ cinsiyet', 't(28) = 2.45, p = .021');
  `);
  if (lisans) {
    await db.exec(`
      insert into public.organizations (id, name, license_status, synced_at)
        values ('${KURUM}', 'Kurum', '${lisans}', now());
      update public.profiles set organization_id = '${KURUM}' where id = '${SAHIP}';
    `);
  }
}

describe("analiz sonuçları", () => {
  test("kullanıcı kendi sonucunu kaydedip okuyabiliyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      const { rows } = await db.query(
        `insert into public.analiz_sonuclari (owner_id, analiz_turu, baslik, apa_metni)
         values ($1, 'anova', 'başarı ~ yöntem', 'F(2, 57) = 4.31, p = .018') returning id`,
        [SAHIP],
      );
      assert.equal(rows.length, 1);
      assert.equal(await sayi(), 2);
    }));

  test("başkasının sonucu görünmüyor ve silinemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", BASKASI);
      assert.equal(await sayi(), 0);
      const { rows } = await db.query(`delete from public.analiz_sonuclari where id = $1 returning id`, [SONUC]);
      assert.equal(rows.length, 0);
    }));

  test("başkasının adına sonuç yazılamıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", BASKASI);
      await reddedilir(db,
        `insert into public.analiz_sonuclari (owner_id, analiz_turu, baslik, apa_metni)
         values ($1, 'ttest', 'sahte', 't(1) = 1, p = .5')`,
        [SAHIP], /row-level security/i);
    }));

  /*
    UPDATE tabloda hiç yok: ne grant ne politika. Test ortamı Supabase'in
    "yeni tabloyu herkese aç" davranışını taklit ettiği için grant burada
    engellemiyor; satırı koruyan POLİTİKANIN YOKLUĞU. Gerçek veritabanında
    grant de yok, istek daha erken düşüyor. İki durumda da tutanak duruyor.
  */
  test("kaydedilen sonuç sonradan değiştirilemiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      const { rows } = await db.query(
        `update public.analiz_sonuclari set apa_metni = 'p < .001' where id = $1 returning id`,
        [SONUC],
      );
      assert.equal(rows.length, 0);
      const satir = (await db.query(`select apa_metni from public.analiz_sonuclari where id = $1`, [SONUC])).rows[0];
      assert.match(satir.apa_metni, /2\.45/);
    }));

  test("aboneliği biten kaydedemiyor ama eski kaydını silebiliyor", () =>
    islem(db, async () => {
      await tohum({ lisans: "past_due" });
      await rol(db, "authenticated", SAHIP);
      await reddedilir(db,
        `insert into public.analiz_sonuclari (owner_id, analiz_turu, baslik, apa_metni)
         values ($1, 'ttest', 'yeni', 't(9) = 2.1, p = .06')`,
        [SAHIP], /Aboneliğiniz sona erdi/);
      const { rows } = await db.query(`delete from public.analiz_sonuclari where id = $1 returning id`, [SONUC]);
      assert.equal(rows.length, 1);
    }));
});
