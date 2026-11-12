// Şifre sıfırlama hız sınırı (migration 20260924100002).
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

let db;
before(async () => {
  db = await veritabani();
});

const dene = async (anahtar, limit = 3) =>
  (await db.query(`select public.rate_limit_hit($1, $2, interval '15 minutes') as izin`, [anahtar, limit])).rows[0].izin;

test("limite kadar izin verir, sonra reddeder; anahtarlar birbirini etkilemez", () =>
  islem(db, async () => {
    await rol(db, "postgres");
    assert.deepEqual([await dene("a"), await dene("a"), await dene("a"), await dene("a")], [true, true, true, false]);
    assert.equal(await dene("b"), true);
  }));

test("pencere dolunca sayaç sıfırlanır", () =>
  islem(db, async () => {
    await rol(db, "postgres");
    for (let i = 0; i < 4; i += 1) await dene("c");
    await db.query(`update public.auth_rate_limits set window_start = now() - interval '16 minutes' where key = 'c'`);
    assert.equal(await dene("c"), true);
  }));

test("sayaç yalnızca sunucuya açık; müşteri ne çağırabilir ne okuyabilir", () =>
  islem(db, async () => {
    await rol(db, "authenticated", "00000000-0000-4000-8000-000000000001");
    await reddedilir(db, `select public.rate_limit_hit('x', 3, interval '15 minutes')`, [], /permission denied/);
    await reddedilir(db, `select * from public.auth_rate_limits`, [], /permission denied/);
    await rol(db, "anon");
    await reddedilir(db, `select public.rate_limit_hit('x', 3, interval '15 minutes')`, [], /permission denied/);
  }));

test("eski kayıtlar temizlenir", () =>
  islem(db, async () => {
    await rol(db, "postgres");
    await dene("eski");
    await db.query(`update public.auth_rate_limits set window_start = now() - interval '2 days' where key = 'eski'`);
    const { rows } = await db.query(`select public.prune_auth_rate_limits() as n`);
    assert.equal(rows[0].n, 1);
  }));

/*
  DOI sorgusu (Phase 5.0b, 12.11.2026): lookupDoi sunucu anahtarıyla
  (service_role) "doi-sorgu:<kullanıcı>" anahtarına saatte 120 hak sayar
  (lib/doi-sorgu-siniri.ts). Burada MEŞRU yol service_role ile sınanıyor.

  PGlite tek bağlantılı: aynı anda gönderilen çağrılar burada sıraya girer,
  yani gerçek yarış koşulu bu dosyada SINANAMAZ. O kanıt
  scripts/eszamanli-hiz-siniri.sh'ta (yerel PostgreSQL, yüzlerce ayrı
  bağlantı; bilerek yarışlı bir gövdeyle kaldığı da gösterildi).
*/
const doiDene = async (kullanici) =>
  (await db.query(`select public.rate_limit_hit($1, 120, interval '1 hour') as izin`, [`doi-sorgu:${kullanici}`])).rows[0].izin;

test("DOI: service_role ile tam 120 sorgu, 121'incisi reddedilir", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    const sonuclar = [];
    for (let i = 0; i < 121; i += 1) sonuclar.push(await doiDene("u1"));
    assert.equal(sonuclar.filter(Boolean).length, 120);
    assert.equal(sonuclar[119], true);
    assert.equal(sonuclar[120], false);
  }));

test("DOI: bir kullanıcının hakkı bitince öteki etkilenmez (iç içe çağrılar)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (let i = 0; i < 120; i += 1) {
      assert.equal(await doiDene("u2"), true);
      assert.equal(await doiDene("u3"), true);
    }
    assert.equal(await doiDene("u2"), false);
    assert.equal(await doiDene("u3"), false);
    assert.equal(await doiDene("u4"), true);
    const { rows } = await db.query(`select key, count from public.auth_rate_limits where key like 'doi-sorgu:u%' order by key`);
    assert.deepEqual(rows.map((r) => [r.key, r.count]), [["doi-sorgu:u2", 121], ["doi-sorgu:u3", 121], ["doi-sorgu:u4", 1]]);
  }));

test("DOI: aynı anda gönderilen çağrılar (Promise.all) sayaçta kaybolmaz", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    const sonuclar = await Promise.all(Array.from({ length: 150 }, () => doiDene("u5")));
    assert.equal(sonuclar.filter(Boolean).length, 120);
    const { rows } = await db.query(`select count from public.auth_rate_limits where key = 'doi-sorgu:u5'`);
    assert.equal(rows[0].count, 150);
  }));

test("DOI: saatlik pencere dolunca hak yenilenir", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (let i = 0; i < 121; i += 1) await doiDene("u6");
    assert.equal(await doiDene("u6"), false);
    await rol(db, "postgres");
    await db.query(`update public.auth_rate_limits set window_start = now() - interval '61 minutes' where key = 'doi-sorgu:u6'`);
    await rol(db, "service_role");
    assert.equal(await doiDene("u6"), true);
  }));

test("DOI: oturumlu kullanıcı sayacı ne çağırabilir ne başkasının sayacını okuyabilir", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    await doiDene("u7");
    await rol(db, "authenticated", "00000000-0000-4000-8000-000000000007");
    await reddedilir(db, `select public.rate_limit_hit('doi-sorgu:u7', 120, interval '1 hour')`, [], /permission denied/);
    await reddedilir(db, `select count from public.auth_rate_limits where key = 'doi-sorgu:u7'`, [], /permission denied/);
  }));
