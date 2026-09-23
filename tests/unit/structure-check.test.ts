import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkStructure } from "@/lib/structure-check";

/*
  checkStructure canlı denetimi sürüyor ve tek bir birim testi yoktu.
  Buradakiler kapsamın tamamı değil; sessizce yanlış cevap verebilecek
  yerleri sabitliyor.
*/

const metin = (text: string) => ({ type: "text", text });
const baslik = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: text ? [metin(text)] : [],
});
const paragraf = (text: string) => ({ type: "paragraph", content: [metin(text)] });

const mesajlar = (doc: Parameters<typeof checkStructure>[0]) =>
  checkStructure(doc).map((sorun) => sorun.message);

describe("yapı denetimi", () => {
  test("başlık düzeyi atlaması yakalanır", () => {
    const sonuc = mesajlar({
      content: [baslik(1, "Giriş"), paragraf("Metin."), baslik(3, "Alt Alt Başlık"), paragraf("Metin.")],
    });
    assert.ok(sonuc.some((m) => m.includes("H3") && m.includes("H2")));
  });

  test("içeriği olmayan bölüm bildirilir", () => {
    const sonuc = mesajlar({ content: [baslik(1, "Yöntem"), baslik(1, "Bulgular"), paragraf("Metin.")] });
    assert.ok(sonuc.some((m) => m.includes("Yöntem") && m.includes("boş")));
  });

  test("alt bölümü olan başlık boş sayılmaz", () => {
    const sonuc = mesajlar({
      content: [baslik(1, "Yöntem"), baslik(2, "Örneklem"), paragraf("Metin.")],
    });
    assert.ok(!sonuc.some((m) => m.includes("Yöntem") && m.includes("boş")));
  });

  /*
    ASIL MESELE: sınır sessizdi. 200 sorunu olan bir tezde öğrenci 60
    tanesini görüp "hepsi bu" sanıyordu. Denetimler sırayla çalıştığı
    için üsttekiler sınırı doldurunca alttakiler (atıf, biçim) hiç
    yazılamıyor ve "temiz" sanılıyordu.
  */
  test("sınıra takılan sorunlar sayıyla bildirilir", () => {
    const content = Array.from({ length: 70 }, () => baslik(1, ""));
    const sonuc = mesajlar({ content });

    const son = sonuc.at(-1) ?? "";
    assert.match(son, /10 sorun daha/);
    assert.match(son, /hiç yazılamamış olabilir/);
  });

  test("sınıra takılmayan listede kırpma uyarısı yoktur", () => {
    const sonuc = mesajlar({ content: [baslik(1, ""), paragraf("Metin.")] });
    assert.ok(!sonuc.some((m) => m.includes("sorun daha")));
  });

  test("boş belge sorun üretmez (ve patlamaz)", () => {
    assert.deepEqual(checkStructure(null), []);
    assert.deepEqual(checkStructure({ content: [] }), []);
  });
});
