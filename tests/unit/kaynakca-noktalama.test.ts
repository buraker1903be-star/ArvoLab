import assert from "node:assert/strict";
import test from "node:test";
import { fixReferencePunctuation, hasReferencePunctuationIssue } from "@/lib/reference-punctuation";

/*
  Kaynakça noktalaması: denetim ve editördeki "Düzelt" düğmesi aynı kuralı
  kullanıyor. Düzeltme kullanıcının METNİNİ değiştiriyor, yani fazla
  çalışan bir kural doğru yazılmış bir künyeyi bozar — üç nokta ve ".NET"
  gibi biçimler bilerek korunuyor.
*/
test("kaynakça noktalaması", async (t) => {
  await t.test("çift nokta tekleniyor", () => {
    assert.ok(hasReferencePunctuationIssue("Yılmaz, A. (t.y.). Kitap.."));
    assert.equal(fixReferencePunctuation("Kitap.."), "Kitap.");
    assert.equal(fixReferencePunctuation("(t.y..)"), "(t.y.)");
  });

  await t.test("üç nokta korunuyor", () => {
    // Alıntıda atlama işareti; "..." tekleştirilirse anlam değişir.
    assert.equal(hasReferencePunctuationIssue("Kitap..."), false);
    assert.equal(fixReferencePunctuation("Kitap..."), "Kitap...");
    assert.equal(fixReferencePunctuation("Kitap…"), "Kitap…");
    // Boşluktan sonra gelen üç nokta da dokunulmaz kalmalı.
    assert.equal(fixReferencePunctuation("dedi ..."), "dedi ...");
  });

  await t.test("noktalama öncesi boşluk siliniyor", () => {
    assert.ok(hasReferencePunctuationIssue("Yılmaz , A."));
    assert.equal(fixReferencePunctuation("Yılmaz , A."), "Yılmaz, A.");
    assert.equal(fixReferencePunctuation("Kitap ."), "Kitap.");
    assert.equal(fixReferencePunctuation("Dergi ; 12(3)"), "Dergi; 12(3)");
    assert.equal(fixReferencePunctuation("Başlık : Alt başlık"), "Başlık: Alt başlık");
  });

  await t.test("bölünmez boşluk ve sekme de siliniyor", () => {
    // Word'den yapıştırılan künyelerde bölünmez boşluk sık; gözle
    // ayırt edilemediği için elle düzeltilmesi de zor.
    assert.equal(fixReferencePunctuation("Yılmaz\u00a0, A."), "Yılmaz, A.");
    assert.equal(fixReferencePunctuation("Yılmaz\t, A."), "Yılmaz, A.");
  });

  await t.test("kelime başı nokta korunuyor", () => {
    // ".NET Framework" gibi adlarda nokta kelimenin parçası.
    assert.equal(hasReferencePunctuationIssue("Microsoft .NET Framework"), false);
    assert.equal(fixReferencePunctuation("Microsoft .NET Framework"), "Microsoft .NET Framework");
  });

  await t.test("doğru yazılmış künyeye dokunulmuyor", () => {
    const kunye = "Yılmaz, A. (2023). Nitel araştırma yöntemleri (3. baskı). Anı Yayıncılık.";
    assert.equal(hasReferencePunctuationIssue(kunye), false);
    assert.equal(fixReferencePunctuation(kunye), kunye);
  });
});
