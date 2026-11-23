import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { olasiStiller } from "@/lib/atif/olasi-stil";

/*
  Her stil için GERÇEKÇE bir kaynakça ve metin. Önerinin değeri tam olarak
  burada ölçülüyor: doğru yazılmış bir kaynakça kendi stilini en üstte
  göstermeli, yanlış bir stili hiç göstermemeli. Yanlış öneri, hiç öneri
  vermemekten kötü — kullanıcıyı yanlış stile ikna eder ve denetimin
  tamamı anlamsızlaşır.
*/

const APA = [
  "Yılmaz, A. (2020). Öğrenme stilleri ve akademik başarı. Eğitim Dergisi, 12(3), 45-67.",
  "Demir, B., & Kaya, C. (2019). Motivasyonun rolü. Psikoloji Araştırmaları, 8(1), 10-25.",
  "Arslan, D. (2018). Sınıf yönetimi. Akademi Yayınları.",
];
const APA_METIN = "Öğrenme stilleri başarıyı etkiler (Yılmaz, 2020). Motivasyon da belirleyicidir (Demir & Kaya, 2019).";

const HARVARD = [
  "Yılmaz, A. (2020) 'Öğrenme stilleri ve başarı', Eğitim Dergisi, 12(3), pp. 45-67.",
  "Demir, B. and Kaya, C. (2019) 'Motivasyonun rolü', Psikoloji Araştırmaları, 8(1), pp. 10-25.",
  "Arslan, D. (2018) Sınıf yönetimi. London: Academy Press.",
];

const VANCOUVER = [
  "1. Yılmaz A, Demir B. Diyabet hastalarında yaşam kalitesi. Türk Tıp Dergisi. 2020;12(3):45-67.",
  "2. Kaya C. Hipertansiyon tedavisi. Ankara: Tıp Yayınları; 2019.",
  "3. Arslan D, Öz E. Kardiyoloji el kitabı. 2. baskı. İstanbul: Sağlık Yayınları; 2018.",
];
const VANCOUVER_METIN = "Yaşam kalitesi düşmektedir (1). Tedavi seçenekleri genişlemiştir (2,3).";

const IEEE = [
  '[1] A. Yılmaz and B. Demir, "Derin öğrenme ile görüntü sınıflandırma," IEEE Trans. Image Process., vol. 29, no. 3, pp. 45-67, 2020.',
  "[2] C. Kaya, Makine Öğrenmesi. Ankara: Teknik Yayınlar, 2019.",
  '[3] D. Arslan, "Evrişimli ağlar," in Proc. IEEE Conf., 2018, pp. 10-15.',
];
const IEEE_METIN = "Derin öğrenme yöntemleri yaygınlaşmıştır [1]. Evrişimli ağlar öne çıkar [2], [3].";

const CHICAGO = [
  'Yılmaz, Ahmet. 2020. "Osmanlı\'da Vergi Düzeni." Tarih Dergisi 12 (3): 45-67.',
  "Demir, Burak. 2019. Cumhuriyet Dönemi Eğitimi. İstanbul: Tarih Yayınları.",
  'Arslan, Deniz. 2018. "Arşiv Belgeleri." Belleten 8 (1): 10-25.',
];
const CHICAGO_METIN = "Vergi düzeni değişmiştir (Yılmaz 2020). Eğitim politikaları da dönüşmüştür (Demir 2019).";

const CHICAGO_NOTLAR = [
  "Yılmaz, Ahmet. Osmanlı'da Vergi Düzeni. İstanbul: Tarih Yayınları, 2020.",
  'Demir, Burak. "Cumhuriyet Dönemi Eğitimi." Tarih Dergisi 12, no. 3 (2019): 45-67.',
  "Arslan, Deniz. Arşiv Belgeleri ve Yöntem. Ankara: Belleten Yayınları, 2018.",
];
const CHICAGO_NOTLAR_METIN = [
  "Vergi düzeni on dokuzuncu yüzyılda değişmiştir.",
  "1 Ahmet Yılmaz, Osmanlı'da Vergi Düzeni (İstanbul: Tarih Yayınları, 2020), 45.",
  '2 Burak Demir, "Cumhuriyet Dönemi Eğitimi," Tarih Dergisi 12, no. 3 (2019): 50.',
].join("\n");

const MLA = [
  'Yılmaz, Ahmet. "Romanda Zaman." Edebiyat Dergisi, vol. 12, no. 3, 2020, pp. 45-67.',
  "Demir, Burak. Modern Türk Şiiri. Edebiyat Yayınları, 2019.",
  'Arslan, Deniz, and Elif Öz. "Metinlerarasılık." Dil ve Edebiyat, vol. 8, 2018, pp. 10-25.',
];
const MLA_METIN = "Zaman kurgusu değişir (Yılmaz 45). Şiirde biçim öne çıkar (Demir 112).";

const ilk = (kunyeler: string[], govde?: string) => {
  const sonuc = olasiStiller({ kunyeler, govde });
  assert.ok(sonuc.yeterliKanit, "kanıt yeterli sayılmalı");
  return sonuc.adaylar[0];
};

describe("olasiStiller — doğru yazılmış kaynakça kendi stilini en üstte gösterir", () => {
  test("APA 7", () => assert.equal(ilk(APA, APA_METIN).stil, "apa7"));
  test("Harvard", () => assert.equal(ilk(HARVARD).stil, "harvard"));
  test("Vancouver", () => assert.equal(ilk(VANCOUVER, VANCOUVER_METIN).stil, "vancouver"));
  test("IEEE", () => assert.equal(ilk(IEEE, IEEE_METIN).stil, "ieee"));
  test("Chicago (Yazar–Tarih)", () => assert.equal(ilk(CHICAGO, CHICAGO_METIN).stil, "chicago"));
  test("MLA 9", () => assert.equal(ilk(MLA, MLA_METIN).stil, "mla"));

  test("Chicago (Notlar–Kaynakça): dipnotlu metinle ilk iki aday dipnot aileleri", () => {
    const sonuc = olasiStiller({ kunyeler: CHICAGO_NOTLAR, govde: CHICAGO_NOTLAR_METIN });
    const ilkIki = sonuc.adaylar.slice(0, 2).map((a) => a.stil).sort();
    assert.deepEqual(ilkIki, ["chicago-notlar", "dipnot"]);
  });
});

describe("olasiStiller — yanlış stil önerilmez", () => {
  test("numaralı kaynakçada yazar–tarih stilleri aday olmaz", () => {
    for (const [kunyeler, metin] of [[VANCOUVER, VANCOUVER_METIN], [IEEE, IEEE_METIN]] as const) {
      const adaylar = olasiStiller({ kunyeler, govde: metin }).adaylar.map((a) => a.stil);
      for (const yanlis of ["apa7", "harvard", "chicago", "mla"]) {
        assert.ok(!adaylar.includes(yanlis as never), `${yanlis} önerilmemeli: ${adaylar.join(", ")}`);
      }
    }
  });

  test("APA kaynakçasında numara stilleri aday olmaz", () => {
    const adaylar = olasiStiller({ kunyeler: APA, govde: APA_METIN }).adaylar.map((a) => a.stil);
    assert.ok(!adaylar.includes("ieee"));
    assert.ok(!adaylar.includes("vancouver"));
  });

  /*
    Harvard ile APA künyesi birbirine çok yakın: ayıran işaret yıldan
    sonraki noktalama. Biri seçilirken ötekinin de aday kalması değil,
    YANLIŞININ ilk sırada çıkması hata olurdu.
  */
  test("Harvard kaynakçası APA'yı ilk sıraya koymaz", () => {
    const adaylar = olasiStiller({ kunyeler: HARVARD }).adaylar;
    assert.equal(adaylar[0].stil, "harvard");
  });
});

describe("olasiStiller — kanıt yoksa öneri verilmez", () => {
  test("üç künyeden az", () => {
    const sonuc = olasiStiller({ kunyeler: APA.slice(0, 2), govde: APA_METIN });
    assert.equal(sonuc.yeterliKanit, false);
    assert.deepEqual(sonuc.adaylar, []);
    assert.equal(sonuc.incelenenKunye, 2);
  });

  test("biçim işareti taşımayan metin yığını", () => {
    const sonuc = olasiStiller({
      kunyeler: [
        "bu satır bir künye değil yalnızca uzun bir cümledir ve hiçbir biçim işareti taşımaz",
        "ikinci satır da aynı şekilde yalnızca düz bir metin parçasıdır burada da işaret yok",
        "üçüncü satır da öyle hiçbir yıl parantez numara ya da tırnak barındırmıyor hiçbiri",
      ],
    });
    assert.equal(sonuc.yeterliKanit, false);
    assert.deepEqual(sonuc.adaylar, []);
  });

  test("tek bir künyedeki işaret stil kuralı sayılmaz", () => {
    const sonuc = olasiStiller({
      kunyeler: [
        "[1] A. Yılmaz, Bir Kitap. Ankara: Yayınevi, 2020.",
        "ikinci satır düz metin olarak yazılmış ve hiçbir biçim işareti taşımıyor burada",
        "üçüncü satır da düz metin olarak yazılmış ve hiçbir biçim işareti taşımıyor hiç",
      ],
    });
    assert.ok(!sonuc.adaylar.some((a) => a.stil === "ieee"), "tek künyeden IEEE çıkarılmamalı");
  });
});

describe("olasiStiller — gerekçe ve sıra", () => {
  test("her adayın en az bir gerekçesi var ve sayı taşıyor", () => {
    for (const a of olasiStiller({ kunyeler: IEEE, govde: IEEE_METIN }).adaylar) {
      assert.ok(a.gerekce.length >= 1);
      for (const g of a.gerekce) {
        assert.ok(g.tr.length > 10 && g.en.length > 10);
        assert.match(`${g.tr} ${g.en}`, /\d/, "gerekçe kaç yerde görüldüğünü yazmalı");
      }
    }
  });

  test("aynı girdi aynı sırayı verir", () => {
    const bir = olasiStiller({ kunyeler: CHICAGO_NOTLAR, govde: CHICAGO_NOTLAR_METIN }).adaylar.map((a) => a.stil);
    const iki = olasiStiller({ kunyeler: CHICAGO_NOTLAR, govde: CHICAGO_NOTLAR_METIN }).adaylar.map((a) => a.stil);
    assert.deepEqual(bir, iki);
  });
});
