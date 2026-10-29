import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kelimeSiniriCikar, sayfaSiniriCikar, surumEtiketiCikar, yururlukTarihiCikar } from "@/lib/kilavuz-kunyesi";

describe("tez sayfa sınırı", () => {
  test("en az / en fazla ayrı cümlelerde", () => {
    const metin = "Tez en az 60 sayfa olmalıdır. Tez metni en fazla 200 sayfa olabilir.";
    assert.deepEqual(sayfaSiniriCikar(metin), { enAz: 60, enFazla: 200 });
  });

  test("aralık biçimi", () => {
    assert.deepEqual(sayfaSiniriCikar("Tez 50-150 sayfa arasında hazırlanır."), { enAz: 50, enFazla: 150 });
    assert.deepEqual(sayfaSiniriCikar("Tez 50 ile 150 sayfa arası olmalıdır."), { enAz: 50, enFazla: 150 });
  });

  test("geçemez kalıbı üst sınır verir", () => {
    assert.deepEqual(sayfaSiniriCikar("Tezin sayfa sayısı 120'yi geçemez."), { enAz: null, enFazla: 120 });
    // Sayı "sayfa" sözcüğünün iki yanında da durabiliyor.
    assert.deepEqual(sayfaSiniriCikar("Tez metni 90 sayfayı aşmamalıdır."), { enAz: null, enFazla: 90 });
  });

  test("ÖZETİN sayfa sınırı tezin sınırı sayılmaz", () => {
    /*
      En tehlikeli yanlış pozitif: kabul edilseydi her öğrenciye "teziniz 2
      sayfayı aştı" denirdi ve teslim kontrolü güvenilmez olurdu.
    */
    assert.deepEqual(sayfaSiniriCikar("Tez özeti en fazla 2 sayfa olmalıdır."), { enAz: null, enFazla: null });
    assert.deepEqual(sayfaSiniriCikar("Kaynakça en fazla 10 sayfa olabilir."), { enAz: null, enFazla: null });
    assert.deepEqual(sayfaSiniriCikar("Ekler en fazla 30 sayfa tutabilir."), { enAz: null, enFazla: null });
  });

  test("tezden söz etmeyen cümle sayılmaz", () => {
    assert.deepEqual(sayfaSiniriCikar("Her sayfa en fazla 40 satır içerir."), { enAz: null, enFazla: null });
  });

  test("akla yatkın olmayan değerler elenir", () => {
    // "A4 sayfa", "12 sayfa numarası" gibi sayılar tez uzunluğu değildir.
    assert.deepEqual(sayfaSiniriCikar("Tez en az 4 sayfa olmalıdır."), { enAz: null, enFazla: null });
    assert.deepEqual(sayfaSiniriCikar("Tez en fazla 5000 sayfa olabilir."), { enAz: null, enFazla: null });
  });

  test("çelişkili sınır kabul edilmez", () => {
    // Hangisinin yanlış okunduğu bilinemez; tahmin yanlış uyarı üretir.
    const metin = "Tez en az 300 sayfa olmalıdır. Tez en fazla 100 sayfa olabilir.";
    assert.deepEqual(sayfaSiniriCikar(metin), { enAz: null, enFazla: null });
  });

  test("sınır yoksa null", () => {
    assert.deepEqual(sayfaSiniriCikar("Tez, enstitünün belirlediği biçimde hazırlanır."), { enAz: null, enFazla: null });
  });
});

describe("sürüm etiketi", () => {
  test("açık sürüm numarası", () => {
    assert.equal(surumEtiketiCikar("TEZ YAZIM KILAVUZU Sürüm 2.1"), "Sürüm 2.1");
    assert.equal(surumEtiketiCikar("Tez Yazım Kılavuzu Revizyon 3"), "Sürüm 3");
  });

  test("kısa sürüm biçimi", () => {
    assert.equal(surumEtiketiCikar("Tez-Yazim-Kilavuzu V2"), "Sürüm 2");
  });

  test("sürüm numarası yoksa kapaktaki ay ve yıl", () => {
    // Gerçek örnek: Gazi kılavuzunun kapağında "Ocak, 2016" yazıyor.
    assert.equal(
      surumEtiketiCikar("GAZİ ÜNİVERSİTESİ LİSANSÜSTÜ TEZ VE TEZ ÖNERİSİ YAZIM KILAVUZU Ocak, 2016"),
      "Ocak 2016",
    );
  });

  test("ay yoksa yıl yeter", () => {
    assert.equal(surumEtiketiCikar("Tez Yazım Kılavuzu 2023"), "2023");
  });

  test("yalnızca belgenin başına bakılır", () => {
    // Gövdedeki tarihler örnek kaynakça künyeleridir, kılavuzun sürümü değil.
    const metin = `${"Kurallar. ".repeat(400)} Bandura, A. (1977). Self-efficacy.`;
    assert.equal(surumEtiketiCikar(metin), null);
  });
});

describe("yürürlük tarihi", () => {
  test("senato kararı tarihi okunur", () => {
    // Gerçek örnek (Gazi kılavuzu kapağı).
    const metin = "Üniversitemiz senatosunun 25.03.2014 tarihli toplantısında alınan 2014/39 sayılı kararla kabul edilen";
    assert.equal(yururlukTarihiCikar(metin), "2014-03-25");
  });

  test("tarih ifadeden sonra da gelebilir", () => {
    assert.equal(yururlukTarihiCikar("Senato kararı ile 01/09/2023 tarihinde yürürlüğe girmiştir."), "2023-09-01");
  });

  test("geçersiz gün/ay tahmin edilmez", () => {
    assert.equal(yururlukTarihiCikar("35.03.2014 tarihli karar"), null);
  });

  test("bağlamsız tarih alınmaz", () => {
    // Örnek künyelerdeki tarihler kılavuzun yürürlüğü değildir.
    assert.equal(yururlukTarihiCikar("Erişim: 12.05.2020"), null);
  });
});

/*
  \b ASCII tabanlı olduğu için Türkçe harfle başlayan sözcükleri
  kaçırıyordu (lib/sozcuk-siniri.ts). İkisi de canlı etkiliydi:
  Şubat'ta yayımlanmış kılavuzun tarihi hiç okunmuyor, "çalışma" diye
  başlayan kural cümleleri tezle ilgisiz sayılıp atlanıyordu.
*/
describe("Türkçe harfle başlayan sözcükler", () => {
  test("Şubat'ta yayımlanmış kılavuzun tarihi okunur", () => {
    const kapak = "T.C. ÖRNEK ÜNİVERSİTESİ\nTez Yazım Kılavuzu\nAnkara, Şubat 2024";
    assert.equal(surumEtiketiCikar(kapak), "Şubat 2024");
  });

  test("on iki ayın hepsi okunur", () => {
    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    for (const ay of aylar) {
      assert.equal(surumEtiketiCikar(`Tez Yazım Kılavuzu\nAnkara, ${ay} 2024`), `${ay} 2024`, ay);
    }
  });

  test("kural cümlesi 'çalışma' ile kurulmuşsa da sayfa sınırı okunur", () => {
    assert.deepEqual(sayfaSiniriCikar("Çalışma en fazla 120 sayfa olmalıdır."), { enAz: null, enFazla: 120 });
  });
});

/* İngilizce sayfa sınırı ve tez kelime sınırı (29.10.2026). */

test("tez kelime sınırı: İngiltere tipi cümle, istisna yan cümlesiyle", () => {
  assert.deepEqual(
    kelimeSiniriCikar("The thesis must not exceed 100,000 words, excluding the bibliography and appendices."),
    { enAz: null, enFazla: 100000 },
  );
  assert.deepEqual(
    kelimeSiniriCikar("A Masters dissertation should be between 15,000 and 20,000 words including footnotes."),
    { enAz: 15000, enFazla: 20000 },
  );
  assert.deepEqual(kelimeSiniriCikar("The word limit for the thesis is 80 000 words."), { enAz: null, enFazla: 80000 });
  assert.deepEqual(kelimeSiniriCikar("Tez metni kaynakça hariç 80.000 kelimeyi geçmemelidir."), { enAz: null, enFazla: 80000 });
});

test("tez kelime sınırı başka bölümün sınırını almaz", () => {
  assert.deepEqual(kelimeSiniriCikar("The abstract of the thesis must not exceed 300 words."), { enAz: null, enFazla: null });
  assert.deepEqual(kelimeSiniriCikar("Each chapter of the thesis should be no more than 12,000 words."), { enAz: null, enFazla: null });
  assert.deepEqual(kelimeSiniriCikar("Essays must not exceed 5,000 words."), { enAz: null, enFazla: null }, "tezden söz etmiyor");
});

test("İngilizce tez sayfa sınırı", () => {
  assert.deepEqual(sayfaSiniriCikar("The dissertation must not exceed 300 pages, excluding appendices."), { enAz: null, enFazla: 300 });
  assert.deepEqual(sayfaSiniriCikar("A thesis should be between 80 and 200 pages long."), { enAz: 80, enFazla: 200 });
  assert.deepEqual(sayfaSiniriCikar("The abstract of the thesis must not exceed 2 pages."), { enAz: null, enFazla: null });
});
