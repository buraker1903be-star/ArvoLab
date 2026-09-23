import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analizBasligi, analizEtiketi, analizTuruMu } from "../../lib/analiz-turleri";

describe("analiz türü etiketi", () => {
  test("bilinen tür Türkçe adıyla çıkıyor", () => {
    assert.equal(analizEtiketi("ttest"), "Bağımsız Örneklem t-Testi");
  });

  /*
    Tanınmayan tür "Bilinmeyen analiz" değil ham anahtar olarak çıkar:
    eski bir kaydın hangi testten geldiğini kullanıcıdan gizlememek için.
  */
  test("tanınmayan tür ham haliyle kalıyor", () => {
    assert.equal(analizEtiketi("mancova"), "mancova");
    assert.equal(analizTuruMu("mancova"), false);
  });
});

describe("kaydedilen analizin başlığı", () => {
  test("t-testi bağımlı ve grup değişkenini yazıyor", () => {
    assert.equal(
      analizBasligi("ttest", { varA: "puan", groupVar: "cinsiyet" }),
      "Bağımsız Örneklem t-Testi: puan ~ cinsiyet",
    );
  });

  test("korelasyon iki değişkeni de yazıyor", () => {
    assert.equal(
      analizBasligi("correlation", { varA: "kaygi", varB: "basari" }),
      "Pearson Korelasyonu: kaygi — basari",
    );
  });

  test("güvenilirlik madde sayısını yazıyor", () => {
    assert.equal(analizBasligi("reliability", { maddeSayisi: 12 }), "Güvenilirlik Analizi (Cronbach Alpha): 12 madde");
  });

  /*
    Eksik seçim uydurulmuyor. "puan ~ " gibi yarım bir başlık, geçmişte
    kullanıcının hangi grupla karşılaştırdığını bildiğini sanmasına yol açardı.
  */
  test("eksik değişken yarım başlık üretmiyor", () => {
    assert.equal(analizBasligi("ttest", { varA: "puan" }), "Bağımsız Örneklem t-Testi: puan");
    assert.equal(analizBasligi("ttest", {}), "Bağımsız Örneklem t-Testi");
  });

  test("betimsel istatistik değişken seçimi istemiyor", () => {
    assert.equal(analizBasligi("descriptives", {}), "Betimsel İstatistikler: tüm sayısal değişkenler");
  });

  test("çok uzun değişken adı veritabanı sınırını aşmıyor", () => {
    const baslik = analizBasligi("correlation", { varA: "a".repeat(400), varB: "b".repeat(400) });
    assert.ok(baslik.length <= 300, `başlık ${baslik.length} karakter`);
    assert.ok(baslik.endsWith("…"));
  });
});
