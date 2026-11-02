import assert from "node:assert/strict";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { buildDocxFromTiptap, type DocxTextDefaults } from "@/lib/tiptap-docx";
import { buildPrintSheet } from "@/lib/print-sheet";
import { buildDecorations } from "@/lib/tiptap-heading-numbers";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import { belge, type JsonNode } from "./ortam";

/*
  KILAVUZUN İNCE BİÇİM KURALLARI ÜÇ YOLDA (02.11.2026, lib/kilavuz-bicim.ts).

  DEÜ Sosyal Bilimler kılavuzundan dipnot puntosu, paragraf aralığı,
  bölüm başlığı hizası, sayfa numarasının yeri ve numarasız Giriş/Sonuç
  okunuyordu ama hiçbir çıktıya inmiyordu. cikti-yollari.test.ts'in
  ilkesi burada da geçerli: her kural editörde, yazdırma/PDF'te ve Word'de
  AYRI yorumlanıyor; biri unutursa öğrenci editörde gördüğünü kâğıtta
  görmez. Her kural kapalı ve açık çizilir, çıktının DEĞİŞMESİ ve doğru
  biçimi taşıması istenir.
*/

const DEU = {
  footnoteSizePt: 10,
  paragraphSpacing: { beforePt: 0, afterPt: 0 },
  chapterAlign: "center" as const,
  chapterLeftSections: ["Giriş", "Sonuç", "Kaynakça"],
  pageNumberPosition: "bottom-right" as const,
  unnumberedSections: ["Giriş", "Sonuç"],
};

const h1 = (text: string, attrs: Record<string, unknown> = {}): JsonNode => ({
  type: "heading",
  attrs: { level: 1, ...attrs },
  content: [{ type: "text", text }],
});
const p = (text: string): JsonNode => ({ type: "paragraph", content: [{ type: "text", text }] });

const TEZ: JsonNode[] = [
  h1("GİRİŞ"),
  p("Giriş metni."),
  h1("Kuramsal Çerçeve"),
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Dipnotlu cümle" },
      { type: "footnoteReference", attrs: { text: "Dipnot açıklaması." } },
    ],
  },
  h1("Yöntem", { textAlign: "right" }),
  p("Yöntem metni."),
  h1("Sonuç ve Öneriler"),
  p("Sonuç metni."),
];
const tezJson = { type: "doc", content: TEZ };

async function wordXml(textDefaults: DocxTextDefaults, headingNumbering = false) {
  const doc = await buildDocxFromTiptap({
    title: "Test",
    doc: tezJson as never,
    fetchImage: async () => null,
    textDefaults,
    headingNumbering,
  });
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const dosya = async (ad: string) => (await zip.file(ad)?.async("string")) ?? "";
  const ustAlt = Object.keys(zip.files).filter((ad) => /word\/(header|footer)\d*\.xml$/.test(ad));
  return {
    belge: await dosya("word/document.xml"),
    dipnot: await dosya("word/footnotes.xml"),
    stiller: await dosya("word/styles.xml"),
    ustbilgi: (await Promise.all(ustAlt.filter((a) => a.includes("header")).map(dosya))).join(""),
    altbilgi: (await Promise.all(ustAlt.filter((a) => a.includes("footer")).map(dosya))).join(""),
  };
}

/** Word'de başlık paragrafının xml'i (başlık metnine göre). */
function wordBasligi(xml: string, metin: string) {
  const son = xml.indexOf(metin);
  const bas = xml.lastIndexOf("<w:p>", son);
  return xml.slice(bas, xml.indexOf("</w:p>", son));
}

const yazdirma = (secenek: Parameters<typeof renderTiptapHtml>[1] = {}) => renderTiptapHtml(tezJson as never, secenek).html;
const htmlBasligi = (html: string, metin: string) => {
  const son = html.indexOf(metin);
  return html.slice(html.lastIndexOf("<h1", son), son);
};

const kilavuz = (settings: Partial<AppliedGuideline["settings"]>) => ({ settings }) as unknown as AppliedGuideline;

test("bölüm başlığı hizası: bölümler ortada, istisnalar solda, öğrencinin hizası kazanır", async (t) => {
  await t.test("editör (süsleme)", () => {
    const doc = belge(...TEZ);
    const hizalar = buildDecorations(doc, false, DEU)
      .find()
      .map((d) => (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs["data-kilavuz-hiza"]);
    // GİRİŞ sol, Kuramsal Çerçeve orta, Yöntem (kendi hizası) da süsleme alır ama CSS'te satır içi stil kazanır, Sonuç ve Öneriler sol.
    assert.deepEqual(hizalar, ["left", "center", "center", "left"]);
    assert.equal(buildDecorations(doc, false, {}).find().length, 0, "kural yokken süsleme olmamalı");
  });

  await t.test("yazdırma", () => {
    const kapali = yazdirma();
    const acik = yazdirma({ chapterAlign: DEU.chapterAlign, chapterLeftSections: DEU.chapterLeftSections });
    assert.notEqual(acik, kapali);
    assert.match(htmlBasligi(acik, "Kuramsal Çerçeve"), /text-align:center/);
    assert.match(htmlBasligi(acik, "GİRİŞ"), /text-align:left/);
    assert.match(htmlBasligi(acik, "Sonuç ve Öneriler"), /text-align:left/);
    // Öğrencinin seçtiği hiza ezilmiyor.
    assert.match(htmlBasligi(acik, "Yöntem"), /text-align:right/);
  });

  await t.test("Word", async () => {
    const kapali = await wordXml({});
    const acik = await wordXml({ chapterAlign: DEU.chapterAlign, chapterLeftSections: DEU.chapterLeftSections });
    assert.match(wordBasligi(acik.belge, "Kuramsal Çerçeve"), /<w:jc w:val="center"\/>/);
    assert.doesNotMatch(wordBasligi(kapali.belge, "Kuramsal Çerçeve"), /<w:jc w:val="center"\/>/);
    assert.match(wordBasligi(acik.belge, "GİRİŞ"), /<w:jc w:val="left"\/>/);
    assert.match(wordBasligi(acik.belge, "Yöntem"), /<w:jc w:val="right"\/>/);
  });
});

test("numarasız ana başlıklar (Giriş, Sonuç) üç yolda numarasız", async (t) => {
  await t.test("editör", () => {
    const numaralar = buildDecorations(belge(...TEZ), true, { numarasiz: DEU.unnumberedSections })
      .find()
      .map((d) => (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs["data-heading-number"]);
    // Eskiden "1.", "2.", "3.", "4." — GİRİŞ ve "Sonuç ve Öneriler" de numaralanıyordu.
    assert.deepEqual(numaralar, ["1.", "2."]);
  });

  await t.test("yazdırma", () => {
    const html = yazdirma({ headingNumbering: true, numarasiz: DEU.unnumberedSections });
    assert.ok(!html.includes("1. GİRİŞ"), html);
    assert.ok(html.includes("1. Kuramsal Çerçeve"));
    assert.ok(html.includes("2. Yöntem"));
    assert.ok(yazdirma({ headingNumbering: true }).includes("1. GİRİŞ"), "kural yokken eski davranış");
  });

  await t.test("Word", async () => {
    const { belge: xml } = await wordXml({ unnumberedSections: DEU.unnumberedSections }, true);
    assert.doesNotMatch(wordBasligi(xml, "GİRİŞ"), /\d\. /, "GİRİŞ numaralanmamalı");
    assert.doesNotMatch(wordBasligi(xml, "Sonuç ve Öneriler"), /\d\. /, "Sonuç numaralanmamalı");
    assert.match(wordBasligi((await wordXml({}, true)).belge, "GİRİŞ"), /1\. /, "kural yokken eski davranış");
    assert.match(wordBasligi(xml, "Kuramsal Çerçeve"), /1\. /);
  });
});

test("dipnot puntosu", async (t) => {
  await t.test("yazdırma", () => {
    const sayfa = buildPrintSheet({}, kilavuz({ footnoteSizePt: 10 }), tezJson as never);
    assert.equal((sayfa.style as Record<string, string>)["--print-dipnot"], "10pt");
    assert.equal((buildPrintSheet({}, kilavuz({}), tezJson as never).style as Record<string, string>)["--print-dipnot"], undefined);
  });

  await t.test("Word", async () => {
    // Word yarım punto sayıyor: 9 pt = 18. Eskiden her zaman 20 (10 pt).
    const { dipnot } = await wordXml({ footnoteSizePt: 9 });
    assert.match(dipnot, /<w:sz w:val="18"\/>/);
    assert.match((await wordXml({})).dipnot, /<w:sz w:val="20"\/>/);
  });
});

test("paragraf aralığı", async (t) => {
  await t.test("yazdırma", () => {
    const stil = buildPrintSheet({}, kilavuz({ paragraphSpacing: { beforePt: 0, afterPt: 12 } }), tezJson as never).style as Record<string, string>;
    assert.equal(stil["--print-p-once"], "0pt");
    assert.equal(stil["--print-p-sonra"], "12pt");
  });

  await t.test("Word", async () => {
    // Varsayılan stilde: 0 nk önce, 12 nk sonra = 0 / 240 twip. Eskiden hep after=120.
    const { stiller } = await wordXml({ paragraphSpacing: { beforePt: 0, afterPt: 12 } });
    assert.match(stiller, /<w:spacing w:after="240" w:before="0"/);
    assert.match((await wordXml({})).stiller, /<w:spacing w:after="120"/);
  });
});

test("sayfa numarasının yeri", async (t) => {
  await t.test("yazdırma", () => {
    const kural = (konum?: AppliedGuideline["settings"]["pageNumberPosition"]) =>
      buildPrintSheet({ showPageNumbers: true }, kilavuz(konum ? { pageNumberPosition: konum } : {}), tezJson as never).pageRule;
    assert.match(kural(), /@bottom-center/);
    assert.match(kural("bottom-right"), /@bottom-right/);
    assert.match(kural("top-right"), /@top-right/);
  });

  await t.test("Word", async () => {
    const sagAlt = await wordXml({ pageNumberPosition: "bottom-right" });
    assert.match(sagAlt.altbilgi, /<w:jc w:val="right"\/>/);
    assert.match(sagAlt.altbilgi, /PAGE/);
    const varsayilan = await wordXml({});
    assert.match(varsayilan.altbilgi, /<w:jc w:val="center"\/>/);
    const ust = await wordXml({ pageNumberPosition: "top-right" });
    assert.match(ust.ustbilgi, /PAGE/);
    assert.doesNotMatch(ust.altbilgi, /PAGE/);
  });
});

test("alt başlık girintisi: belirtilen düzeyden itibaren, başlığın kendi girintisi kazanır", async (t) => {
  // DEÜ SBE: "birinci dereceden sonraki başlıkların tümü 1,25 cm içeriden" → H3 ve altı.
  const kural = { fromLevel: 3 as const, cm: 1.25 };
  const alt: JsonNode[] = [
    h1("Kuramsal Çerçeve"),
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Birinci Derece" }] },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "İkinci Derece" }] },
    { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Üçüncü Derece" }] },
    { type: "heading", attrs: { level: 3, firstLineIndent: 2 }, content: [{ type: "text", text: "Kendi Girintisi" }] },
  ];
  const json = { type: "doc", content: alt };

  await t.test("editör (süsleme)", () => {
    const isaretli = buildDecorations(belge(...alt), false, { altGirinti: kural })
      .find()
      .map((d) => (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs["data-kilavuz-girinti"]);
    // H3, H4 ve kendi girintili H3 (editörde satır içi stil onu ezer) işaretli; H1, H2 değil.
    assert.deepEqual(isaretli, ["true", "true", "true"]);
  });

  await t.test("yazdırma", () => {
    const html = renderTiptapHtml(json as never, { altGirinti: kural }).html;
    const baslik = (metin: string) => html.slice(html.lastIndexOf("<h", html.indexOf(metin)), html.indexOf(metin));
    assert.doesNotMatch(baslik("Birinci Derece"), /padding-left/);
    assert.match(baslik("İkinci Derece"), /padding-left:1\.25cm/);
    assert.match(baslik("Üçüncü Derece"), /padding-left:1\.25cm/);
    assert.doesNotMatch(baslik("Kendi Girintisi"), /padding-left/);
    assert.doesNotMatch(renderTiptapHtml(json as never).html, /padding-left/, "kural yokken girinti yok");
  });

  await t.test("Word", async () => {
    const doc = await buildDocxFromTiptap({ title: "T", doc: json as never, fetchImage: async () => null, textDefaults: { subheadingIndent: kural } });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const xml = (await zip.file("word/document.xml")!.async("string"));
    // 1,25 cm = 708 twip (paragraf girintisiyle aynı yuvarlama).
    assert.match(wordBasligi(xml, "İkinci Derece"), /<w:ind w:left="708"\/>/);
    assert.doesNotMatch(wordBasligi(xml, "Birinci Derece"), /<w:ind /);
    assert.doesNotMatch(wordBasligi(xml, "Kendi Girintisi"), /w:left="708"/);
  });
});

test("ön sayfalar Romen rakamıyla: Word iki bölüm, yazdırma ana metni işaretliyor", async (t) => {
  const tez = {
    type: "doc",
    content: [h1("ÖZET"), p("Özet."), h1("ABSTRACT"), p("Abstract."), h1("GİRİŞ"), p("Giriş."), h1("Yöntem"), p("Yöntem.")],
  };

  await t.test("Word", async () => {
    const xml = async (frontMatterRoman: boolean, kapak = false) => {
      const doc = await buildDocxFromTiptap({
        title: "T",
        doc: tez as never,
        fetchImage: async () => null,
        textDefaults: { frontMatterRoman },
        includeToc: true,
        ...(kapak ? { coverPage: { title: "Tez", authorName: "Ö", degreeType: "YL" } as never } : {}),
      });
      const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
      return zip.file("word/document.xml")!.async("string");
    };
    const acik = await xml(true, true);
    // Ön bölüm Romen, ana bölüm 1'den; kapak sayfası ayrı (numarasız).
    assert.match(acik, /<w:pgNumType w:start="1" w:fmt="lowerRoman"\/>/);
    assert.match(acik, /<w:pgNumType w:start="1" w:fmt="decimal"\/>/);
    assert.match(acik, /<w:titlePg\/>/);
    // Bölüm sonu GİRİŞ'ten hemen önce: ön bölümün sectPr'i ABSTRACT'tan sonra, GİRİŞ'ten önce.
    const bolumSonu = acik.indexOf("lowerRoman");
    // (İlk "GİRİŞ" içindekiler alanında; bakılan, Abstract'tan sonraki başlık.)
    assert.ok(acik.indexOf("Abstract.") < bolumSonu && bolumSonu < acik.indexOf("GİRİŞ", acik.indexOf("Abstract.")));
    // Kural yokken tek bölüm, Romen yok.
    assert.doesNotMatch(await xml(false), /lowerRoman"\/>/);
  });

  await t.test("yazdırma", () => {
    const html = renderTiptapHtml(tez as never, { onSayfaRomen: true }).html;
    assert.match(html, /<h1 class="print-ana-baslangic">GİRİŞ/);
    assert.equal((html.match(/print-ana-baslangic/g) ?? []).length, 1);
    assert.doesNotMatch(renderTiptapHtml(tez as never).html, /print-ana-baslangic/);
    // Başlıksız başlayan belge: işaret ilk düğümün önünde.
    const duz = renderTiptapHtml({ type: "doc", content: [p("Metin.")] } as never, { onSayfaRomen: true }).html;
    assert.match(duz, /^<div class="print-ana-baslangic"><\/div><p/);
  });
});
