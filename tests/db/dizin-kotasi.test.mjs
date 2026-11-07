// Ortak dizin kotası (DOI kotası, 07.11.2026): lib/dizin-kotasi.ts'in
// çağırdığı rate_limit_hit, uygulamanın kullandığı AYNI anahtar, sınır ve
// pencereyle. Migration YOK: mevcut fonksiyon (20260924100002).
//
// Sınanan:
//   - 60. çağrı izin, 61. ret; Kaynaklar araması, DOI künyesi ve toplu DOI
//     AYNI anahtarı paylaştığı için toplam 60;
//   - kullanıcılar birbirinin hakkını tüketmez; ai-asistan gibi başka
//     sayaçlarla karışmaz;
//   - sayaç yalnızca service_role'e açık: kullanıcı kendi hakkını
//     sıfırlayamaz, başkasınınkini düşüremez;
//   - aynı anda gönderilen çağrılar: tam 60 izin.
//     SINIR: PGlite tek bağlantı, sorgular SIRAYLA işler. Bu senaryo
//     sayımın kaybolmadığını gösterir; gerçek Postgres'te eşzamanlı
//     bağlantılar altındaki atomiklik fonksiyonun tek ifadeli
//     "insert … on conflict do update … returning" yapısından gelir ve
//     burada ÖLÇÜLMEMİŞTİR (raporda UNVERIFIED).
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const A = "00000000-0000-4000-8000-0000000000d1";
const B = "00000000-0000-4000-8000-0000000000d2";
// lib/dizin-kotasi-kurali.ts ile aynı değerler (birim testi orada sabitliyor).
const anahtar = (id) => `literatur-arama:${id}`;
const SINIR = 60;

let db;
before(async () => {
  db = await veritabani();
});

const hak = async (k) => (await db.query(`select public.rate_limit_hit($1, $2, $3::interval) as izin`, [k, SINIR, "1 hour"])).rows[0].izin;

test("60 hak: 60 izin, 61. ret; kullanıcılar ve başka sayaçlar ayrı", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    const sonuc = [];
    for (let i = 0; i < SINIR + 1; i++) sonuc.push(await hak(anahtar(A)));
    assert.equal(sonuc.filter(Boolean).length, SINIR);
    assert.equal(sonuc.at(-1), false);
    assert.equal(await hak(anahtar(A)), false, "dolduktan sonra da ret");
    assert.equal(await hak(anahtar(B)), true, "B'nin hakkı A'dan bağımsız");
    assert.equal(await hak(`ai-asistan:${A}`), true, "asistan sayacı ayrı");
  }));

test("pencere geçince hak geri gelir", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    for (let i = 0; i < SINIR; i++) await hak(anahtar(A));
    assert.equal(await hak(anahtar(A)), false);
    await rol(db, "postgres");
    await db.query(`update public.auth_rate_limits set window_start = now() - interval '61 minutes' where key = $1`, [anahtar(A)]);
    await rol(db, "service_role");
    assert.equal(await hak(anahtar(A)), true);
  }));

test("aynı anda gönderilen 75 çağrı: tam 60 izin (PGlite sıralı işler, bkz. üst not)", () =>
  islem(db, async () => {
    await rol(db, "service_role");
    const sonuc = await Promise.all(Array.from({ length: 75 }, () => hak(anahtar(B))));
    assert.equal(sonuc.filter(Boolean).length, SINIR);
    await rol(db, "postgres");
    const { rows } = await db.query(`select count from public.auth_rate_limits where key = $1`, [anahtar(B)]);
    assert.equal(Number(rows[0].count), 75, "reddedilen çağrılar da sayılır");
  }));

test("kullanıcı sayaca doğrudan dokunamaz: ne kendi hakkını sıfırlar ne başkasınınkini düşürür", () =>
  islem(db, async () => {
    await rol(db, "authenticated", A);
    await reddedilir(db, `select public.rate_limit_hit($1, 60, interval '1 hour')`, [anahtar(B)], /permission denied/);
    await reddedilir(db, `delete from public.auth_rate_limits where key = $1`, [anahtar(A)], /permission denied/);
    await rol(db, "anon");
    await reddedilir(db, `select public.rate_limit_hit($1, 60, interval '1 hour')`, [anahtar(A)], /permission denied/);
  }));
