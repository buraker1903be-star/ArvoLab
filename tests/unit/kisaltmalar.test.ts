import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kisaltmaSorunlari } from "@/lib/kisaltmalar";
import { kisaltmaMesaji } from "@/lib/kisaltmalar";

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

test("kısaltma mesajı İngilizce", () => {
  assert.equal(
    kisaltmaMesaji({ kisaltma: "WHO", tur: "kullanilmamis", hedef: "World Health Organization (WHO)" }, "en"),
    "“WHO” is defined but never used again; a single-use abbreviation is unnecessary.",
  );
  assert.match(kisaltmaMesaji({ kisaltma: "WHO", tur: "once-kullanilmis", hedef: "WHO" }), /açık yazıldığı yerden ÖNCE/);
});

/*
  Madde 9 (03.11.2026, örnek tez): Kısaltmalar bölümü sözlüktür; tablo
  hücresi kullanımdır ama tanım değildir; açılımda küçük harf olabilir.
*/
describe("kısaltma: sözlük, tablo ve düzyazı", async () => {
  const { checkStructure } = await import("@/lib/structure-check");
  const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const tablo = (...satirlar: string[][]) => ({
    type: "table",
    content: satirlar.map((hucreler) => ({ type: "tableRow", content: hucreler.map((hucre) => ({ type: "tableCell", content: [p(hucre)] })) })),
  });
  const kisaltmaBulgulari = (content: unknown[]) =>
    checkStructure({ content: content as never }, { belgeDili: "tr" }).filter((s) => s.kategori === "yazim").map((s) => s.message);
  const SOZLUK = tablo(["Kısaltma", "Açıklama"], ["AIC", "Akaike Bilgi Ölçütü"], ["BIC / SC", "Bayesci (Schwarz) Bilgi Ölçütü"], ["FPE", "Nihai Tahmin Hatası"]);

  test("yalnızca tabloda geçen, açılmamış FPE ve BIC uyarı alır; AIC almaz", () => {
    const bulgular = kisaltmaBulgulari([
      h(2, "Kısaltmalar"),
      SOZLUK,
      h(2, "Giriş"),
      p("Gecikme Akaike bilgi ölçütü (AIC) ile seçilmiştir. AIC iki gecikme önerir."),
      tablo(["Gecikme", "AIC", "SC (BIC)", "FPE"], ["1", "0,1", "0,2", "0,3"]),
    ]);
    assert.equal(bulgular.length, 1, bulgular.join("\n"));
    assert.match(bulgular[0], /açılmamış kısaltmalar .*: SC, BIC, FPE\./);
  });

  test("Kısaltmalar satırı ne tanım ne kullanım sayılır", () => {
    // Eskiden: BIC "açık yazıldığı yerden önce kullanılmış" + "bir daha kullanılmamış".
    const bulgular = kisaltmaBulgulari([h(2, "Kısaltmalar"), SOZLUK, h(2, "Giriş"), p("Akaike bilgi ölçütü (AIC) kullanıldı; AIC küçüktür.")]);
    assert.deepEqual(bulgular, ["Kısaltmalar listesinde olup metinde geçmeyenler: BIC, SC, FPE."]);
  });

  test("tabloda 'SC (BIC)' tanım değildir; düzyazıda küçük harfli açılım tanımdır", () => {
    assert.deepEqual(kisaltmaSorunlari([{ metin: "Gecikme AIC SC (BIC) FPE", tanimOlabilir: false }]), []);
    assert.deepEqual(kisaltmaSorunlari("AIC ve SC (BIC) birlikte raporlandı."), []);
    assert.deepEqual(
      kisaltmaSorunlari("Doğrusal olmayan ARDL (NARDL) modeli. NARDL asimetriyi yakalar.").map((s) => s.tur),
      [],
    );
  });

  test("Özet'teki kullanım ve kod satırı sayılmaz; değişken tablosu tanımdır", () => {
    const bulgular = kisaltmaBulgulari([
      h(2, "Özet"),
      p("Durağanlık ADF testiyle sınanmıştır."),
      h(2, "Kısaltmalar"),
      tablo(["ADF", "Genişletilmiş Dickey–Fuller"], ["ENF", "Enflasyon oranı"]),
      h(2, "Yöntem"),
      tablo(["Değişken", "Tanım"], ["ENF", "TÜFE yıllık değişim"]),
      p("Genişletilmiş Dickey–Fuller (ADF) testi uygulanmıştır. ADF sonuçları ve ENF serisi."),
      h(2, "Ek 2"),
      p("# Beklentilerle genişletilmiş Phillips eğrisi (ADF)"),
    ]);
    assert.deepEqual(bulgular, []);
  });
});
