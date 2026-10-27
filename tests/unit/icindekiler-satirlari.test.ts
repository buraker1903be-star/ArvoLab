import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { icindekilerSatirlari } from "@/lib/heading-numbering";

const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("içindekiler satırları (Word ve PDF ortak)", () => {
  test("H1–H3 sırayla, numaralama açıkken çıktıdaki numarasıyla; boş başlık ve H4 yok", () => {
    const doc = { content: [h(1, "Özet"), p("x"), h(1, "Giriş"), h(2, "Amaç"), h(4, "Derin"), h(2, " "), h(1, "Kaynakça")] };
    assert.deepEqual(icindekilerSatirlari(doc, true), [
      { level: 1, text: "Özet", numara: null },
      { level: 1, text: "Giriş", numara: "1." },
      { level: 2, text: "Amaç", numara: "1.1." },
      { level: 1, text: "Kaynakça", numara: null },
    ]);
    assert.equal(icindekilerSatirlari(doc, false)[1].numara, null);
    assert.deepEqual(icindekilerSatirlari(null, true), []);
  });
});
