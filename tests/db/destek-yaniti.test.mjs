// Destek yanıtı (migration 20260924100022).
//
// Mevcut UPDATE politikası satırı TALEBİ AÇANA da açıyor (kendi talebini
// kapatabilsin diye). Yanıt sütunu korunmasaydı kullanıcı kendi talebine
// "sistem yöneticisi yanıtı" yazabilirdi — RLS "kim yazabilir"i söyler,
// "neyi"yi söylemez.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const MUSTERI = "00000000-0000-4000-8000-0000000000d1";
const YONETICI = "00000000-0000-4000-8000-0000000000d2";
const TALEP = "00000000-0000-4000-8000-0000000000d9";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${MUSTERI}', 'ogrenci@example.com'),
      ('${YONETICI}', 'yonetici@example.com');
    update public.profiles set role = 'system_admin' where id = '${YONETICI}';
    insert into public.app_support_requests (id, requested_by, subject, message, category)
    values ('${TALEP}', '${MUSTERI}', 'Belge yüklenmiyor', 'PDF seçince hata alıyorum.', 'bug');
  `);
}

describe("destek yanıtı", () => {
  test("talebi açan kişi kendine yanıt yazamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db,
        `update public.app_support_requests set admin_note = 'Çözüldü, merak etmeyin' where id = $1`,
        [TALEP], /yanıtını yalnızca Sistem Yöneticisi/i);
    }));

  test("yanıt zamanı da korunuyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db,
        `update public.app_support_requests set answered_at = now() where id = $1`,
        [TALEP], /yanıtını yalnızca Sistem Yöneticisi/i);
    }));

  /*
    Meşru akış da sınanıyor: koruma eklerken uygulamanın kendi yolunu
    kırmak bu depoda daha önce yaşandı (AGENTS.md).
  */
  test("sistem yöneticisi yanıt yazabiliyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YONETICI);
      await db.query(
        `update public.app_support_requests
            set admin_note = 'Sürüm 1.2 ile düzeltildi.', answered_at = now(), status = 'resolved'
          where id = $1`,
        [TALEP],
      );
      await rol(db, "authenticated", MUSTERI);
      const satir = await tek(`select admin_note, status from public.app_support_requests where id = $1`, [TALEP]);
      // Kullanıcı kendi talebindeki yanıtı OKUYABİLMELİ.
      assert.match(satir.admin_note, /1\.2/);
      assert.equal(satir.status, "resolved");
    }));

  /*
    Durum koruması ZATEN vardı (20260913120000) ve yanıt alanları aynı
    tetikleyiciye eklendi; ikinci bir koruyucu yazmak ikisinin zamanla
    ayrışması olurdu. Eski davranışın bozulmadığı burada sabitleniyor.
  */
  test("durum koruması eskisi gibi duruyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", MUSTERI);
      await reddedilir(db,
        `update public.app_support_requests set status = 'resolved' where id = $1`,
        [TALEP], /durumunu yalnızca Sistem Yöneticisi/i);
    }));
});
