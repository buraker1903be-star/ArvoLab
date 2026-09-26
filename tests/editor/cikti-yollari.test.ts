import assert from "node:assert/strict";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { editorSchema, type JsonNode } from "./ortam";

/*
  ÜÇ ÇIKTI YOLUNUN KARŞILAŞTIRMASI.

  Aynı belge üç ayrı yerde çiziliyor ve her biri öznitelikleri KENDİ BAŞINA
  yorumluyor:
    editör   lib/tiptap-paragraph-formatting.ts + lib/tiptap-caption.ts
    yazdırma lib/tiptap-html.ts   (yazdırma/PDF sayfası VE danışman paylaşımı)
    Word     lib/tiptap-docx.ts

  26.09.2026'da bu üçlünün biri ayrıştı: kaynakçanın asılı girintisi
  editörde ve Word'de vardı, yazdırma çıktısında HİÇ yoktu. Öğrenci
  kaynakçayı editörde girintili görüyor, yazdırdığında düz görüyordu. Ne
  derleme ne lint ne de tek yola bakan bir test bunu söyler — üç çıktı
  birbirine karşı sınanmadıkça bir sonraki biçim kuralı da aynı şekilde
  sessizce düşer.

  Yöntem: her biçim özniteliği için belge İKİ kez çiziliyor (öznitelik var /
  yok) ve üç yolun da çıktısının DEĞİŞMESİ isteniyor. Değişmeyen yol o
  özniteliği yok sayıyor demektir. Ardından ne biçimde taşındığı da
  sınanıyor, yoksa "yanlış sebepten değişmiş" bir çıktı yeşil geçerdi.

  Kapsam dışı: başlık numaralandırma ve bölüm sayfa sonu editörde DOM
  süslemesi (decoration) olarak gösteriliyor, yani belgenin kendisine
  yazılmıyor ve toDOM ile görünmüyor. O ikisi aşağıda yalnızca yazdırma ile
  Word arasında karşılaştırılıyor — hata sınıfı orada da aynı.
*/

const KUNYE = "Yılmaz, A. (2023). Kitap. Yayınevi.";

const belgeJson = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "paragraph", attrs, content: [{ type: "text", text: KUNYE }] }] as JsonNode[],
});

/** Editörün paragrafa yazacağı HTML öznitelikleri (toDOM veri döndürür, DOM değil). */
function editorCizimi(json: ReturnType<typeof belgeJson>): string {
  const paragraf = editorSchema.nodeFromJSON(json).firstChild!;
  const spec = editorSchema.nodes.paragraph.spec.toDOM!(paragraf) as unknown as [string, Record<string, string>];
  return JSON.stringify(spec[1] ?? {});
}

const yazdirma = (json: ReturnType<typeof belgeJson>, secenek = {}) => renderTiptapHtml(json as never, secenek).html;

/** Word çıktısındaki İLK paragrafın xml'i (sectPr gürültüsü olmadan). */
async function wordParagrafi(
  json: ReturnType<typeof belgeJson>,
  secenek: { textDefaults?: Record<string, unknown>; headingNumbering?: boolean } = {},
): Promise<string> {
  const doc = await buildDocxFromTiptap({
    title: "Test",
    doc: json as never,
    fetchImage: async () => null,
    ...secenek,
  } as never);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml = await zip.file("word/document.xml")!.async("string");
  const bas = xml.indexOf("<w:p>", xml.indexOf("<w:body>"));
  return xml.slice(bas, xml.indexOf("</w:p>", bas) + "</w:p>".length);
}

const OZNITELIKLER: { ad: string; attrs: Record<string, unknown>; editor: RegExp; yazdirma: RegExp; word: RegExp }[] = [
  {
    ad: "textAlign",
    attrs: { textAlign: "center" },
    editor: /text-align:\s*center/,
    yazdirma: /text-align:center/,
    word: /<w:jc w:val="center"\/>/,
  },
  {
    ad: "lineSpacing",
    attrs: { lineSpacing: "2" },
    editor: /line-height:\s*2/,
    yazdirma: /line-height:2/,
    // 2 satır aralığı = 480 twip (240 = tek satır).
    word: /<w:spacing w:line="480"/,
  },
  {
    ad: "firstLineIndent",
    attrs: { firstLineIndent: 1.25 },
    editor: /text-indent:\s*1\.25cm/,
    yazdirma: /text-indent:1\.25cm/,
    word: /w:firstLine="708"/,
  },
  {
    ad: "hangingIndent",
    attrs: { hangingIndent: 1.25 },
    // Negatif ilk satır + eşit padding; Word'de "hanging".
    editor: /text-indent:\s*-1\.25cm/,
    yazdirma: /text-indent:-1\.25cm/,
    word: /w:hanging="708"/,
  },
  {
    ad: "caption",
    attrs: { caption: "figure" },
    editor: /"data-caption":"figure"/,
    yazdirma: /print-caption/,
    word: /SEQ Şekil/,
  },
];

test("üç çıktı yolu aynı biçim kurallarını taşıyor", async (t) => {
  const temiz = belgeJson({});
  const temizEditor = editorCizimi(temiz);
  const temizYazdirma = yazdirma(temiz);
  const temizWord = await wordParagrafi(temiz);

  for (const olcu of OZNITELIKLER) {
    await t.test(olcu.ad, async () => {
      const json = belgeJson(olcu.attrs);
      const cikti = {
        editör: editorCizimi(json),
        yazdırma: yazdirma(json),
        Word: await wordParagrafi(json),
      };
      const temizCikti = { editör: temizEditor, yazdırma: temizYazdirma, Word: temizWord };

      // 1) Üç yolun da çıktısı DEĞİŞMELİ: değişmeyen yol özniteliği yok sayıyor.
      for (const yol of ["editör", "yazdırma", "Word"] as const) {
        assert.notEqual(
          cikti[yol],
          temizCikti[yol],
          `${olcu.ad}: "${yol}" çıktısı değişmedi — bu yol özniteliği yok sayıyor`,
        );
      }

      // 2) Doğru sebepten değişmeli: her yolda beklenen biçim aranıyor.
      assert.match(cikti.editör, olcu.editor, `${olcu.ad}: editör çizimi`);
      assert.match(cikti.yazdırma, olcu.yazdirma, `${olcu.ad}: yazdırma çıktısı`);
      assert.match(cikti.Word, olcu.word, `${olcu.ad}: Word çıktısı`);
    });
  }

  await t.test("metin üç yolda da yerinde duruyor", async () => {
    // Bir yol özniteliği uygularken metni düşürmemeli.
    const json = belgeJson({ hangingIndent: 1.25, textAlign: "left" });
    assert.ok(yazdirma(json).includes(KUNYE));
    assert.ok((await wordParagrafi(json)).includes("Yılmaz"));
  });
});

test("belge düzeyi seçenekler yazdırma ile Word arasında tutuyor", async (t) => {
  /*
    Bu iki seçenek editörde süsleme olarak gösteriliyor (belgeye yazılmıyor),
    o yüzden yalnızca iki çıktı yolu karşılaştırılıyor. Hata sınıfı aynı:
    biri uygular, öbürü unutur.
  */
  const iki = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] },
      { type: "paragraph", content: [{ type: "text", text: "Gövde." }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Yöntem" }] },
    ] as JsonNode[],
  };

  await t.test("başlık numaralandırma iki yolda da uygulanıyor", async () => {
    assert.ok(!yazdirma(iki).includes("1. Giriş"), "kapalıyken yazılmamalı");
    assert.ok(yazdirma(iki, { headingNumbering: true }).includes("1. Giriş"), "yazdırma");

    const kapali = await wordParagrafi(iki);
    const acik = await wordParagrafi(iki, { headingNumbering: true });
    assert.notEqual(acik, kapali, "Word: numaralandırma çıktıyı değiştirmeli");
    assert.ok(acik.includes("1."), acik);
  });

  await t.test("bölüm sayfa sonu iki yolda da uygulanıyor", async () => {
    assert.ok(!yazdirma(iki).includes("print-new-page"), "kapalıyken yazılmamalı");
    assert.ok(yazdirma(iki, { chapterNewPage: true }).includes("print-new-page"), "yazdırma");

    /*
      Word'de sayfa sonu İKİNCİ ana bölüme düşüyor, yani ilk paragrafı
      karşılaştırmak yetmez; belgenin tamamına bakılıyor.
      (Baştaki sayfa sonu boş bir sayfa üretirdi — lib/chapter-rules.ts.)
      chapterNewPage Word tarafında textDefaults içinden geçiyor.
    */
    const tamXml = async (chapterNewPage: boolean) => {
      const doc = await buildDocxFromTiptap({
        title: "Test",
        doc: iki as never,
        fetchImage: async () => null,
        textDefaults: { chapterNewPage },
      } as never);
      const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
      return zip.file("word/document.xml")!.async("string");
    };
    const kapali = await tamXml(false);
    const acik = await tamXml(true);
    assert.notEqual(acik, kapali, "Word: sayfa sonu çıktıyı değiştirmeli");
    assert.ok(/w:pageBreakBefore|w:br w:type="page"/.test(acik), "Word'de sayfa sonu işareti yok");
  });
});
