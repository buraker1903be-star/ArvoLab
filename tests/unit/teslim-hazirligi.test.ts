import assert from "node:assert/strict";
import test from "node:test";
import { manuscriptReadiness, type ReadinessManuscript } from "@/lib/manuscript-readiness";
import type { AppliedGuideline } from "@/lib/guideline-rules";

/*
  Teslim hazırlığı: ana sayfadaki özet ile editördeki "Teslim kontrolü"
  aynı listeyi kullanıyor. Bu modül kendi başına kural üretmiyor, saf
  fonksiyonları BİRLEŞTİRİYOR — hataların yaşadığı yer de tam burası:
  yanlış varsayılan, yanlış alan, yanlış süzgeç. Liste öğrenciye "teslime
  hazırsın" diyor; eksik bir maddeyi yeşil göstermek en pahalı hata.
*/
const baslik = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const paragraf = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

const kilavuz = (uzerine: Partial<AppliedGuideline> = {}): AppliedGuideline => ({
  id: "k1",
  version: "2026-09-01T00:00:00Z",
  label: "X Üniversitesi",
  universityName: "X Üniversitesi",
  instituteName: null,
  versionLabel: null,
  sourceUrl: null,
  citationStyle: "apa7",
  requiredSections: ["Giriş", "Yöntem", "Bulgular", "Sonuç"],
  minPages: null,
  maxPages: null,
  settings: {},
  lastCheckedAt: null,
  updatePending: false,
  ...uzerine,
});

const metin = (uzerine: Partial<ReadinessManuscript> = {}): ReadinessManuscript => ({
  content: { type: "doc", content: [] },
  word_count: 0,
  ...uzerine,
});

const madde = (liste: ReturnType<typeof manuscriptReadiness>, id: string) =>
  liste.items.find((i) => i.id === id);

test("teslim hazırlığı", async (t) => {
  await t.test("numaralı başlık zorunlu bölümü karşılıyor", () => {
    /*
      Öğrenci başlığını "1. GİRİŞ" yazdığında kılavuzun "Giriş" bölümü
      eksik sayılmamalı: eşleştirme section-match kuralıyla, yani
      numaralandırma ve büyük harf gözetilmeden yapılıyor.
    */
    const liste = manuscriptReadiness({
      manuscript: metin({
        content: {
          type: "doc",
          content: [baslik(1, "1. GİRİŞ"), baslik(1, "2. Yöntem"), baslik(1, "3. BULGULAR"), baslik(1, "4. Sonuç")],
        },
      }),
      guideline: kilavuz(),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    assert.equal(madde(liste, "sections")?.status, "ok", JSON.stringify(madde(liste, "sections")));
  });

  await t.test("eksik bölüm yeşil gösterilmiyor", () => {
    const liste = manuscriptReadiness({
      manuscript: metin({ content: { type: "doc", content: [baslik(1, "Giriş"), baslik(1, "Yöntem")] } }),
      guideline: kilavuz(),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    const bolumler = madde(liste, "sections");
    assert.notEqual(bolumler?.status, "ok");
    assert.match(bolumler!.detail, /Bulgular/);
    assert.match(bolumler!.detail, /Sonuç/);
  });

  await t.test("gövde metnindeki cümle başlık sayılmıyor", () => {
    // "Bulgular tartışıldı." bir paragraf; bölüm başlığı değil.
    const liste = manuscriptReadiness({
      manuscript: metin({
        content: { type: "doc", content: [baslik(1, "Giriş"), paragraf("Bulgular tartışıldı."), paragraf("Sonuç olarak")] },
      }),
      guideline: kilavuz(),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    assert.match(madde(liste, "sections")!.detail, /Bulgular/);
  });

  await t.test("iç içe düğümlerdeki başlıklar da bulunuyor", () => {
    // Word'den gelen belgelerde başlık bir kapsayıcının içinde olabiliyor.
    const liste = manuscriptReadiness({
      manuscript: metin({
        content: {
          type: "doc",
          content: [
            { type: "section", content: [baslik(1, "Giriş"), baslik(1, "Yöntem")] },
            { type: "section", content: [baslik(1, "Bulgular"), baslik(1, "Sonuç")] },
          ],
        },
      }),
      guideline: kilavuz(),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    assert.equal(madde(liste, "sections")?.status, "ok");
  });

  await t.test("elle yazılmış numara yalnızca otomatik numaralandırma AÇIKKEN uyarı", () => {
    /*
      Numaralandırma kapalıyken elle yazılan numara sorun değil — kullanıcı
      numarayı kendisi yönetiyor. Açıkken ÇİFT numara çıkar ("1. 1. Giriş")
      ve bu uyarılmalı.

      Kılavuz numaralandırma kuralı SÖYLEMİYOR (settings boş): yoksa
      "kılavuza uy" dalı devreye girip iki durumu da uyarıya çevirir ve
      test ölçmek istediği şeyi ölçmez.
    */
    const belge = { type: "doc", content: [baslik(1, "1. Giriş"), baslik(1, "2. Yöntem")] };
    const olustur = (heading_numbering: boolean) =>
      manuscriptReadiness({
        manuscript: metin({ content: belge, heading_numbering }),
        guideline: kilavuz(),
        projectType: "thesis",
        citationStyle: "apa7",
      });

    assert.equal(madde(olustur(false), "numbering"), undefined, "kapalıyken madde hiç çıkmamalı");

    const acik = madde(olustur(true), "numbering");
    assert.equal(acik?.status, "warning");
    assert.match(acik!.detail, /2 başlıkta/);
    assert.equal(acik?.action?.id, "strip-manual-numbers");
  });

  await t.test("kılavuzun numaralandırma kuralı metinle çelişirse uyarılıyor", () => {
    const liste = manuscriptReadiness({
      manuscript: metin({ heading_numbering: false }),
      guideline: kilavuz({ settings: { headingNumbering: true } }),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    const numara = madde(liste, "numbering");
    assert.equal(numara?.status, "warning");
    assert.equal(numara?.action?.id, "apply-numbering");
  });

  await t.test("kılavuz yoksa liste yine üretiliyor", () => {
    // Kılavuzsuz çalışma da teslim edilebilir; liste çökmemeli.
    const liste = manuscriptReadiness({
      manuscript: metin({ content: { type: "doc", content: [baslik(1, "Giriş")] } }),
      guideline: null,
      projectType: "thesis",
      citationStyle: "apa7",
    });
    assert.ok(liste.items.length > 0);
    assert.ok(liste.total >= liste.done);
    assert.notEqual(madde(liste, "guideline")?.status, "ok", "kılavuz bağlı değil");
  });

  await t.test("kenar boşluğu boşsa 2,5 cm varsayılıyor ve kılavuzla karşılaştırılıyor", () => {
    /*
      Metnin kenar boşluğu null olabiliyor (hiç ayarlanmamış). Bu durumda
      geçerli değer 2,5 cm sayılıyor; kılavuz 3 cm istiyorsa fark
      GÖSTERİLMELİ, yoksa öğrenci yanlış düzenle teslim eder.
    */
    const liste = manuscriptReadiness({
      manuscript: metin({ margin_top_cm: null, show_page_numbers: true }),
      guideline: kilavuz({ settings: { margins: { top: 3, bottom: 2.5, left: 2.5, right: 2.5 }, showPageNumbers: true } }),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    const duzen = madde(liste, "page-setup");
    assert.ok(duzen, "sayfa düzeni maddesi olmalı");
    assert.notEqual(duzen?.status, "ok");
  });

  await t.test("sayılan madde toplamı tutarlı", () => {
    const liste = manuscriptReadiness({
      manuscript: metin(),
      guideline: kilavuz(),
      projectType: "thesis",
      citationStyle: "apa7",
    });
    assert.equal(liste.total, liste.items.length);
    assert.ok(liste.done >= 0 && liste.done <= liste.total);
  });
});
