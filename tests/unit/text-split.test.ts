import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { splitBodyAndReferences } from "@/lib/text-split";

describe("gövde ve kaynakça ayrımı", () => {
  test("Türkçe başlık", () => {
    const { bodyText, referenceText } = splitBodyAndReferences("Giriş metni.\nKAYNAKÇA\nYılmaz, A. (2020). Başlık.");
    assert.equal(bodyText, "Giriş metni.");
    assert.equal(referenceText, "Yılmaz, A. (2020). Başlık.");
  });

  /* İngilizce çalışmalar (28.10.2026): MLA'nın "Works Cited" başlığı da tanınmalı. */
  test("İngilizce başlıklar: References ve Works Cited", () => {
    assert.equal(splitBodyAndReferences("Body.\nReferences\nSmith, J. (2020). Title.").referenceText, "Smith, J. (2020). Title.");
    assert.equal(splitBodyAndReferences("Body.\nWorks Cited\nSmith, John. Title. 2020.").bodyText, "Body.");
  });
});
