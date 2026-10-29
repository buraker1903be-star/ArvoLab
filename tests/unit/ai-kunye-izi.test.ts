/*
  Künye izi artık iki yetenekte birden çalışıyor: literatür taraması (bulgu
  listesi) ve belge geri bildirimi (düz metin). Regex tek yerde
  (lib/ai/bulgu.ts); burada düz metin tarafı sabitleniyor.

  Belge geri bildirimi "şu iddia kaynaksız" diyebilen bir yetenek; oradan
  "örneğin Yılmaz, A. (2019)" demeye bir adım var ve öğrenci onu olduğu gibi
  tezine yazar. Bu yüzden künye görülürse cevabın tamamı düşürülüyor.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { baglamDisiKunye, kunyeIziMetinde } from "@/lib/ai/bulgu";
import { kunyeIzi } from "@/lib/ai/literatur-taramasi";

describe("künye izi · düz metin", () => {
  test("APA künyesi yakalanır", () => {
    assert.equal(
      kunyeIziMetinde("- Bu iddia kaynaksız; örneğin Yılmaz, A. (2019) bu konuda bir çerçeve sunuyor."),
      true,
    );
  });

  /*
    Bu testin yakaladığı hata: denetim \b ile aranıyordu ve JavaScript'te \b
    ASCII tabanlı. "Ş" sözcük karakteri sayılmadığı için önünde sınır
    oluşmuyordu; Türkiye'nin en yaygın soyadlarıyla uydurulmuş künyeler
    denetimden hiç geçmiyordu. Yılmaz yakalanıyor, Şahin yakalanmıyordu.
  */
  test("Türkçe harfle başlayan soyadları da yakalanır", () => {
    const kacanlar = [
      "Şahin, B. (2021) çalışmasına bakın.",
      "Özdemir, K. (2018) bu bulguyu tartışıyor.",
      "Çelik, H. (2020) araştırmasında benzer sonuç var.",
      "Ünal, T. (2017) modeline bakılabilir.",
      "İnce, D. (2018) bu konuyu ele alıyor.",
      "Ğ ile başlayan bir soyadı yok ama sınıf eksiksiz: Gül, A. (2015).",
    ];
    for (const satir of kacanlar) {
      assert.equal(kunyeIziMetinde(satir), true, `Kaçtı: ${satir}`);
    }
  });

  test("ASCII harfle başlayan soyadları eskisi gibi yakalanmaya devam ediyor", () => {
    assert.equal(kunyeIziMetinde("Yılmaz, A. (2019) bu konuda"), true);
    assert.equal(kunyeIziMetinde("Demir, C. (2022) çalışması"), true);
  });

  test("tireli soyadın ikinci parçası da sınır sayılır", () => {
    // "Demir-Kaya, A. (2020)": tire harf değil, lookbehind geçer.
    assert.equal(kunyeIziMetinde("Karşılaştırma için Demir-Kaya, A. (2020)."), true);
  });

  test("meşru yapısal geri bildirim yanlış alarm üretmez", () => {
    // Yanlış alarm, kaçırılan uydurmadan sinsidir: kullanıcı doğru çalışan
    // aracı kullanmayı bırakır. Bu cümlelerin hiçbiri künye değil.
    const mesru = [
      "- Giriş bölümünde araştırmanın amacı net ifade edilmemiş.",
      "- Bu paragrafta iki ayrı fikir karışık veriliyor (2. ve 3. cümleler).",
      "- Yöntem bölümünde örneklem gerekçesi eksik; 2019 verisi neden seçildi?",
      "- Tartışmada sınırlılıklara değinilmemiş.",
      "- Bu iddia bir kaynakla desteklenmemiş görünüyor (metinde atıf yok).",
    ];
    for (const satir of mesru) {
      assert.equal(kunyeIziMetinde(satir), false, `Yanlış alarm: ${satir}`);
    }
  });

  /*
    29.10.2026'ya kadar yalnızca "Soyad, A. (2020)" aranıyordu; en yaygın
    biçimler geçiyordu ve literatür yeteneğinde sayı denetimi yok.
  */
  test("yaygın künye ve atıf biçimlerinin hepsi yakalanır", () => {
    for (const satir of [
      "Deci, E. L. (1985) öz belirleme kuramını önerdi.",
      "Smith, J. (2020a) bunu gösterdi.",
      "McDonald, R. (2018) modeline bakın.",
      "Smith et al. (2020) benzer sonuç buldu.",
      "Yılmaz vd. (2019) çalışmasına bakın.",
      "Bandura (1977) öz yeterliği tanımladı.",
      "Bu bulgu desteklenir (Yılmaz & Demir, 2020).",
      "Bkz. (Kaya et al., 2018).",
      "DOI: 10.1037/0022-3514.53.6.1024",
    ]) {
      assert.equal(kunyeIziMetinde(satir), true, `Kaçtı: ${satir}`);
    }
  });

  test("kısaltma ve yıl içeren meşru cümleler künye sayılmaz", () => {
    for (const satir of [
      "TÜİK (2022) verileri güncellenmeli.",
      "COVID (2020) dönemi ayrıca ele alınmalı.",
      "Bu iddia (2019 verisi) eskimiş olabilir.",
      "APA 7 (2020) kurallarına göre başlıklar düzenlenmeli.",
    ]) {
      assert.equal(kunyeIziMetinde(satir), false, `Yanlış alarm: ${satir}`);
    }
  });

  test("öğrencinin metninde geçen atıfa değinmek uydurma değildir", () => {
    const metin = "Öz yeterlik Bandura (1977) tarafından tanımlanmıştır.";
    assert.deepEqual(baglamDisiKunye("- Bandura (1977) atfının kaynakçada karşılığı yok.", metin), []);
    assert.deepEqual(baglamDisiKunye("- Örneğin Deci (1985) de eklenebilir.", metin), ["Deci (1985)"]);
  });

  test("metnin herhangi bir yerindeki künye yeter", () => {
    const uzun = "- Akış zayıf.\n- Yöntem eksik.\n- Karşılaştırma için Demir, C. (2022) kullanılabilir.\n- Sonuç kısa.";
    assert.equal(kunyeIziMetinde(uzun), true);
  });
});

describe("künye izi · literatür sonucu", () => {
  const sonuc = (bulgular: Parameters<typeof kunyeIzi>[0]["bulgular"], aramalar: string[] = []) => ({ bulgular, aramalar });

  test("açıklamadaki künye yakalanır", () => {
    assert.equal(
      kunyeIzi(sonuc([{ tur: "oneri", baslik: "Kaynak", aciklama: "Şu çalışmaya bakın: Yıldırım, S. (2020). Öğrenme ortamları." }])),
      true,
    );
  });

  test("BAŞLIKTAKİ künye de yakalanır", () => {
    /*
      Gerileme: denetim yalnızca `aciklama`ya bakıyordu. Başlık 60 karaktere
      kadar serbest metin ve "Şahin, A. (2021)" 16 karakter — yani künye
      başlığa sığıyor ve kullanıcıya İLK görünen alan başlıktır. Sayı
      denetimi (bulgulariDogrula) başlığı ve açıklamayı birleştirip
      tarıyordu; iki denetim aynı çıktının farklı kısmına bakıyordu.
    */
    assert.equal(
      kunyeIzi(sonuc([{ tur: "oneri", baslik: "Şahin, A. (2021) taraması", aciklama: "Anahtar kelimeleri genişletin." }])),
      true,
    );
  });

  test("ARAMA DİZESİNDEKİ künye de yakalanır", () => {
    /*
      Gerileme: arama dizeleri hiç taranmıyordu. Kullanıcı bunları veri
      tabanına yapıştırıyor; künye biçiminde bir dize, olmayan bir çalışmayı
      varmış gibi gösterir. Sayı denetiminin buraya uygulanmama gerekçesi
      ("2015..2025" meşru bir yıl filtresi) künyeye geçmiyor.
    */
    assert.equal(
      kunyeIzi(sonuc([{ tur: "oneri", baslik: "Strateji", aciklama: "Genişletin." }], ['"Yıldırım, S. (2020)"'])),
      true,
    );
  });

  test("meşru strateji ve arama dizeleri yanlış alarm üretmiyor", () => {
    // Yanlış alarm burada özellikle pahalı: kusursuz bir tarama stratejisi
    // düşerse kullanıcı aracı kullanmayı bırakır.
    assert.equal(
      kunyeIzi(
        sonuc([{ tur: "oneri", baslik: "Strateji", aciklama: "Anahtar kelimeleri İngilizce de deneyin." }], [
          '("öğrenme ortamı" OR "learning environment") AND 2015..2025',
          'TI=(motivasyon) AND AU=(Yılmaz)',
          '"blended learning" AND TR',
        ]),
      ),
      false,
    );
  });

  test("bulgu ve arama yoksa alarm yok", () => {
    assert.equal(kunyeIzi(sonuc([], [])), false);
  });
});
