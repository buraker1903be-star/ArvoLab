import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { anlamlilik, detectStatistics } from "../../lib/stats-interpreter";

const tek = (metin: string) => {
  const sonuc = detectStatistics(metin);
  assert.equal(sonuc.length, 1, `tek sonuç bekleniyordu, ${sonuc.length} geldi: ${JSON.stringify(sonuc)}`);
  return sonuc[0];
};

describe("p değerinin yazılışı korunuyor", () => {
  /*
    EN AĞIR HATA. "p < .05" girdisi "p = .050 (istatistiksel olarak anlamlı
    değil)" olarak çıkıyordu: karşılaştırma işareti atılıp sayı eşitlik
    sanılıyor, öğrencinin ANLAMLI bulgusu anlamsıza çevriliyordu. Türkçe
    tezlerde anlamlılığın en yaygın yazımı budur.
  */
  test("p < .05 anlamlıdır ve aynen yazılır", () => {
    const s = tek("t(28) = 2.45, p < .05");
    assert.equal(s.significant, true);
    assert.equal(s.apaSentenceFragment, "t(28) = 2.45, p < .05");
  });

  test("p = .021 anlamlı", () => {
    assert.equal(tek("t(28) = 2.45, p = .021").apaSentenceFragment, "t(28) = 2.45, p = .021");
  });

  test("p = .21 anlamlı değil ve bu yazılıyor", () => {
    const s = tek("t(28) = 1.10, p = .21");
    assert.equal(s.significant, false);
    assert.match(s.apaSentenceFragment, /anlamlı değil/);
  });

  /*
    "p < .10" anlamlılığı ne kanıtlar ne çürütür: gerçek değer .08 de
    olabilir .03 de. "Anlamlı değil" demek, olmayan bir bilgiyi uydurmaktır.
  */
  test("p < .10 belirsizdir; anlamsız sayılmaz", () => {
    const s = tek("t(28) = 1.80, p < .10");
    assert.equal(s.significant, null);
    assert.match(s.apaSentenceFragment, /belirlenemiyor/);
    assert.match(s.apaSentenceFragment, /p < \.1/);
  });

  test("çok küçük p değeri APA eşiğiyle yazılıyor", () => {
    assert.match(tek("t(28) = 6.20, p = .0001").apaSentenceFragment, /p < \.001$/);
  });

  test("ondalık virgül kabul ediliyor", () => {
    assert.equal(tek("t(28) = 2,45, p = 0,021").apaSentenceFragment, "t(28) = 2.45, p = .021");
  });
});

describe("tanınan yazımlar", () => {
  /* Modülün kendi yorumunda destekleniyor yazan ama hiç tanınmayan biçim. */
  test("t = değer, df = ... biçimi de tanınıyor", () => {
    assert.equal(tek("t = 2.45, df = 28, p = .021").apaSentenceFragment, "t(28) = 2.45, p = .021");
  });

  test("ANOVA", () => {
    assert.equal(tek("F(2, 57) = 4.31, p = .018").apaSentenceFragment, "F(2, 57) = 4.31, p = .018");
  });

  test("ki-kare N ile birlikte", () => {
    assert.equal(
      tek("χ²(1, N = 120) = 6.14, p = .013").apaSentenceFragment,
      "χ²(1, N = 120) = 6.14, p = .013",
    );
  });

  test("Welch t testinin ondalık serbestlik derecesi korunuyor", () => {
    assert.match(tek("t(27.4) = 2.45, p = .021").apaSentenceFragment, /^t\(27\.4\)/);
  });

  test("negatif t değeri", () => {
    assert.match(tek("t(28) = -2.45, p = .021").apaSentenceFragment, /t\(28\) = -2\.45/);
  });
});

describe("uydurma istatistik üretilmiyor", () => {
  /*
    Harf sınırı yoktu: Türkçede "r" ile biten her sözcük ("değer",
    "faktör") korelasyon sanılıyor ve GİRDİDE OLMAYAN bir istatistik
    üretiliyordu. AGENTS.md: üretilen her sayı girdide geçmek zorunda.
  */
  test("sözcük sonundaki r korelasyon sayılmıyor", () => {
    assert.deepEqual(detectStatistics("Ortalama değer = .42, p = .003"), []);
    assert.deepEqual(detectStatistics("Bu faktör = .55, p = .01 olarak bulundu"), []);
  });

  test("gerçek korelasyon tanınıyor", () => {
    assert.equal(tek("r(48) = .42, p = .003").apaSentenceFragment, "r(48) = .42, p = .003");
  });

  /* APA: ±1 ile sınırlı değerlerde baştaki sıfır yazılmaz ("r = .42"). */
  test("korelasyon baştaki sıfır olmadan yazılıyor", () => {
    assert.match(tek("r = .42, p = .003").apaSentenceFragment, /^r = \.42,/);
  });

  test("negatif korelasyonda da sıfır yazılmıyor", () => {
    assert.match(tek("r = -.42, p = .003").apaSentenceFragment, /^r = -\.42,/);
  });

  test("tanınabilir ifade yoksa boş liste", () => {
    assert.deepEqual(detectStatistics("Katılımcıların çoğu olumlu görüş bildirdi."), []);
  });
});

describe("sıra", () => {
  /* Eskiden türe göre kümeleniyordu; kullanıcı yapıştırdığı sırayı bulamıyordu. */
  test("sonuçlar metindeki sıraya göre", () => {
    const sonuc = detectStatistics(
      "t(28) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nt(30) = 1.10, p = .28",
    );
    assert.deepEqual(sonuc.map((s) => s.type), ["t-test", "anova", "t-test"]);
  });
});

describe("anlamlılık kuralı", () => {
  test("eşitlikte eşik kesin", () => {
    assert.equal(anlamlilik({ islec: "=", deger: 0.049 }), true);
    assert.equal(anlamlilik({ islec: "=", deger: 0.05 }), false);
  });

  test("üst sınırda eşiğe kadar anlamlı, ötesi belirsiz", () => {
    assert.equal(anlamlilik({ islec: "<", deger: 0.05 }), true);
    assert.equal(anlamlilik({ islec: "<", deger: 0.001 }), true);
    assert.equal(anlamlilik({ islec: "<", deger: 0.06 }), null);
  });

  /*
    Üst sınırda YAZILAN rakamlar korunur. Eskiden p sayıya çevrilip geri
    yazılıyordu ve sondaki sıfır yutuluyordu:

        yazılan "p < .10"   →  çıkan "p < .1"
        yazılan "p < .050"  →  çıkan "p < .05"

    APA'da p en az iki ondalıkla yazılır; ve modülün kendi kuralı zaten
    "yazılan p ifadesi korunur". Öğrencinin yazdığını yeniden yazmak, bu
    dosyanın düzelttiği hatanın küçük kardeşiydi.
  */
  test("üst sınırda sondaki sıfır korunur", () => {
    assert.match(detectStatistics("F(2, 57) = 3.10, p < .10")[0].apaSentenceFragment, /p < \.10\b/);
    assert.match(detectStatistics("t(28) = 2.45, p < .050")[0].apaSentenceFragment, /p < \.050$/);
  });

  test("baştaki sıfır yine APA'ya göre atılır", () => {
    // Yazılanı korumak, APA düzeltmesinden vazgeçmek demek değil.
    assert.match(detectStatistics("t(28) = 2.45, p < 0.05")[0].apaSentenceFragment, /p < \.05$/);
  });

  test("Türkçe ondalık virgülü üst sınırda da okunur", () => {
    assert.match(detectStatistics("t(28) = 2.45, p < 0,05")[0].apaSentenceFragment, /p < \.05$/);
  });
});

/*
  SAYININ YAZILIŞI KILAVUZDAN GELİR (25.10.2026).

  Baştaki sıfır ve ondalık ayırıcı koda sabitlenmişti; ikisi de APA
  kuralıydı. Bu kurallar üniversiteden üniversiteye değişiyor —
  kılavuzu "0,021" diyen öğrenci araçtan ".021" alıyor ve araç bunu
  doğru biçim diye sunuyordu.
*/
describe("biçim kılavuzdan geliyor", () => {
  const turkKilavuzu = { ayirici: "comma" as const, bastakiSifir: true };
  const apa = { ayirici: "period" as const, bastakiSifir: false };

  test("Türkçe kılavuz: virgül ve baştaki sıfır", () => {
    const [bulgu] = detectStatistics("t(28) = 2.45, p = 0.021", turkKilavuzu);
    assert.equal(bulgu.apaSentenceFragment, "t(28) = 2,45, p = 0,021");
  });

  test("aynı girdi APA biçiminde", () => {
    const [bulgu] = detectStatistics("t(28) = 2.45, p = 0.021", apa);
    assert.equal(bulgu.apaSentenceFragment, "t(28) = 2.45, p = .021");
  });

  test("BİÇİM VERİLMEZSE eski davranış korunur", () => {
    /* Varsayılan APA geleneği: bu değişiklik mevcut çağıranları
       bozmuyor. Ama çağıran biçimi vermeli ve varsayılana
       düşüldüğünü kullanıcıya söylemeli. */
    const [bulgu] = detectStatistics("t(28) = 2.45, p = 0.021");
    assert.match(bulgu.apaSentenceFragment, /p = \.021/);
  });

  test("ÜST SINIR yazımında da kılavuz uygulanır, basamak korunur", () => {
    const [bulgu] = detectStatistics("F(2, 57) = 4.31, p < .050", turkKilavuzu);
    /* ".050" → "0,050": sıfır eklendi, ayırıcı değişti, basamak duruyor. */
    assert.match(bulgu.apaSentenceFragment, /p < 0,050/);
    assert.match(bulgu.apaSentenceFragment, /F\(2, 57\) = 4,31/);
  });

  test("çok küçük p de kılavuza uyar", () => {
    const [bulgu] = detectStatistics("χ²(1, N = 120) = 16.4, p = 0.0004", turkKilavuzu);
    assert.match(bulgu.apaSentenceFragment, /p < 0,001/);
    assert.match(bulgu.apaSentenceFragment, /χ²\(1, N = 120\) = 16,40/);
  });

  test("r BAŞTAKİ SIFIRLA yazılmış olsa da TANINIYOR", () => {
    /*
      Desen `-?[.,]\\d+` diyordu, yani r'nin APA'daki gibi sıfırsız
      yazıldığını varsayıyordu: "r(48) = 0,42" hiç eşleşmiyor ve araç
      "istatistik bulunamadı" diyordu. Biçimlendirme değil TANIMA
      kusuruydu — kılavuzu sıfır yazdıran öğrencinin değeri hiç
      görünmüyordu.
    */
    assert.equal(detectStatistics("r(48) = 0.42, p = 0.003", apa).length, 1);
    assert.equal(detectStatistics("r(48) = 0,42, p = 0,003", turkKilavuzu).length, 1);
    assert.equal(detectStatistics("r(48) = .42, p = .003", apa).length, 1);
  });

  test("korelasyonda SINIRLI DEĞER kuralı r'ye de uygulanır", () => {
    const turk = detectStatistics("r(48) = .42, p = 0.003", turkKilavuzu);
    assert.match(turk[0].apaSentenceFragment, /r\(48\) = 0,42/);
    const apaSonuc = detectStatistics("r(48) = 0.42, p = 0.003", apa);
    assert.match(apaSonuc[0].apaSentenceFragment, /r\(48\) = \.42/);
  });

  test("SERBESTLİK DERECESİ sayı değil: biçimlenmiyor", () => {
    /* t(28) içindeki 28 bir ondalık değil, serbestlik derecesi.
       Ayırıcı kuralı ona uygulansaydı "t(2,8)" gibi saçma bir
       çıktı olurdu. */
    const [bulgu] = detectStatistics("t(28) = 2.45, p = 0.021", turkKilavuzu);
    assert.match(bulgu.apaSentenceFragment, /t\(28\)/);
  });
});
