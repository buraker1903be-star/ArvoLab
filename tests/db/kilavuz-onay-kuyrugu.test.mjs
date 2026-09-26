// Onaya hazırlık ölçütü: OCR'lı kılavuz tek adım onaya girmiyor
// (migration 20260926135648).
//
// Ölçüt güven, bölüm sayısı, dolu kural kümesi ve algılanmış atıf sistemine
// bakıyordu. OCR hiçbirine girmiyor — taranmış görüntüden okunan metin için
// ayrı bir ceza yok, yalnızca uyarı ekleniyor — yani metni gürültülü bir
// belge "Tek adım onaya hazır" rozetini alıp yöneticiye bildirim
// ürettiriyordu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const UNI = "00000000-0000-4000-8000-00000000e201";
const KILAVUZ = "00000000-0000-4000-8000-00000000e301";

let db;
before(async () => {
  db = await veritabani();
});

/** Ölçütün diğer bütün koşullarını sağlayan kayıt; yalnızca ai_analysis değişir. */
async function kilavuzYaz(analiz) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.universities (id, name, university_type)
      values ('${UNI}', 'X Üniversitesi', 'devlet')
      on conflict (id) do nothing;
  `);
  await db.query(
    `insert into public.thesis_guidelines
       (id, university_id, university_name, citation_style, analysis_status,
        required_sections, extracted_rules, ai_analysis)
     values ('${KILAVUZ}', '${UNI}', 'X Üniversitesi', 'apa7', 'needs_review',
             array['Giriş','Yöntem','Bulgular','Sonuç'],
             '{"font_size_pt":12}'::jsonb, $1::jsonb)
     on conflict (id) do update set ai_analysis = excluded.ai_analysis`,
    [JSON.stringify(analiz)],
  );
  const { rows } = await db.query(
    `select ready_for_approval from public.thesis_guidelines where id = '${KILAVUZ}'`);
  return rows[0].ready_for_approval;
}

const SAGLAM = { detectedCitationHint: "APA 7", confidence: 0.95 };

describe("onay kuyruğu ölçütü", () => {
  test("bütün koşullar sağlanınca kayıt tek adım onaya hazır", () =>
    islem(db, async () => {
      assert.equal(await kilavuzYaz(SAGLAM), true);
    }));

  test("OCR ile okunan kılavuz tek adım onaya girmiyor", () =>
    islem(db, async () => {
      assert.equal(await kilavuzYaz({ ...SAGLAM, ocrUsed: true }), false);
    }));

  test("ocrUsed false ise ölçüt etkilenmiyor", () =>
    islem(db, async () => {
      // Alanın varlığı değil, DEĞERİ karar veriyor.
      assert.equal(await kilavuzYaz({ ...SAGLAM, ocrUsed: false }), true);
    }));

  test("atıf sistemi algılanmamışsa yine hazır değil", () =>
    islem(db, async () => {
      assert.equal(await kilavuzYaz({ confidence: 0.95 }), false);
    }));

  test("güven eşiğin altındaysa hazır değil", () =>
    islem(db, async () => {
      assert.equal(await kilavuzYaz({ ...SAGLAM, confidence: 0.89 }), false);
    }));
});
