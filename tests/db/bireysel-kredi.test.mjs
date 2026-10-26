// Bireysel abonenin AI kredisi (migration 20261026181929).
//
// Kurumdaki modelin kişiye bağlı eşi: aylık 1.000 kredi hak, satın alınan
// bakiye yanmaz, aynı ödeme iki kez yüklenmez. Para karşılığı bir hak
// tuttuğu için iki yön de sabitleniyor: fazla düşmek müşteriyi, eksik
// düşmek bizi zarara sokar.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KISI = "00000000-0000-4000-8000-000000000c01";
const BASKA = "00000000-0000-4000-8000-000000000c02";
const KURUM = "00000000-0000-4000-8000-000000000a09";
const KURUMLU = "00000000-0000-4000-8000-000000000c03";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const hesap = (kisi = KISI) => tek(`select aylik_kalan, ek_bakiye from public.ai_bireysel_kredi_hesabi where user_id = $1`, [kisi]);

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${KISI}', 'ogrenci@x.co'), ('${BASKA}', 'baska@x.co');
  `);
}

const calisma = (kisi, karakter, durum = "completed") =>
  `insert into public.ai_assistant_runs (user_id, capability, status, prompt_chars, output_chars)
     values ('${kisi}', 'analiz', '${durum}', ${karakter}, 0);`;

describe("bireysel AI kredisi", () => {
  test("ilk çalışmada hesap açılır, aylık 1.000 haktan düşer", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(calisma(KISI, 3000)); // 3 kredi
      const h = await hesap();
      assert.deepEqual([Number(h.aylik_kalan), Number(h.ek_bakiye)], [997, 0]);
    }));

  test("aylık hak bitince satın alınan bakiyeden düşer; ikisi de bitince sıfırda durur", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 500, 'odeme-1');`);
      await db.exec(calisma(KISI, 1_200_000)); // 1.200 kredi: 1.000 aylık + 200 bakiye
      let h = await hesap();
      assert.deepEqual([Number(h.aylik_kalan), Number(h.ek_bakiye)], [0, 300]);
      await db.exec(calisma(KISI, 900_000));
      h = await hesap();
      assert.deepEqual([Number(h.aylik_kalan), Number(h.ek_bakiye)], [0, 0]);
    }));

  test("aynı ödeme iki kez yüklenmez", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 500, 'odeme-1');`);
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 500, 'odeme-1');`);
      assert.equal(Number((await hesap()).ek_bakiye), 500);
    }));

  test("ay değişince aylık hak yenilenir, satın alınan bakiye yanmaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 50, 'odeme-1');`);
      await db.exec(calisma(KISI, 400_000)); // 1.000 → 600
      await db.exec(`update public.ai_bireysel_kredi_hesabi
                        set donem = (date_trunc('month', now()) - interval '1 month')::date
                      where user_id = '${KISI}';`);
      await db.exec(calisma(KISI, 1000));
      const h = await hesap();
      assert.deepEqual([Number(h.aylik_kalan), Number(h.ek_bakiye)], [999, 50]);
    }));

  test("reddedilen çalışma kredi düşmez", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(calisma(KISI, 1000));
      await db.exec(calisma(KISI, 50_000, "rejected"));
      assert.equal(Number((await hesap()).aylik_kalan), 999);
    }));

  test("kurum üyesi ve kurumsuz personel bireysel hesaptan düşmez", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`
        insert into public.organizations (id, name, ai_credit_limit, synced_at) values ('${KURUM}', 'Kurum', 10, now());
        insert into auth.users (id, email) values ('${KURUMLU}', 'k@x.co');
        update public.profiles set organization_id = '${KURUM}' where id = '${KURUMLU}';
        update public.profiles set role = 'expert' where id = '${BASKA}';
      `);
      await db.exec(calisma(KURUMLU, 2000));
      await db.exec(calisma(BASKA, 2000));
      assert.equal(await hesap(KURUMLU), undefined);
      assert.equal(await hesap(BASKA), undefined, "kurumsuz uzman müşteri değil, sınırsız kalır");
      // Kurum üyesi kurumun hesabından düştü (eski davranış bozulmadı).
      const k = await tek(`select aylik_kalan from public.ai_kredi_hesabi where organization_id = $1`, [KURUM]);
      assert.equal(Number(k.aylik_kalan), 8);
    }));

  test("bireysel olmayan kullanıcıya kredi yüklenemez (parası kaybolmasın, hata görünsün)", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`update public.profiles set role = 'expert' where id = '${BASKA}';`);
      await reddedilir(db, `select public.ai_bireysel_kredi_yukle($1, 100, 'odeme-x')`, [BASKA], /bireysel abone değil/);
    }));

  test("durum: bireysel abone kendi hakkını ve bakiyesini görür", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 500, 'odeme-1');`);
      await db.exec(calisma(KISI, 5000));
      await rol(db, "authenticated", KISI);
      const d = await tek(`select * from public.ai_kredi_durumum()`);
      assert.deepEqual(
        [Number(d.limit_kredi), Number(d.aylik_kalan), Number(d.ek_bakiye), d.bildirildi, d.bireysel],
        [1000, 995, 500, true, true],
      );
      const hareketler = (await db.query(`select tur from public.ai_bireysel_kredi_hareketlerim()`)).rows.map((r) => r.tur);
      assert.deepEqual(hareketler.sort(), ["tuketim", "yukleme"]);
    }));

  test("hesabı hiç açılmamış abonede aylık hak tam görünür", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", KISI);
      const d = await tek(`select * from public.ai_kredi_durumum()`);
      assert.deepEqual([Number(d.aylik_kalan), Number(d.ek_bakiye), d.bireysel], [1000, 0, true]);
    }));

  test("başkasının hareketi görünmez; bakiye ve yükleme ürün içinden yazılamaz", () =>
    islem(db, async () => {
      await tohum();
      await db.exec(`select public.ai_bireysel_kredi_yukle('${KISI}', 500, 'odeme-1');`);
      await rol(db, "authenticated", BASKA);
      assert.equal((await db.query(`select * from public.ai_bireysel_kredi_hareketlerim()`)).rows.length, 0);
      await reddedilir(db, `update public.ai_bireysel_kredi_hesabi set ek_bakiye = 99999 where user_id = $1`, [BASKA], /permission denied/);
      await reddedilir(db, `select public.ai_bireysel_kredi_yukle($1, 999, 'sahte')`, [BASKA], /permission denied/);
      await reddedilir(db, `select * from public.ai_bireysel_kredi_hareketleri`, [], /permission denied/);
    }));
});
