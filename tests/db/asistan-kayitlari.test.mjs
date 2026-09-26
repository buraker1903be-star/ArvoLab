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
const KURUCU = "00000000-0000-4000-8000-000000000004";
const KAYIT = "00000000-0000-4000-8000-0000000000c1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${SAHIP}', 's@x.co'), ('${YABANCI}', 'y@x.co'), ('${KONTROLOR}', 'k@x.co'),
      ('${KURUCU}', 'f@x.co');
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    update public.profiles set role = 'founder' where id = '${KURUCU}';
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

  test("eğitim verisini iç ekip derler; müşteri kurumun kontrolörü değil", async () => {
    // İnce ayar kümesini iç ekip derleyecek; göremezse küme derlenemez.
    // Müşteri kurumun kontrolörü ise yalnızca kendi kurumunun kaydını görür
    // (20260924100028): eskiden kurumdan bağımsız hepsini görüyordu, yani
    // bir müşterinin kontrolörü diğer müşterinin asistan girdisini okuyordu.
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KURUCU);
      assert.equal((await say("select id from public.ai_assistant_runs")).length, 1);

      await rol(db, "authenticated", KONTROLOR);
      assert.equal((await say("select id from public.ai_assistant_runs")).length, 0);
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

  /*
    ÖRNEK DEĞİL SÜPÜRME.

    Yukarıdaki test korumayı üç sütunla deniyordu (output, context, status);
    koruma ise on beş sütunu sayıyor. Kapsanmayanlar arasında prompt_chars
    ve output_chars vardı — kredi muhasebesi (ai_kredi_durumum) bu ikisini
    TOPLUYOR, yani sıfırlanabilirse bedava kullanım demek.

    Sütun listesi şemadan okunuyor, elle yazılmıyor: tabloya yeni bir sütun
    eklenip koruma güncellenmezse bu test düşer. Elle yazılmış bir liste
    tam o durumda sessiz kalırdı.
  */
  test("korumanın kapsamı şemayla birlikte büyüyor: sayılmayan sütun yok", async () => {
    await islem(db, async () => {
      await tohum();

      // Kullanıcının yazmasına İZİN VERİLEN alanlar (değerlendirme).
      const serbest = new Set(["rating", "rating_note", "rated_at"]);
      await rol(db, "postgres");
      const sutunlar = await say(
        `select column_name, data_type, is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'ai_assistant_runs' order by column_name`,
      );
      assert.ok(sutunlar.length >= 18, `sütun listesi okunamadı: ${sutunlar.length}`);

      /* Her sütun için MEVCUTTAN FARKLI bir değer: "is distinct from" ancak
         gerçekten değişen bir değerle tetiklenir. */
      const farkliDeger = ({ data_type }) => {
        if (data_type === "uuid") return `'00000000-0000-4000-8000-0000000000ff'`;
        if (data_type === "integer") return "999";
        if (data_type === "jsonb") return `'{"x":1}'::jsonb`;
        if (data_type.startsWith("timestamp")) return `'2000-01-01T00:00:00Z'`;
        return `'degistirildi'`;
      };

      await rol(db, "authenticated", SAHIP);
      const denenen = [];
      for (const sutun of sutunlar) {
        if (serbest.has(sutun.column_name)) continue;
        denenen.push(sutun.column_name);
        await reddedilir(
          db,
          `update public.ai_assistant_runs set ${sutun.column_name} = ${farkliDeger(sutun)} where id = '${KAYIT}'`,
          [],
          // Yardımcı hata mesajına SQL'i koyuyor, yani düşen sütun görünür.
          /değiştirilemez/,
        );
      }
      // Muhasebeye giren sütunların gerçekten denendiğini de doğrula.
      for (const kritik of ["prompt_chars", "output_chars", "findings", "capability", "created_at"]) {
        assert.ok(denenen.includes(kritik), `${kritik} süpürmeye girmedi`);
      }
    });
  });

  test("serbest alanlar yazılabilir kalıyor: koruma meşru akışı kırmıyor", async () => {
    // Koruma eklerken meşru yolun yeşil kalması şart (AGENTS.md).
    await islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await db.query(
        `update public.ai_assistant_runs set rating = 'faydali', rating_note = 'işe yaradı' where id = '${KAYIT}'`,
      );
      const [satir] = await say(`select rating, rating_note, rated_at from public.ai_assistant_runs where id = '${KAYIT}'`);
      assert.equal(satir.rating, "faydali");
      assert.equal(satir.rating_note, "işe yaradı");
      assert.ok(satir.rated_at, "rated_at sunucuda yazılmalı");
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
