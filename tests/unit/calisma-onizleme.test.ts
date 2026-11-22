import assert from "node:assert/strict";
import test from "node:test";
import { belgeOnizlemesi, onizlemeDolu, ONIZLEME_SATIR, ONIZLEME_KARAKTER } from "@/lib/calisma-onizleme";

/*
  Çalışmalarım kartındaki belge önizlemesi: kaydedilmiş içerikten üretilir,
  editör başlatılmaz. Girdi kullanıcıdan gelen JSON olduğu için hiçbir
  biçimde fırlatmamalı; içerik yoksa BOŞ dönmeli (çağıran taraf o zaman
  kutuyu hiç çizmiyor — sahte metin ya da "yükleniyor" çizgisi yok).
*/

const belge = (...blok: unknown[]) => ({ type: "doc", content: blok });
const p = (metin: string) => ({ type: "paragraph", content: [{ type: "text", text: metin }] });
const h = (metin: string, level = 1) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: metin }] });

test("ilk başlık ayrı döner, sonraki paragraflar satır olur", () => {
  const o = belgeOnizlemesi(belge(h("Giriş"), p("Birinci paragraf."), p("İkinci paragraf.")));
  assert.equal(o.baslik, "Giriş");
  assert.deepEqual(o.satirlar, ["Birinci paragraf.", "İkinci paragraf."]);
  assert.equal(onizlemeDolu(o), true);
});

test("başlıksız belge: baslik null, paragraflar yine gelir", () => {
  const o = belgeOnizlemesi(belge(p("Yalnızca metin.")));
  assert.equal(o.baslik, null);
  assert.deepEqual(o.satirlar, ["Yalnızca metin."]);
  assert.equal(onizlemeDolu(o), true);
});

test("sonraki başlıklar satır olarak görünür (akış korunur)", () => {
  const o = belgeOnizlemesi(belge(h("Giriş"), p("Metin."), h("Yöntem", 2), p("Örneklem.")));
  assert.equal(o.baslik, "Giriş");
  assert.deepEqual(o.satirlar, ["Metin.", "Yöntem", "Örneklem."]);
});

test("BOŞ belge boş önizleme verir — kutu çizilmez", () => {
  for (const girdi of [null, undefined, "", 0, [], {}, { type: "doc" }, { type: "doc", content: [] }, belge(p("   ")), belge({ type: "paragraph" })]) {
    const o = belgeOnizlemesi(girdi);
    assert.deepEqual(o, { baslik: null, satirlar: [] }, `boş beklenen: ${JSON.stringify(girdi)}`);
    assert.equal(onizlemeDolu(o), false);
  }
});

test("bozuk ya da beklenmedik yapı fırlatmaz", () => {
  const bozuk = [
    "düz dize",
    42,
    { type: "doc", content: "dizi değil" },
    { type: "doc", content: [null, 3, { type: "paragraph", content: "dizi değil" }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: 5 }] }] },
  ];
  for (const girdi of bozuk) assert.doesNotThrow(() => belgeOnizlemesi(girdi), `fırlattı: ${JSON.stringify(girdi)}`);
  assert.equal(onizlemeDolu(belgeOnizlemesi(bozuk[0])), false);
});

test("iç içe düğümlerin metni toplanır; sonsuz derinlikte durur", () => {
  const icice = { type: "doc", content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Alıntı" }, { type: "text", text: " sürüyor" }] }] }] };
  assert.deepEqual(belgeOnizlemesi(icice).satirlar, ["Alıntı sürüyor"]);
  let derin: Record<string, unknown> = { type: "text", text: "dip" };
  for (let i = 0; i < 40; i++) derin = { type: "paragraph", content: [derin] };
  assert.doesNotThrow(() => belgeOnizlemesi({ type: "doc", content: [derin] }));
});

test("satır ve karakter sınırı: uzun belge önizlemeyi şişirmez", () => {
  const cok = belge(h("Başlık"), ...Array.from({ length: 50 }, (_, i) => p(`Paragraf ${i + 1}`)));
  assert.equal(belgeOnizlemesi(cok).satirlar.length, ONIZLEME_SATIR);
  const uzun = belgeOnizlemesi(belge(p("x".repeat(500))));
  assert.equal(uzun.satirlar[0].length, ONIZLEME_KARAKTER + 1, "kırpılmış metin + …");
  assert.ok(uzun.satirlar[0].endsWith("…"));
});

test("boşluklar tek boşluğa iner (satır sonları kutuyu bozmasın)", () => {
  assert.deepEqual(belgeOnizlemesi(belge(p("  iki   boşluk\tve\nsatır  "))).satirlar, ["iki boşluk ve satır"]);
});
