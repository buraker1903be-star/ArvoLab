// Kurum başına AI tüketim ölçümü (migration 20260924100012).
//
// ArvoOS bu ölçümü krediye çevirip kotayı gösteriyor ve fiyatlandırıyor;
// yanlış bir toplam doğrudan yanlış fatura demek. Buradaki senaryolar
// toplamın NEYİ saydığını ve neyi saymadığını sabitliyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-0000000000e1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000000e2";
const BIZIM = "00000000-0000-4000-8000-0000000000f1";
const BIZIM_IKI = "00000000-0000-4000-8000-0000000000f2";
const YABANCI = "00000000-0000-4000-8000-0000000000f3";

let db;
before(async () => {
  db = await veritabani();
});

const olc = async (kurum = KURUM, since = "2026-09-01T00:00:00+03:00") =>
  (await db.query(`select karakter, calisma from public.arvoos_ai_kullanimi($1, $2)`, [kurum, since])).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name)
      values ('${KURUM}', 'AkademikMerkez'), ('${BASKA_KURUM}', 'Başka Kurum');
    insert into auth.users (id, email) values
      ('${BIZIM}', 'a@akademikmerkez.com'),
      ('${BIZIM_IKI}', 'b@akademikmerkez.com'),
      ('${YABANCI}', 'c@baska.com');
    update public.profiles set organization_id = '${KURUM}' where id in ('${BIZIM}', '${BIZIM_IKI}');
    update public.profiles set organization_id = '${BASKA_KURUM}' where id = '${YABANCI}';
  `);
}

const calisma = (user, { durum = "completed", girdi = 0, cikti = 0, tarih = "2026-09-10T12:00:00+03:00" } = {}) =>
  `insert into public.ai_assistant_runs (user_id, capability, status, prompt_chars, output_chars, created_at)
     values ('${user}', 'analiz', '${durum}', ${girdi}, ${cikti}, '${tarih}');`;

describe("AI tüketim ölçümü", () => {
  test("kurumun tüm kullanıcılarının karakterleri toplanır", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(
        calisma(BIZIM, { girdi: 1000, cikti: 500 })
        + calisma(BIZIM_IKI, { girdi: 200, cikti: 300 }),
      );
      const sonuc = await olc();
      assert.equal(Number(sonuc.karakter), 2000);
      assert.equal(Number(sonuc.calisma), 2);
    }));

  test("başka kurumun tüketimi karışmaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(calisma(BIZIM, { girdi: 100, cikti: 0 }) + calisma(YABANCI, { girdi: 9999, cikti: 9999 }));
      assert.equal(Number((await olc()).karakter), 100);
    }));

  test("reddedilen ve düşen çalışmalar sayılmaz", () =>
    islem(db, async () => {
      await tohum();
      /*
        Reddedilen yanıt (uydurma sayı, künye izi) kullanıcıya hiç
        gösterilmiyor; gösterilmeyen bir şeyin parasını almak yanlış olur.
        Maliyeti biz üstleniyoruz.
      */
      await db.exec(
        calisma(BIZIM, { girdi: 100, cikti: 100 })
        + calisma(BIZIM, { durum: "rejected", girdi: 5000, cikti: 5000 })
        + calisma(BIZIM, { durum: "failed", girdi: 5000, cikti: 5000 }),
      );
      const sonuc = await olc();
      assert.equal(Number(sonuc.karakter), 200);
      assert.equal(Number(sonuc.calisma), 1);
    }));

  test("dönem başından öncesi sayılmaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(
        calisma(BIZIM, { girdi: 700, cikti: 0, tarih: "2026-08-31T23:00:00+03:00" })
        + calisma(BIZIM, { girdi: 40, cikti: 0, tarih: "2026-09-01T00:30:00+03:00" }),
      );
      // Kota aylık; geçen ayın tüketimi bu ayın hakkını yemiyor.
      assert.equal(Number((await olc()).karakter), 40);
    }));

  test("hiç kullanım yoksa sıfır döner, boş satır değil", () =>
    islem(db, async () => {
      await tohum();
      const sonuc = await olc();
      /*
        null dönseydi ArvoOS "ölçülemedi" sanıp kotayı bilinmeyen
        gösterirdi; oysa yanıt belli: bu kurum hiç kullanmamış.
      */
      assert.equal(Number(sonuc.karakter), 0);
      assert.equal(Number(sonuc.calisma), 0);
    }));

  test("chars null olan eski kayıtlar toplamı düşürmez", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`
        insert into public.ai_assistant_runs (user_id, capability, status, created_at)
          values ('${BIZIM}', 'analiz', 'completed', '2026-09-10T12:00:00+03:00');
      ` + calisma(BIZIM, { girdi: 50, cikti: 50 }));
      assert.equal(Number((await olc()).karakter), 100);
    }));

  test("ürün içinden çağrılamaz", () =>
    islem(db, async () => {
      await tohum();
      /*
        Fonksiyon kurum kimliğini parametre alıyor: açık olsaydı herhangi
        bir kullanıcı başka bir kurumun tüketimini okuyabilirdi.
      */
      await rol(db, "anon");
      await reddedilir(db, `select * from public.arvoos_ai_kullanimi($1, now())`, [KURUM], /permission denied/);
      await rol(db, "authenticated", BIZIM);
      await reddedilir(db, `select * from public.arvoos_ai_kullanimi($1, now())`, [KURUM], /permission denied/);
    }));
});
