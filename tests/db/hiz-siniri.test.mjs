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

/* Ad bilerek "sıralı": PGlite tek bağlantılı, Promise.all burada çağrıları
   sıraya koyar. Bu senaryo SAYMAYI sınar, yarışı değil; gerçek eşzamanlılık
   kanıtı scripts/eszamanli-hiz-siniri.sh'ta (CI dışı). */
test("DOI: art arda 150 çağrı (PGlite'ta sıralı) sayaçta kaybolmaz, 120'si izinli", () =>
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

/*
  T3 (12.11.2026): public.rate_limit_take — atomik toplu rezervasyon
  (migration 20261112195236). Tekli DOI sorgusu (1 birim) ve toplu içe
  aktarma (N birim) AYNI anahtardan, kullanıcı başına saatte 120 harcar.
  Gerçek eşzamanlılık kanıtı scripts/eszamanli-hiz-siniri.sh'ta.
*/
const al = async (kullanici, istenen, sinir = 120) =>
  (await db.query(
    `select granted, remaining, resets_at from public.rate_limit_take($1, $2, interval '1 hour', $3)`,
    [`doi-sorgu:${kullanici}`, sinir, istenen],
  )).rows[0];

test("toplu: istenen kalan haktan azsa tamamı verilir, kalan ve yenilenme döner", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    const r = await al("t1", 50);
    assert.equal(r.granted, 50);
    assert.equal(r.remaining, 70);
    const { rows } = await db.query(`select window_start + interval '1 hour' as beklenen from public.auth_rate_limits where key = 'doi-sorgu:t1'`);
    assert.equal(new Date(r.resets_at).getTime(), new Date(rows[0].beklenen).getTime());
  }));

test("toplu: kalan hak yetmezse en çok kalan kadar (kısmi), sonra 0", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    assert.equal((await al("t2", 50)).granted, 50);
    assert.equal((await al("t2", 50)).granted, 50);
    const ucuncu = await al("t2", 50);
    assert.equal(ucuncu.granted, 20);
    assert.equal(ucuncu.remaining, 0);
    const dorduncu = await al("t2", 50);
    assert.equal(dorduncu.granted, 0);
    assert.equal(dorduncu.remaining, 0);
    const { rows } = await db.query(`select count from public.auth_rate_limits where key = 'doi-sorgu:t2'`);
    assert.equal(rows[0].count, 120, "verilmeyen hak sayaca yazılmaz");
  }));

test("tekli ve toplu aynı bütçeyi paylaşır (rate_limit_hit ile karışık)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (let i = 0; i < 100; i += 1) assert.equal(await doiDene("t3"), true); // tekli, eski işlev
    const toplu = await al("t3", 50);
    assert.equal(toplu.granted, 20);
    assert.equal(toplu.remaining, 0);
    assert.equal(await doiDene("t3"), false);
    assert.equal((await al("t3", 1)).granted, 0);
  }));

test("rate_limit_hit reddedilen denemeyi de saydığında sayaç sınırı aşmış olabilir: take 0 verir, sayacı küçültmez", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (let i = 0; i < 125; i += 1) await doiDene("t4");
    const r = await al("t4", 10);
    assert.equal(r.granted, 0);
    assert.equal(r.remaining, 0);
    const { rows } = await db.query(`select count from public.auth_rate_limits where key = 'doi-sorgu:t4'`);
    assert.equal(rows[0].count, 125);
  }));

test("pencere dolunca hak yenilenir (toplu)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    await al("t5", 120);
    assert.equal((await al("t5", 5)).granted, 0);
    await rol(db, "postgres");
    await db.query(`update public.auth_rate_limits set window_start = now() - interval '61 minutes' where key = 'doi-sorgu:t5'`);
    await rol(db, "service_role");
    const r = await al("t5", 5);
    assert.equal(r.granted, 5);
    assert.equal(r.remaining, 115);
  }));

test("kullanıcı izolasyonu: birinin bütçesi ötekini etkilemez", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    assert.equal((await al("t6", 120)).granted, 120);
    assert.equal((await al("t7", 50)).granted, 50);
  }));

test("sıfır ve negatif istek sayacı değiştirmez (iade yok, gözetleme olur)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    await al("t8", 30);
    const sifir = await al("t8", 0);
    assert.equal(sifir.granted, 0);
    assert.equal(sifir.remaining, 90);
    const eksi = await al("t8", -40);
    assert.equal(eksi.granted, 0);
    assert.equal(eksi.remaining, 90);
  }));

test("rate_limit_take yalnızca service_role'a açık", () =>
  islem(db, async () => {
    await rol(db, "authenticated", "00000000-0000-4000-8000-000000000008");
    await reddedilir(db, `select * from public.rate_limit_take('doi-sorgu:x', 120, interval '1 hour', 5)`, [], /permission denied/);
    await rol(db, "anon");
    await reddedilir(db, `select * from public.rate_limit_take('doi-sorgu:x', 120, interval '1 hour', 5)`, [], /permission denied/);
  }));

/*
  Sertleştirme (13.11.2026): search_path = '' ve geçersiz girdide açık hata.
  Eskiden NULL pencere "now() - NULL" ile pencereyi hiç sıfırlamıyor, boş
  anahtar bütün çağıranları tek ortak sayaçta topluyordu.
*/
test("geçersiz anahtar reddedilir (NULL, boş, yalnızca boşluk) ve sayaca satır yazılmaz", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (const anahtar of [null, "", "   "]) {
      await reddedilir(db, `select * from public.rate_limit_take($1, 120, interval '1 hour', 1)`, [anahtar], /anahtar boş olamaz/);
    }
    await rol(db, "postgres");
    const { rows } = await db.query(`select count(*)::int as n from public.auth_rate_limits where btrim(key) = ''`);
    assert.equal(rows[0].n, 0);
  }));

test("geçersiz pencere reddedilir (NULL, sıfır, negatif) ve sayaç değişmez", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    await al("t10", 7);
    for (const pencere of [null, "0", "0 seconds", "-1 hour", "-1 second"]) {
      await reddedilir(db, `select * from public.rate_limit_take('doi-sorgu:t10', 120, $1::interval, 5)`, [pencere], /pencere pozitif/);
    }
    await rol(db, "postgres");
    const { rows } = await db.query(`select count from public.auth_rate_limits where key = 'doi-sorgu:t10'`);
    assert.equal(rows[0].count, 7, "reddedilen çağrı sayaca yazılmaz");
  }));

test("işlev search_path = '' ile tanımlı ve çağıranın yolundan bağımsız çalışır", () =>
  islem(db, async () => {
    await rol(db, "postgres");
    const { rows } = await db.query(
      `select p.prosecdef, p.proconfig from pg_proc p where p.oid = 'public.rate_limit_take(text, integer, interval, integer)'::regprocedure`,
    );
    assert.equal(rows[0].prosecdef, true);
    assert.deepEqual(rows[0].proconfig, ['search_path=""']);
    // Çağıranın yolunda aynı adlı bir gölge tablo olsa bile gerçek tablo sayılır.
    await db.query(`create schema golge`);
    await db.query(`create table golge.auth_rate_limits (key text primary key, window_start timestamptz, count int)`);
    await db.query(`grant usage on schema golge to service_role`);
    await db.query(`grant all on golge.auth_rate_limits to service_role`);
    await rol(db, "service_role");
    await db.query(`set local search_path = golge`);
    const r = (await db.query(`select granted from public.rate_limit_take('doi-sorgu:t11', 120, interval '1 hour', 3)`)).rows[0];
    assert.equal(r.granted, 3);
    await rol(db, "postgres");
    assert.equal((await db.query(`select count(*)::int as n from golge.auth_rate_limits`)).rows[0].n, 0);
    assert.equal((await db.query(`select count from public.auth_rate_limits where key = 'doi-sorgu:t11'`)).rows[0].count, 3);
  }));

test("mevcut şifre sıfırlama sınırı etkilenmez (farklı anahtar, aynı tablo)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    await al("t9", 120);
    assert.deepEqual([await dene("sifre:a@x.co"), await dene("sifre:a@x.co"), await dene("sifre:a@x.co"), await dene("sifre:a@x.co")], [true, true, true, false]);
  }));
