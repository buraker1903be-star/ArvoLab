// P52b-1: kaynak PDF kaydının KOŞULLU yazılması (lib/kaynak-pdf-yazimi.ts).
// Burada PostgREST'in ürettiği SQL'in anlamı Supabase rolleriyle ve RLS ile
// sınanıyor: ON CONFLICT DO NOTHING, "hazır değilse güncelle", "okunan eski
// yola koşullu güncelle". PGlite tek bağlantılı; aynı koşulun İKİ GERÇEK
// OTURUMDA kilitli satır üzerinde yeniden değerlendirildiği
// denetim/p52b1/senaryolar.mjs (S0a, S0b; Postgres 17 + PostgREST) ile kanıtlı.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000611";
const BASKA = "00000000-0000-4000-8000-000000000612";
const TEZ = "00000000-0000-4000-8000-0000000006b1";
const YUKLEME = `${TEZ}/kaynak-pdf/y-${OGRENCI}-1763200000000.pdf`;
const OTOMATIK = `${TEZ}/kaynak-pdf/0123456789abcdef-1763200000001.pdf`;

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o6@x.co'), ('${BASKA}', 'b6@x.co');
    insert into public.academic_projects (id, owner_id, title, project_type) values ('${TEZ}', '${OGRENCI}', 'Tez', 'thesis');
  `);
}

// otomatikSonucuYaz, 1. adım: upsert(..., { ignoreDuplicates: true }) → ON CONFLICT DO NOTHING
const EKLE_YOKSA = `insert into public.kaynak_pdfleri (project_id, olusturan, kunye_anahtari, kunye, durum, depo_yolu)
  values ($1, $2, $3, 'K', $4, $5) on conflict (project_id, kunye_anahtari) do nothing returning id`;
// otomatikSonucuYaz, 2. adım: update(...).not("durum","in","(indirildi,yuklendi)")
const GUNCELLE_HAZIR_DEGILSE = `update public.kaynak_pdfleri set durum = $3, depo_yolu = $4
  where project_id = $1 and kunye_anahtari = $2 and not (durum = any (array['indirildi','yuklendi'])) returning id`;
const durum = async (anahtar) =>
  (await db.query(`select durum, depo_yolu from public.kaynak_pdfleri where kunye_anahtari = $1`, [anahtar])).rows[0];

test("otomatik arama öğrencinin YÜKLEDİĞİ PDF'i ezemez: ekleme yok sayılır, koşullu güncelleme 0 satır", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k1", "yuklendi", YUKLEME]);
    assert.equal((await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k1", "erisilemedi", null])).rows.length, 0);
    assert.equal((await db.query(GUNCELLE_HAZIR_DEGILSE, [TEZ, "k1", "erisilemedi", null])).rows.length, 0);
    assert.deepEqual(await durum("k1"), { durum: "yuklendi", depo_yolu: YUKLEME });
  }));

test("başka isteğin İNDİRDİĞİ PDF de korunur (geç dönen başarısız ya da ikinci başarılı istek)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k2", "indirildi", OTOMATIK]);
    for (const [d, y] of [["erisilemedi", null], ["indirildi", `${TEZ}/kaynak-pdf/fedcba9876543210-1763200000002.pdf`]]) {
      assert.equal((await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k2", d, y])).rows.length, 0);
      assert.equal((await db.query(GUNCELLE_HAZIR_DEGILSE, [TEZ, "k2", d, y])).rows.length, 0);
    }
    assert.deepEqual(await durum("k2"), { durum: "indirildi", depo_yolu: OTOMATIK });
  }));

test("meşru akış: hazır olmayan kayıt yeniden aramada güncellenir (bulunamadı → indirildi)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k3", "bulunamadi", null]);
    assert.equal((await db.query(GUNCELLE_HAZIR_DEGILSE, [TEZ, "k3", "indirildi", OTOMATIK])).rows.length, 1);
    assert.deepEqual(await durum("k3"), { durum: "indirildi", depo_yolu: OTOMATIK });
  }));

test("öğrencinin yüklemesi okunan eski yola koşullu: arada yol değiştiyse 0 satır (yanlış 'eski dosya' silinmez)", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k4", "indirildi", OTOMATIK]);
    const YENI = `${TEZ}/kaynak-pdf/y-${OGRENCI}-1763200000009.pdf`;
    const KOSULLU = `update public.kaynak_pdfleri set durum = 'yuklendi', depo_yolu = $3
      where project_id = $1 and kunye_anahtari = 'k4' and depo_yolu = $2 returning id`;
    // Okunan eski yol artık geçerli değil (arada başka biri değiştirdi).
    assert.equal((await db.query(KOSULLU, [TEZ, YUKLEME, YENI])).rows.length, 0);
    assert.equal((await db.query(KOSULLU, [TEZ, OTOMATIK, YENI])).rows.length, 1);
    assert.deepEqual(await durum("k4"), { durum: "yuklendi", depo_yolu: YENI });
  }));

test("RLS: yabancı kullanıcının koşullu yazması da kullanım sorgusu da hiçbir satıra değmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k5", "bulunamadi", null]);
    await rol(db, "authenticated", BASKA);
    assert.equal((await db.query(GUNCELLE_HAZIR_DEGILSE, [TEZ, "k5", "indirildi", OTOMATIK])).rows.length, 0);
    // yolKullaniliyorMu'nun sorgusu: yabancı görmez → "kullanılmıyor" der, ama
    // silme depolama politikasında reddedilir (denetim/p52b/depo-rls.sql).
    assert.equal((await db.query(`select id from public.kaynak_pdfleri where project_id = $1`, [TEZ])).rows.length, 0);
    await rol(db, "postgres");
    assert.deepEqual(await durum("k5"), { durum: "bulunamadi", depo_yolu: null });
  }));

// baglamayiGeriAl: dosya depoda yoksa kaydın düzeltilmesi, yalnızca satır hâlâ o yolu gösteriyorsa.
test("bağlantıyı geri alma koşullu: yol değişmişse (daha yeni yazma) 0 satır; değişmemişse önceki hâle döner ya da silinir", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const YENI = `${TEZ}/kaynak-pdf/y-${OGRENCI}-1763200000010.pdf`;
    const GERI = `update public.kaynak_pdfleri set durum = $3, depo_yolu = $4 where project_id = $1 and kunye_anahtari = 'k6' and depo_yolu = $2 returning id`;
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k6", "indirildi", OTOMATIK]);
    // Arada öğrenci yeni PDF yükledi: geri alma onu EZMEZ.
    await db.query(`update public.kaynak_pdfleri set durum = 'yuklendi', depo_yolu = $1 where kunye_anahtari = 'k6'`, [YENI]);
    assert.equal((await db.query(GERI, [TEZ, OTOMATIK, "erisilemedi", null])).rows.length, 0);
    assert.deepEqual(await durum("k6"), { durum: "yuklendi", depo_yolu: YENI });
    // Yol hâlâ bizimse geri alınır.
    assert.equal((await db.query(GERI, [TEZ, YENI, "erisilemedi", null])).rows.length, 1);
    assert.deepEqual(await durum("k6"), { durum: "erisilemedi", depo_yolu: null });
    // Satırı biz açtıysak koşullu silme (RLS: çalışmaya yazabilen siler).
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k7", "yuklendi", YUKLEME]);
    const SIL = `delete from public.kaynak_pdfleri where project_id = $1 and kunye_anahtari = 'k7' and depo_yolu = $2 returning id`;
    assert.equal((await db.query(SIL, [TEZ, OTOMATIK])).rows.length, 0);
    assert.equal((await db.query(SIL, [TEZ, YUKLEME])).rows.length, 1);
  }));

test("RLS: yabancı kullanıcının geri alması/silmesi hiçbir satıra değmez", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    await db.query(EKLE_YOKSA, [TEZ, OGRENCI, "k9", "yuklendi", YUKLEME]);
    await rol(db, "authenticated", BASKA);
    assert.equal((await db.query(`update public.kaynak_pdfleri set durum = 'erisilemedi', depo_yolu = null where project_id = $1 and depo_yolu = $2 returning id`, [TEZ, YUKLEME])).rows.length, 0);
    assert.equal((await db.query(`delete from public.kaynak_pdfleri where project_id = $1 and depo_yolu = $2 returning id`, [TEZ, YUKLEME])).rows.length, 0);
    await rol(db, "postgres");
    assert.deepEqual(await durum("k9"), { durum: "yuklendi", depo_yolu: YUKLEME });
  }));
