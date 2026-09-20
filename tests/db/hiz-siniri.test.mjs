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
