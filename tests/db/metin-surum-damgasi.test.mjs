// P52a2 (20261115203504): project_manuscripts.updated_at'i veritabanı yazar
// ve satır başına kesin artar. Damga iyimser kilidin anahtarı
// (lib/metin-yazimi.ts): eskiden uygulama sunucusunun saatiyle milisaniye
// hassasiyetinde yazılıyordu; aynı milisaniyedeki iki kayıt aynı damgayı
// alıyor ve eski sürümden yazan sekme öteki metni çakışmasız eziyordu
// (gerçek Postgres'te yeniden üretimi: scripts/yerel-yigin, S4). Meşru akış
// (koşullu güncelleme, ilk ekleme) burada da sınanıyor: koruma onu kırmamalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000052a1";
const PROJE = "00000000-0000-4000-8000-0000000052b1";
const DOC = '{"type":"doc","content":[]}';

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const damga = async () => (await tek(`select updated_at::text as d from public.project_manuscripts where project_id = $1`, [PROJE])).d;

async function tohum() {
  await rol(db, "postgres");
  await db.query(`insert into auth.users (id, email) values ($1, 'sahip@x.co')`, [SAHIP]);
  await db.query(`insert into public.academic_projects (id, owner_id, title, project_type) values ($1, $2, 'Tez', 'thesis')`, [PROJE, SAHIP]);
}

describe("metin sürüm damgası", () => {
  test("eklemede gönderilen damga yok sayılır; veritabanı saati yazılır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(
        `insert into public.project_manuscripts (project_id, content, updated_at) values ($1, $2::jsonb, '2000-01-01T00:00:00Z')`,
        [PROJE, DOC],
      );
      assert.ok(!(await damga()).startsWith("2000"), "gönderilen eski damga yazıldı");
    }));

  test("güncellemede damga kesin artar: aynı ya da eski değer gönderilse bile", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(`insert into public.project_manuscripts (project_id, content) values ($1, $2::jsonb)`, [PROJE, DOC]);
      const goruldu = [await damga()];
      for (const gonderilen of [goruldu[0], "2000-01-01T00:00:00Z", goruldu[0]]) {
        await db.query(`update public.project_manuscripts set plain_text = 'x', updated_at = $2 where project_id = $1`, [PROJE, gonderilen]);
        goruldu.push(await damga());
      }
      // Aynı işlem içinde: saat neredeyse hiç ilerlemese de her damga bir öncekinden büyük.
      await rol(db, "postgres");
      for (let i = 1; i < goruldu.length; i++) {
        const { buyuk } = await tek(`select $1::timestamptz > $2::timestamptz as buyuk`, [goruldu[i], goruldu[i - 1]]);
        assert.equal(buyuk, true, `${goruldu[i]} > ${goruldu[i - 1]} değil`);
      }
    }));

  test("meşru akış: güncel damgaya koşullu kayıt geçer, eski damgayla kayıt hiçbir satıra değmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(`insert into public.project_manuscripts (project_id, content) values ($1, $2::jsonb)`, [PROJE, DOC]);
      const t0 = await damga();
      const ilk = await db.query(
        `update public.project_manuscripts set plain_text = 'A' where project_id = $1 and updated_at = $2 returning updated_at::text`,
        [PROJE, t0],
      );
      assert.equal(ilk.rows.length, 1);
      const t1 = ilk.rows[0].updated_at;
      assert.notEqual(t1, t0);
      // Dönen damga bir sonraki kaydın koşulu olarak birebir çalışıyor (sahte çakışma yok).
      const ikinci = await db.query(
        `update public.project_manuscripts set plain_text = 'A2' where project_id = $1 and updated_at = $2 returning 1`,
        [PROJE, t1],
      );
      assert.equal(ikinci.rows.length, 1);
      const eski = await db.query(
        `update public.project_manuscripts set plain_text = 'B eski' where project_id = $1 and updated_at = $2 returning 1`,
        [PROJE, t0],
      );
      assert.equal(eski.rows.length, 0);
      assert.equal((await tek(`select plain_text from public.project_manuscripts where project_id = $1`, [PROJE])).plain_text, "A2");
    }));

  test("tetikleyici işlevi doğrudan çağrılamaz", async () => {
    for (const r of ["anon", "authenticated"]) {
      const { izin } = await tek(`select has_function_privilege($1, 'public.metin_surum_damgasi()', 'execute') as izin`, [r]);
      assert.equal(izin, false, `${r} çağırabiliyor`);
    }
  });
});
