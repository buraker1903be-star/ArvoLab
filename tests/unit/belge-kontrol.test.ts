import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { metinDurumu, sayfaDenetimi, surumFarki, type KarsilastirilanAnaliz } from "@/lib/belge-kontrol";

describe("belgenin metni denetime yeter mi", () => {
  test("taranmış PDF boş sayılır", () => {
    // pdf-parse görüntü PDF'te hata vermiyor; eskiden belge "Denetlendi" görünüyordu.
    assert.equal(metinDurumu("\n\n  \n", 80).durum, "bos");
  });

  test("yalnızca kapağı okunan belge kısmi", () => {
    // 80 sayfada 900 karakter: sayfa başına ~11.
    assert.equal(metinDurumu("x ".repeat(450), 80).durum, "kismi");
  });

  test("metin PDF'i tamam", () => {
    assert.equal(metinDurumu("x".repeat(80_000), 60).durum, "tamam");
  });

  test("Word'de sayfa bilinmez, yalnızca uzunluğa bakılır", () => {
    assert.equal(metinDurumu("x".repeat(5_000), null).durum, "tamam");
    assert.equal(metinDurumu("kısa", null).durum, "bos");
  });
});

describe("sayfa sınırı", () => {
  test("sınır içinde", () => {
    assert.deepEqual(sayfaDenetimi(120, 60, 200), { ton: "success", metin: "PDF 120 sayfa; kılavuz 60–200 sayfa öngörüyor." });
  });

  test("sınır dışı hüküm değil, kontrol önerisi", () => {
    const s = sayfaDenetimi(45, 60, null);
    assert.equal(s?.ton, "warning");
    assert.match(s!.metin, /en az 60 sayfa/);
    assert.match(s!.metin, /kılavuzdan kontrol edin/);
  });

  test("sayfa ya da sınır yoksa söylenecek bir şey yok", () => {
    assert.equal(sayfaDenetimi(null, 60, 200), null); // Word
    assert.equal(sayfaDenetimi(120, null, null), null);
  });
});

const analiz = (x: Partial<KarsilastirilanAnaliz> = {}): KarsilastirilanAnaliz => ({
  complianceScore: 60,
  referenceSectionFound: true,
  references: [{ issues: [1] }, { issues: [1] }, { issues: [] }],
  crossCheck: { citationsWithoutReference: [1, 2], referencesWithoutCitation: [1] },
  guidelineCompliance: { missingSections: ["Özet", "Ekler"] },
  kilavuz: { surum: "k@1" },
  ...x,
});

describe("önceki sürümle fark", () => {
  test("iyileşme yeşil, kötüleşme sarı", () => {
    const f = surumFarki(
      analiz(),
      analiz({
        complianceScore: 78,
        references: [{ issues: [] }, { issues: [] }, { issues: [1] }],
        crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [1, 2] },
        guidelineCompliance: { missingSections: ["Ekler"] },
      }),
    );
    assert.deepEqual(f, [
      { metin: "Kaynakça uyumu: 60 → 78", ton: "success" },
      { metin: "Biçim sorunu olan künye: 2 → 1", ton: "success" },
      { metin: "Atıfı olmayan kaynak: 1 → 2", ton: "warning" },
      { metin: "Karşılığı olmayan atıf: 2 → 0", ton: "success" },
      { metin: "Eksik zorunlu bölüm: 2 → 1", ton: "success" },
    ]);
  });

  test("değişiklik yoksa boş", () => {
    assert.deepEqual(surumFarki(analiz(), analiz()), []);
  });

  test("kaynakça okunamayınca sorunlar 'düzelmiş' sayılmaz", () => {
    const f = surumFarki(analiz(), analiz({ referenceSectionFound: false, references: [], complianceScore: null }));
    assert.deepEqual(f, [{ metin: "Kaynakça bölümü bu sürümde bulunamadı", ton: "warning" }]);
  });

  test("kılavuz değiştiyse bölüm sayıları karşılaştırılmaz", () => {
    const f = surumFarki(analiz(), analiz({ kilavuz: { surum: "k@2" }, guidelineCompliance: { missingSections: [] } }));
    assert.deepEqual(f, []);
  });
});
