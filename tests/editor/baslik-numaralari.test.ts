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

/*
  Phase 2 (04.11.2026): başlığa dokunmayan değişiklikte süsleme baştan
  kurulmuyor, yeni konumlara EŞLENİYOR. Eşlenen sonuç baştan kurulanla
  birebir aynı olmalı; olmazsa numara/hiza/sayfa ayracı yanlış başlıkta
  görünür. Rastgele düzenlemelerle sınanır.
*/
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { basliklaraDokunurMu, buildDecorations } from "@/lib/tiptap-heading-numbers";
import type { DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";

const ozet = (set: DecorationSet, doc: PmNode) =>
  set.find(0, doc.content.size).map((d) => `${d.from}-${d.to}:${JSON.stringify((d as unknown as { type: { attrs: unknown } }).type.attrs)}`).sort();

function rastgele(tohum: number) {
  let s = tohum;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

test("başlığa dokunmayan düzenlemede eşlenen süsleme baştan kurulanla aynı", () => {
  const kurallar = { numarasiz: ["Giriş", "Sonuç"], chapterAlign: "center" as const };
  const parcalar = [];
  for (let i = 0; i < 12; i++) parcalar.push(baslik(1 + (i % 3), i % 5 === 0 ? "Giriş" : `Bölüm ${i}`), paragraf(`Paragraf ${i} metni burada uzunca yazılı.`), paragraf(`İkinci paragraf ${i}.`));
  const r = rastgele(42);
  let state = EditorState.create({ doc: belge(...parcalar) });
  let sus = buildDecorations(state.doc, true, kurallar);
  let eslenen = 0;
  let baştan = 0;
  for (let adim = 0; adim < 400; adim++) {
    const boyut = state.doc.content.size;
    const konum = 1 + Math.floor(r() * (boyut - 2));
    const tr = state.tr;
    const tur = r();
    try {
      if (tur < 0.45) tr.insertText(r() < 0.5 ? "x" : "Giriş ", konum);
      else if (tur < 0.7) tr.delete(konum, Math.min(boyut - 1, konum + 1 + Math.floor(r() * 30)));
      else if (tur < 0.85) tr.split(konum);
      else tr.addMark(konum, Math.min(boyut - 1, konum + 5), state.schema.marks.bold.create());
    } catch {
      continue; // geçersiz konum (ör. düğüm sınırı): bu adım atlanır
    }
    if (!tr.docChanged) continue;
    const yeni = state.apply(tr.setSelection(TextSelection.create(tr.doc, 1)));
    const beklenen = buildDecorations(yeni.doc, true, kurallar);
    if (basliklaraDokunurMu(tr)) {
      baştan++;
      sus = beklenen;
    } else {
      eslenen++;
      sus = sus.map(tr.mapping, tr.doc);
      assert.deepEqual(ozet(sus, yeni.doc), ozet(beklenen, yeni.doc), `adım ${adim}: eşlenen süsleme farklı`);
    }
    state = yeni;
  }
  // Sınamanın bir şey ölçtüğünden emin ol: iki yol da gerçekten çalıştı.
  assert.ok(eslenen > 50, `eşlenen yol çok az çalıştı (${eslenen})`);
  assert.ok(baştan > 10, `baştan kurma yolu çok az çalıştı (${baştan})`);
});

test("başlığın metnine yazmak, başlığı silmek ve düzey değiştirmek baştan kurar", () => {
  const doc = belge(baslik(1, "Giriş"), paragraf("Metin"), baslik(2, "Alt"));
  const state = EditorState.create({ doc });
  assert.equal(basliklaraDokunurMu(state.tr.insertText("x", 2)), true); // başlığın içi
  assert.equal(basliklaraDokunurMu(state.tr.insertText("x", 10)), false); // paragrafın içi
  const ilk = doc.firstChild!;
  assert.equal(basliklaraDokunurMu(state.tr.delete(0, ilk.nodeSize)), true); // başlığı silmek
  assert.equal(basliklaraDokunurMu(state.tr.setNodeMarkup(0, undefined, { level: 2 })), true); // düzey
  assert.equal(basliklaraDokunurMu(state.tr.addMark(1, 4, state.schema.marks.bold.create())), false); // biçim
});
