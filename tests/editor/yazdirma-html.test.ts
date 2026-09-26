import assert from "node:assert/strict";
import test from "node:test";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { belge, baslik, paragraf } from "./ortam";

/*
  Tiptap JSON → yazdırma/PDF HTML'i, sunucuda.

  İki ayrı risk var. Birincisi GÜVENLİK: metin kullanıcıdan geliyor ve ham
  HTML hiç geçirilmemeli; bağlantı ve resim adresleri izin listesinden
  geçmeli. İkincisi DOĞRULUK: bu çıktı öğrencinin teslim ettiği belge —
  dipnot numaraları, başlık numaraları ve bölüm sayfa sonları burada
  doğru olmalı.

  Belgeler editörün kendi şemasından geçiriliyor, yani sınanan şey
  gerçekten kaydedilebilecek bir belge.
*/
const ciz = (doc: ReturnType<typeof belge>, secenek = {}) => renderTiptapHtml(doc.toJSON() as never, secenek);

test("yazdırma HTML'i", async (t) => {
  await t.test("metin kaçışlanıyor", () => {
    const { html } = ciz(belge(paragraf("<script>alert(1)</script> & 5 < 7")));
    assert.ok(!html.includes("<script>"), html);
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("&amp;"));
  });

  await t.test("izin verilmeyen bağlantı adresi düşüyor", () => {
    const baglanti = (href: string) =>
      ciz(belge({
        type: "paragraph",
        content: [{ type: "text", text: "bağlantı", marks: [{ type: "link", attrs: { href } }] }],
      })).html;

    assert.ok(baglanti("https://x.edu.tr/a").includes("href=\"https://x.edu.tr/a\""));
    assert.ok(baglanti("mailto:a@x.edu.tr").includes("mailto:"));
    for (const kotu of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", " javascript:alert(1)"]) {
      const html = baglanti(kotu);
      assert.ok(!html.includes("<a "), `${kotu} bağlantı olarak çizilmemeli: ${html}`);
      assert.ok(html.includes("bağlantı"), "metin yine görünmeli");
    }
  });

  await t.test("izin verilmeyen resim adresi düşüyor", () => {
    const resim = (src: string) => ciz(belge({ type: "image", attrs: { src } })).html;
    assert.ok(resim("https://x.edu.tr/a.png").includes("<img"));
    assert.ok(resim("data:image/png;base64,iVBORw0KGgo=").includes("<img"));
    for (const kotu of ["http://x.edu.tr/a.png", "javascript:alert(1)", "data:text/html,<script>"]) {
      assert.ok(!resim(kotu).includes("<img"), `${kotu} çizilmemeli`);
    }
  });

  await t.test("dipnotlar sırayla numaralanıp sonda listeleniyor", () => {
    const { html, footnotes } = ciz(belge(
      { type: "paragraph", content: [
        { type: "text", text: "Birinci" },
        { type: "footnoteReference", attrs: { id: "a", text: "İlk not" } },
      ] },
      { type: "paragraph", content: [
        { type: "text", text: "İkinci" },
        { type: "footnoteReference", attrs: { id: "b", text: "İkinci not" } },
      ] },
    ));
    assert.deepEqual(footnotes, ["İlk not", "İkinci not"]);
    // Numaralar belgedeki SIRAYA göre, kayıttaki id'ye göre değil.
    assert.ok(html.indexOf("1") < html.indexOf("2"), html);
  });

  await t.test("footnotes DÜZ METİNDİR, html ise HTML'dir", () => {
    /*
      Sözleşme: dönen `html` doğrudan dangerouslySetInnerHTML'e giriyor,
      bu yüzden içindeki her şey kaçışlanmış. `footnotes` ise ham metin —
      tüketici (app/print/manuscript/manuscript-sheet.tsx) onları React
      çocuğu olarak çiziyor ve React kendisi kaçışlıyor. Burada kaçışlamak
      HATA olurdu: kullanıcı ekranda "&lt;img&gt;" görürdü.

      Dipnot listesi bir gün innerHTML ile çizilecek olursa bu test
      kırılmaz — ama bu yorum neden kırılması gerektiğini söylüyor:
      o değişiklikle birlikte metin burada kaçışlanmalı.
    */
    const tehlikeli = "<img onerror=x>";
    const { html, footnotes } = ciz(belge({
      type: "paragraph",
      content: [
        { type: "text", text: "Gövde" },
        { type: "footnoteReference", attrs: { id: "a", text: tehlikeli } },
      ],
    }));
    assert.equal(footnotes[0], tehlikeli, "React çizecek; kaçışlamak metni bozar");
    assert.ok(!html.includes(tehlikeli), "dipnot METNİ html'e hiç girmemeli");
    assert.match(html, /<sup class="print-fn">1<\/sup>/, "gövdede yalnızca numara durur");
  });

  await t.test("başlık numarası yalnızca istenince ekleniyor", () => {
    const doc = belge(baslik(1, "Giriş"), baslik(2, "Amaç"));
    assert.ok(!ciz(doc).html.includes("1.1."), "varsayılan kapalı");
    const acik = ciz(doc, { headingNumbering: true }).html;
    assert.ok(acik.includes("1. Giriş"), acik);
    assert.ok(acik.includes("1.1. Amaç"), acik);
  });

  await t.test("bölüm sayfa sonu yalnızca istenince ve ilk başlıkta olmadan", () => {
    const doc = belge(baslik(1, "Giriş"), paragraf("metin"), baslik(1, "Yöntem"));
    const sayfaSonu = (html: string) => (html.match(/print-new-page/g) ?? []).length;

    assert.equal(sayfaSonu(ciz(doc).html), 0, "varsayılan kapalı");
    const acik = ciz(doc, { chapterNewPage: true }).html;
    assert.equal(sayfaSonu(acik), 1, "yalnızca ikinci ana bölümde: baştaki boş sayfa üretirdi");
    // İşaret GİRİŞ'te değil YÖNTEM'de olmalı.
    assert.ok(acik.indexOf("print-new-page") > acik.indexOf("Giriş"), acik);
  });

  await t.test("boş belge boş çıktı veriyor", () => {
    assert.deepEqual(renderTiptapHtml(null), { html: "", footnotes: [] });
    assert.deepEqual(renderTiptapHtml({ content: [] }), { html: "", footnotes: [] });
  });
});
