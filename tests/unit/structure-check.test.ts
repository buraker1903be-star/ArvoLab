import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkStructure, sorunlariGrupla } from "@/lib/structure-check";
import { sorunTurleri } from "@/lib/structure-check";

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

describe("ekler", () => {
  const govde = (cumle: string) => [baslik(1, "GİRİŞ"), paragraf(cumle)];

  test("metinde anılan ve sırayla numaralanan ekler uyarı üretmez", () => {
    const doc = {
      content: [
        ...govde("Görüşme formu Ek 1'de, ölçek Ek 2'de verilmiştir."),
        baslik(1, "EK 1. Görüşme Formu"),
        paragraf("Form metni."),
        baslik(1, "EK 2. Ölçek"),
        paragraf("Ölçek metni."),
      ],
    };
    assert.deepEqual(mesajlar(doc).filter((m) => /Ek /.test(m)), []);
  });

  test("metinde anılmayan ek yakalanır", () => {
    /*
      Ekin kendi başlığı gövde metninin içinde geçiyor; onu "anılmış"
      saymak her eki anılmış gösterirdi.
    */
    const doc = {
      content: [...govde("Bulgular tabloda özetlenmiştir."), baslik(1, "EK 1. Görüşme Formu"), paragraf("Form.")],
    };
    assert.ok(mesajlar(doc).some((m) => /Ek 1.*metinde anılmıyor/.test(m)));
  });

  test("metinde olmayan eke gönderme yakalanır", () => {
    const doc = {
      content: [...govde("Ayrıntılar Ek 5'te yer almaktadır."), baslik(1, "EK 1. Görüşme Formu"), paragraf("Form.")],
    };
    assert.ok(mesajlar(doc).some((m) => /“Ek 5” geçiyor ama o numarada bir ek başlığı yok/.test(m)));
  });

  test("atlanan ek numarası yakalanır", () => {
    const doc = {
      content: [
        ...govde("Ek 1 ve Ek 3 incelenmiştir."),
        baslik(1, "EK 1. Form"),
        paragraf("a"),
        baslik(1, "EK 3. Ölçek"),
        paragraf("b"),
      ],
    };
    assert.ok(mesajlar(doc).some((m) => /Ek numaralandırmasında atlama var: 1 sonrası 3/.test(m)));
  });

  test("“EKLER” bölüm başlığı ve harfli ek numaralandırmaya sokulmaz", () => {
    // Numarasız başlığı denetime almak kusursuz bir teze uyarı basardı.
    const doc = { content: [...govde("Metin."), baslik(1, "EKLER"), baslik(2, "Ek A. Form"), paragraf("a")] };
    assert.deepEqual(mesajlar(doc).filter((m) => /ek/i.test(m) && /numara|anılmıyor/i.test(m)), []);
  });
});

describe("kısaltmalar", () => {
  test("tanımdan önce kullanılan kısaltma yapı denetiminde görünüyor", () => {
    const doc = {
      content: [
        baslik(1, "GİRİŞ"),
        paragraf("TÜİK verileri incelendi."),
        paragraf("Türkiye İstatistik Kurumu (TÜİK) raporuna göre oran arttı."),
        paragraf("TÜİK ayrıca bunu doğruluyor."),
      ],
    };
    assert.ok(mesajlar(doc).some((m) => /TÜİK.*ilk geçtiği yerde açık yazılır/.test(m)));
  });

  test("kusursuz kısaltma kullanımı uyarı üretmiyor", () => {
    const doc = {
      content: [
        baslik(1, "GİRİŞ"),
        paragraf("Türkiye İstatistik Kurumu (TÜİK) verileri incelendi."),
        paragraf("TÜİK raporuna göre oran arttı."),
      ],
    };
    assert.deepEqual(mesajlar(doc).filter((m) => /kısaltma/i.test(m)), []);
  });

  test("sorun türü denetim bloğundan gelir; pencere türe göre gruplar", () => {
    const sorunlar = checkStructure({
      content: [
        baslik(1, "Giriş"),
        baslik(1, "Yöntem"),
        paragraf("Metin (Yılmaz, 2020) burada."),
        baslik(1, "Kaynakça"),
        paragraf("Kaya, A. (2019). Kitap. Yayınevi."),
      ],
    });
    const bos = sorunlar.find((s) => s.message.includes("Giriş"));
    const atif = sorunlar.find((s) => s.message.includes("Yılmaz"));
    assert.equal(bos?.kategori, "bolum");
    assert.equal(atif?.kategori, "kaynakca");
    const gruplar = sorunlariGrupla(sorunlar);
    assert.deepEqual(gruplar.map((g) => g.tur), ["bolum", "kaynakca"]);
    assert.equal(gruplar.reduce((t, g) => t + g.sorunlar.length, 0), sorunlar.length);
  });
});

describe("İngilizce arayüz ve İngilizce yazılmış tez", () => {
  const h = (text: string, level = 1) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
  const p = (text: string, attrs: Record<string, unknown> = {}) => ({ type: "paragraph", attrs, content: [{ type: "text", text }] });

  test("mesajlar İngilizce; şekil/tablo etiketi belgedeki başlıklardan okunuyor", () => {
    const doc = {
      content: [
        h("Introduction"),
        p("As Table 1 shows, the results differ. See Figure 3."),
        p("Table 1. Participants", { caption: "table" }),
        p("Figure 1. Model", { caption: "figure" }),
        h("Empty Section"),
        h("Works Cited"),
        p("Smith, J. (2020). A title. Journal."),
      ],
    };
    const mesajlar = checkStructure(doc, {}, "en").map((s) => s.message);
    assert.ok(mesajlar.includes("The section “Empty Section” is still empty."), mesajlar.join("\n"));
    // "Figure" başlıkları tanındı: numarasız başlık uyarısı YOK, eksik numara doğru etiketle.
    assert.ok(!mesajlar.some((m) => m.includes("does not start with a number")), mesajlar.join("\n"));
    assert.ok(mesajlar.some((m) => m.startsWith("The text mentions “Figure 3”, but there is no figure caption with that number (the document has 1 figure caption)")), mesajlar.join("\n"));
    assert.ok(mesajlar.some((m) => m.startsWith("Figure 1 (“Figure 1. Model”) is not mentioned in the text")), mesajlar.join("\n"));
  });

  /*
    Başlık numarası belgede saklanmıyor (editör, baskı ve Word sırayla
    numaralıyor). 29.10.2026'ya kadar denetim numarayı başlık metninde
    arıyor, doğru kurulmuş her başlığa uyarı, her "Tablo 1'de" anışına
    "o numarada başlık yok" tehlikesi veriyordu.
  */
  test("otomatik numaralı başlıklar sıradan numara alır; elle yazılan numara çift basılacağı için uyarılır", () => {
    const dogru = {
      content: [h("Giriş"), p("Dağılım Tablo 1'de, model Şekil 1'de verilmiştir."), p("Katılımcıların dağılımı", { caption: "table" }), p("Araştırma modeli", { caption: "figure" })],
    };
    const temiz = checkStructure(dogru, { belgeDili: "tr" }).map((s) => s.message);
    assert.ok(!temiz.some((m) => /Tablo|Şekil/.test(m)), temiz.join("\n"));

    const ingilizce = {
      content: [h("Introduction"), p("See Table 1 and Table 2."), p("Participants", { caption: "table" })],
    };
    const en = checkStructure(ingilizce, { belgeDili: "en" }, "en").map((s) => s.message);
    assert.ok(en.some((m) => m.startsWith("The text mentions “Table 2”")), en.join("\n"));
    assert.ok(!en.some((m) => m.includes("“Table 1”")), en.join("\n"));

    const elle = { content: [h("Giriş"), p("Tablo 1'e bakınız."), p("Tablo 1. Dağılım", { caption: "table" })] };
    const uyarilar = checkStructure(elle, { belgeDili: "tr" }).map((s) => s.message);
    assert.ok(uyarilar.some((m) => m.includes("elle yazılmış numarayla başlıyor")), uyarilar.join("\n"));
  });

  test("'Şek. 3' ek anışı sayılmaz (Unicode sözcük sınırı)", () => {
    // \b ASCII olduğu için "Şek. 3"teki "ek" eskiden "Ek 3" anışı sayılıyordu.
    const doc = { content: [h("Giriş"), p("Şek. 3 ve Ek 1 incelendi."), h("Ek 1. Anket"), p("x")] };
    const mesajlar = checkStructure(doc, { belgeDili: "tr" }).map((s) => s.message);
    assert.ok(!mesajlar.some((m) => m.includes("Ek 3")), mesajlar.join("\n"));
  });

  test("İngilizce ek başlıkları ve 'Works Cited' kaynakça sayılıyor", () => {
    const doc = {
      content: [h("Introduction"), p("See Appendix 2."), h("Works Cited"), p("Smith, J. (2020). A title. Journal."), h("Appendix 1. Survey"), p("x")],
    };
    const mesajlar = checkStructure(doc, { citationStyle: "apa7" }, "en").map((s) => s.message);
    assert.ok(mesajlar.some((m) => m.startsWith("The text mentions “Appendix 2”")), mesajlar.join("\n"));
    assert.ok(mesajlar.some((m) => m.startsWith("The reference “Smith, J. (2020)")), mesajlar.join("\n"));
  });

  test("sorun türlerinin başlıkları İngilizce, sıra aynı", () => {
    const tr = sorunTurleri();
    const en = sorunTurleri("en");
    assert.deepEqual(en.map((t) => t.tur), tr.map((t) => t.tur));
    assert.equal(en.find((t) => t.tur === "kaynakca")?.baslik, "Citations and reference list");
    assert.equal(sorunlariGrupla([{ kategori: "dipnot" as const }], "en")[0].baslik, "Footnotes");
  });
});
