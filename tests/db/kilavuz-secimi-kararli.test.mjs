// Aynı düzeyde iki onaylı kılavuz varsa seçim kararlı (migration 20260926131150).
//
// 26.09.2026 toplu onayında iki üniversitede ikişer üniversite geneli kayıt
// çıktı. approved_at hepsinde AYNI ana damgalandığı için sıralama tükeniyor
// ve "limit 1" hangisini döndüreceğini planlayıcıya bırakıyordu — Burdur'da
// Fen Bilimleri ile Eğitim Bilimleri kılavuzu arasında rastgele seçim.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-000000001a01";
const UNI = "00000000-0000-4000-8000-000000001b01";
const ESKI = "00000000-0000-4000-8000-000000001c01";
const YENI = "00000000-0000-4000-8000-000000001c02";

const ONAY = `'{"citation_style":"apa7","required_sections":["Giriş","Yöntem","Bulgular","Sonuç"],"extracted_rules":{"font_size_pt":12},"approved_at":"2026-09-26T10:00:00Z"}'::jsonb`;

let db;
before(async () => {
  db = await veritabani();
});

/* İki kayıt da ÜNİVERSİTE GENELİ ve approved_at'leri AYNI — canlıdaki durum. */
async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 'sahip@example.com');
    insert into public.universities (id, name, university_type) values ('${UNI}', 'X Üniversitesi', 'devlet');
    insert into public.thesis_guidelines
      (id, university_id, university_name, citation_style, analysis_status, approved_snapshot, created_at)
      values
      ('${ESKI}', '${UNI}', 'X Üniversitesi', 'apa7', 'approved', ${ONAY}, '2026-01-01T00:00:00Z'),
      ('${YENI}', '${UNI}', 'X Üniversitesi', 'ieee', 'approved', ${ONAY}, '2026-06-01T00:00:00Z');
  `);
}

const secilen = async () => {
  const { rows } = await db.query(
    `select public.best_guideline_for($1, null, null, null) as id`, [UNI]);
  return rows[0].id;
};

describe("kılavuz seçimi kararlı", () => {
  /*
    Bu test migration olmadan da geçebilir: PGlite küçük tabloda aynı planı
    üretip tesadüfen kararlı davranabiliyor. Asıl garantiyi aşağıdaki
    "hangi kayıt kazanıyor" testi veriyor; bu, sözleşmeyi belgeliyor.
  */
  test("eşit damgada hep aynı kayıt seçiliyor", () =>
    islem(db, async () => {
      await tohum();
      const ilk = await secilen();
      for (let i = 0; i < 5; i += 1) {
        assert.equal(await secilen(), ilk, "seçim çağrıdan çağrıya değişmemeli");
      }
    }));

  test("eşitlikte sonradan eklenen kayıt kazanıyor", () =>
    islem(db, async () => {
      await tohum();
      assert.equal(await secilen(), YENI);
    }));

  /* Eklenme sırası ters olsa da kural aynı: created_at belirler, satır sırası değil. */
  test("ekleme sırası sonucu değiştirmiyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`
        insert into auth.users (id, email) values ('${SAHIP}', 'sahip@example.com');
        insert into public.universities (id, name, university_type) values ('${UNI}', 'X Üniversitesi', 'devlet');
        insert into public.thesis_guidelines
          (id, university_id, university_name, citation_style, analysis_status, approved_snapshot, created_at)
          values
          ('${YENI}', '${UNI}', 'X Üniversitesi', 'ieee', 'approved', ${ONAY}, '2026-06-01T00:00:00Z'),
          ('${ESKI}', '${UNI}', 'X Üniversitesi', 'apa7', 'approved', ${ONAY}, '2026-01-01T00:00:00Z');
      `);
      assert.equal(await secilen(), YENI);
    }));

  /*
    Kararlılık kırıcıları ÖNCEKİ kuralların önüne geçmemeli: yürürlük
    tarihi hâlâ belirleyici.
  */
  test("yürürlük tarihi kararlılık kırıcılarından önce geliyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      // Eski kayda ileri bir yürürlük tarihi ver: artık o kazanmalı.
      await db.query(`update public.thesis_guidelines set effective_from = '2026-09-01' where id = $1`, [ESKI]);
      assert.equal(await secilen(), ESKI);
    }));
});
