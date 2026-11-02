import assert from "node:assert/strict";
import test from "node:test";
import {
  adListedeMi,
  anaBaslikHizasi,
  bolumHizasiCikar,
  dipnotPuntosuCikar,
  numarasizBolumlerCikar,
  paragrafAraligiCikar,
  sayfaNumarasiKonumuCikar,
} from "@/lib/kilavuz-bicim";
import { extractFormattingRules, noktaliIDuzle } from "@/lib/guideline-scan";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";
import { numberHeadings } from "@/lib/heading-numbering";
import { icindekiler } from "@/lib/icindekiler";

/* DEÜ Sosyal Bilimler kılavuzunun ilgili cümleleri (pdf-parse çıktısı, 02.11.2026). */
const DEU = noktaliIDuzle(
  [
    "Paragraf Aralıkları : Paragraflar ararsında boşluk bırakılmamalı (önce 0nk, sonra 0nk).",
    "Paragraf Girintisi : 1,25 cm Paragraf Düzeni : İki yana yaslanmış (Justified)",
    "Sayfa Numarası : Sağ alt köşe (Altbilgi (footer): 1,25 cm) Yazı Rengi : Siyah",
    "“Giriş” ve “Sonuç” başlıkları ayrı bir bölüm olmadığından numaralandırma yapılmayacaktır.",
    "Tezin BÖLÜM BAŞLIKLARI sayfanın ortasına yazılmak kaydıyla, GİRİŞ, SONUÇ, KAYNAKÇA başlıkları ve BİRİNCİ DERECE ALT BAŞLIKLAR en sola yaslı olarak yazılmalı.",
    "Dipnotlar tüm metin için (1)’den başlayarak numaralandırılır. Dipnotlarda yazı boyutu olarak tezin yazıldığı yazı karakterine göre Times New Roman için 10, Arial için 9 punto kullanılır.",
  ].join(" "),
);

test("DEÜ SBE kılavuzunun ince kuralları", () => {
  assert.equal(dipnotPuntosuCikar(DEU, "Times New Roman"), 10);
  assert.equal(dipnotPuntosuCikar(DEU, "Arial"), 9);
  assert.deepEqual(paragrafAraligiCikar(DEU), { beforePt: 0, afterPt: 0 });
  assert.equal(sayfaNumarasiKonumuCikar(DEU), "bottom-right");
  assert.deepEqual(bolumHizasiCikar(DEU), { hiza: "center", solaYasli: ["Giriş", "Sonuç", "Kaynakça"] });
  assert.deepEqual(numarasizBolumlerCikar(DEU), ["Giriş", "Sonuç"]);
});

test("açıkça yazılmamış kural çıkmıyor", () => {
  // Gövdenin 12 puntosu dipnotun ölçüsü değil.
  assert.equal(dipnotPuntosuCikar("Metin Times New Roman 12 punto yazılır. Dipnotlar sayfa altında verilir.", "Times New Roman"), undefined);
  // Başlığın "önce 12 nk" kuralı paragrafın değil; ölçüsüz "bir satır boşluk" tahmin edilmez.
  assert.equal(paragrafAraligiCikar("Başlıklardan önce 12 nk, sonra 6 nk boşluk bırakılır."), undefined);
  assert.equal(paragrafAraligiCikar("Paragraflar arasında bir satır boşluk bırakılmalıdır."), undefined);
  assert.equal(sayfaNumarasiKonumuCikar("Sayfa numarası verilmelidir."), undefined);
  assert.equal(bolumHizasiCikar("Başlıklar kalın yazılır."), undefined);
  assert.deepEqual(numarasizBolumlerCikar("Bütün başlıklar numaralandırılır."), []);
});

test("başka yazımlar", () => {
  assert.equal(dipnotPuntosuCikar("Dipnotlar 10 punto ve tek aralıklı yazılır."), 10);
  assert.deepEqual(paragrafAraligiCikar("Paragraf öncesi 6 nk, sonrası 6 nk aralık verilir."), { beforePt: 6, afterPt: 6 });
  assert.equal(sayfaNumarasiKonumuCikar("Sayfa numaraları sayfanın altına ortalanarak yazılır."), "bottom-center");
  assert.equal(sayfaNumarasiKonumuCikar("Sayfa numarası sağ üst köşeye yazılır."), "top-right");
  assert.deepEqual(bolumHizasiCikar(noktaliIDuzle("Ana bölüm başlıkları ortalanarak yazılır.")), { hiza: "center", solaYasli: [] });
  assert.deepEqual(bolumHizasiCikar("Bölüm başlıkları sola yaslı yazılır."), { hiza: "left", solaYasli: [] });
});

test("ana başlık hizası ve ad eşleşmesi", () => {
  const ayar = { chapterAlign: "center" as const, chapterLeftSections: ["Giriş", "Sonuç", "Kaynakça"] };
  assert.equal(anaBaslikHizasi("GİRİŞ", ayar), "left");
  // "Sonuç" kuralı "Sonuç ve Öneriler"i de kapsar.
  assert.equal(anaBaslikHizasi("SONUÇ VE ÖNERİLER", ayar), "left");
  assert.equal(anaBaslikHizasi("BİRİNCİ BÖLÜM KURAMSAL ÇERÇEVE", ayar), "center");
  assert.equal(anaBaslikHizasi("Giriş", {}), null);
  // "Sonuçlar ve Tartışma" "Sonuç" değil.
  assert.equal(adListedeMi("Sonuçlar ve Tartışma", ["Sonuç"]), false);
});

test("numarasız ana başlıklar numaralandırmada ve editör içindekilerinde", () => {
  const basliklar = [
    { level: 1, text: "GİRİŞ" },
    { level: 1, text: "Kuramsal Çerçeve" },
    { level: 2, text: "Tanımlar" },
    { level: 1, text: "Sonuç ve Öneriler" },
  ];
  // Eskiden: 1., 2., 2.1., 3.
  assert.deepEqual(numberHeadings(basliklar, ["Giriş", "Sonuç"]), [null, "1.", "1.1.", null]);
  assert.deepEqual(numberHeadings(basliklar), ["1.", "2.", "2.1.", "3."]);
  // Yalnızca ana başlık: "Giriş" adlı bir ALT başlık numarasını korur.
  assert.deepEqual(numberHeadings([{ level: 1, text: "Yöntem" }, { level: 2, text: "Giriş" }], ["Giriş"]), ["1.", "1.1."]);
  const satirlar = icindekiler(
    basliklar.map((b, i) => ({ ...b, pos: i, kelimeOncesi: i * 100 })),
    true,
    500,
    ["Giriş", "Sonuç"],
  );
  assert.deepEqual(satirlar.map((s) => s.numara), [null, "1.", "1.1.", null]);
});

test("kurallar tarayıcıdan editör ayarına iniyor, saçma değer inmiyor", () => {
  const { suggestedRules } = extractFormattingRules(DEU, 5, true);
  const ayar = normalizeGuidelineEditorSettings(suggestedRules);
  assert.deepEqual(ayar.paragraphSpacing, { beforePt: 0, afterPt: 0 });
  assert.equal(ayar.pageNumberPosition, "bottom-right");
  assert.equal(ayar.chapterAlign, "center");
  assert.deepEqual(ayar.chapterLeftSections, ["Giriş", "Sonuç", "Kaynakça"]);
  assert.deepEqual(ayar.unnumberedSections, ["Giriş", "Sonuç"]);

  const saçma = normalizeGuidelineEditorSettings({
    footnote_size_pt: 40,
    paragraph_spacing_pt: { beforePt: -1, afterPt: 6 },
    chapter_align: "justify",
    page_number_position: "middle",
    unnumbered_sections: [42, ""],
  });
  assert.deepEqual(saçma, {});
});
