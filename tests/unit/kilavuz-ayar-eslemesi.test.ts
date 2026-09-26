import assert from "node:assert/strict";
import test from "node:test";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { PageMargins, SettingsSource } from "@/app/actions/manuscript";

/*
  Kılavuz sürümü ile metnin sayfa ayarları arasındaki karar.

  Dört sonuçtan biri çıkıyor ve ikisi kullanıcının BELGESİNİ değiştiriyor:
  "auto-applied" kendiliğinden yazıyor, "offer" soruyor. Ayrımı yanlış
  vermek ya öğrencinin kendi ayarlarını sessizce ezer ya da kılavuz
  güncellendiği hâlde eski ayarlarla yazmaya devam ettirir.
*/
const BOSLUK = (top: number, rest = 2.5): PageMargins => ({ top, bottom: rest, left: rest, right: rest });

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
  settings: { margins: BOSLUK(3), showPageNumbers: true, headingNumbering: true },
  lastCheckedAt: null,
  updatePending: false,
  ...uzerine,
});

const kaynak = (uzerine: Partial<SettingsSource> = {}): SettingsSource => ({
  guidelineId: "k1",
  version: "2026-09-01T00:00:00Z",
  customized: false,
  ...uzerine,
});

const metin = (uzerine: Partial<Parameters<typeof resolveGuidelineSync>[1] & object> = {}) => ({
  margins: BOSLUK(2.5),
  showPageNumbers: true,
  headingNumbering: false,
  settingsSource: kaynak(),
  ...uzerine,
});

test("kılavuz ayar eşlemesi", async (t) => {
  await t.test("kılavuz yoksa metnin ayarlarına dokunulmuyor", () => {
    const sonuc = resolveGuidelineSync(null, metin({ margins: BOSLUK(4) }));
    assert.equal(sonuc.mode, "none");
    assert.equal(sonuc.margins.top, 4);
    assert.deepEqual(sonuc.changes, []);
  });

  await t.test("henüz metin yoksa ayarlar kılavuzdan geliyor", () => {
    const sonuc = resolveGuidelineSync(kilavuz(), null);
    assert.equal(sonuc.mode, "fresh");
    assert.equal(sonuc.margins.top, 3);
    assert.equal(sonuc.headingNumbering, true);
    assert.equal(sonuc.source.guidelineId, "k1");
    assert.equal(sonuc.source.customized, false);
  });

  await t.test("damga kılavuzun sürümüyle aynıysa soru sorulmuyor", () => {
    const sonuc = resolveGuidelineSync(kilavuz(), metin({ margins: BOSLUK(3), headingNumbering: true }));
    assert.equal(sonuc.mode, "current");
    assert.deepEqual(sonuc.changes, []);
  });

  await t.test("kullanıcı dokunmamışsa yeni sürüm kendiliğinden uygulanıyor", () => {
    // Damga eski sürümden; ayarlar kılavuzdan gelmişti, kullanıcı değiştirmedi.
    const sonuc = resolveGuidelineSync(
      kilavuz(),
      metin({ settingsSource: kaynak({ version: "2026-01-01T00:00:00Z" }) }),
    );
    assert.equal(sonuc.mode, "auto-applied");
    assert.equal(sonuc.margins.top, 3, "kılavuzun değeri yazılmalı");
    assert.equal(sonuc.headingNumbering, true);
    assert.equal(sonuc.source.version, kilavuz().version, "damga yenilenmeli");
    assert.deepEqual(
      sonuc.changes.map((d) => `${d.label}: ${d.from} → ${d.to}`),
      ["Üst kenar boşluğu: 2,5 cm → 3 cm", "Başlık numaralandırma: Kapalı → Açık"],
    );
  });

  await t.test("kullanıcı ayarları değiştirmişse ezilmiyor, soruluyor", () => {
    const sonuc = resolveGuidelineSync(
      kilavuz(),
      metin({ margins: BOSLUK(4), settingsSource: kaynak({ version: "2026-01-01T00:00:00Z", customized: true }) }),
    );
    assert.equal(sonuc.mode, "offer");
    assert.equal(sonuc.margins.top, 4, "kullanıcının değeri korunmalı");
    assert.equal(sonuc.source.customized, true, "damga korunmalı");
    assert.ok(sonuc.changes.some((d) => d.label === "Üst kenar boşluğu" && d.to === "3 cm"));
  });

  await t.test("hiç damgalanmamış ayarlar kendiliğinden ezilmiyor", () => {
    /*
      version null: bu ayarların kılavuzdan geldiği bilinmiyor. Kullanıcı
      "customized" işaretlenmemiş olsa bile sessizce üzerine yazmak, elle
      girilmiş bir düzeni kaybettirebilir — bu yüzden soruluyor.
    */
    const sonuc = resolveGuidelineSync(
      kilavuz(),
      metin({ margins: BOSLUK(4), settingsSource: kaynak({ guidelineId: null, version: null }) }),
    );
    assert.equal(sonuc.mode, "offer");
    assert.equal(sonuc.margins.top, 4);
  });

  await t.test("ayarlar zaten kılavuzla aynıysa yalnızca damga yenileniyor", () => {
    const sonuc = resolveGuidelineSync(
      kilavuz(),
      metin({ margins: BOSLUK(3), headingNumbering: true, settingsSource: kaynak({ version: "2026-01-01T00:00:00Z", customized: true }) }),
    );
    assert.equal(sonuc.mode, "current");
    assert.deepEqual(sonuc.changes, []);
    assert.equal(sonuc.source.version, kilavuz().version);
    assert.equal(sonuc.source.customized, false, "artık kılavuzla aynı: özelleştirme işareti kalkmalı");
  });

  await t.test("kenar boşluğu ÇIKARILAMAMIŞ kılavuz metnin boşluklarını değiştirmiyor", () => {
    /*
      26.09.2026: tarayıcı makul olmayan kenar boşluklarını (A4'ün tam
      yüksekliği olan "üst 29,7 cm" gibi) artık hiç yazmıyor, yani
      settings.margins TANIMSIZ olabiliyor. Böyle bir kılavuz öğrencinin
      sayfa düzenini bozmamalı: eksik bilgi, yanlış bilgiden iyidir.
    */
    const eksik = kilavuz({ settings: { showPageNumbers: true, headingNumbering: false } });
    const sonuc = resolveGuidelineSync(
      eksik,
      metin({ margins: BOSLUK(4), settingsSource: kaynak({ version: "2026-01-01T00:00:00Z" }) }),
    );
    assert.equal(sonuc.margins.top, 4, "kılavuz boşluk söylemiyorsa metnin boşluğu kalır");
    assert.ok(
      !sonuc.changes.some((d) => d.label.includes("kenar boşluğu")),
      "söylenmeyen bir kural değişiklik olarak gösterilmemeli",
    );
  });

  await t.test("ondalık ayırıcı virgül", () => {
    const sonuc = resolveGuidelineSync(
      kilavuz({ settings: { margins: BOSLUK(1.25), showPageNumbers: true, headingNumbering: false } }),
      metin({ settingsSource: kaynak({ version: "2026-01-01T00:00:00Z" }) }),
    );
    assert.ok(sonuc.changes.some((d) => d.to === "1,25 cm"), JSON.stringify(sonuc.changes));
  });
});
