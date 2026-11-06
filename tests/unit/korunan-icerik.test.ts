import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";
import {
  KORUNAN_BLOK,
  KORUNAN_ISARET,
  KORUNAN_SATIR_ICI,
  korunanIcerigiGeriSar,
  korunanOgeSayisi,
  korunanOnizleme,
} from "@/lib/tiptap-korunan-icerik";

/*
  S1.3 — editörün tanımadığı içerik. Şemaya bağlı hazırlık
  tests/editor/korunan-icerik.test.ts'te, gerçek editör şemasıyla sınanıyor;
  burası şemasız iki şeyi sabitliyor: geri sarmanın kendisi ve kayıt
  yollarının onu GERÇEKTEN çağırdığı. Biri düşerse veritabanına editörün iç
  biçimi yazılır (çıktılar onu tanımaz) ya da açılamayan belge yine boş
  editörle kaydedilebilir hâle gelir.
*/

const ozgunBlok = { type: "eskiDugum", attrs: { a: 1 }, content: [{ type: "text", text: "özgün metin" }] };
const ozgunIsaret = { type: "eskiIsaret", attrs: { r: "x" } };
type Dugum = { type: string; text?: string; attrs?: unknown; marks?: unknown[]; content?: Dugum[] };
const sarili: Dugum = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Önce." }] },
    { type: KORUNAN_BLOK, attrs: { tur: "eskiDugum", json: JSON.stringify(ozgunBlok) } },
    {
      type: "paragraph",
      content: [
        { type: KORUNAN_SATIR_ICI, attrs: { tur: "x", json: JSON.stringify({ type: "x" }) } },
        { type: "text", text: "vurgulu", marks: [{ type: "bold" }, { type: KORUNAN_ISARET, attrs: { tur: "eskiIsaret", json: JSON.stringify(ozgunIsaret) } }] },
      ],
    },
  ],
};

describe("korunan içeriği geri sarma", () => {
  test("blok, satır içi ve işaret özgün JSON'larına döner", () => {
    const geri = korunanIcerigiGeriSar(sarili);
    assert.deepEqual(geri.content![1], ozgunBlok);
    assert.deepEqual(geri.content![2].content![0], { type: "x" });
    assert.deepEqual(geri.content![2].content![1].marks, [{ type: "bold" }, ozgunIsaret]);
    assert.equal(korunanOgeSayisi(geri), 0);
    assert.equal(korunanOgeSayisi(sarili), 3);
  });

  test("girdiyi değiştirmez; korunan öğe yoksa aynı nesneyi döndürür", () => {
    const once = JSON.stringify(sarili);
    korunanIcerigiGeriSar(sarili);
    assert.equal(JSON.stringify(sarili), once);
    const temiz = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] };
    assert.equal(korunanIcerigiGeriSar(temiz), temiz);
  });

  test("bozuk json uydurulmaz, öğe olduğu gibi kalır (sunucu reddeder)", () => {
    const bozuk = { type: "doc", content: [{ type: KORUNAN_BLOK, attrs: { tur: "?", json: "{" } }] };
    assert.equal(korunanOgeSayisi(korunanIcerigiGeriSar(bozuk)), 1);
  });

  test("önizleme özgün metinden, sınırlı", () => {
    assert.equal(korunanOnizleme(JSON.stringify(ozgunBlok)), "özgün metin");
    assert.equal(korunanOnizleme(JSON.stringify({ type: "p", content: [{ type: "text", text: "a".repeat(200) }] }), 10), `${"a".repeat(9)}…`);
    assert.equal(korunanOnizleme("{bozuk"), "");
  });
});

describe("kayıt yolları geri sarmayı ve açılış kararını kullanıyor", () => {
  const editor = readFileSync("app/dashboard/editor/[id]/write/manuscript-editor.tsx", "utf8");
  const sunucu = readFileSync("app/actions/manuscript.ts", "utf8");

  test("otomatik kayıt gövdesi geri sarılmış JSON", () => {
    assert.match(editor, /JSON\.stringify\(korunanIcerigiGeriSar\(editor\.getJSON\(\)\)\)/);
    assert.doesNotMatch(editor, /JSON\.stringify\(editor\.getJSON\(\)\)/, "geri sarmadan kayıt gövdesi üreten yol var");
  });

  test("editör hazırlanmış içerikle açılıyor; açılamayan belge boş verilir, ham hâli verilmez", () => {
    assert.match(editor, /content: acilis && acilis\.durum !== "acilamadi" \? \(acilis\.icerik as object\) : ""/);
    assert.doesNotMatch(editor, /content: initialContent \?\? ""/, "eski doğrudan açılış geri gelmiş");
  });

  test("açılamayan belgede kilit açılamıyor ve taslak önerilmiyor", () => {
    assert.match(editor, /if \(acilisDurumu === "acilamadi"\) return;/);
    assert.match(editor, /const draft = durum === "acilamadi" \? null : readDraft/);
    assert.match(editor, /icerikUyumsuz && acilisDurumu !== "acilamadi" \?/, "'Yedekle ve devam et' yalnızca açılabilen belgede");
  });

  test("taslak geri yükleme setContent'ten önce hazırlıyor", () => {
    assert.match(editor, /korunacakIcerigiHazirla\(draftOffer\.content, editor\.schema\)[\s\S]{0,600}editor\.commands\.setContent\(hazir\.icerik as object\)/);
    assert.doesNotMatch(editor, /setContent\(draftOffer\.content\)/);
  });

  test("sunucu da geri sarıyor ve sarılamayan öğe kalırsa yazmıyor", () => {
    assert.match(sunucu, /const content = gelenIcerik \? korunanIcerigiGeriSar\(gelenIcerik\) : gelenIcerik;/);
    assert.match(sunucu, /if \(content && korunanOgeSayisi\(content\) > 0\) \{/);
  });
});
