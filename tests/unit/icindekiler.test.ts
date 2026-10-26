import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { icindekiler } from "@/lib/icindekiler";

describe("içindekiler", () => {
  test("sayfa, başlıktan önceki kelimeden; bölüm yeni sayfada başlar", () => {
    const satirlar = icindekiler(
      [
        { pos: 0, level: 1, text: "Özet", kelimeOncesi: 0 },
        { pos: 10, level: 1, text: "Giriş", kelimeOncesi: 200 },
        { pos: 20, level: 2, text: "Amaç", kelimeOncesi: 700 },
        { pos: 30, level: 1, text: "Yöntem", kelimeOncesi: 1100 },
      ],
      true,
      500,
    );
    assert.deepEqual(
      satirlar.map((s) => [s.numara, s.sayfa]),
      [
        [null, 1],
        ["1.", 2],
        ["1.1.", 3],
        ["2.", 4],
      ],
    );
  });

  test("numaralama kapalıysa numara yok; geçersiz sayfa başı kelimede varsayılan", () => {
    const [s] = icindekiler([{ pos: 0, level: 1, text: "Giriş", kelimeOncesi: 1200 }], false, 0);
    assert.equal(s.numara, null);
    assert.equal(s.sayfa, 3);
  });
});
