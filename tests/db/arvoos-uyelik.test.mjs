// ArvoOS üyelerinin ArvoLab'a ilk girişte bağlanması
// (migration 20260924100011).
//
// Kural: ArvoOS kurumun üye e-postalarını arvoos_members'a yazıyor; kişi
// ArvoLab'a KENDİ kaydolduğunda profili o kuruma bağlanıyor. Hesap
// açılmıyor, davet gönderilmiyor — yalnızca gerçekten giren kişi bağlanıyor.
//
// Buradaki senaryolar hem kuralın çalıştığını hem de FAZLA çalışmadığını
// sabitliyor: listede olmayan bağlanmamalı, zaten bir kuruma bağlı olan
// taşınmamalı, liste ürün içinden okunamamalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-0000000000c1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000000c2";
const YENI = "00000000-0000-4000-8000-0000000000d1";
const YABANCI = "00000000-0000-4000-8000-0000000000d2";
const BAGLI = "00000000-0000-4000-8000-0000000000d3";
const ESKI = "00000000-0000-4000-8000-0000000000d4";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name)
      values ('${KURUM}', 'AkademikMerkez'), ('${BASKA_KURUM}', 'Başka Kurum');
    insert into public.arvoos_members (email, organization_id) values
      ('uzman@akademikmerkez.com', '${KURUM}'),
      ('bagli@akademikmerkez.com', '${KURUM}'),
      ('eski@akademikmerkez.com', '${KURUM}');
  `);
}

describe("ArvoOS üyeliği ilk girişte bağlanır", () => {
  test("listedeki e-postayla kaydolan kişi kuruma bağlanır", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', 'uzman@akademikmerkez.com')`);
      const profil = await tek(`select organization_id from public.profiles where id = $1`, [YENI]);
      assert.equal(profil.organization_id, KURUM);
    }));

  test("rol yükseltilmez: bağlanan kişi 'client' kalır", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', 'uzman@akademikmerkez.com')`);
      const profil = await tek(`select role from public.profiles where id = $1`, [YENI]);
      // En az yetkiyle başlamak; yükseltmeyi ArvoLab yöneticisi yapar.
      assert.equal(profil.role, "client");
    }));

  test("büyük/küçük harf ve boşluk eşleşmeyi bozmaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', ' UZMAN@AkademikMerkez.com ')`);
      const profil = await tek(`select organization_id from public.profiles where id = $1`, [YENI]);
      assert.equal(profil.organization_id, KURUM);
    }));

  test("listede olmayan kişi kurumsuz kalır ama kaydı düşmez", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YABANCI}', 'kimse@baska.com')`);
      const profil = await tek(`select organization_id from public.profiles where id = $1`, [YABANCI]);
      // Kayıt olması engellenmiyor: bu liste bir kapı değil, bir eşleşme.
      assert.ok(profil, "profil oluşmalı");
      assert.equal(profil.organization_id, null);
    }));

  test("zaten bir kuruma bağlı profil taşınmaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`
        insert into auth.users (id, email) values ('${BAGLI}', 'bagli@akademikmerkez.com');
        update public.profiles set organization_id = '${BASKA_KURUM}' where id = '${BAGLI}';
        select public.arvoos_uyeligini_bagla('${BAGLI}', 'bagli@akademikmerkez.com');
      `);
      const profil = await tek(`select organization_id from public.profiles where id = $1`, [BAGLI]);
      /*
        Kişi elle başka bir kuruma alınmış olabilir; ArvoOS listesi onu geri
        almamalı. Aksi halde her girişte bir kurum kavgası çıkardı.
      */
      assert.equal(profil.organization_id, BASKA_KURUM);
    }));

  test("listeden önce kaydolmuş kişi kendi çağrısıyla bağlanır", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      // Önce kullanıcı, SONRA liste: bugün var olan herkesin durumu bu.
      await db.exec(`
        insert into public.organizations (id, name) values ('${KURUM}', 'AkademikMerkez');
        insert into auth.users (id, email) values ('${ESKI}', 'eski@akademikmerkez.com');
        insert into public.arvoos_members (email, organization_id)
          values ('eski@akademikmerkez.com', '${KURUM}');
      `);
      const once = await tek(`select organization_id from public.profiles where id = $1`, [ESKI]);
      assert.equal(once.organization_id, null, "tetikleyici geçmişe dönük çalışmaz");

      await rol(db, "authenticated", ESKI);
      await db.query(`select public.arvoos_uyeligimi_bagla()`);

      await rol(db, "postgres");
      const sonra = await tek(`select organization_id from public.profiles where id = $1`, [ESKI]);
      assert.equal(sonra.organization_id, KURUM);
    }));

  test("kendi çağrısı başkasının profilini bağlayamaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YABANCI}', 'kimse@baska.com')`);
      await rol(db, "authenticated", YABANCI);
      /*
        Fonksiyon parametre almıyor: kimlik de e-posta da auth.uid()'den
        okunuyor. Parametreli bir sürüm, herkesin herkesi istediği kuruma
        bağlayabildiği bir uç nokta olurdu.
      */
      await db.query(`select public.arvoos_uyeligimi_bagla()`);
      await rol(db, "postgres");
      const profil = await tek(`select organization_id from public.profiles where id = $1`, [YABANCI]);
      assert.equal(profil.organization_id, null);
    }));

  test("üye listesi ürün içinden okunamaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', 'uzman@akademikmerkez.com')`);
      // Müşterinin personel listesi ArvoLab kullanıcılarına açılmamalı.
      await rol(db, "anon");
      await reddedilir(db, `select * from public.arvoos_members`, [], /permission denied/);
      await rol(db, "authenticated", YENI);
      await reddedilir(db, `select * from public.arvoos_members`, [], /permission denied/);
    }));
});
