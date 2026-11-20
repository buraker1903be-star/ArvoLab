import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { atifIslemi, kaynakcaGirdisiIslemi } from "@/app/dashboard/editor/[id]/write/editor-navigation";
import { belge, baslik, editorSchema, paragraf } from "./ortam";

/*
  ALINTI + ATIF TEK İŞLEMDE (20.11.2026, canlı deneme). Eskiden PDF'ten
  alıntı ayrı bir işlemle, önüne boşluk konmadan yazılıyordu
  ("tanımlanmıştır“…”"), atıf üretilemezse alıntı atıfsız kalıyordu ve
  Ctrl+Z ikisini ayrı ayrı geri alıyordu. Bu dosya gerçek ProseMirror
  belgesi ve geçmiş eklentisiyle sabitler.
*/
const kaynak = { title: "Seasonal patterns in synthetic data", authors: "Fisher, E. W., & Other, J.", year: "2023", source_type: "article", doi_or_url: null, container_title: "Journal of Science & Society" };
const ALINTI = "Seasonal variation explained most of the observed difference.";

function durum(doc = belge(baslik(1, "Giriş"), paragraf("Önceki çalışmalar şöyle tanımlar"))) {
  return EditorState.create({ doc, plugins: [history()] });
}
const metin = (s: EditorState) => s.doc.textBetween(0, s.doc.content.size, "\n");
/* "Önceki çalışmalar şöyle tanımlar" paragrafının içindeki konumlar (başlık 7 düğüm boyu). */
const PARAGRAF_BASI = 8;
const PARAGRAF_SONU = PARAGRAF_BASI + "Önceki çalışmalar şöyle tanımlar".length;

describe("alıntı ve atıf", () => {
  test("sözcük sonuna: önce boşluk, sonra alıntı, boşluk, atıf; kaynakça açılır", () => {
    const s = durum();
    const tr = s.tr;
    const sonuc = atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    const yeni = s.apply(tr);
    assert.equal(sonuc.addedReference, true);
    assert.match(metin(yeni), /tanımlar “Seasonal variation explained most of the observed difference\.” \(Fisher ve Other, 2023\)\nKaynakça\nFisher, E\. W\., & Other, J\./);
  });

  test("eklenen alıntı seçilen metnin birebir aynısı (sözcük ortasında biten seçim dahil)", () => {
    const yarim = "Seasonal variation expl";
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: yarim, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    assert.ok(metin(s.apply(tr)).includes(`“${yarim}”`));
  });

  test("tek geri alma alıntıyı, atfı ve kaynakça girdisini birlikte kaldırır", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    let yeni = s.apply(tr);
    undo(yeni, (t) => (yeni = yeni.apply(t)));
    assert.equal(metin(yeni), metin(s));
  });

  test("kayıtlı konuma yazar; işlemin seçimi başka yerdeyse de", () => {
    const s = durum();
    const tr = s.tr.setSelection(TextSelection.create(s.doc, 2)); // seçim başlıkta
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    const yeni = s.apply(tr);
    assert.ok(metin(yeni).startsWith("Giriş\nÖnceki çalışmalar şöyle tanımlar “"), metin(yeni));
  });

  test("boşluktan, parantezden sonra ve paragraf başında fazladan boşluk yok; sözcük ortasında arkaya boşluk", () => {
    const bosluk = durum(belge(paragraf("Metin ")));
    const t1 = bosluk.tr;
    atifIslemi(t1, kaynak, "apa7", { konum: { from: 7, to: 7 } });
    assert.ok(metin(bosluk.apply(t1)).startsWith("Metin (Fisher ve Other, 2023)"));

    const bas = durum(belge(paragraf("Metin")));
    const t2 = bas.tr;
    atifIslemi(t2, kaynak, "apa7", { alinti: ALINTI, konum: { from: 1, to: 1 } });
    assert.ok(metin(bas.apply(t2)).startsWith(`“${ALINTI}” (Fisher ve Other, 2023) Metin`), metin(bas.apply(t2)));
  });

  test("aynı kaynağa ikinci atıf kaynakçayı yinelemez", () => {
    let s = durum();
    for (let i = 0; i < 2; i++) {
      const tr = s.tr;
      atifIslemi(tr, kaynak, "apa7", { konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
      s = s.apply(tr);
    }
    assert.equal(metin(s).split("Seasonal patterns in synthetic data").length - 1, 1, metin(s));
  });

  test("hazır (CSL) atıf ve dipnot biçimi de aynı işlemde", () => {
    const s = durum();
    const tr = s.tr;
    const r = atifIslemi(tr, kaynak, "apa7", {
      alinti: ALINTI,
      konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU },
      hazir: { atif: [{ text: "Fisher ve Other, 2023, s. 4." }], kunye: [{ text: "Fisher, E. W. ve Other, J. 2023." }], dipnot: true },
    });
    const yeni = s.apply(tr);
    assert.equal(r.citation, "Fisher ve Other, 2023, s. 4.");
    let dipnot = 0;
    yeni.doc.descendants((n) => {
      if (n.type.name === "footnoteReference") dipnot++;
    });
    assert.equal(dipnot, 1);
    assert.ok(metin(yeni).includes(`tanımlar “${ALINTI}”`));
  });
});

test("şema: editorSchema yüklendi", () => assert.ok(editorSchema.nodes.footnoteReference));

/*
  B-16 (20.11.2026): yazım asistanının metni ve eşleşen kaynağın künyesi
  AYNI işlemde girer. Eskiden metin düz atıfla giriyor, Kaynakça hiç
  güncellenmiyordu; ayrı işlem olsaydı Ctrl+Z metni geri alıp künyeyi
  kaynakçada yetim bırakırdı.
*/
test("B-16: AI metni ve künyesi tek işlemde; tek geri alma ikisini birlikte kaldırır; olan künye yinelenmez", () => {
  let s = EditorState.create({ doc: belge(baslik(1, "Giriş"), paragraf("Önceki çalışmalar")), plugins: [history()] });
  const tr = s.tr.insert(s.doc.content.size, editorSchema.nodeFromJSON({ type: "paragraph", content: [{ type: "text", text: "Mevsimsel örüntüler belirgindir (Fisher & Other, 2023)." }] }));
  assert.equal(kaynakcaGirdisiIslemi(tr, kaynak, "apa7", { dil: "tr" }), true);
  s = s.apply(tr);
  assert.match(metin(s), /Kaynakça\nFisher, E\. W\., & Other, J\. \(2023\)/);
  const tr2 = s.tr;
  assert.equal(kaynakcaGirdisiIslemi(tr2, kaynak, "apa7", { dil: "tr" }), false, "künye zaten kaynakçada");
  assert.equal(tr2.docChanged, false);
  undo(s, (u) => (s = s.apply(u)));
  assert.equal(metin(s), "Giriş\nÖnceki çalışmalar");
});
