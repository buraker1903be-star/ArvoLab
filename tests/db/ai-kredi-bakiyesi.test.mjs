// AI kredi bakiyesi (migration 20260924100014).
//
// Burası para karşılığı bir hak tutuyor: yanlış bir düşme müşterinin
// ödediğini kaybetmesi, eksik bir düşme bizim bedava iş yapmamız demek.
// Senaryolar iki yönü de sabitliyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-000000000a01";
const UYE = "00000000-0000-4000-8000-000000000b01";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const hesap = () => tek(`select aylik_kalan, ek_bakiye, donem from public.ai_kredi_hesabi where organization_id = $1`, [KURUM]);

async function tohum(limit = 10) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name, ai_credit_limit, synced_at)
      values ('${KURUM}', 'AkademikMerkez', ${limit}, now());
    insert into auth.users (id, email) values ('${UYE}', 'a@akademikmerkez.com');
    update public.profiles set organization_id = '${KURUM}' where id = '${UYE}';
  `);
}

const calisma = (girdi, cikti = 0, durum = "completed") =>
  `insert into public.ai_assistant_runs (user_id, capability, status, prompt_chars, output_chars)
     values ('${UYE}', 'analiz', '${durum}', ${girdi}, ${cikti});`;

describe("AI kredi bakiyesi", () => {
  test("tüketim önce aylık haktan düşer", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 5, 'odeme-1');`);
      await db.exec(calisma(3000)); // 3 kredi
      const h = await hesap();
      assert.equal(Number(h.aylik_kalan), 7);
      // Satın alınan krediye dokunulmadı: hakkı dururken parasını
      // harcatmak müşteriye yapılacak en açık haksızlık.
      assert.equal(Number(h.ek_bakiye), 5);
    }));

  test("aylık hak bitince bakiyeden düşer", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 5, 'odeme-1');`);
      await db.exec(calisma(12_000)); // 12 kredi: 10 aylık + 2 bakiye
      const h = await hesap();
      assert.equal(Number(h.aylik_kalan), 0);
      assert.equal(Number(h.ek_bakiye), 3);
    }));

  test("ikisi de yetmezse sıfırda durur, eksiye düşmez", () =>
    islem(db, async () => {
      await tohum(2);
      await db.exec(calisma(50_000));
      const h = await hesap();
      assert.equal(Number(h.aylik_kalan), 0);
      assert.equal(Number(h.ek_bakiye), 0);
    }));

  test("reddedilen çalışma kredi düşmez", () =>
    islem(db, async () => {
      await tohum(10);
      // Önce bir tamamlanan çalışma: hesap satırı ilk tüketimde açılıyor.
      await db.exec(calisma(1000));
      const once = Number((await hesap()).aylik_kalan);
      await db.exec(calisma(9000, 0, "rejected"));
      // Reddedilen yanıt kullanıcıya gösterilmiyor; parası da alınmıyor.
      assert.equal(Number((await hesap()).aylik_kalan), once);
    }));

  test("başlanan dilim tam kredi sayılır", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(calisma(1, 0)); // 1 karakter = 1 kredi
      assert.equal(Number((await hesap()).aylik_kalan), 9);
    }));

  test("aynı ödeme iki kez yüklenmez", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 100, 'odeme-1');`);
      /*
        Ödeme bildirimleri tekrar gelebiliyor (PayTR yeniden deneyebiliyor);
        her denemede kredi eklemek, bir kez ödeyen müşteriye kat kat hak
        vermek demekti.
      */
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 100, 'odeme-1');`);
      assert.equal(Number((await hesap()).ek_bakiye), 100);
    }));

  test("ay değişince aylık hak yenilenir, bakiye durur", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 7, 'odeme-1');`);
      await db.exec(calisma(4000)); // aylık 10 → 6
      // Geçen aydan kalmış gibi geriye alıyoruz.
      await db.exec(`update public.ai_kredi_hesabi
                        set donem = (date_trunc('month', now()) - interval '1 month')::date
                      where organization_id = '${KURUM}';`);
      await db.exec(calisma(1000));
      const h = await hesap();
      // Yenilendi (10) ve yeni çalışma düştü (1) → 9. Kullanılmayan 6 YANDI.
      assert.equal(Number(h.aylik_kalan), 9);
      assert.equal(Number(h.ek_bakiye), 7, "satın alınan kredi ay sonunda yanmaz");
    }));

  test("her hareket deftere yazılır", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(`select public.ai_kredi_yukle('${KURUM}', 5, 'odeme-1');`);
      await db.exec(calisma(2000));
      const defter = (await db.query(
        `select tur, kredi from public.ai_kredi_hareketleri where organization_id = $1 order by created_at`, [KURUM])).rows;
      // Bakiye tek bir sayı; "bu kredi nereye gitti" sorusunun yanıtı defterde.
      assert.deepEqual(defter.map((r) => r.tur), ["yukleme", "tuketim"]);
    }));

  test("bakiye ürün içinden yazılamaz", () =>
    islem(db, async () => {
      await tohum(10);
      await rol(db, "authenticated", UYE);
      /*
        Kullanıcıya açık olsaydı kendi bakiyesini yazabilen bir uç nokta
        olurdu — parayla satılan bir hak için en kötüsü.
      */
      await reddedilir(db, `update public.ai_kredi_hesabi set ek_bakiye = 99999 where organization_id = $1`, [KURUM], /permission denied/);
      await reddedilir(db, `select public.ai_kredi_yukle($1, 999, 'sahte')`, [KURUM], /permission denied/);
    }));

  test("kurumsuz kullanıcının çalışması hesabı bozmaz", () =>
    islem(db, async () => {
      await tohum(10);
      await db.exec(calisma(1000));
      const once = Number((await hesap()).aylik_kalan);
      await db.exec(`
        insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000b02', 'bagimsiz@x.co');
        insert into public.ai_assistant_runs (user_id, capability, status, prompt_chars, output_chars)
          values ('00000000-0000-4000-8000-000000000b02', 'analiz', 'completed', 5000, 0);
      `);
      // Bireysel kullanıcının kurum bakiyesiyle işi yok.
      assert.equal(Number((await hesap()).aylik_kalan), once);
    }));
});
