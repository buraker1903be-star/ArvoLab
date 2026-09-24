import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { appliedGuidelineFromRow, type GuidelineRow } from "../../lib/guideline-rules";

/*
  Onaylı kılavuzun öğrenciye ulaştığı son halka.

  Bu yol canlıda HİÇ çalışmadı: 47 kılavuzun hiçbiri onaylı değil, bu yüzden
  approved_snapshot her kayıtta boş ve hiçbir çalışmaya kural inmedi. Yani
  buradaki bir uyumsuzluk bugüne kadar görünmezdi — kılavuzlar onaylandığı
  gün ortaya çıkardı.

  Testler tarayıcının GERÇEK çıktı anahtarlarını kullanıyor
  (lib/guideline-scan.ts → extractFormattingRules): margins_cm, font_family,
  font_size_pt, line_spacing, … İsimlerden biri kayarsa öğrencinin editörü
  sessizce varsayılanlara düşer.
*/
const TARAYICI_KURALLARI = {
  margins_cm: { top: 3, bottom: 2.5, left: 3.5, right: 2 },
  font_family: "Times New Roman",
  font_size_pt: 12,
  line_spacing: 1.5,
  show_page_numbers: true,
  heading_numbering: true,
  chapter_uppercase: true,
  chapter_new_page: true,
  justify: true,
  paragraph_indent_cm: 1.25,
  reference_hanging_indent_cm: 1.27,
  abstract_min_words: 150,
  abstract_max_words: 250,
  keywords_min: 3,
  keywords_max: 5,
};

const ONAY = {
  citation_style: "apa7",
  required_sections: ["Giriş", "Yöntem", "Bulgular", "Sonuç"],
  extracted_rules: TARAYICI_KURALLARI,
  min_pages: 60,
  max_pages: 200,
  version_label: "2025 sürümü",
  document_title: "X Üniversitesi Tez Yazım Kılavuzu",
  source_url: "https://ornek.edu.tr/kilavuz.pdf",
  approved_at: "2026-09-01T10:00:00Z",
};

const satir = (parca: Partial<GuidelineRow> = {}): GuidelineRow => ({
  id: "k1",
  university_name: "X Üniversitesi",
  institute_name: "Eğitim Bilimleri Enstitüsü",
  analysis_status: "approved",
  approved_snapshot: ONAY,
  ...parca,
});

describe("uygulanan kılavuz", () => {
  test("onaylı kayıt öğrenciye iniyor ve tarayıcı kuralları editör ayarına dönüşüyor", () => {
    const uygulanan = appliedGuidelineFromRow(satir());
    assert.ok(uygulanan, "onaylı kayıt uygulanmalı");
    assert.equal(uygulanan.citationStyle, "apa7");
    assert.equal(uygulanan.requiredSections.length, 4);
    assert.equal(uygulanan.minPages, 60);
    assert.equal(uygulanan.maxPages, 200);
    assert.equal(uygulanan.label, "X Üniversitesi Tez Yazım Kılavuzu");
    assert.equal(uygulanan.updatePending, false);

    const a = uygulanan.settings;
    assert.deepEqual(a.margins, { top: 3, bottom: 2.5, left: 3.5, right: 2 });
    assert.equal(a.fontFamily, "Times New Roman");
    assert.equal(a.fontSizePt, 12);
    assert.equal(a.lineSpacing, 1.5);
    assert.equal(a.headingNumbering, true);
    assert.equal(a.chapterUppercase, true);
    assert.equal(a.chapterNewPage, true);
    assert.equal(a.justify, true);
    assert.equal(a.showPageNumbers, true);
    assert.equal(a.paragraphIndentCm, 1.25);
    assert.equal(a.referenceHangingIndentCm, 1.27);
    assert.deepEqual(a.abstract, { minWords: 150, maxWords: 250, keywordsMin: 3, keywordsMax: 5 });
  });

  /*
    Onaylanmamış kayıt UYGULANMAZ. Katalogdaki 47 kaydın bugünkü durumu bu;
    "kurallar var ama onaysız" hâlinde öğrencinin editörüne inmemeli.
  */
  test("onaysız kayıt uygulanmıyor", () => {
    assert.equal(
      appliedGuidelineFromRow(satir({ analysis_status: "needs_review", approved_snapshot: null })),
      null,
    );
  });

  /*
    Yönetici kuralları yeniden düzenlerken kayıt needs_review'a düşüyor ama
    approved_snapshot duruyor: müşteri SON ONAYLI sürümle çalışmaya devam
    etmeli, ortasında kuralsız kalmamalı.
  */
  test("yeniden incelemeye düşen kayıtta son onaylı sürüm uygulanmaya devam ediyor", () => {
    const uygulanan = appliedGuidelineFromRow(satir({ analysis_status: "needs_review" }));
    assert.ok(uygulanan);
    assert.equal(uygulanan.citationStyle, "apa7");
    // Ama "güncelleme bekliyor" bilgisi kayboluyor değil.
    assert.equal(uygulanan.updatePending, true);
  });

  test("kaynakta yeni sürüm algılandıysa onaylıyken de bekleme işaretleniyor", () => {
    const uygulanan = appliedGuidelineFromRow(satir({ ai_analysis: { pendingReview: true } }));
    assert.equal(uygulanan?.updatePending, true);
  });

  /*
    Anlık görüntüden önceki kayıtlar: snapshot yok ama kayıt onaylı. Canlı
    alanlar kullanılır, yoksa eski onaylar bir gecede kuralsız kalırdı.
  */
  test("anlık görüntüsü olmayan eski onaylı kayıt canlı alanlardan kuruluyor", () => {
    const uygulanan = appliedGuidelineFromRow({
      id: "k2",
      university_name: "Y Üniversitesi",
      analysis_status: "approved",
      approved_snapshot: null,
      citation_style: "ieee",
      required_sections: ["Giriş", "Sonuç"],
      extracted_rules: { font_size_pt: 11 },
      reviewed_at: "2026-08-01T00:00:00Z",
    });
    assert.equal(uygulanan?.citationStyle, "ieee");
    assert.equal(uygulanan?.settings.fontSizePt, 11);
  });

  test("başlık yoksa kurum ve sürümden kuruluyor", () => {
    const uygulanan = appliedGuidelineFromRow(
      satir({ approved_snapshot: { ...ONAY, document_title: null } }),
    );
    assert.equal(uygulanan?.label, "X Üniversitesi — Eğitim Bilimleri Enstitüsü (2025 sürümü)");
  });

  /*
    Geçersiz değerler SESSİZCE düşürülür, uydurulmaz: 40 puntoluk bir
    "kural" öğrencinin belgesini bozardı. Eksik kural yok sayılır, editör
    kendi varsayılanıyla çalışır.
  */
  test("aralık dışı değerler editöre taşınmıyor", () => {
    const uygulanan = appliedGuidelineFromRow(
      satir({
        approved_snapshot: {
          ...ONAY,
          extracted_rules: { font_size_pt: 40, line_spacing: 9, font_family: "Comic Sans" },
        },
      }),
    );
    assert.equal(uygulanan?.settings.fontSizePt, undefined);
    assert.equal(uygulanan?.settings.lineSpacing, undefined);
    assert.equal(uygulanan?.settings.fontFamily, undefined);
  });

  /* Kenar boşlukları ya dördü birden ya hiç: üçüyle sayfa düzeni kurulamaz. */
  test("eksik kenar boşluğu kümesi uygulanmıyor", () => {
    const uygulanan = appliedGuidelineFromRow(
      satir({
        approved_snapshot: { ...ONAY, extracted_rules: { margins_cm: { top: 3, bottom: 2.5, left: 3.5 } } },
      }),
    );
    assert.equal(uygulanan?.settings.margins, undefined);
  });
});
