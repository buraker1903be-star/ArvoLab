// Asistan çalışma kayıtları (migration 20260924100005). Bu tablo ArvoLab'ın
// kendi modelini eğitecek veri; kayıt kanıt değerini yitirmemeli. Hem
// mahremiyet (başkasının kaydı görünmez) hem de dokunulmazlık (içerik
// sonradan değiştirilemez) sınanır — ikincisi RLS'in söyleyemediği şey.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-000000000001";
const YABANCI = "00000000-0000-4000-8000-000000000002";
const KONTROLOR = "00000000-0000-4000-8000-000000000003";
const KAYIT = "00000000-0000-4000-8000-0000000000c1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${SAHIP}', 's@x.co'), ('${YABANCI}', 'y@x.co'), ('${KONTROLOR}', 'k@x.co');
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    insert into public.ai_assistant_runs (id, user_id, capability, status, model, context, output)
      values ('${KAYIT}', '${SAHIP}', 'analiz', 'completed', 'test-model',
              '### Analiz çıktısı\nt(28) = 2.45, p = .021', '{"bulgular":[]}');
  `);
}

const say = async (sql, p = []) => (await db.query(sql, p)).rows;

describe("asistan kayıtları", () => {
  test("kayıt sahibi görür, yabancı görmez", async () => {
    await islem(db, async () => {
      await tohum();

      await rol(db, "authenticated", SAHIP);
      assert.equal((await say("select id from public.ai_assistant_runs")).length, 1);

      await rol(db, "authenticated", YABANCI);
      assert.equal((await say("select id from public.ai_assistant_runs")).length, 0);
    });
  });

  test("kontrolör eğitim verisi için hepsini görür", async () => {
    // İnce ayar kümesini iç ekip derleyecek; göremezse küme derlenemez.
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KONTROLOR);
      assert.equal((await say("select id from public.ai_assistant_runs")).length, 1);
    });
  });

  test("başkasının adına kayıt yazılamaz", async () => {
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      await reddedilir(
        db,
        `insert into public.ai_assistant_runs (user_id, capability, status) values ('${SAHIP}', 'analiz', 'completed')`,
        [],
        /row-level security/i,
      );
    });
  });

  test("kullanıcı kendi kaydını puanlar, rated_at sunucuda yazılır", async () => {
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(`update public.ai_assistant_runs set rating = 'faydali' where id = '${KAYIT}'`);
      const [satir] = await say(`select rating, rated_at from public.ai_assistant_runs where id = '${KAYIT}'`);
      assert.equal(satir.rating, "faydali");
      assert.ok(satir.rated_at, "rated_at tetikleyiciyle dolmalı");
    });
  });

  test("kaydın içeriği sonradan değiştirilemez", async () => {
    // RLS "kim yazabilir"i söyler, "neyi"yi söylemez: UPDATE hakkı olan
    // kullanıcı PostgREST'ten her sütunu yazabilirdi.
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      for (const sql of [
        `update public.ai_assistant_runs set output = 'degistirildi' where id = '${KAYIT}'`,
        `update public.ai_assistant_runs set context = 'degistirildi' where id = '${KAYIT}'`,
        `update public.ai_assistant_runs set status = 'failed' where id = '${KAYIT}'`,
      ]) {
        await reddedilir(db, sql, [], /değiştirilemez/);
      }
    });
  });

  test("yabancı kaydı puanlayamaz", async () => {
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      const sonuc = await db.query(
        `update public.ai_assistant_runs set rating = 'faydasiz' where id = '${KAYIT}'`,
      );
      // RLS satırı hiç göstermiyor: hata değil, sıfır satır.
      assert.equal(sonuc.affectedRows ?? 0, 0);
    });
  });

  test("anon hiçbir şey göremez", async () => {
    await islem(db, async () => {
      await tohum();
      await rol(db, "anon");
      await reddedilir(db, "select id from public.ai_assistant_runs", [], /permission denied|row-level security/i);
    });
  });
});
