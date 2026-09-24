/*
  Word çıktısı — gidiş-dönüş testi.

  Bu modül 552 satır ve hiç testi yoktu; oysa ürettiği dosya öğrencinin
  ÜNİVERSİTEYE TESLİM ETTİĞİ şey. Editörde doğru görünüp Word'de kaybolan
  bir dipnot ya da karışan bir başlık sırası, kullanıcının ancak teslimden
  sonra fark edeceği bir hatadır.

  Yöntem: Tiptap belgesi → docx → mammoth ile geri okuma. Üretilen dosya
  gerçekten açılabiliyor mu ve içerik yerinde mi, tek seferde sınanıyor.
  (mammoth projede zaten var: Word içe aktarımı onu kullanıyor.)
*/
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Packer } from "docx";
import mammoth from "mammoth";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import type { TiptapDoc } from "@/lib/tiptap-text";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });

const BELGE = {
  type: "doc",
  content: [
    h(1, "Giriş"),
    p("Bu çalışmanın amacı Türkçe karakterleri sınamaktır: ÇĞİÖŞÜ çğıöşü."),
    h(2, "Alt başlık"),
    p("İkinci paragraf."),
    { type: "bulletList", content: [
      { type: "listItem", content: [p("Birinci madde")] },
      { type: "listItem", content: [p("İkinci madde")] },
    ] },
    h(1, "Yöntem"),
    p("Yöntem bölümünün metni."),
  ],
} as unknown as TiptapDoc;

const hicResimYok = async () => null;

async function metneCevir(doc: TiptapDoc, secenek: Record<string, unknown> = {}) {
  const belge = await buildDocxFromTiptap({
    title: "Sınama Tezi",
    doc,
    fetchImage: hicResimYok,
    ...secenek,
  });
  const buffer = Buffer.from(await Packer.toBuffer(belge));
  const { value } = await mammoth.extractRawText({ buffer });
  return { metin: value, buffer };
}

/*
  Dipnot metni belgenin gövdesinde DEĞİL, footnotes.xml'de durur; ham metin
  çıkarımı oraya bakmaz. HTML'e çevirince dipnotlar da geliyor.
*/
async function htmlCevir(doc: TiptapDoc) {
  const belge = await buildDocxFromTiptap({ title: "Sınama Tezi", doc, fetchImage: hicResimYok });
  const buffer = Buffer.from(await Packer.toBuffer(belge));
  return (await mammoth.convertToHtml({ buffer })).value;
}

let ciktı: Awaited<ReturnType<typeof metneCevir>>;
before(async () => {
  ciktı = await metneCevir(BELGE);
});

describe("Word çıktısı", () => {
  test("üretilen dosya geçerli bir docx (Word'ün açabildiği zip)", () => {
    // "PK" zip imzası: bozuk dosya öğrencinin teslim gününde anlaşılırdı.
    assert.equal(ciktı.buffer.subarray(0, 2).toString("latin1"), "PK");
    assert.ok(ciktı.buffer.length > 1000, "Dosya şüpheli derecede küçük");
  });

  test("bütün başlıklar ve paragraflar çıktıda var", () => {
    for (const parca of ["Giriş", "Alt başlık", "İkinci paragraf.", "Yöntem", "Yöntem bölümünün metni."]) {
      assert.ok(ciktı.metin.includes(parca), `Kayıp: ${parca}`);
    }
  });

  test("Türkçe karakterler bozulmadan taşınıyor", () => {
    assert.ok(ciktı.metin.includes("ÇĞİÖŞÜ çğıöşü"), "Türkçe karakterler bozuldu");
  });

  test("sıra korunuyor", () => {
    // Başlık sırası karışırsa tezin bölüm düzeni bozulur; metinde görünür
    // olmaları yetmez, DOĞRU sırada olmaları gerekir.
    const giris = ciktı.metin.indexOf("Giriş");
    const alt = ciktı.metin.indexOf("Alt başlık");
    const yontem = ciktı.metin.indexOf("Yöntem bölümünün metni.");
    assert.ok(giris < alt && alt < yontem, `Sıra bozuk: ${giris}, ${alt}, ${yontem}`);
  });

  test("liste maddeleri kaybolmuyor", () => {
    assert.ok(ciktı.metin.includes("Birinci madde"));
    assert.ok(ciktı.metin.includes("İkinci madde"));
  });

  const KAPAK = {
    university: "İstanbul Bilgi Üniversitesi",
    institute: "Sosyal Bilimler Enstitüsü",
    department: "İşletme",
    program: "İşletme Yüksek Lisans",
    degreeType: "Yüksek Lisans Tezi",
    title: "Nitel bir inceleme",
    authorName: "Ayşe Yılmaz",
    advisorName: "Prof. Dr. Ahmet Demir",
    city: "İstanbul",
    year: "2026",
  };

  test("kapak sayfası metne giriyor ve gövdeyi düşürmüyor", async () => {
    const { metin } = await metneCevir(BELGE, { coverPage: KAPAK });
    for (const parca of ["SOSYAL BİLİMLER ENSTİTÜSÜ", "Ayşe Yılmaz", "Danışman: Prof. Dr. Ahmet Demir", "İstanbul, 2026"]) {
      assert.ok(metin.includes(parca), `Kapakta kayıp: ${parca}`);
    }
    assert.ok(metin.includes("Yöntem bölümünün metni."), "Kapak eklenince gövde kayboldu");
  });

  /*
    Kapaktaki adlar TÜRKÇE kurallarıyla büyütülmeli. Düz toUpperCase() ile
    "i" → "I" olur ve kapakta "ISTANBUL BILGI UNIVERSITESI" yazardı; bir tez
    kapağında bu, danışmanın geri çevireceği bir hatadır.
  */
  test("kapak büyük harfe Türkçe kurallarıyla çevriliyor", async () => {
    const { metin } = await metneCevir(BELGE, { coverPage: KAPAK });
    assert.ok(metin.includes("İSTANBUL BİLGİ ÜNİVERSİTESİ"), "Üniversite adı yanlış büyütüldü");
    assert.ok(metin.includes("NİTEL BİR İNCELEME"), "Tez başlığı yanlış büyütüldü");
    assert.equal(metin.includes("ISTANBUL BILGI"), false, "i harfi noktasız I olmuş");
  });

  test("başlık numaralandırması açıkken metin kaybolmuyor", async () => {
    const { metin } = await metneCevir(BELGE, { headingNumbering: true });
    assert.ok(metin.includes("Giriş"));
    assert.ok(metin.includes("Yöntem"));
  });

  test("boş belge çökmüyor", async () => {
    const { buffer } = await metneCevir({ type: "doc", content: [] } as unknown as TiptapDoc);
    assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
  });

  test("dipnot metni çıktıya giriyor", async () => {
    // Dipnotu yutmak en sinsi kayıp: editörde görünür, Word'de yok ve
    // öğrenci bunu ancak teslimden sonra fark eder.
    const html = await htmlCevir({
      type: "doc",
      content: [
        { type: "paragraph", content: [
          { type: "text", text: "Dipnotlu cümle" },
          { type: "footnoteReference", attrs: { text: "Kaynağın açıklaması." } },
        ] },
      ],
    } as unknown as TiptapDoc);
    assert.ok(html.includes("Kaynağın açıklaması."), "Dipnot metni çıktıda yok");
  });

  test("şekil ve tablo başlıkları etiketleriyle çıkıyor", async () => {
    const { metin } = await metneCevir({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { caption: "table" }, content: [{ type: "text", text: "Katılımcıların dağılımı" }] },
        { type: "paragraph", attrs: { caption: "figure" }, content: [{ type: "text", text: "Model şeması" }] },
      ],
    } as unknown as TiptapDoc);
    // Numara Word'ün SEQ alanı: dosya açılınca Word dolduruyor, ham metinde boş.
    assert.match(metin, /Tablo\s*\.\s*Katılımcıların dağılımı/);
    assert.match(metin, /Şekil\s*\.\s*Model şeması/);
  });

  test("tablo hücreleri ve blok alıntı kaybolmuyor", async () => {
    const hucre = (t: string) => ({ type: "tableCell", content: [p(t)] });
    const { metin } = await metneCevir({
      type: "doc",
      content: [
        { type: "table", content: [
          { type: "tableRow", content: [{ type: "tableHeader", content: [p("Başlık A")] }, { type: "tableHeader", content: [p("Başlık B")] }] },
          { type: "tableRow", content: [hucre("Hücre 1"), hucre("Hücre 2")] },
        ] },
        { type: "blockquote", content: [p("Blok alıntı metni.")] },
      ],
    } as unknown as TiptapDoc);
    for (const parca of ["Başlık A", "Başlık B", "Hücre 1", "Hücre 2", "Blok alıntı metni."]) {
      assert.ok(metin.includes(parca), `Kayıp: ${parca}`);
    }
  });
});
