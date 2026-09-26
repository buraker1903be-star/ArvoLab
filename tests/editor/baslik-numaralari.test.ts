import assert from "node:assert/strict";
import test from "node:test";
import { countManualHeadingNumbers } from "@/lib/tiptap-heading-numbers";
import { headingNumberMap } from "@/lib/heading-numbering";
import { belge, baslik, paragraf } from "./ortam";

/*
  Editörde başlık numaraları süsleme olarak, Word ve baskı çıktısında
  başlığın önüne eklenerek gösteriliyor. Numara metne YAZILMIYOR — bu
  yüzden elle yazılmış numara varsa çıktıda çift görünür ("1. 1. Giriş")
  ve öğrenci bunu ancak teslim ettiği belgede fark eder.

  Buradaki testler gerçek ProseMirror belgesi üzerinde: JSON taklidiyle
  değil, editörün kendi şemasından geçmiş bir belgeyle.
*/
test("başlık numaraları", async (t) => {
  await t.test("elle yazılmış numaralar sayılıyor", () => {
    const doc = belge(baslik(1, "1. Giriş"), baslik(1, "Yöntem"), baslik(2, "2.1 Örneklem"));
    assert.equal(countManualHeadingNumbers(doc), 2);
  });

  await t.test("yıl elle yazılmış numara sayılmıyor", () => {
    // "2023 Bulguları" başlığının başı kırpılmamalı.
    assert.equal(countManualHeadingNumbers(belge(baslik(1, "2023 Bulguları"))), 0);
  });

  await t.test("paragraftaki numara başlık sayılmıyor", () => {
    assert.equal(countManualHeadingNumbers(belge(paragraf("1. madde"), baslik(1, "Giriş"))), 0);
  });

  await t.test("numara eşlemesi gerçek belgede düğüm nesnesiyle anahtarlanıyor", () => {
    /*
      Anahtar düğüm NESNESİ: Word ve baskı belgeyi hangi sırayla gezerse
      gezsin doğru numarayı bulur. Eşleme JSON üzerinden kurulduğu için
      burada belgenin JSON'una bakılıyor.
    */
    const doc = belge(
      baslik(1, "Giriş"),
      baslik(2, "Amaç"),
      baslik(1, "Yöntem"),
      baslik(1, "Kaynakça"),
      baslik(1, "Sonuç"),
    );
    const json = doc.toJSON() as { content: { attrs?: { level?: number }; content?: { text?: string }[] }[] };
    const eslesme = headingNumberMap(json as never);
    const numara = (index: number) => eslesme.get(json.content[index] as never) ?? null;

    assert.equal(numara(0), "1.", "Giriş");
    assert.equal(numara(1), "1.1.", "Amaç");
    assert.equal(numara(2), "2.", "Yöntem");
    assert.equal(numara(3), null, "Kaynakça numarasız");
    assert.equal(numara(4), "3.", "Kaynakça bir numara yakmamalı");
  });

  await t.test("iç içe yapıdaki başlıklar da numaralanıyor", () => {
    // Tablo hücresi içindeki paragraf başlık değil; alıntı içindeki başlık sayılır.
    const doc = belge(
      baslik(1, "Giriş"),
      { type: "blockquote", content: [baslik(2, "Alt başlık")] },
      baslik(1, "Yöntem"),
    );
    const json = doc.toJSON() as { content: unknown[] };
    const eslesme = headingNumberMap(json as never);
    assert.equal(eslesme.size, 3, "alıntı içindeki başlık da numaralanmalı");
  });
});
