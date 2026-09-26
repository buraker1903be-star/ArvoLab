// Model özeti veritabanında sayılıyor (migration 20260926150217).
//
// Eskiden app/actions/ai-kayitlar.ts ai_assistant_runs'tan .limit(5000) ile
// satır çekip toplamları JavaScript'te topluyordu — sıralama olmadan, yani
// tablo sınırı aştığı gün özet rastgele bir alt kümenin özeti olurdu ve hiçbir
// belirti vermezdi. Bu tablo "hangi model daha iyi denetliyor" kararına
// giriyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const KURUCU = "00000000-0000-4000-8000-00000000d001";
const MUSTERI = "00000000-0000-4000-8000-00000000d002";
const BASKA = "00000000-0000-4000-8000-00000000d003";
const KURUM = "00000000-0000-4000-8000-00000000d0a1";
const BASKA_KURUM = "00000000-0000-4000-8000-00000000d0a2";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A'), ('${BASKA_KURUM}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${KURUCU}', 'k@x.co'), ('${MUSTERI}', 'm@x.co'), ('${BASKA}', 'b@x.co');
    update public.profiles set role = 'founder' where id = '${KURUCU}';
    update public.profiles set organization_id = '${KURUM}' where id = '${MUSTERI}';
    update public.profiles set organization_id = '${BASKA_KURUM}' where id = '${BASKA}';

    insert into public.ai_assistant_runs
      (user_id, capability, status, model, rating, duration_ms, prompt_chars, output_chars) values
      -- MÜŞTERİ: ucuz modelden üç çalışma
      ('${MUSTERI}', 'analiz',    'completed', 'ucuz', 'faydali',  1000, 100, 50),
      ('${MUSTERI}', 'kaynakca',  'completed', 'ucuz', 'kismen',   3000, 200, 100),
      ('${MUSTERI}', 'literatur', 'rejected',  'ucuz', null,          0,  10,  0),
      -- BAŞKA kurumun kullanıcısı: pahalı modelden bir çalışma
      ('${BASKA}',   'analiz',    'failed',    'pahali', 'faydasiz', null, 5, 5);
  `);
}

const ozet = async (kim) => {
  await rol(db, "authenticated", kim);
  const { rows } = await db.query(`select * from public.asistan_model_ozetleri()`);
  return new Map(rows.map((r) => [r.model, r]));
};

describe("asistan model özeti", () => {
  test("iç ekip bütün modellerin toplamını görüyor", () =>
    islem(db, async () => {
      await tohum();
      const o = await ozet(KURUCU);
      assert.deepEqual([...o.keys()].sort(), ["pahali", "ucuz"]);

      const ucuz = o.get("ucuz");
      assert.equal(Number(ucuz.toplam), 3);
      assert.equal(Number(ucuz.tamamlanan), 2);
      assert.equal(Number(ucuz.reddedilen), 1);
      assert.equal(Number(ucuz.basarisiz), 0);
      assert.equal(Number(ucuz.faydali), 1);
      assert.equal(Number(ucuz.kismen), 1);
      assert.equal(Number(ucuz.puanlanan), 2, "puansız çalışma sayılmamalı");
      // Süre ortalaması SIFIRI dışarıda tutar: eski JavaScript `if (duration_ms)`
      // ile hem boşu hem sıfırı atlıyordu, ortalama 1000 ve 3000'in ortalaması.
      assert.equal(Number(ucuz.ort_sure), 2000);
      assert.equal(Number(ucuz.toplam_karakter), 100 + 50 + 200 + 100 + 10 + 0);
    }));

  test("kullanıcı yalnızca kendi çalışmalarının özetini alıyor", () =>
    islem(db, async () => {
      await tohum();
      const o = await ozet(MUSTERI);
      assert.deepEqual([...o.keys()], ["ucuz"], "başka kurumun modeli görünmemeli");
      assert.equal(Number(o.get("ucuz").toplam), 3);
    }));

  test("başka kurumun kullanıcısı komşunun sayılarını göremiyor", () =>
    islem(db, async () => {
      await tohum();
      const o = await ozet(BASKA);
      assert.deepEqual([...o.keys()], ["pahali"]);
      assert.equal(Number(o.get("pahali").toplam), 1);
      assert.equal(Number(o.get("pahali").ort_sure), 0, "süresi olmayan çalışmada ortalama sıfır");
    }));

  test("model adı boşsa 'bilinmiyor' kovasında toplanıyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await db.exec(`insert into public.ai_assistant_runs (user_id, capability, status, model)
                     values ('${MUSTERI}', 'belge', 'completed', null)`);
      const o = await ozet(MUSTERI);
      assert.equal(Number(o.get("bilinmiyor").toplam), 1);
    }));
});
