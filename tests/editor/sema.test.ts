import assert from "node:assert/strict";
import test from "node:test";
import { belge, baslik, editorSchema, paragraf } from "./ortam";
import { detectFormatLoss } from "@/lib/format-loss";

/*
  Şema sözleşmesi.

  Belge şeması editörün eklenti listesinden doğuyor ve uygulamanın geri
  kalanı onu VARSAYIYOR: lib/tiptap-html.ts dipnot ve şekil başlığı
  özniteliklerini okuyor, lib/manuscript-readiness.ts başlık düzeylerini
  sayıyor, lib/format-loss.ts hangi düğümlerin öznitelik taşıdığını
  biliyor, Word çıktısı tablo hücrelerini geziyor.

  Listeden bir eklenti düşerse ne derleme ne lint bunu söyler: kaydedilmiş
  belgeler o düğümü içerdiği için sessizce ayrıştırılamaz hâle gelir.
  Buradaki testler o sözleşmeyi sabitler.
*/
test("belge şeması", async (t) => {
  await t.test("uygulamanın saydığı düğümler şemada var", () => {
    for (const ad of [
      "doc", "paragraph", "heading", "text", "image", "hardBreak", "horizontalRule",
      "blockquote", "bulletList", "orderedList", "listItem", "codeBlock",
      "table", "tableRow", "tableCell", "tableHeader", "footnoteReference",
    ]) {
      assert.ok(editorSchema.nodes[ad], `${ad} düğümü kaybolmuş`);
    }
  });

  await t.test("biçim işaretleri şemada var", () => {
    // Üst simge dipnot işareti için, bağlantı kaynakça adresleri için.
    for (const ad of ["bold", "italic", "underline", "superscript", "link", "textStyle"]) {
      assert.ok(editorSchema.marks[ad], `${ad} işareti kaybolmuş`);
    }
  });

  await t.test("başlık düzeyi ve hizalama öznitelikleri duruyor", () => {
    const h = editorSchema.nodes.heading;
    assert.ok("level" in h.spec.attrs!, "başlık düzeyi olmadan numaralandırma çöker");
    assert.ok("textAlign" in h.spec.attrs!, "hizalama kılavuz kuralı");
    assert.ok("textAlign" in editorSchema.nodes.paragraph.spec.attrs!);
  });

  await t.test("paragrafın kılavuz biçim öznitelikleri duruyor", () => {
    /*
      Adlar burada SABİTLENİYOR: kılavuzun paragraf girintisi, kaynakça
      asılı girintisi, satır aralığı ve şekil/tablo başlığı bu alanlardan
      uygulanıyor. Bir adın değişmesi derlemede görünmez (şema tipsiz) ama
      kaydedilmiş bütün belgelerde o biçim sessizce düşer.
    */
    const p = editorSchema.nodes.paragraph.spec.attrs!;
    for (const ad of ["textAlign", "lineSpacing", "firstLineIndent", "hangingIndent", "caption"]) {
      assert.ok(ad in p, `paragraf özniteliği ${ad} kaybolmuş: ${JSON.stringify(Object.keys(p))}`);
    }
  });

  await t.test("dipnot düğümü metnini taşıyor", () => {
    const d = editorSchema.nodes.footnoteReference;
    assert.ok(d.isInline && d.isAtom, "dipnot satır içi ve bölünmez olmalı");
    assert.ok("text" in d.spec.attrs!, "dipnot metni özniteliktedir; kaybolursa dipnot boşalır");
    assert.ok("id" in d.spec.attrs!);
  });

  await t.test("şema dışı düğüm belgeye giremiyor", () => {
    // Kaydedilen JSON şemadan geçiyor: uydurma bir düğüm sessizce durmamalı.
    assert.throws(() => belge({ type: "uydurmaDugum" } as never), /Unknown node type|uydurmaDugum/);
  });

  await t.test("şemadan kurulan belge biçim kaybı izi taşımıyor", () => {
    /*
      format-loss "düzgün kayıtta bu düğümler her zaman attrs taşır"
      varsayımına dayanıyor. Varsayım şemadan geliyor; ikisi ayrışırsa
      denetim her belgeyi "sakat" gösterir ya da hiçbirini yakalamaz.
    */
    const doc = belge(
      baslik(1, "Giriş"),
      paragraf("Gövde metni."),
      { type: "image", attrs: { src: "https://x.edu.tr/a.png" } },
      paragraf(""),
    );
    const rapor = detectFormatLoss(doc.toJSON());
    assert.deepEqual(rapor, { affected: false, nodesWithoutAttrs: 0, missingImages: 0, emptyFootnotes: 0 });
  });
});
