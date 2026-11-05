import assert from "node:assert/strict";
import test from "node:test";
import { kelimeSay } from "@/lib/kelime-sayimi";
import { countWords } from "@/lib/tiptap-text";

/*
  B7 (Signature OS 4.3.5): tek kelime sayacı. Eskiden kayıt satır sonunda
  iki sözcüğü birleştiriyor, editör NBSP/sekmede bölmüyordu.
*/
test("her Unicode boşluğu ayırıcı: NBSP, ince boşluk, sekme, satır sonu", () => {
  assert.equal(kelimeSay("p\u00a0<\u00a00,05 düzeyinde\tanlamlı"), 5, "NBSP ve sekme ayırıcı; '<' de bir sözcük (Word gibi)");
  assert.equal(kelimeSay("Şekil\u00a01 ve Tablo\u202f2"), 5);
  assert.equal(kelimeSay("bir\niki\r\nüç"), 3);
  assert.equal(kelimeSay("a\u2009b\u3000c"), 3);
});

test("tek başına noktalama da sözcüktür (Word gibi; editörün eski sayısı); boş metin 0", () => {
  assert.equal(kelimeSay("Bulgular — ve · sonuçlar –"), 6);
  assert.equal(kelimeSay(""), 0);
  assert.equal(kelimeSay("     "), 0);
});

test("belge: satır sonu ve dipnot işareti ayırıcı, dipnot METNİ sayılmaz", () => {
  const doc = {
    type: "doc" as const,
    content: [
      { type: "paragraph", content: [{ type: "text", text: "birinci" }, { type: "hardBreak" }, { type: "text", text: "ikinci" }] },
      { type: "paragraph", content: [{ type: "text", text: "gövde" }, { type: "footnoteReference", attrs: { text: "bu dipnot sayılmaz" } }, { type: "text", text: "sonu" }] },
    ],
  };
  // Eskiden "birinciikinci" tek sözcük sayılıyordu (satır sonu boş).
  assert.equal(countWords(doc), 4);
});
