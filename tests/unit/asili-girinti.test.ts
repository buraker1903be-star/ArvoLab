import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HANGING_CM, hangingIndentCmOf, parseHangingStyle, validHangingCm } from "@/lib/paragraph-format";
import { HANGING_INDENT, HANGING_INDENT_CM } from "@/lib/guideline-scan";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";

describe("asılı girinti ölçüsü", () => {
  test("öznitelikten okunur; true eski kayıt için varsayılanı verir", () => {
    assert.equal(hangingIndentCmOf({ hangingIndent: 1.27 }), 1.27);
    assert.equal(hangingIndentCmOf({ hangingIndent: true }), DEFAULT_HANGING_CM);
    assert.equal(hangingIndentCmOf({ hangingIndent: false }), null);
    assert.equal(hangingIndentCmOf(null), null);
  });

  test("yalnızca NEGATİF text-indent asılı girintidir", () => {
    // Olumlu değer normal ilk satır girintisidir; ikisi birbirinin tersi.
    assert.equal(parseHangingStyle("-1.27cm"), 1.27);
    assert.equal(parseHangingStyle("1.25cm"), false);
    assert.equal(parseHangingStyle(""), false);
  });

  test("aralık dışındaki ölçü kabul edilmez", () => {
    assert.equal(validHangingCm(1.27), 1.27);
    assert.equal(validHangingCm("1,27"), 1.27);
    assert.equal(validHangingCm(0.1), undefined);
    assert.equal(validHangingCm(9), undefined);
  });
});

describe("kılavuzdan çıkarım", () => {
  const gecer = (metin: string) => HANGING_INDENT.test(metin);

  test("üç yazım biçimi de tanınır", () => {
    assert.ok(gecer("Kaynakçada asılı girinti kullanılır."));
    assert.ok(gecer("Asılı paragraf girintisi uygulanır."));
    assert.ok(gecer("References use a hanging indent."));
  });

  test("ilk satır girintisiyle karışmaz", () => {
    assert.ok(!gecer("Paragraflarda ilk satır girintisi 1,25 cm olmalıdır."));
  });

  test("ölçü iki yazım sırasında da okunur", () => {
    assert.equal(HANGING_INDENT_CM.exec("asılı girinti 1,27 cm olmalıdır")?.[1], "1,27");
    assert.equal(HANGING_INDENT_CM.exec("1,27 cm asılı girinti kullanılır")?.[2], "1,27");
  });
});

describe("kılavuz ayarlarına dönüşüm", () => {
  test("iki anahtar adı da okunur", () => {
    assert.equal(normalizeGuidelineEditorSettings({ reference_hanging_indent_cm: 1.27 }).referenceHangingIndentCm, 1.27);
    assert.equal(normalizeGuidelineEditorSettings({ hanging_indent_cm: 1.5 }).referenceHangingIndentCm, 1.5);
  });

  test("kural yoksa alan hiç yazılmaz", () => {
    // "Bilmiyorum" ile "istemiyor" aynı şey değil.
    assert.equal("referenceHangingIndentCm" in normalizeGuidelineEditorSettings({}), false);
  });

  test("geçersiz ölçü yok sayılır", () => {
    assert.equal(normalizeGuidelineEditorSettings({ reference_hanging_indent_cm: 40 }).referenceHangingIndentCm, undefined);
  });
});
