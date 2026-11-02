import assert from "node:assert/strict";
import test from "node:test";
import { extractFormattingRules, onerilenBolumler, taramaUyarisiCevir } from "@/lib/guideline-scan";
import { atifYontemiUyarisi, atifYontemleri, atifSistemiSec } from "@/lib/atif-sistemi";
import { bicimOzeti } from "@/lib/kilavuz-dogrulama";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";

/*
  Dokuz Eylül Üniversitesi Sosyal Bilimler Enstitüsü "Tez Yazımında
  Uyulması Gereken Kurallar" (2011). Bir öğrenci 02.11.2026'da yükledi ve
  tarayıcı kuralların yarısını kaçırdı: satır aralığı, iki yana yaslama,
  büyük harfli bölüm başlıkları ve bölümlerin çoğu çıkmadı, punto da
  YANLIŞ çıktı (Times New Roman için 11 — kılavuzda Arial'in puntosu).
  Aşağıdaki metin, pdf-parse'ın o belgeden çıkardığı satırlardır.
*/
const ICINDEKILER = [
  "İÇİNDEKİLER i",
  "EKLER LİSTESİ iii",
  "GİRİŞ 1",
  "BİRİNCİ BÖLÜM",
  "1.5. ATIF USULLERİ 4",
  "1.5.1. Dipnot Yöntemi 5",
  "1.5.2. Metin İçi Yöntem 9",
  "2.1.5. Özet 16",
  "2.2.1. Giriş 17",
  "2.2.3. Sonuç ve Öneriler 18",
  "2.3.1. Kaynakça 18",
  "2.3.2. Ekler 23",
].join("\n");

const BICIM = [
  "Kenar Boşlukları : Üst boşluk (top) : 3 cm",
  "Alt boşluk (bottom) : 3 cm",
  "Sol (left) : 4 cm",
  "Sağ (right) : 2,5 cm",
  "Karakter : Arial veya Times New Roman",
  "Punto : Arial karakterinde 11 punto,",
  "Times New Roman karakterinde 12 punto",
  "Satır Aralıkları : 1,5",
  "Paragraf Aralıkları : Paragraflar ararsında boşluk bırakılmamalı (önce 0nk,",
  "sonra 0nk).",
  "Paragraf Girintisi : 1,25 cm",
  "Paragraf Düzeni : İki yana yaslanmış (Justified)",
  "Sayfa Numarası : Sağ alt köşe (Altbilgi (footer): 1,25 cm)",
  "Bunların dışındaki tüm başlıklar numaralandırılmalı, bölüm başlığı ve birinci",
  "derece alt başlığı oluşturan cümlenin tümü “BÜYÜK HARFLERLE ve KOYU",
  "(BOLD)” yazılmalıdır.",
  "Tezin BÖLÜM BAŞLIKLARI sayfanın ortasına yazılmak kaydıyla, GİRİŞ,",
  "SONUÇ, KAYNAKÇA başlıkları ve BİRİNCİ DERECE ALT BAŞLIKLAR en sola",
  "Dipnotlarda yazı boyutu olarak tezin yazıldığı yazı karakterine göre Times New Roman için 10, Arial",
  "için 9 punto kullanılır.",
  "Tezlerde dipnot yöntemi ve metin içi yöntem olmak üzere iki farklı yöntem",
  "kullanılabilir.",
].join("\n");

const METIN = `${ICINDEKILER}\n${BICIM}`;

test("DEÜ SBE kılavuzunun biçim kuralları", async (t) => {
  const { suggestedRules: kurallar, warnings } = extractFormattingRules(METIN, 5, false);

  await t.test("punto SEÇİLEN yazı tipinin puntosu", () => {
    // Eskiden 11 çıkıyordu: ilk eşleşme Arial'inkiydi, yazı tipi Times New Roman.
    assert.equal(kurallar.font_family, "Times New Roman");
    assert.equal(kurallar.font_size_pt, 12);
    assert.ok(warnings.some((u) => u.includes("birden fazla yazı tipine izin veriyor (Arial, Times New Roman)")), warnings.join(" | "));
  });

  await t.test("tablo düzenindeki satır aralığı okunuyor", () => {
    // "Satır Aralıkları : 1,5" — eskiden yalnızca "1,5 satır aralığı" aranıyordu.
    assert.equal(kurallar.line_spacing, 1.5);
  });

  await t.test("büyük İ ile yazılmış kurallar görülüyor", () => {
    // "İki yana yaslanmış": `i` bayrağı "İ"yi "i" saymıyordu.
    assert.equal(kurallar.justify, true);
    // "bölüm başlığı … BÜYÜK HARFLERLE": "başlığı" (ğ) eskiden eşleşmiyordu.
    assert.equal(kurallar.chapter_uppercase, true);
  });

  await t.test("kenar boşlukları, girinti, kâğıt değişmedi", () => {
    assert.deepEqual(kurallar.margins_cm, { top: 3, bottom: 3, left: 4, right: 2.5 });
    assert.equal(kurallar.paragraph_indent_cm, 1.25);
  });

  await t.test("tek yazı tipli kılavuzda uyarı yok", () => {
    const tek = extractFormattingRules("Yazı tipi Times New Roman, 12 punto, 1,5 satır aralığı.", 5, true);
    assert.equal(tek.suggestedRules.font_size_pt, 12);
    assert.ok(!tek.warnings.some((u) => u.includes("birden fazla yazı tipine")));
  });

  await t.test("satır aralığının ardında birim varsa aralık sayılmıyor", () => {
    const nk = extractFormattingRules("Satır aralığı: 6 nk önce, 6 nk sonra.", 5, true);
    assert.equal(nk.suggestedRules.line_spacing, undefined);
  });
});

test("DEÜ SBE kılavuzunun bölümleri", () => {
  /*
    Eskiden ["Özet", "Sonuç", "Ekler"]: çok düzeyli numara ("2.2.1. Giriş")
    ve büyük İ ("GİRİŞ") tanınmıyordu, "Sonuç" ise "Sonuç ve Öneriler"in
    başından ve "SONUÇ, KAYNAKÇA başlıkları" cümlesinden geliyordu.
  */
  assert.deepEqual(onerilenBolumler(METIN, false), ["Özet", "Giriş", "Sonuç ve Öneriler", "Kaynakça", "Ekler"]);
  // Kılavuz yalnızca "Sonuç" diyorsa o kalır.
  assert.deepEqual(onerilenBolumler("1. GİRİŞ\n4. SONUÇ\nKAYNAKÇA", false), ["Giriş", "Sonuç", "Kaynakça"]);
});

test("sistem adı vermeyen kılavuz yöntemi söylüyor", () => {
  assert.equal(atifSistemiSec(METIN), null);
  assert.deepEqual(atifYontemleri(METIN), { dipnot: true, metinIci: true });
  const uyari = atifYontemiUyarisi(atifYontemleri(METIN));
  assert.ok(uyari?.includes("dipnot ve metin içi"), uyari ?? "");
  assert.notEqual(taramaUyarisiCevir(uyari!, "en"), uyari);
  assert.equal(atifYontemiUyarisi(atifYontemleri("APA 7 kullanılır.")), null);
  // Büyük harfle yazılmış başlık da yöntemi söylüyor.
  assert.deepEqual(atifYontemleri("1.5.2. METİN İÇİ YÖNTEM"), { dipnot: false, metinIci: true });
});

test("yazı tipi uyarısı İngilizceye çevriliyor", () => {
  assert.equal(
    taramaUyarisiCevir("Kılavuz birden fazla yazı tipine izin veriyor (Arial, Times New Roman); Times New Roman önerildi, punto ona göre alındı.", "en"),
    "The guideline allows more than one font (Arial, Times New Roman); Times New Roman was suggested and the size taken for it.",
  );
});

test("onay ekranının özeti editöre inen her kuralı söylüyor", () => {
  const { suggestedRules } = extractFormattingRules(METIN, 5, false);
  const satirlar = bicimOzeti(normalizeGuidelineEditorSettings({ ...suggestedRules, page_size: "a4" }));
  // Eskiden girinti, yaslama, kâğıt ve büyük harfli başlık özette yoktu.
  assert.ok(satirlar.includes("Kâğıt: A4"), satirlar.join(" | "));
  assert.ok(satirlar.includes("Paragraf: ilk satır girintisi 1,25 cm · iki yana yaslı"), satirlar.join(" | "));
  assert.ok(satirlar.includes("Bölüm başlıkları büyük harfle"), satirlar.join(" | "));
  assert.ok(satirlar.includes("Yazı: Times New Roman · 12 punto"), satirlar.join(" | "));
});
