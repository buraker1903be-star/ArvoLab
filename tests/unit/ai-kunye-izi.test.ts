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
import { kunyeIziMetinde } from "@/lib/ai/bulgu";
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

  test("metnin herhangi bir yerindeki künye yeter", () => {
    const uzun = "- Akış zayıf.\n- Yöntem eksik.\n- Karşılaştırma için Demir, C. (2022) kullanılabilir.\n- Sonuç kısa.";
    assert.equal(kunyeIziMetinde(uzun), true);
  });
});

describe("künye izi · bulgu listesi", () => {
  test("literatür tarafı aynı kuralı kullanmaya devam ediyor", () => {
    assert.equal(
      kunyeIzi([{ tur: "oneri", baslik: "Kaynak", aciklama: "Şu çalışmaya bakın: Yıldırım, S. (2020). Öğrenme ortamları." }]),
      true,
    );
    assert.equal(
      kunyeIzi([{ tur: "oneri", baslik: "Strateji", aciklama: "Anahtar kelimeleri İngilizce de deneyin." }]),
      false,
    );
  });
});
