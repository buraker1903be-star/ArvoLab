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
});
