import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kisaltmaSorunlari } from "@/lib/kisaltmalar";

const turler = (metin: string) => kisaltmaSorunlari(metin).map((s) => `${s.kisaltma}:${s.tur}`).sort();

describe("kısaltma kuralları", () => {
  test("kusursuz kullanım uyarı üretmez", () => {
    const metin = "Türkiye İstatistik Kurumu (TÜİK) verileri incelendi. TÜİK'e göre oran artmıştır. TÜİK ayrıca…";
    assert.deepEqual(turler(metin), []);
  });

  test("tanımdan önce kullanılmışsa yakalanır", () => {
    const metin = "TÜİK verileri incelendi. Türkiye İstatistik Kurumu (TÜİK) raporuna göre oran arttı. TÜİK…";
    assert.ok(turler(metin).includes("TÜİK:once-kullanilmis"));
  });

  test("iki kez tanımlanmışsa yakalanır", () => {
    const metin =
      "Türkiye İstatistik Kurumu (TÜİK) verileri. TÜİK raporu. Yeniden Türkiye İstatistik Kurumu (TÜİK) açıklaması. TÜİK…";
    assert.ok(turler(metin).includes("TÜİK:cok-tanimlanmis"));
  });

  test("tanımlanıp bir daha kullanılmamışsa yakalanır", () => {
    const metin = "Bu çalışmada Dünya Sağlık Örgütü (DSÖ) verileri kullanıldı ve başka bir şey denmedi.";
    assert.deepEqual(turler(metin), ["DSÖ:kullanilmamis"]);
  });

  /*
    Yanlış alarm bu denetimin en büyük riski; aşağıdakiler kısaltma
    DEĞİLDİR ve hiçbiri uyarı üretmemeli.
  */
  test("yıl, atıf ve sayfa parantezleri kısaltma sayılmaz", () => {
    const metin = "Bu görüş yaygındır (Yılmaz, 2020). Sonuçlar (Tablo 3) verilmiştir. Ayrıca (bkz. Şekil 2).";
    assert.deepEqual(turler(metin), []);
  });

  test("büyük harfli bölüm başlıkları kısaltma sayılmaz", () => {
    // Kılavuzların çoğu ana bölüm başlığını büyük harf istiyor.
    assert.deepEqual(turler("GİRİŞ\n\nYÖNTEM\n\nBULGULAR VE TARTIŞMA"), []);
  });

  test("hiç tanımlanmamış kısaltma sessizce geçer", () => {
    // Bilerek: hangi büyük harf öbeğinin kısaltma olduğunu güvenilir
    // biçimde ayırt etmenin yolu yok; yanlış suçlamaktansa susmak iyi.
    assert.deepEqual(turler("SPSS ile analiz edildi. SPSS çıktısı ekte."), []);
  });

  test("aynı metinde birden çok kısaltma ayrı ayrı değerlendirilir", () => {
    const metin =
      "Dünya Sağlık Örgütü (DSÖ) ve Türkiye İstatistik Kurumu (TÜİK) verileri. DSÖ raporu bunu doğruluyor. DSÖ ayrıca…";
    assert.deepEqual(turler(metin), ["TÜİK:kullanilmamis"]);
  });
});
