import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sayilar, uydurmaSayilar, uydurmaYaziylaSayilar, yaziylaSayilar } from "../../lib/ai/sayi-denetimi";
import { bulgulariCozumle, bulgulariDogrula } from "@/lib/ai/bulgu";

describe("sayı çıkarma", () => {
  test("virgül, nokta ve baştaki sıfır aynı sayıya çıkar", () => {
    assert.deepEqual(sayilar("p = 0,05 ve p = .05 ile .050"), [".05", ".05", ".05"]);
    // χ² içindeki üst simge 2 rakam sayılmaz; yalnızca gerçek değerler çıkar.
    assert.deepEqual(sayilar("χ²(1, N = 120) = 6.14"), ["1", "120", "6.14"]);
    assert.deepEqual(sayilar("r = -.42"), ["-.42"]);
  });
});

describe("uydurma sayı denetimi", () => {
  const girdi = "t(28) = 2.45, p = .021";

  test("girdideki sayılarla yazılmış yorum geçer", () => {
    assert.deepEqual(uydurmaSayilar("t(28) = 2.45, p = .021 olduğundan fark anlamlıdır (p < .05).", girdi), []);
  });

  test("girdide olmayan değer yakalanır", () => {
    // Döndürülen değerler normalleştirilmiştir: "0.83" → ".83"
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 olarak hesaplanmıştır.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });

  test("doğrulanmış ek kaynaktaki sayılar serbest", () => {
    const apa = "t(28) = 2.45, p = .021, N = 30";
    assert.deepEqual(uydurmaSayilar("30 katılımcıyla yapılan analizde fark anlamlıdır.", girdi, apa), []);
  });

  test("eşik değerleri ve madde numaraları serbest", () => {
    assert.deepEqual(uydurmaSayilar("1. Sonuç p < .001 düzeyinde anlamlıdır. 2. Etki yönü pozitiftir.", girdi), []);
  });
});

describe("yanlış alarmlar (canlı, 20.09.2026)", () => {
  const girdi = "t(58) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nχ²(1, N = 60) = 6.14, p = .013";

  test("boşluksuz serbestlik derecesi ondalık sayılmaz", () => {
    // Girdide "F(2, 57)" boşluklu; asistan "F(2,57)" yazınca Türkçe ondalık
    // kuralıyla 2,57 okunuyor ve uydurma sanılıp cevabın tamamı atılıyordu.
    assert.deepEqual(uydurmaSayilar("F(2,57) üç grupla tutarlı.", girdi), []);
    assert.deepEqual(sayilar("F(2,57)"), ["2", "57"]);
    assert.deepEqual(sayilar("χ²(1,58) anlamlı"), ["1", "58"]);
  });

  test("gerçek ondalığa dokunulmaz", () => {
    // Kural yalnızca test adından sonraki parantezde geçerli.
    assert.deepEqual(sayilar("(p = 0,021)"), [".021"]);
    assert.deepEqual(sayilar("ortalama 2,57 bulundu"), ["2.57"]);
  });

  test("standart sürümü sayısal iddia değildir", () => {
    assert.deepEqual(uydurmaSayilar("APA 7 standardı etki büyüklüğü ister.", girdi), []);
    assert.deepEqual(uydurmaSayilar("Tip 1 hata riski artar.", girdi), []);
  });

  test("gerçek uydurma hâlâ yakalanır", () => {
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = 0.83 çıkar.", girdi), [".83"]);
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
  });
});

describe("serbest liste · bilinçli dengenin bedeli", () => {
  /*
    Bu testler bir DOĞRULUĞU değil, kabul edilmiş bir SINIRI sabitliyor.
    Serbest listenin gerekçesi lib/ai/sayi-denetimi.ts'te yazılı; burada
    bedeli görünür tutuluyor ki bir sonraki okuyan "denetim uydurmayı
    yakalıyor" diye fazla güvenmesin.
  */
  const girdi = "t(28) = 2.45, p = .021";

  test("95 ve 100 serbest: güven aralığı cümlesi cevabı düşürmüyor", () => {
    // Asıl kazanç bu: kullanıcı yalnızca t ve p yapıştırdığında standart
    // bir güven aralığı cümlesi yanlış alarm üretmiyor.
    assert.deepEqual(uydurmaSayilar("Etki %95 güven aralığında raporlanmalı.", girdi), []);
  });

  test("aynı değerlerle kurulmuş uydurma KAÇIYOR (kabul edilmiş sınır)", () => {
    /*
      Bu satırlar "geçmesi gereken" değil, "bugün geçtiği bilinen"
      durumlar. Daraltma yolu bağlama bakmak olurdu ama "%95 güven
      aralığı" ile "%95'i kadındır" ayırt edilemiyor.
    */
    assert.deepEqual(uydurmaSayilar("Katılımcıların %95'i kadındır.", girdi), []);
    assert.deepEqual(uydurmaSayilar("Çalışma 100 katılımcıyla yapılmıştır.", girdi), []);
  });

  test("sınırın DIŞINDAKİ uydurmalar yakalanmaya devam ediyor", () => {
    // Serbest liste dar tutulmalı: 68, 83, 42 gibi değerler yakalanıyor.
    assert.deepEqual(uydurmaSayilar("Katılımcıların %68'i kadındır.", girdi), ["68"]);
    assert.deepEqual(uydurmaSayilar("Ortalama yaş 42 idi.", girdi), ["42"]);
    assert.deepEqual(uydurmaSayilar("Örneklem 96 kişiydi.", girdi), ["96"]);
  });
});

describe("çıktı kanalı düz yazı taşıyamaz", () => {
  /*
    "Asistan denetler, yazmaz" kuralının koddaki karşılığı YAPISAL: model
    ne yazarsa yazsın, bulgu listesi biçiminde olmayan hiçbir şey okunmuyor.
    Ayrı bir "hazır cümle" denetimi bilerek yok — asistanın öğrencinin kendi
    cümlesini alıntılaması meşru ve ikisi ayırt edilemiyor.
  */
  test("düz yazı yanıt hiç bulguya dönüşmüyor", () => {
    const duzYazi = "Şöyle yazabilirsiniz: Bulgular hipotezi desteklemektedir. Ayrıca tartışmayı genişletin.";
    assert.deepEqual(bulgulariCozumle(duzYazi), []);
  });

  test("başlık ve açıklama kırpılıyor: paragraf sığmaz", () => {
    const uzun = JSON.stringify({
      bulgular: [{ tur: "oneri", baslik: "x".repeat(200), aciklama: "y".repeat(2000) }],
    });
    const [bulgu] = bulgulariCozumle(uzun);
    assert.equal(bulgu.baslik.length, 60);
    assert.equal(bulgu.aciklama.length, 400);
  });
});

/*
  YAZIYLA YAZILAN SAYI.

  Denetim rakamı yakalıyordu, yazıyı yakalamıyordu: asistan
  "yaklaşık yirmi kişi" yazdığında girdide böyle bir sayı olmasa
  bile cevap geçiyordu.

  Kural DAR tutuldu çünkü bu dosyanın kendi ilkesi: yanlış alarm,
  kaçırılan uydurmadan sinsidir — kullanıcı doğru çalışan aracı
  kullanmayı bırakır.
*/
describe("yazıyla yazılan sayı", () => {
  test("ondan büyük miktar yakalanıyor", () => {
    assert.deepEqual(
      uydurmaYaziylaSayilar("Yaklaşık yirmi kişiyle görüşülmüş.", "Katılımcı sayısı belirtilmemiş."),
      ["yirmi"],
    );
  });

  test("bileşik miktar tek parça okunuyor", () => {
    /* "iki yüz otuz beş" = 235; parçalar ayrı ayrı sayılsaydı
       anlamsız üç ayrı uydurma raporlanırdı. */
    const bulgular = uydurmaYaziylaSayilar("İki yüz otuz beş katılımcı", "N belirtilmemiş");
    assert.deepEqual(bulgular, ["iki yüz otuz beş"]);
  });

  test("GİRDİDE RAKAMLA geçiyorsa uydurma değil", () => {
    /* Kullanıcı "20 kişi" yazmış, asistan "yirmi kişi" demiş:
       aynı sayı, farklı yazım. Reddetmek doğru cevabı atmak olurdu. */
    assert.deepEqual(uydurmaYaziylaSayilar("yirmi kişi", "Örneklem 20 kişiden oluşuyor."), []);
  });

  test("GİRDİDE YAZIYLA geçiyorsa uydurma değil", () => {
    assert.deepEqual(uydurmaYaziylaSayilar("yirmi kişi", "Yirmi kişiyle görüşüldü."), []);
  });

  test('"BİR" VE "İKİ" TEK BAŞINA SAYILMIYOR', () => {
    /*
      Türkçede belirteç olarak da geçiyorlar ("bir analiz", "iki
      yönlü test"); saysaydık neredeyse her cevap reddedilirdi.
      Bedeli açık: ondan küçük yazıyla uydurma hâlâ kaçıyor.
    */
    assert.deepEqual(uydurmaYaziylaSayilar("Bir analiz yapılmış, iki yönlü test uygulanmış.", ""), []);
  });

  test('"YÜZDE" bir miktar değil', () => {
    /* "yüzde 40" içindeki "yüz" ayıklanmazsa her yüzde ifadesi
       100 sayılır ve uydurma diye raporlanırdı. */
    assert.deepEqual(uydurmaYaziylaSayilar("Katılımcıların yüzde 40'ı kadın.", "%40 kadın"), []);
  });

  test("küçük sözcük BÜYÜĞE BİTİŞİKSE okunuyor", () => {
    const bulgular = uydurmaYaziylaSayilar("üç yüz kayıt incelendi", "kayıt sayısı yok");
    assert.deepEqual(bulgular, ["üç yüz"]);
  });

  test("EK GİRDİ de kaynak sayılıyor", () => {
    /* Doğrulanmış istatistikler ek girdi olarak geliyor; orada
       geçen sayı uydurma değildir. */
    assert.deepEqual(uydurmaYaziylaSayilar("otuz katılımcı", "", "N = 30"), []);
  });

  test("aynı miktar iki kez geçerse bir kez raporlanıyor", () => {
    const bulgular = uydurmaYaziylaSayilar("yirmi kişi ve yine yirmi gözlem", "");
    assert.deepEqual(bulgular, ["yirmi"]);
  });
});

test("DOĞRULAMA YOLUNDA da yazıyla uydurma eleniyor", () => {
  /*
    Denetim yalnızca rakamı yakalıyordu; asistan "yaklaşık yirmi
    kişi" yazdığında cevap kullanıcıya gidiyordu. İki yazım da aynı
    kapıdan geçmeli, yoksa rakamı elemek yazıya kapıyı açık
    bırakmak olur.
  */
  const bulgular = [
    { tur: "uyari" as const, baslik: "Örneklem belirsiz", aciklama: "Yaklaşık yirmi katılımcıdan söz ediliyor." },
  ];
  const sonuc = bulgulariDogrula(bulgular, "Örneklem bölümünde sayı verilmemiş.");
  assert.equal(sonuc.gecti, false);
  assert.ok(sonuc.gecti === false && sonuc.uydurulan.includes("yirmi"));
});

test("doğrulanmış kaynakta geçen miktar GEÇİYOR", () => {
  const bulgular = [
    { tur: "bilgi" as const, baslik: "Örneklem", aciklama: "Otuz katılımcıyla çalışılmış." },
  ];
  assert.equal(bulgulariDogrula(bulgular, "Çalışmaya 30 kişi katıldı.").gecti, true);
});

describe("oran ve yüzde, Cohen eşikleri (28.10.2026)", () => {
  test("η² = ,06 girdisinde '%6' uydurma değil", () => {
    // Canlıda analiz asistanının cevabı "uydurulan: 6" ile düşmüştü.
    assert.deepEqual(uydurmaSayilar("Grup, varyansın %6'sını açıklıyor.", "F(2, 57) = 3,41, p = ,040, η² = ,06"), []);
  });

  test("yalnızca tam dönüşüm: ,062 girdisinde '%6' hâlâ uydurma", () => {
    assert.deepEqual(uydurmaSayilar("Varyansın %6'sı.", "η² = ,062"), ["6"]);
    assert.deepEqual(uydurmaSayilar("Varyansın %6,2'si.", "η² = ,062"), []);
  });

  test("Cohen'in eşikleri yorum ölçütüdür", () => {
    assert.deepEqual(uydurmaSayilar("d = 0,31; küçük etki (.2 ile .5 arası, büyük için .8).", "t(28) = 2,45, d = 0,31"), []);
  });

  test("bedeli: eşikle aynı uydurma etki büyüklüğü kaçar", () => {
    // Bilerek kabul edilen sınır (sayi-denetimi.ts, SERBEST).
    assert.deepEqual(uydurmaSayilar("Etki büyüklüğü d = .5.", "t(28) = 2,45"), []);
  });
});

describe("bilerek boş liste", () => {
  test("boş liste okunamayan yanıttan ayrılır", async () => {
    const { bosListeMi } = await import("@/lib/ai/bulgu");
    assert.equal(bosListeMi('{"bulgular": []}'), true);
    assert.equal(bosListeMi("Üzgünüm, yardımcı olamam."), false);
    assert.equal(bosListeMi('{"bulgular": [{"tur":"bilgi","baslik":"a","aciklama":"b"}]}'), false);
  });
});

describe("yapısal türetmeler yalnızca analizde (28.10.2026)", () => {
  const bulgu = (aciklama: string) => [{ tur: "bilgi" as const, baslik: "Not", aciklama }];

  test("dört grupta 6 ikili karşılaştırma", () => {
    const girdi = "F(3, 46) = 4,12, p = ,011. Tukey HSD: A–B, A–C, A–D, B–C, B–D, C–D";
    assert.equal(bulgulariDogrula(bulgu("6 ikili karşılaştırma yapılmış; çoklu karşılaştırma düzeltmesi raporlanmalı."), girdi, { yapisalTuretme: true }).gecti, true);
  });

  test("n = 50'den r(48)", () => {
    assert.equal(bulgulariDogrula(bulgu("APA'da r(48) biçiminde yazılır."), "r = ,41, p = ,003, n = 50", { yapisalTuretme: true }).gecti, true);
  });

  test("seçenek kapalıyken (kaynakça, makale) türetme yok", () => {
    // "2020 − 1" uydurma bir yıl olurdu.
    const sonuc = bulgulariDogrula(bulgu("Yayın yılı 2019 olmalı."), "Yılmaz, A. (2020). Başlık.");
    assert.equal(sonuc.gecti, false);
  });

  test("bedeli: girdideki sayının bir eksiği olan uydurma tam sayı kaçar", () => {
    assert.equal(bulgulariDogrula(bulgu("49 katılımcı."), "n = 50", { yapisalTuretme: true }).gecti, true);
  });

  test("ondalıklar türetilmez", () => {
    assert.equal(bulgulariDogrula(bulgu("p = ,012"), "F(3, 46) = 4,12, p = ,011", { yapisalTuretme: true }).gecti, false);
  });
});

describe("İngilizce çıktıda yazıyla sayılar (28.10.2026)", () => {
  const bulgu = (aciklama: string) => [{ tur: "bilgi" as const, baslik: "Note", aciklama }];

  test("uydurma 'twenty participants' yakalanır", () => {
    const sonuc = bulgulariDogrula(bulgu("The sample of twenty participants is small."), "t(28) = 2,45", { dil: "en" });
    assert.equal(sonuc.gecti, false);
  });

  test("'on the other hand' Türkçe 'on' (10) sayılmaz", () => {
    assert.equal(bulgulariDogrula(bulgu("On the other hand, the effect size is missing."), "t(28) = 2,45", { dil: "en" }).gecti, true);
  });

  test("girdide Türkçe yazılan sayı İngilizce çıktıda bilinir", () => {
    assert.equal(bulgulariDogrula(bulgu("Twenty participants were included."), "Çalışmaya yirmi kişi katıldı.", { dil: "en" }).gecti, true);
  });

  test("bileşik ve tireli: two hundred thirty-five", () => {
    assert.deepEqual(yaziylaSayilar("two hundred thirty-five students", "en"), [{ metin: "two hundred thirty five", deger: 235 }]);
  });

  test("'one'/'two' tek başına sayı sayılmaz; 'percent' ayıklanır", () => {
    assert.deepEqual(yaziylaSayilar("one of the two groups; fifty percent", "en"), [{ metin: "fifty", deger: 50 }]);
  });
});

test("kaydedilen bağlam dile göre ayrışır, sayı içermez (28.10.2026)", async () => {
  // Önceki cevap önbelleği bağlam metniyle eşleşiyor; dil bağlamda yoksa
  // Türkçe cevap İngilizce arayüzde geri geliyordu.
  const { dilliKaynak } = await import("@/lib/ai/bulgu");
  assert.notEqual(dilliKaynak("t(28) = 2,45", "en"), dilliKaynak("t(28) = 2,45", "tr"));
  assert.equal(dilliKaynak("x", "tr"), "x");
  assert.deepEqual(sayilar(dilliKaynak("", "en")), []);
});

/*
  29.10.2026'ya kadar "12.000" ondalık okunup 12'ye iniyordu: girdide t(12)
  varken uydurulmuş "12.000 katılımcı" geçiyor, girdideki "1.500"e karşılık
  çıktıdaki "1500" uydurma sanılıyordu.
*/
describe("binlik ayırıcı", () => {
  test("uydurulmuş binlikli sayı, küçük bir sayının kılığına giremez", () => {
    assert.deepEqual(uydurmaSayilar("Çalışmaya 12.000 katılımcı katıldı.", "t(12) = 2,31"), ["12000"]);
    assert.deepEqual(uydurmaSayilar("12,000 participants", "t(12) = 2.31"), ["12000"]);
  });

  test("aynı sayının iki yazımı birbirine eşittir", () => {
    assert.deepEqual(uydurmaSayilar("1500 kişi", "Örneklem 1.500 kişi."), []);
    assert.deepEqual(uydurmaSayilar("1.500 kişi", "n = 1500"), []);
    assert.deepEqual(uydurmaSayilar("12.345,67", "12345.67"), []);
  });

  test("belirsiz tek grup iki okumayı da taşır, baştaki sıfır binlik değildir", () => {
    assert.deepEqual(uydurmaSayilar("M = 1.5", "Ortalama 1.500"), []);
    assert.deepEqual(uydurmaSayilar("p = .001", "p = 0.001"), []);
  });
});
