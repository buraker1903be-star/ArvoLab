import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  cozulenUyarilariAyikla,
  kilavuzIstemi,
  kilavuzMetni,
  kilavuzOkumasiniCozumle,
  kurallariBirlestir,
  redMi,
  type KilavuzOkumasi,
} from "@/lib/ai/kilavuz-kurallari";
import { extractFormattingRules } from "@/lib/guideline-scan";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";

/*
  Yapay zekâyla kılavuz okuma (02.11.2026). Metin DEÜ Sosyal Bilimler
  kılavuzunun pdf-parse çıktısı (tests/fixtures/kilavuz-deu-sbe.txt);
  model yanıtları gerçek bir okumanın biçiminde elle yazıldı. Sınanan:
  doğrulama — alıntı metinde, sayı alıntıda, bölüm adı metinde.
*/
const METIN = readFileSync("tests/fixtures/kilavuz-deu-sbe.txt", "utf8");

const DOGRU = JSON.stringify({
  kurallar: {
    kenar_ust_cm: { deger: 3, alinti: "Üst boşluk (top) : 3 cm" },
    kenar_alt_cm: { deger: 3, alinti: "Alt boşluk (bottom) : 3 cm" },
    kenar_sol_cm: { deger: 4, alinti: "Sol (left) : 4 cm" },
    kenar_sag_cm: { deger: 2.5, alinti: "Sağ (right) : 2,5 cm" },
    yazi_tipi: { deger: "Times New Roman", alinti: "Karakter : Arial veya Times New Roman" },
    punto: { deger: 12, alinti: "Times New Roman karakterinde 12 punto" },
    satir_araligi: { deger: 1.5, alinti: "Satır Aralıkları : 1,5" },
    paragraf_once_nk: { deger: 0, alinti: "(önce 0nk, sonra 0nk)" },
    paragraf_sonra_nk: { deger: 0, alinti: "(önce 0nk, sonra 0nk)" },
    paragraf_girintisi_cm: { deger: 1.25, alinti: "Paragraf Girintisi : 1,25 cm" },
    iki_yana_yasla: { deger: true, alinti: "Paragraf Düzeni : İki yana yaslanmış (Justified)" },
    dipnot_punto: { deger: 10, alinti: "Times New Roman için 10, Arial için 9 punto kullanılır" },
    sayfa_numarasi_yeri: { deger: "bottom-right", alinti: "Sayfa Numarası : Sağ alt köşe" },
    on_sayfalar_romen: { deger: true, alinti: "Giriş bölümünde sayfa numarası 1’den başlar" },
    bolum_hizasi: { deger: "center", alinti: "Tezin BÖLÜM BAŞLIKLARI sayfanın ortasına yazılmak kaydıyla" },
    sola_yasli_bolumler: { deger: ["Giriş", "Sonuç", "Kaynakça"], alinti: "GİRİŞ, SONUÇ, KAYNAKÇA başlıkları ve BİRİNCİ DERECE ALT BAŞLIKLAR en sola yaslı" },
    numarasiz_bolumler: { deger: ["Giriş", "Sonuç"], alinti: "“Giriş” ve “Sonuç” başlıkları ayrı bir bölüm olmadığından numaralandırma yapılmayacaktır" },
    alt_baslik_girintisi: { deger: { duzey: 3, cm: 1.25 }, alinti: "birinci dereceden sonraki başlıkların tümü 1,25 cm içeriden hizalı" },
    ozet_en_cok_kelime: { deger: 250, alinti: "Tez özeti 250 kelimeyi geçmemelidir." },
    zorunlu_bolumler: { deger: ["Özet", "Giriş", "Sonuç ve Öneriler", "Kaynakça", "Ekler"], alinti: "2.2.3. Sonuç ve Öneriler" },
  },
});

test("doğrulanan okuma kural kümesine çevriliyor ve editör ayarına iniyor", () => {
  const sonuc = kilavuzOkumasiniCozumle(DOGRU, METIN);
  assert.ok(!redMi(sonuc), JSON.stringify(sonuc));
  const o = sonuc as KilavuzOkumasi;
  assert.deepEqual(o.kurallar.margins_cm, { top: 3, bottom: 3, left: 4, right: 2.5 });
  assert.equal(o.kurallar.font_size_pt, 12);
  assert.equal(o.kurallar.line_spacing, 1.5);
  assert.deepEqual(o.kurallar.paragraph_spacing_pt, { beforePt: 0, afterPt: 0 });
  assert.deepEqual(o.kurallar.subheading_indent, { fromLevel: 3, cm: 1.25 });
  assert.equal(o.kurallar.abstract_max_words, 250);
  assert.deepEqual(o.zorunluBolumler, ["Özet", "Giriş", "Sonuç ve Öneriler", "Kaynakça", "Ekler"]);
  // Kalıp okumanın KAÇIRDIĞI kural (özet sınırı 250) yapay zekâdan geliyor.
  assert.equal((extractFormattingRules(METIN, 5, false).suggestedRules as Record<string, unknown>).abstract_max_words, undefined);
  const ayar = normalizeGuidelineEditorSettings(o.kurallar);
  assert.equal(ayar.abstract?.maxWords, 250);
  assert.equal(ayar.footnoteSizePt, 10);
  assert.equal(ayar.frontMatterRoman, true);
  assert.equal(o.kanitlar.length, Object.keys(JSON.parse(DOGRU).kurallar).length);
});

test("metinde olmayan alıntı yanıtın tamamını düşürüyor", () => {
  const yanit = JSON.parse(DOGRU);
  yanit.kurallar.punto = { deger: 12, alinti: "Metin 12 punto ile yazılmalıdır" }; // kılavuzda böyle bir cümle yok
  const sonuc = kilavuzOkumasiniCozumle(JSON.stringify(yanit), METIN);
  assert.ok(redMi(sonuc));
  assert.deepEqual(sonuc, { neden: "alinti", ayrinti: ["punto"] });
});

test("alıntıda geçmeyen sayı uydurma sayılıyor", () => {
  const yanit = JSON.parse(DOGRU);
  yanit.kurallar.kenar_sol_cm = { deger: 3.5, alinti: "Sol (left) : 4 cm" };
  const sonuc = kilavuzOkumasiniCozumle(JSON.stringify(yanit), METIN);
  assert.ok(redMi(sonuc));
  assert.equal(sonuc.neden, "uydurma_sayi");
});

test("metinde geçmeyen bölüm adı reddediliyor", () => {
  const yanit = JSON.parse(DOGRU);
  yanit.kurallar.zorunlu_bolumler.deger.push("Bulgular ve Tartışma");
  const sonuc = kilavuzOkumasiniCozumle(JSON.stringify(yanit), METIN);
  assert.ok(redMi(sonuc));
  assert.deepEqual(sonuc.ayrinti, ["bölüm: Bulgular ve Tartışma"]);
});

test("aralık dışı okuma yok sayılıyor, boş yanıt reddediliyor", () => {
  // A4'ün yüksekliği alıntıda geçiyor ama kenar boşluğu olamaz: ret değil, kural yazılmaz.
  const yanit = { kurallar: { kenar_ust_cm: { deger: 297, alinti: "A4 (210 x 297 mm)" }, punto: { deger: 12, alinti: "Times New Roman karakterinde 12 punto" } } };
  const sonuc = kilavuzOkumasiniCozumle(JSON.stringify(yanit), METIN) as KilavuzOkumasi;
  assert.equal(sonuc.kurallar.margins_cm, undefined);
  assert.equal(sonuc.kurallar.font_size_pt, 12);
  assert.ok(redMi(kilavuzOkumasiniCozumle("{}", METIN)));
  assert.ok(redMi(kilavuzOkumasiniCozumle("düz yazı", METIN)));
});

test("birleştirme: yapay zekâ kazanıyor, farklar söyleniyor; kalıbın okuduğu korunuyor", () => {
  const { kurallar, farklar } = kurallariBirlestir({ font_size_pt: 11, page_size: "a4" }, { font_size_pt: 12, line_spacing: 1.5 });
  assert.deepEqual(kurallar, { font_size_pt: 12, page_size: "a4", line_spacing: 1.5 });
  assert.deepEqual(farklar, ["font_size_pt"]);
});

test("yapay zekânın çözdüğü kalıp uyarıları düşüyor (metinler tarayıcıyla aynı)", () => {
  const kalip = extractFormattingRules("Metin yazılır.", 1, false).warnings;
  // Bu uyarıların tarayıcıda gerçekten bu metinle üretildiğini doğrular.
  assert.ok(kalip.includes("Gövde metninin satır aralığı açıkça bulunamadı."));
  assert.ok(kalip.includes("Yeterli sayıda zorunlu bölüm tespit edilemedi."));
  const o = kilavuzOkumasiniCozumle(DOGRU, METIN) as KilavuzOkumasi;
  const kalan = cozulenUyarilariAyikla(kalip, o);
  assert.ok(!kalan.includes("Gövde metninin satır aralığı açıkça bulunamadı."));
  assert.ok(!kalan.includes("Yeterli sayıda zorunlu bölüm tespit edilemedi."));
  // Atıf sistemi okunmadıysa o uyarı kalır.
  assert.ok(kalan.includes("Kaynakça sistemi açıkça bulunamadı."));
});

test("uzun kılavuzda bütçe biçim satırlarına harcanıyor, sırası korunuyor", () => {
  const dolgu = "Bu kılavuz enstitünün tarihçesini anlatır.\n".repeat(3000);
  const uzun = `${dolgu}Satır Aralıkları : 1,5\n${dolgu}Kenar Boşlukları : Üst boşluk (top) : 3 cm`;
  const { kaynak, kirpildi } = kilavuzMetni(uzun, 5_000);
  assert.ok(kirpildi);
  assert.ok(kaynak.length <= 5_000);
  assert.ok(kaynak.indexOf("Satır Aralıkları") < kaynak.indexOf("Kenar Boşlukları"));
  // Biçim satırının bir önceki/sonraki satırı bağlam olarak gidiyor; dolgunun geri kalanı gitmiyor.
  assert.ok((kaynak.match(/tarihçesini/g) ?? []).length <= 4);
  // DEÜ kılavuzu bütçeye sığıyor: olduğu gibi gidiyor.
  assert.equal(kilavuzIstemi(METIN).kirpildi, false);
});
