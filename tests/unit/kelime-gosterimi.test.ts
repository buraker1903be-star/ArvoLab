import assert from "node:assert/strict";
import test from "node:test";
import { gosterilecekKelime, icerikleSayilacaklar, ICERIKTEN_SAYIM_SINIRI } from "@/lib/kelime-gosterimi";
import { countWords, extractPlainText } from "@/lib/tiptap-text";
import { kelimeSay } from "@/lib/kelime-sayimi";

/*
  Ekranda gösterilen kelime sayısı (UX S1-A). Algoritma değişmedi
  (lib/kelime-sayimi.ts); değişen, içerik eldeyken kayıttaki ESKİ sayının
  değil editörle aynı sayımın gösterilmesi.
*/
const belge = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "bir" }, { type: "hardBreak" }, { type: "text", text: "iki" }] },
    { type: "paragraph", content: [{ type: "text", text: "p < 0,05 üç" }] },
  ],
};

test("içerik varsa editörle aynı sayım (countWords); kayıttaki eski sayı yok sayılır", () => {
  assert.equal(gosterilecekKelime({ content: belge, word_count: 3 }), countWords(belge as never));
  assert.equal(gosterilecekKelime({ content: belge, word_count: 3 }), 6);
});

test("içerik yoksa ya da belge değilse kayıttaki sayı", () => {
  assert.equal(gosterilecekKelime({ word_count: 42 }), 42);
  assert.equal(gosterilecekKelime({ content: null, word_count: 7 }), 7);
  assert.equal(gosterilecekKelime({ content: "metin", word_count: 7 }), 7);
  assert.equal(gosterilecekKelime({}), 0);
});

test("eski kural (düz metinden sayım) satır sonunda iki sözcüğü birleştiriyordu: gösterim ondan ayrışır", () => {
  // Kayıttaki 6.304 / editördeki 6.354 farkının kaynağı: plain_text ayıraç taşımıyor.
  assert.ok(kelimeSay(extractPlainText(belge as never)) < gosterilecekKelime({ content: belge }));
});

test("listede en son düzenlenen sınır kadar çalışma içerikten sayılır", () => {
  const adaylar = Array.from({ length: 15 }, (_, i) => ({ id: `c${i}`, guncellendi: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z` }));
  const secilen = icerikleSayilacaklar(adaylar);
  assert.equal(secilen.length, ICERIKTEN_SAYIM_SINIRI);
  assert.equal(secilen[0], "c14");
  assert.ok(!secilen.includes("c0") && !secilen.includes("c2"));
  assert.deepEqual(icerikleSayilacaklar(adaylar, 0), []);
  assert.deepEqual(icerikleSayilacaklar([]), []);
});
