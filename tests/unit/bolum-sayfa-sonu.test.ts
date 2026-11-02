import assert from "node:assert/strict";
import test from "node:test";
import { chapterBreakSet } from "@/lib/chapter-rules";

/*
  "Her ana bölüm yeni sayfadan başlar" kuralı. Word ve baskı çıktısı aynı
  kümeyi kullanıyor; buradaki bir kayma doğrudan teslim edilen belgede
  görünür. En sinsi hata fazla sayfa sonu: belgenin başında ya da kapaktan
  hemen sonra BOŞ bir sayfa oluşur.
*/
const baslik = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const paragraf = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const bosParagraf = () => ({ type: "paragraph" });
/* JsonNode dışa aktarılmıyor; örnek belgeler bilerek gevşek yazılıyor. */
const belge = (...content: unknown[]) => ({ type: "doc", content }) as never;

test("ana bölüm sayfa sonları", async (t) => {
  await t.test("belgenin ilk başlığı yeni sayfadan başlamıyor", () => {
    const giris = baslik(1, "Giriş");
    const kume = chapterBreakSet(belge(giris, paragraf("metin")));
    assert.equal(kume.size, 0, "baştaki sayfa sonu boş bir sayfa üretirdi");
  });

  await t.test("baştaki boş paragraflar içerik sayılmıyor", () => {
    const giris = baslik(1, "Giriş");
    const kume = chapterBreakSet(belge(bosParagraf(), paragraf("   "), giris));
    assert.equal(kume.size, 0);
  });

  await t.test("sonraki ana bölümler yeni sayfadan başlıyor", () => {
    const giris = baslik(1, "Giriş");
    const yontem = baslik(1, "Yöntem");
    const sonuc = baslik(1, "Sonuç");
    const kume = chapterBreakSet(belge(giris, paragraf("metin"), yontem, paragraf("metin"), sonuc));
    assert.equal(kume.size, 2);
    assert.ok(!kume.has(giris as never));
    assert.ok(kume.has(yontem as never));
    assert.ok(kume.has(sonuc as never));
  });

  await t.test("başlığın kendi metni sonraki başlık için içerik sayılıyor", () => {
    // Arada paragraf olmasa bile ikinci ana bölüm yeni sayfadan başlar.
    const giris = baslik(1, "Giriş");
    const yontem = baslik(1, "Yöntem");
    const kume = chapterBreakSet(belge(giris, yontem));
    assert.deepEqual([...kume], [yontem]);
  });

  await t.test("alt başlıklar sayfa sonu almıyor", () => {
    const giris = baslik(1, "Giriş");
    const amac = baslik(2, "Amaç");
    const yontem = baslik(1, "Yöntem");
    const kume = chapterBreakSet(belge(giris, amac, paragraf("metin"), yontem));
    assert.ok(!kume.has(amac as never));
    assert.ok(kume.has(yontem as never));
  });

  await t.test("resim, tablo ve yatay çizgi içerik sayılıyor", () => {
    /*
      Kapak sayfası bir resimden oluşabiliyor. Ardından gelen ilk ana
      bölüm yeni sayfadan başlamalı, yoksa kapağın altına yazılır.
    */
    for (const tur of ["image", "table", "horizontalRule"]) {
      const giris = baslik(1, "Giriş");
      const kume = chapterBreakSet(belge({ type: tur }, giris));
      assert.equal(kume.size, 1, `${tur} içerik sayılmalı`);
      assert.ok(kume.has(giris as never));
    }
  });

  await t.test("düzeyi yazılmamış başlık birinci düzey sayılıyor", () => {
    // attrs.level yoksa varsayılan 1: eski kayıtlarda düzey eksik olabiliyor.
    const ilk = { type: "heading", content: [{ type: "text", text: "Giriş" }] };
    const ikinci = { type: "heading", content: [{ type: "text", text: "Yöntem" }] };
    const kume = chapterBreakSet(belge(ilk, ikinci));
    assert.deepEqual([...kume], [ikinci]);
  });

  await t.test("boş ve tanımsız belgede küme boş", () => {
    assert.equal(chapterBreakSet(null).size, 0);
    assert.equal(chapterBreakSet(undefined).size, 0);
    assert.equal(chapterBreakSet(belge()).size, 0);
  });
});

test("ön sayfalar ve Giriş her zaman yeni sayfadan (kural kapalıyken de)", async () => {
  const { onSayfaKirilimlari, sayfaKirilimlari } = await import("@/lib/chapter-rules");
  const h1 = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const icKapak = p("ENFLASYON BEKLENTİLERİ");
  const onay = h1("TEZ ONAY SAYFASI");
  const ozet = h1("ÖZET");
  const giris = h1("GİRİŞ");
  const yontem = h1("BİRİNCİ BÖLÜM");
  const kaynakca = h1("KAYNAKÇA");
  const doc = { content: [icKapak, onay, p("x"), ozet, p("y"), giris, p("z"), yontem, p("w"), kaynakca] };
  const kume = onSayfaKirilimlari(doc);
  // İç kapaktan sonra onay; özet; Giriş. Bölümler ve kaynakça kural kapalıyken etkilenmez.
  assert.deepEqual([onay, ozet, giris].map((d) => kume.has(d)), [true, true, true]);
  assert.deepEqual([yontem, kaynakca].map((d) => kume.has(d)), [false, false]);
  // Kural açıksa her ana bölüm.
  assert.ok(sayfaKirilimlari(doc, true).has(yontem));
  // Belgenin başındaki başlık boş sayfa açmaz; ön sayfasız belgede Giriş kırılmaz.
  assert.equal(onSayfaKirilimlari({ content: [ozet, p("y")] }).has(ozet), false);
  assert.equal(onSayfaKirilimlari({ content: [giris, p("z"), yontem] }).size, 0);
});
