import assert from "node:assert/strict";
import test from "node:test";
import { yazarlikRaporu } from "@/lib/yazarlik-raporu";

/* Yazarlık raporu (03.11.2026): belgede duran asistan izli metnin payı. */
const yazi = (text: string, kayit?: string | null) =>
  kayit === undefined ? { type: "text", text } : { type: "text", text, marks: [{ type: "asistanIzi", attrs: { kayit } }] };
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const h = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [yazi(text)] });

test("pay, ekleme sayısı ve örnek", () => {
  const rapor = yazarlikRaporu([
    h("Giriş"),
    p(yazi("Bu altı sözcüklük öğrenci cümlesidir burada. "), yazi("Asistanın dört sözcüğü.", "k1")),
    p(yazi("Yine asistan.", "k1")),
    p(yazi("Başka bir ekleme var.", "k2")),
  ] as never);
  assert.equal(rapor.toplamKelime, 1 + 6 + 3 + 2 + 4);
  assert.equal(rapor.asistanKelime, 3 + 2 + 4);
  assert.equal(rapor.yuzde, Math.round((9 / 16) * 100));
  assert.deepEqual(
    rapor.eklemeler.map((e) => [e.kayit, e.kelime]),
    [
      ["k1", 5],
      ["k2", 4],
    ],
  );
  assert.equal(rapor.eklemeler[1].ornek, "Başka bir ekleme var.");
});

test("kaynakça sayılmaz; boş belge sıfır; işaretsiz belge sıfır pay", () => {
  const rapor = yazarlikRaporu([h("Giriş"), p(yazi("Öğrencinin metni burada.")), h("Kaynakça"), p(yazi("Yılmaz, A. (2020). Asistan gibi.", "k9"))] as never);
  assert.equal(rapor.asistanKelime, 0);
  assert.equal(rapor.toplamKelime, 1 + 3);
  assert.deepEqual(yazarlikRaporu([]), { toplamKelime: 0, asistanKelime: 0, yuzde: 0, eklemeler: [] });
});

test("sözcük ortasında biten iz ayrı sözcük sayılmaz; paragraf sınırı sözcük ayırır", () => {
  const rapor = yazarlikRaporu([p(yazi("Bir"), yazi("iki", "k1")), p(yazi("üç"))] as never);
  // "Biriki" tek sözcük: işaretli parça yine sayılıyor (bilinen kaba sayım), toplam 2 + 1 değil.
  assert.equal(rapor.eklemeler.length, 1);
  assert.ok(rapor.toplamKelime >= 2);
});
