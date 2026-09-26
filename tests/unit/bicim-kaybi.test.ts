import assert from "node:assert/strict";
import test from "node:test";
import { detectFormatLoss, hasNonPlainAttributes } from "@/lib/format-loss";

/*
  Geçmişte yaşanmış bir VERİ KAYBININ koruması.

  Editör içeriği sunucuya gönderilirken ProseMirror'ın prototipsiz öznitelik
  nesneleri React'in kodlayıcısında "geçici referans"a dönüşüyor ve
  kaydedilen metinden bütün öznitelikler düşüyordu: başlık düzeyi, resim
  adresi, dipnot metni, hizalama, şekil/tablo başlığı. Kullanıcı hata
  görmüyordu, belge sessizce sakatlanıyordu.

  İki işlev var ve ikisi de ARIZAYA KAPALI olmalı: kuşkulu içerikte kayıt
  yapılmamalı (hasNonPlainAttributes), kaydedilmiş belgede iz varsa
  kullanıcıya söylenmeli (detectFormatLoss). Yanlış tarafa düşen bir kural
  ya kaydı hiç yaptırmaz ya da kaybı gizler.
*/
/* DocNode dışa aktarılmıyor; örnek belgeler bilerek gevşek yazılıyor. */
const belge = (...content: unknown[]) => ({ type: "doc", content }) as never;

test("biçim kaybı izi", async (t) => {
  await t.test("düzgün belgede iz yok", () => {
    const rapor = detectFormatLoss(
      belge(
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] },
        { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "metin" }] },
        { type: "image", attrs: { src: "https://x.edu.tr/a.png" } },
        { type: "footnoteReference", attrs: { text: "Yılmaz, 2023" } },
      ),
    );
    assert.deepEqual(rapor, { affected: false, nodesWithoutAttrs: 0, missingImages: 0, emptyFootnotes: 0 });
  });

  await t.test("özniteliği düşmüş düğümler sayılıyor", () => {
    const rapor = detectFormatLoss(
      belge({ type: "heading", content: [{ type: "text", text: "Giriş" }] }, { type: "paragraph" }),
    );
    assert.equal(rapor.nodesWithoutAttrs, 2);
    assert.equal(rapor.affected, true);
  });

  await t.test("boş öznitelik nesnesi kayıp SAYILMIYOR", () => {
    // attrs: {} düzgün bir kayıt — alan var, içi boş. Kaybın izi alanın
    // HİÇ olmaması.
    const rapor = detectFormatLoss(belge({ type: "paragraph", attrs: {} }));
    assert.equal(rapor.nodesWithoutAttrs, 0);
    assert.equal(rapor.affected, false);
  });

  await t.test("adresi olmayan resim ve boş dipnot ayrı ayrı sayılıyor", () => {
    const rapor = detectFormatLoss(
      belge(
        { type: "image", attrs: { src: "" } },
        { type: "image", attrs: {} },
        { type: "footnoteReference", attrs: { text: "   " } },
      ),
    );
    assert.equal(rapor.missingImages, 2);
    assert.equal(rapor.emptyFootnotes, 1);
    assert.equal(rapor.affected, true);
  });

  await t.test("iç içe düğümler de taranıyor", () => {
    // Tablo hücresindeki resim de kullanıcının belgesinde görünmez olur.
    const rapor = detectFormatLoss(
      belge({
        type: "table",
        attrs: {},
        content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: {}, content: [{ type: "image", attrs: {} }] }] }],
      }),
    );
    assert.equal(rapor.missingImages, 1);
  });

  await t.test("boş belge iz vermiyor", () => {
    assert.equal(detectFormatLoss(null).affected, false);
    assert.equal(detectFormatLoss(belge()).affected, false);
  });
});

test("kuşkulu öznitelik kaydı engelliyor", async (t) => {
  await t.test("düz nesne öznitelikler geçiyor", () => {
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: { level: 1 } })), false);
    assert.equal(hasNonPlainAttributes(belge({ type: "paragraph" })), false, "attrs hiç yoksa kuşku yok");
    assert.equal(hasNonPlainAttributes(belge()), false);
    assert.equal(hasNonPlainAttributes({ type: "doc" }), false, "içeriksiz belge kaydedilebilir");
  });

  await t.test("prototipi olmayan nesne de düz sayılıyor", () => {
    // Object.create(null) ProseMirror'ın kendi üslubu; sorun bu DEĞİL.
    const attrs = Object.create(null) as Record<string, unknown>;
    attrs.level = 1;
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs })), false);
  });

  await t.test("kodlanamamış öznitelik kaydı engelliyor", () => {
    /*
      Geçici referansa dönüşen değer bir işlev, dizi ya da sınıf örneği
      olarak geliyor. Hiçbiri düz nesne değil ve hiçbiri kaydedilmemeli.
    */
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: () => 1 })), true);
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: [1, 2] })), true);
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: new Map() })), true);
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: "level=1" })), true);
    assert.equal(hasNonPlainAttributes(belge({ type: "heading", attrs: null })), true, "null düz nesne değil");
  });

  await t.test("işaretlerdeki (mark) öznitelik de denetleniyor", () => {
    // Bağlantı adresi ve renk mark özniteliğinde duruyor.
    assert.equal(
      hasNonPlainAttributes(belge({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "https://x.edu.tr" } }] })),
      false,
    );
    assert.equal(
      hasNonPlainAttributes(belge({ type: "text", text: "x", marks: [{ type: "link", attrs: () => 1 }] })),
      true,
    );
    assert.equal(hasNonPlainAttributes(belge({ type: "text", text: "x", marks: [null] })), true);
  });

  await t.test("iç içe düğümde kuşku yukarı taşınıyor", () => {
    assert.equal(
      hasNonPlainAttributes(
        belge({ type: "table", attrs: {}, content: [{ type: "tableCell", attrs: new Map() }] }),
      ),
      true,
    );
  });

  await t.test("belge nesne değilse kayıt engelliyor", () => {
    // Arızaya kapalı: ne geldiğini anlamadığımız içerikle üzerine yazmak,
    // kullanıcının metnini kaybetmenin en kısa yolu.
    for (const kotu of [null, undefined, "metin", 42, [1, 2], []]) {
      assert.equal(hasNonPlainAttributes(kotu), true, `${JSON.stringify(kotu)} reddedilmeli`);
    }
  });

  await t.test("düğüm nesne değilse kayıt engelliyor", () => {
    assert.equal(hasNonPlainAttributes(belge("metin")), true);
    assert.equal(hasNonPlainAttributes(belge(null)), true);
  });
});
