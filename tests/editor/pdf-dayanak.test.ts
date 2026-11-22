import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState } from "@tiptap/pm/state";
import { history, redo, undo } from "@tiptap/pm/history";
import { Packer } from "docx";
import JSZip from "jszip";
import { atifIslemi } from "@/app/dashboard/editor/[id]/write/editor-navigation";
import { pdfDayanaklari, pdfIsaretleri, PDF_DAYANAK } from "@/lib/tiptap-pdf-dayanak";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { belge, baslik, paragraf } from "./ortam";

/*
  PDF DAYANAĞI (20.11.2026): PDF'teki kalıcı vurgu belgedeki görünmez
  işaretten türer. Bu dosya kalıcılığın belgeyle tutarlılığını gerçek
  ProseMirror belgesi ve geçmiş eklentisiyle sabitler: işaret yalnızca
  pasaja bağlı eklemede konur, geri alma/yineleme/silme ile birlikte
  gider-gelir, hiçbir çıktıya girmez.
*/
const kaynak = { title: "Seasonal patterns in synthetic data", authors: "Fisher, E. W., & Other, J.", year: "2023", source_type: "article", doi_or_url: null, container_title: "J" };
const ALINTI = "Seasonal variation explained most of the observed difference.";
const DAYANAK = { pdf: "pdf-1", surum: "parmakizi-a", sayfa: 3, pasaj: ALINTI, kaynak: "k-1" };
const durum = () => EditorState.create({ doc: belge(baslik(1, "Giriş"), paragraf("Önceki çalışmalar şöyle tanımlar")), plugins: [history()] });
const SON = 8 + "Önceki çalışmalar şöyle tanımlar".length;
const isaretliMetin = (s: EditorState) => {
  const parcalar: string[] = [];
  s.doc.descendants((n) => {
    if (n.marks.some((m) => m.type.name === PDF_DAYANAK)) parcalar.push(n.isText ? (n.text ?? "") : `[${n.type.name}]`);
  });
  return parcalar;
};

describe("işaret yalnızca pasaja bağlı eklemede", () => {
  test("alıntı + atıf: ikisi de işaretli, aradaki boşluklar değil", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    const y = s.apply(tr);
    assert.deepEqual(isaretliMetin(y), [`“${ALINTI}”`, "(Fisher ve Other, 2023)"]);
    assert.deepEqual(pdfDayanaklari(y.doc), [DAYANAK]);
  });
  test("yalnızca atıf (pasaja bağlı): atıf işaretli", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { konum: { from: SON, to: SON }, dayanak: DAYANAK });
    assert.deepEqual(isaretliMetin(s.apply(tr)), ["(Fisher ve Other, 2023)"]);
  });
  test("genel kaynak atfı (pasaj yok): hiçbir şey işaretlenmez", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { konum: { from: SON, to: SON } });
    const y = s.apply(tr);
    assert.deepEqual(isaretliMetin(y), []);
    assert.deepEqual(pdfDayanaklari(y.doc), []);
  });
  test("dipnot stili: dipnot düğümü işaretli", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "dipnot", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    assert.deepEqual(isaretliMetin(s.apply(tr)), [`“${ALINTI}”`, "[footnoteReference]"]);
  });
  test("aynı PDF'ten iki pasaj: ikisi de ayrı işaret", () => {
    let s = durum();
    let tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    s = s.apply(tr);
    tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: "Ikinci pasaj.", konum: { from: s.doc.content.size - 2, to: s.doc.content.size - 2 }, dayanak: { ...DAYANAK, sayfa: 5, pasaj: "Ikinci pasaj." } });
    s = s.apply(tr);
    assert.equal(pdfDayanaklari(s.doc).length, 2);
  });
});

describe("belgeyle tutarlılık", () => {
  test("geri alma işareti kaldırır, yineleme geri getirir", () => {
    let s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    s = s.apply(tr);
    assert.equal(pdfDayanaklari(s.doc).length, 1);
    undo(s, (u) => (s = s.apply(u)));
    assert.equal(pdfDayanaklari(s.doc).length, 0);
    redo(s, (u) => (s = s.apply(u)));
    assert.equal(pdfDayanaklari(s.doc).length, 1);
  });
  test("atıf ve alıntı silinince işaret de gider", () => {
    let s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    s = s.apply(tr);
    let bas = -1;
    let son = -1;
    s.doc.descendants((n, pos) => {
      if (n.marks.some((m) => m.type.name === PDF_DAYANAK)) {
        if (bas < 0) bas = pos;
        son = pos + n.nodeSize;
      }
    });
    s = s.apply(s.tr.delete(bas, son));
    assert.equal(pdfDayanaklari(s.doc).length, 0);
  });
  test("başarısız ekleme (işlem gönderilmedi) işaret bırakmaz", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
    // tr uygulanmadı: belge aynı.
    assert.equal(pdfDayanaklari(s.doc).length, 0);
  });
});

describe("PDF sürümü", () => {
  test("eski sürüme ait işaret yeni dosyada uygulanmaz, sayılır", () => {
    const d = [DAYANAK, { ...DAYANAK, surum: "eski", sayfa: 2 }, { ...DAYANAK, pdf: "baska" }];
    const r = pdfIsaretleri(d, "pdf-1", "parmakizi-a");
    assert.equal(r.gecerli.length, 1);
    assert.equal(r.eski, 1);
    assert.deepEqual(pdfIsaretleri(d, "pdf-1", null), { gecerli: [], eski: 0 });
  });
});

test("işaret hiçbir çıktıya girmez (yazdırma ve Word), metin aynen", async () => {
  const s = durum();
  const tr = s.tr;
  atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: SON, to: SON }, dayanak: DAYANAK });
  const json = s.apply(tr).doc.toJSON();
  const html = renderTiptapHtml(json as never, {}).html;
  assert.match(html, /Seasonal variation explained most of the observed difference/);
  assert.ok(!/pdf-dayanak|data-pdf/.test(html), html);
  const word = await buildDocxFromTiptap({ title: "T", doc: json as never, fetchImage: async () => null } as never);
  const xml = await (await JSZip.loadAsync(await Packer.toBuffer(word))).file("word/document.xml")!.async("string");
  assert.match(xml, /Seasonal variation explained/);
  assert.ok(!/parmakizi|pdf-1/.test(xml));
});
