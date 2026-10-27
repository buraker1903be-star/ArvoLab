// Destek yazışması (migration 20261027074716).
//
// Uzman talebinde yazışma yalnızca iki taraf arasında: talebi açan ve
// üstlenen uzman. Uygulama desteğinde talebi açan ve iç ekip. Yazanın adı
// ve tarafı sunucuda konuyor; çözülmüş talebe talep sahibi yazınca talep
// yeniden açılıyor (yoksa kuyrukta hiç görünmezdi).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-0000000000a1";
const OGRENCI = "00000000-0000-4000-8000-0000000000e1";
const UZMAN = "00000000-0000-4000-8000-0000000000e2";
const BASKA_UZMAN = "00000000-0000-4000-8000-0000000000e3";
const YABANCI = "00000000-0000-4000-8000-0000000000e4";
const DESTEK_EKIBI = "00000000-0000-4000-8000-0000000000e5";
const UZMAN_TALEBI = "00000000-0000-4000-8000-0000000000f1";
const DESTEK_TALEBI = "00000000-0000-4000-8000-0000000000f2";

let db;
before(async () => {
  db = await veritabani();
});

const satirlar = async (sql, p = []) => (await db.query(sql, p)).rows;

async function tohum({ uzmanDurumu = "accepted", destekDurumu = "open" } = {}) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum');
    insert into auth.users (id, email) values
      ('${OGRENCI}', 'ogrenci@example.com'),
      ('${UZMAN}', 'uzman@example.com'),
      ('${BASKA_UZMAN}', 'baska@example.com'),
      ('${YABANCI}', 'yabanci@example.com'),
      ('${DESTEK_EKIBI}', 'destek@example.com');
    update public.profiles set organization_id = '${KURUM}', full_name = 'Ayşe Öğrenci' where id = '${OGRENCI}';
    update public.profiles set organization_id = '${KURUM}', role = 'expert', full_name = 'Meral Uzman' where id = '${UZMAN}';
    update public.profiles set organization_id = '${KURUM}', role = 'expert' where id = '${BASKA_UZMAN}';
    update public.profiles set role = 'system_admin', full_name = 'Destek Ekibi' where id = '${DESTEK_EKIBI}';
    insert into public.consultancy_requests (id, requested_by, request_type, message, status, assigned_expert_id)
      values ('${UZMAN_TALEBI}', '${OGRENCI}', 'statistics', 'Regresyon', '${uzmanDurumu}',
              ${uzmanDurumu === "open" ? "null" : `'${UZMAN}'`});
    insert into public.app_support_requests (id, requested_by, subject, message, category, status)
      values ('${DESTEK_TALEBI}', '${OGRENCI}', 'PDF', 'Yüklenmiyor', 'bug', '${destekDurumu}');
  `);
}

const yaz = (kim, sutun, talep, metin) =>
  islemIci(kim, `insert into public.destek_mesajlari (${sutun}, metin) values ($1, $2)`, [talep, metin]);

async function islemIci(kim, sql, p) {
  await rol(db, "authenticated", kim);
  await db.query(sql, p);
}

describe("uzman yazışması", () => {
  test("öğrenci ve üstlenen uzman yazışır; ad ve taraf sunucuda konur", () =>
    islem(db, async () => {
      await tohum();
      await yaz(OGRENCI, "uzman_talebi_id", UZMAN_TALEBI, "Hangi testi kullanmalıyım?");
      await yaz(UZMAN, "uzman_talebi_id", UZMAN_TALEBI, "Önce dağılıma bakalım.");
      await rol(db, "authenticated", OGRENCI);
      const mesajlar = await satirlar(
        `select yazan_adi, taraf from public.destek_mesajlari where uzman_talebi_id = $1 order by created_at, taraf desc`,
        [UZMAN_TALEBI]);
      assert.deepEqual(mesajlar.map((m) => m.taraf).sort(), ["talep_sahibi", "uzman"]);
      // Öğrenci uzmanın adını yazışmadan görüyor; profilini okuması gerekmiyor.
      assert.ok(mesajlar.some((m) => m.yazan_adi === "Meral Uzman"));
    }));

  test("istemci tarafı ve adı kendisi yazamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.destek_mesajlari (uzman_talebi_id, metin, taraf, yazan_adi) values ($1, 'x', 'uzman', 'Uzman')`,
        [UZMAN_TALEBI]);
      const [m] = await satirlar(`select taraf, yazan_adi from public.destek_mesajlari`);
      assert.equal(m.taraf, "talep_sahibi");
      assert.equal(m.yazan_adi, "Ayşe Öğrenci");
    }));

  test("üstlenmemiş uzman yazamaz ve okuyamaz", () =>
    islem(db, async () => {
      await tohum();
      await yaz(OGRENCI, "uzman_talebi_id", UZMAN_TALEBI, "Gizli ayrıntı");
      await rol(db, "authenticated", BASKA_UZMAN);
      await reddedilir(db,
        `insert into public.destek_mesajlari (uzman_talebi_id, metin) values ($1, 'araya giriyorum')`,
        [UZMAN_TALEBI], /row-level security/);
      assert.equal((await satirlar(`select 1 from public.destek_mesajlari`)).length, 0);
    }));

  test("tamamlanan talebe yazılmaz", () =>
    islem(db, async () => {
      await tohum({ uzmanDurumu: "completed" });
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db,
        `insert into public.destek_mesajlari (uzman_talebi_id, metin) values ($1, 'bir şey daha')`,
        [UZMAN_TALEBI], /row-level security/);
    }));

  // Tetikleyici yazanı oturumdaki kişiyle değiştiriyor (RLS denetiminden ÖNCE):
  // sahte yazar reddedilmiyor, yok sayılıyor.
  test("başkasının adına yazılamaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.destek_mesajlari (uzman_talebi_id, metin, yazan) values ($1, 'sahte', '${UZMAN}')`,
        [UZMAN_TALEBI]);
      const [m] = await satirlar(`select yazan, taraf from public.destek_mesajlari`);
      assert.equal(m.yazan, OGRENCI);
      assert.equal(m.taraf, "talep_sahibi");
    }));

  test("mesaj düzeltilemez ve silinemez", () =>
    islem(db, async () => {
      await tohum();
      await yaz(OGRENCI, "uzman_talebi_id", UZMAN_TALEBI, "İlk hâl");
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db, `update public.destek_mesajlari set metin = 'değişti'`, [], /permission denied/);
      await reddedilir(db, `delete from public.destek_mesajlari`, [], /permission denied/);
    }));
});

describe("uygulama desteği yazışması", () => {
  test("iç ekip yanıt yazar, talebi açan okur; yabancı göremez", () =>
    islem(db, async () => {
      await tohum();
      await yaz(DESTEK_EKIBI, "destek_talebi_id", DESTEK_TALEBI, "Dosya boyutu kaç MB?");
      await rol(db, "authenticated", OGRENCI);
      const [m] = await satirlar(`select taraf, yazan_adi from public.destek_mesajlari`);
      assert.equal(m.taraf, "destek");
      assert.equal(m.yazan_adi, "Destek Ekibi");
      await rol(db, "authenticated", YABANCI);
      assert.equal((await satirlar(`select 1 from public.destek_mesajlari`)).length, 0);
      await reddedilir(db,
        `insert into public.destek_mesajlari (destek_talebi_id, metin) values ($1, 'x')`,
        [DESTEK_TALEBI], /row-level security/);
    }));

  test("çözülmüş talebe talep sahibi yazınca talep yeniden açılır", () =>
    islem(db, async () => {
      await tohum({ destekDurumu: "resolved" });
      await yaz(OGRENCI, "destek_talebi_id", DESTEK_TALEBI, "Hâlâ olmuyor.");
      await rol(db, "postgres");
      const [t] = await satirlar(`select status from public.app_support_requests where id = $1`, [DESTEK_TALEBI]);
      assert.equal(t.status, "open");
    }));

  test("iç ekibin mesajı talebi yeniden açmaz", () =>
    islem(db, async () => {
      await tohum({ destekDurumu: "resolved" });
      await yaz(DESTEK_EKIBI, "destek_talebi_id", DESTEK_TALEBI, "Bilginize.");
      await rol(db, "postgres");
      const [t] = await satirlar(`select status from public.app_support_requests where id = $1`, [DESTEK_TALEBI]);
      assert.equal(t.status, "resolved");
    }));

  // İstisna yalnızca tetikleyicinin içinde; talep sahibi durumu doğrudan değiştiremez.
  test("talep sahibi durumu kendisi değiştiremez", () =>
    islem(db, async () => {
      await tohum({ destekDurumu: "resolved" });
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db,
        `update public.app_support_requests set status = 'open' where id = $1`,
        [DESTEK_TALEBI], /durumunu yalnızca Sistem Yöneticisi/i);
    }));
});
