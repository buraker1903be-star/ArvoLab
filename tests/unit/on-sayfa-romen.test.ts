import assert from "node:assert/strict";
import test from "node:test";
import { anaMetinBaslangici, onSayfaBasligiMi, romen, sayfaEtiketleri } from "@/lib/heading-numbering";
import { onSayfaRomenCikar } from "@/lib/kilavuz-bicim";
import { noktaliIDuzle } from "@/lib/guideline-scan";
import { icindekiler } from "@/lib/icindekiler";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";

/*
  Ön sayfalar Romen rakamıyla, ana metin 1'den (02.11.2026). DEÜ SBE 1.6:
  "Romen rakamı 'iii' ile başlayarak Yemin Metni, Özet … küçük harf Romen
  rakamları ile numaralandırılır. Giriş bölümünde sayfa numarası 1'den başlar".
*/

const h1 = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

test("Romen rakamı", () => {
  assert.deepEqual([1, 2, 3, 4, 9, 14, 40].map(romen), ["i", "ii", "iii", "iv", "ix", "xiv", "xl"]);
});

test("ön sayfa başlıkları; arka bölümler ön sayfa değil", () => {
  for (const ad of ["ÖZET", "Abstract", "ÖNSÖZ", "İÇİNDEKİLER", "KISALTMALAR", "TABLOLAR LİSTESİ"]) assert.ok(onSayfaBasligiMi(ad), ad);
  for (const ad of ["GİRİŞ", "KAYNAKÇA", "EKLER", "EK 1: Anket", "ÖZGEÇMİŞ", "Birinci Bölüm"]) assert.ok(!onSayfaBasligiMi(ad), ad);
});

test("ana metnin başı: ön sayfa olmayan ilk H1", () => {
  assert.equal(anaMetinBaslangici({ content: [h1("ÖZET"), p("x"), h1("ABSTRACT"), p("y"), h1("GİRİŞ"), p("z")] }), 4);
  // Giriş kılavuz gereği numarasız olsa da ön sayfa değil; ön bölüm yoksa baştan.
  assert.equal(anaMetinBaslangici({ content: [h1("GİRİŞ"), p("z")] }), 0);
  assert.equal(anaMetinBaslangici({ content: [p("başlıksız metin")] }), 0);
  // Yalnızca ön sayfalar: ana metin yok.
  assert.equal(anaMetinBaslangici({ content: [h1("ÖZET"), p("x")] }), 2);
});

test("sayfa etiketleri: kapak boş, ön sayfalar Romen, ana metin 1'den", () => {
  assert.deepEqual(sayfaEtiketleri(7, 4, true), ["", "ii", "iii", "iv", "1", "2", "3"]);
  assert.deepEqual(sayfaEtiketleri(4, 2, false), ["i", "ii", "1", "2"]);
  assert.deepEqual(sayfaEtiketleri(2, -1, false), ["i", "ii"]);
});

test("kılavuzdan okunuyor; iki yarı da gerekiyor", () => {
  const deu = noktaliIDuzle(
    "Romen rakamı “iii” ile başlayarak Yemin Metni, Özet, İngilizce Özet, İçindekiler küçük harf Romen rakamları ile numaralandırılır. Giriş bölümünde sayfa numarası 1’den başlar ve buradan itibaren metnin diğer sayfalarına Arap rakamları (1, 2, 3, 4, ...) sırayla verilir.",
  );
  assert.equal(onSayfaRomenCikar(deu), true);
  // Bölüm numarasından söz eden Romen rakamı sayfa kuralı değil.
  assert.equal(onSayfaRomenCikar("Bölümler Romen rakamı ile numaralandırılır (BÖLÜM I, BÖLÜM II)."), false);
  assert.equal(onSayfaRomenCikar("Preliminary pages use lowercase roman numerals; arabic numerals start with the Introduction."), true);
  assert.equal(normalizeGuidelineEditorSettings({ front_matter_roman: true }).frontMatterRoman, true);
  assert.equal(normalizeGuidelineEditorSettings({ front_matter_roman: "evet" }).frontMatterRoman, undefined);
});

test("editörün içindekiler tahmini Romen ve 1'den", () => {
  const basliklar = [
    { pos: 0, level: 1, text: "ÖZET", kelimeOncesi: 0 },
    { pos: 1, level: 1, text: "ABSTRACT", kelimeOncesi: 300 },
    { pos: 2, level: 1, text: "GİRİŞ", kelimeOncesi: 600 },
    { pos: 3, level: 1, text: "BİRİNCİ BÖLÜM", kelimeOncesi: 1200 },
  ];
  const romenli = icindekiler(basliklar, false, 500, undefined, true).map((s) => s.sayfaEtiketi);
  assert.deepEqual(romenli, ["i", "ii", "1", "2"]);
  // Kural yokken eskisi gibi tek sayı dizisi.
  assert.deepEqual(icindekiler(basliklar, false, 500).map((s) => s.sayfaEtiketi), ["1", "2", "3", "4"]);
});
