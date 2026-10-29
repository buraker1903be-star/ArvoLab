// Kullanım Sözleşmesi onay kaydı (20261029153742). Kayıt bir DELİL: yalnızca
// sunucu yazar, kimse değiştiremez ya da silemez, hesap silinince de kalır.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KULLANICI = "00000000-0000-4000-8000-00000000c101";
const BASKASI = "00000000-0000-4000-8000-00000000c102";
const OZET = "a".repeat(64);

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`insert into auth.users (id, email) values ('${KULLANICI}', 'k@x.co'), ('${BASKASI}', 'b@x.co')`);
}

const onayYaz = (kullanici) =>
  db.query(
    `insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi, ip, kullanici_araci, eposta)
       values ($1, 'kullanim_sozlesmesi', '2026-10-29', 'tr', $2, 'giris', true, '203.0.113.5', 'Mozilla/5.0', 'k@x.co') returning id`,
    [kullanici, OZET],
  );

describe("sözleşme onay kaydı", () => {
  test("kullanıcı kendi adına bile onay yazamaz (IP ve zaman sunucudan gelmeli); sunucu yazar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KULLANICI);
      await reddedilir(
        db,
        `insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi, ip)
           values ($1, 'kullanim_sozlesmesi', '2026-10-29', 'tr', $2, 'giris', true, '1.2.3.4')`,
        [KULLANICI, OZET],
        /permission denied/i,
      );
      await rol(db, "service_role");
      await onayYaz(KULLANICI);
    }));

  test("kullanıcı yalnızca kendi onaylarını görür", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      await onayYaz(KULLANICI);
      await onayYaz(BASKASI);
      await rol(db, "authenticated", KULLANICI);
      const { rows } = await db.query(`select user_id from public.sozlesme_onaylari`);
      assert.deepEqual(rows.map((r) => r.user_id), [KULLANICI]);
    }));

  test("kayıt değiştirilemez ve silinemez — sunucu ve tablo sahibi dâhil", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      const { rows } = await onayYaz(KULLANICI);
      const id = rows[0].id;
      await reddedilir(db, `update public.sozlesme_onaylari set ip = '9.9.9.9' where id = $1`, [id], /permission denied/i);
      await reddedilir(db, `delete from public.sozlesme_onaylari where id = $1`, [id], /permission denied/i);
      await rol(db, "postgres");
      await reddedilir(db, `update public.sozlesme_onaylari set onaylandi = now() - interval '1 year' where id = $1`, [id], /değiştirilemez/);
      await reddedilir(db, `delete from public.sozlesme_onaylari where id = $1`, [id], /silinemez/);
    }));

  test("hesap silinince kayıt kalır; yalnızca kullanıcı bağı kopar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      await onayYaz(KULLANICI);
      await rol(db, "postgres");
      await db.query(`delete from auth.users where id = $1`, [KULLANICI]);
      const { rows } = await db.query(`select user_id, eposta, ip, metin_ozeti from public.sozlesme_onaylari`);
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0], { user_id: null, eposta: "k@x.co", ip: "203.0.113.5", metin_ozeti: OZET });
    }));
});

// Yaklaşık konum (20261029163058): sunucu yazar, sonradan değiştirilemez.
describe("sözleşme onayında konum", () => {
  test("konum yazılıyor ve değişmezlik onu da koruyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      const { rows: [k] } = await db.query(
        `insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi, ip, ulke, bolge, sehir, enlem, boylam, saat_dilimi)
           values ($1, 'kullanim_sozlesmesi', '2026-10-29.3', 'tr', $2, 'giris', true, '203.0.113.5', 'TR', '34', 'İstanbul', 41.0082, 28.97, 'Europe/Istanbul') returning id`,
        [KULLANICI, OZET],
      );
      await rol(db, "postgres");
      await reddedilir(db, `update public.sozlesme_onaylari set sehir = 'Ankara' where id = $1`, [k.id], /değiştirilemez/);
      await rol(db, "authenticated", KULLANICI);
      const { rows } = await db.query(`select sehir, enlem from public.sozlesme_onaylari where id = $1`, [k.id]);
      assert.equal(rows[0].sehir, "İstanbul");
      assert.equal(Number(rows[0].enlem), 41.0082);
    }));
});
