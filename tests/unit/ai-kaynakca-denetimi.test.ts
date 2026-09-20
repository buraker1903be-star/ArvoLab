import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kaynakOzeti, kaynakcaIstemi, type KaynakSatiri } from "../../lib/ai/kaynakca-denetimi";
import { bulgulariCozumle, bulgulariDogrula } from "../../lib/ai/bulgu";

const kaynaklar: KaynakSatiri[] = [
  {
    sira: 1,
    ham: "Yılmaz, A. (2019). Öğretmen motivasyonu. Eğitim Dergisi, 12(3), 45-60.",
    durum: "verified",
    eslesmeBasligi: "Öğretmen motivasyonu",
  },
  {
    sira: 2,
    ham: "Demir, B. (2021). Sınıf yönetimi [Yayımlanmamış doktora tezi]. Ankara Üniversitesi.",
    durum: "not_found",
    bicimSorunlari: ["author: baş harf sonrası nokta eksik"],
  },
];

describe("kaynak özeti", () => {
  test("durum, eşleşme ve biçim sorunu tek blokta toplanır", () => {
    const ozet = kaynakOzeti(kaynaklar);
    assert.match(ozet, /\[1\] dizinde doğrulandı · dizindeki başlık: Öğretmen motivasyonu/);
    assert.match(ozet, /\[2\] dizinde bulunamadı · biçim: author: baş harf sonrası nokta eksik/);
    assert.ok(ozet.includes("Yayımlanmamış doktora tezi"));
  });
});

describe("kaynakça istemi", () => {
  test("düzeltilmiş künye yazmak ve künye uydurmak istemde yasaklanır", () => {
    const { mesajlar } = kaynakcaIstemi({ kaynaklar });
    const sistem = mesajlar[0].metin;
    assert.match(sistem, /Düzeltilmiş kaynakça satırı YAZMA/);
    assert.match(sistem, /DOI, yıl, cilt, sayı, sayfa aralığı ya da yazar adı UYDURMA/);
    // "Bulunamadı" toptan hata sayılmamalı: kullanıcı 25 kırmızı satır görüp
    // hepsini görmezden gelmeyi öğreniyordu.
    assert.match(sistem, /tek başına hata değildir/);
  });

  test("bütçe dolunca eksik atıflar korunur, kullanılmayanlar düşer", () => {
    const { kaynak, kirpilanlar } = kaynakcaIstemi(
      {
        kaynaklar,
        eksikKaynaklar: ["(Kaya, 2020)"],
        kullanilmayanKaynaklar: Array.from({ length: 40 }, (_, i) => `Kullanılmayan kaynak ${i} ${"x".repeat(200)}`),
      },
      700,
    );
    assert.ok(kaynak.includes("(Kaya, 2020)"));
    assert.ok(kirpilanlar.includes("Kaynakçada olup metinde atıf yapılmayanlar"));
  });
});

describe("kaynakçada uydurma künye denetimi", () => {
  const { kaynak } = kaynakcaIstemi({ kaynaklar });

  test("alan adıyla konuşan bulgu geçer", () => {
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"oneri","baslik":"Olası eşleşmeyi doğrulayın","aciklama":"Cilt ve sayı bilgisini kaynağın aslından karşılaştırın."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak), { gecti: true });
  });

  test("uydurulan cilt/sayfa değeri cevabın tamamını düşürür", () => {
    // Kaynakçada en sık uydurulan şey yıl, cilt, sayı ve sayfa aralığıdır.
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"uyari","baslik":"Sayfa aralığı yanlış","aciklama":"Doğrusu 45-72 olmalı, 14(2) sayısında yayımlanmış."}]}',
    );
    const sonuc = bulgulariDogrula(bulgular, kaynak);
    assert.equal(sonuc.gecti, false);
    if (!sonuc.gecti) assert.deepEqual(sonuc.uydurulan.sort(), ["14", "72"]);
  });

  test("sayfa aralığındaki tire eksi işareti sayılmaz", () => {
    // APA kısa tire (–) tercih ediyor; girdideki "45-60" ile asistanın
    // yazdığı "45–60" aynı sayılmazsa doğru cevap uydurma sanılıp atılıyordu.
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"bilgi","baslik":"Sayfa aralığı","aciklama":"45–60 aralığı APA biçimine uygun yazılmış."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak), { gecti: true });
  });

  test("kaynakçada geçen yıl ve cilt uydurma sayılmaz", () => {
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"bilgi","baslik":"Tez kaydı","aciklama":"2021 tarihli tez dizinde yok; bu beklenen bir durumdur."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak), { gecti: true });
  });
});

describe("atıf–kaynakça uyumu", () => {
  test("mekanik denetimin ikiye böldüğü sorun eşleştirilmek üzere gönderilir", () => {
    // lib/apa7.ts yazar ve yılın TAM eşleşmesini arıyor: metinde (Demir, 2020),
    // kaynakçada Demir 2021 varsa iki ayrı alarm üretiyor. Asistanın bunları
    // eşleştirebilmesi için iki liste de aynı öncelikte gönderilir.
    const { mesajlar, kaynak, kirpilanlar } = kaynakcaIstemi(
      {
        kaynaklar,
        eksikKaynaklar: ["(Demir, 2020)"],
        kullanilmayanKaynaklar: ["Demir, B. (2021). Sınıf yönetimi."],
        atiflar: ["(Demir, 2020)", "(Yılmaz, 2019)"],
      },
      4000,
    );
    assert.match(mesajlar[0].metin, /ATIF–KAYNAKÇA UYUMU/);
    assert.match(mesajlar[0].metin, /tek bir sorundur, iki ayrı değil/);
    assert.ok(kaynak.includes("(Demir, 2020)"));
    assert.ok(kaynak.includes("Demir, B. (2021)"));
    assert.deepEqual(kirpilanlar, []);
  });

  test("hangi yılın doğru olduğunu söylemek istemde yasak", () => {
    const { mesajlar } = kaynakcaIstemi({ kaynaklar });
    assert.match(mesajlar[0].metin, /Hangisinin doğru olduğunu SÖYLEME/);
  });

  test("bütçe dolunca eşleştirme listeleri künyelerden önce korunur", () => {
    const { kaynak, kirpilanlar } = kaynakcaIstemi(
      {
        kaynaklar: Array.from({ length: 40 }, (_, i) => ({
          sira: i + 1,
          ham: `Kaynak ${i} ${"x".repeat(300)}`,
          durum: "verified" as const,
        })),
        eksikKaynaklar: ["(Demir, 2020)"],
        kullanilmayanKaynaklar: ["Demir, B. (2021). Sınıf yönetimi."],
      },
      800,
    );
    assert.ok(kaynak.includes("(Demir, 2020)"));
    assert.ok(kaynak.includes("Demir, B. (2021)"));
    assert.ok(kirpilanlar.includes("Kaynakça ve dizin sonuçları"));
  });
});
