// Arayüz dili tercihi (migration 20261028092453).
//
// Kullanıcı yalnızca KENDİ tercihini yazar; başkasınınkini değiştiremez.
// Değer listesi lib/dil.ts DILLER ile aynı: bilinmeyen bir değer reddedilir,
// yoksa çerezde ve e-postada tanınmayan bir dil dolaşırdı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000d1";
const BASKASI = "00000000-0000-4000-8000-0000000000d2";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${BASKASI}', 'b@x.co');`);
}

const tercih = async (id) => (await db.query(`select arayuz_dili from public.profiles where id = $1`, [id])).rows[0].arayuz_dili;

describe("arayüz dili tercihi", () => {
  test("yeni kullanıcıda tercih yok (Türkçe varsayılan)", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await tercih(OGRENCI), null);
    }));

  test("öğrenci kendi tercihini İngilizce yapabilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.profiles set arayuz_dili = 'en' where id = $1`, [OGRENCI]);
      await rol(db, "postgres");
      assert.equal(await tercih(OGRENCI), "en");
    }));

  test("başkasının tercihini değiştiremez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.profiles set arayuz_dili = 'en' where id = $1`, [BASKASI]);
      await rol(db, "postgres");
      assert.equal(await tercih(BASKASI), null);
    }));

  test("bilinmeyen dil reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db, `update public.profiles set arayuz_dili = 'fr' where id = $1`, [OGRENCI], /check constraint|arayuz_dili/);
    }));
});
