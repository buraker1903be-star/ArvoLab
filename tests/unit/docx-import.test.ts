/*
  Word (.docx) içe aktarımı. Modülün hiç testi yoktu; oysa kendi yorumu
  "yükleyici dışarıdan verilir → test edilebilir" diyerek bunun için
  tasarlanmış.

  Önemi: kullanıcı MEVCUT tezini buraya getiriyor. Kaybolan bir dipnot ya
  da silinen bir paragraf, ürünle ilk karşılaşmasında güvenini bitirir.

  Yöntem: docx kitaplığıyla gerçek bir dosya üretilip içe aktarılıyor
  (ikisi de projede zaten var).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  Document,
  FootnoteReferenceRun,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import { convertDocxToEditorHtml, removeWordToc } from "@/lib/docx-import";

async function iceAktar(belge: Document, yukleyici: Parameters<typeof convertDocxToEditorHtml>[1] = async () => null) {
  const buffer = Buffer.from(await Packer.toBuffer(belge));
  return convertDocxToEditorHtml(buffer, yukleyici);
}

const ORNEK = new Document({
  footnotes: { 1: { children: [new Paragraph("Dipnot açıklaması.")] } },
  sections: [
    {
      children: [
        new Paragraph({ text: "Giriş", heading: HeadingLevel.HEADING_1 }),
        new Paragraph("Türkçe karakterler: ÇĞİÖŞÜ çğıöşü."),
        new Paragraph({ text: "Yöntem", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun("Dipnotlu cümle"), new FootnoteReferenceRun(1)] }),
        new Table({
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("A")] }), new TableCell({ children: [new Paragraph("B")] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph("1")] }), new TableCell({ children: [new Paragraph("2")] })] }),
          ],
        }),
      ],
    },
  ],
});

describe("Word içe aktarımı", () => {
  test("başlıklar düzeyleriyle geliyor", async () => {
    const { html, stats } = await iceAktar(ORNEK);
    assert.match(html, /<h1>Giriş<\/h1>/);
    assert.match(html, /<h2>Yöntem<\/h2>/);
    assert.equal(stats.headings, 2);
  });

  test("Türkçe karakterler bozulmuyor", async () => {
    const { html } = await iceAktar(ORNEK);
    assert.ok(html.includes("ÇĞİÖŞÜ çğıöşü"));
  });

  test("dipnot METNİYLE birlikte taşınıyor", async () => {
    // İşaret gelip metin kaybolsaydı kullanıcı dipnotu yeniden yazmak
    // zorunda kalırdı ve bunu ancak teslim ederken fark ederdi.
    const { html, stats } = await iceAktar(ORNEK);
    assert.match(html, /data-footnote-text="Dipnot açıklaması\."/);
    assert.equal(stats.footnotes, 1);
  });

  test("tablo hücreleriyle geliyor", async () => {
    const { html, stats } = await iceAktar(ORNEK);
    assert.equal(stats.tables, 1);
    for (const hucre of ["A", "B", "1", "2"]) assert.ok(html.includes(`<p>${hucre}</p>`), `Hücre kayıp: ${hucre}`);
  });
});

/*
  Word'ün ESKİ içindekiler tablosu kaldırılıyor (yenisi çıktıda üretiliyor).
  Buradaki asıl risk yanlış pozitif: gerçek metni içindekiler sanıp silmek,
  kullanıcının farkına varmayacağı bir içerik kaybıdır.
*/
describe("eski içindekiler kaldırma", () => {
  test("gerçek içindekiler kaldırılıyor", () => {
    const r = removeWordToc("<p>İÇİNDEKİLER</p><p>Giriş.................1</p><p>Yöntem...........5</p><p>Gerçek metin.</p>");
    assert.equal(r.html, "<p>Gerçek metin.</p>");
    assert.equal(r.removedLines, 2, "Sayım girdileri sayar, başlığı değil");
  });

  test("tablolar listesi de kaldırılıyor", () => {
    const r = removeWordToc("<p>TABLOLAR LİSTESİ</p><p>Tablo 1 ......... 45</p><p>Tablo 2 ......... 46</p><p>Gerçek metin.</p>");
    assert.equal(r.html, "<p>Gerçek metin.</p>");
  });

  test("başlıktan sonra GERÇEK metin varsa hiçbir şey silinmiyor", () => {
    // En kritik durum: "İÇİNDEKİLER" yazıp ardından anlatıma geçen tezler var.
    const girdi = "<p>İÇİNDEKİLER</p><p>Bu tez dört bölümden oluşmaktadır.</p><p>Devam.</p>";
    assert.deepEqual(removeWordToc(girdi), { html: girdi, removedLines: 0 });
  });

  test("gövdedeki noktalı satırlar korunuyor", () => {
    // "Ek 3 ......... 120" bir içindekiler satırına benziyor ama gövdede
    // tek başına duruyor; silinirse kullanıcı bunu fark etmez.
    const tek = "<p>Sonuç olarak şu söylenebilir.</p><p>Ek 3 ......... 120</p><p>Devamı.</p>";
    assert.equal(removeWordToc(tek).removedLines, 0);
    const cift = "<p>Giriş metni.</p><p>Tablo 1 ......... 45</p><p>Tablo 2 ......... 46</p><p>Devamı.</p>";
    assert.equal(removeWordToc(cift).removedLines, 0, "Başlıksız noktalı satırlar içindekiler sayılmamalı");
  });

  test("içindekiler yoksa belge aynen kalıyor", () => {
    const girdi = "<h1>Giriş</h1><p>Normal bir tez metni burada devam ediyor.</p>";
    assert.deepEqual(removeWordToc(girdi), { html: girdi, removedLines: 0 });
  });
});
