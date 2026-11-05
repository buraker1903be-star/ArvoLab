import assert from "node:assert/strict";
import test from "node:test";
import { atifDurumlari, metindeGeciyorMu, yazarAdaylari, yilAnahtari } from "@/lib/atif-eslesmesi";

/*
  B8 (Signature OS 4.3.5): kurum yazarı ve yıl ekleri. Eskiden "TÜİK."
  noktasıyla aranıyor, "Türkiye İstatistik Kurumu" yalnızca "Kurumu" diye
  aranıyor, 2026a ile 2026b ayrılmıyordu.
*/
const ara = (authors: string | null, year: string | null, metin: string) => metindeGeciyorMu({ authors, year }, metin.toLocaleLowerCase("tr-TR"));

test("kurum yazarı: sondaki nokta atılır", () => {
  assert.deepEqual(yazarAdaylari("TÜİK."), ["tüik"]);
  assert.equal(ara("TÜİK.", "2026a", "Enflasyon verisi (TÜİK, 2026a) ile ölçülmüştür."), true);
  assert.equal(ara("World Bank.", "2020", "according to the World Bank (2020)"), true);
});

test("çok sözcüklü kurum adı: TAMAMI aranır, tek sözcüğü değil", () => {
  assert.equal(ara("Türkiye İstatistik Kurumu", "2024", "Türkiye İstatistik Kurumu (2024) verilerine göre"), true);
  // Eskiden "Kurumu" arandığı için her "kurumu" sözcüğü atıf sayılıyordu.
  assert.equal(ara("Türkiye İstatistik Kurumu", "2024", "Yükseköğretim Kurumu 2024 yılında"), false);
});

test("kurum adı ve parantezdeki kısaltma ikisi de aday", () => {
  assert.deepEqual(yazarAdaylari("Türkiye Cumhuriyet Merkez Bankası (TCMB)"), ["tcmb", "türkiye cumhuriyet merkez bankası"]);
  assert.equal(ara("Türkiye Cumhuriyet Merkez Bankası (TCMB)", "2023", "Politika faizi (TCMB, 2023) …"), true);
  assert.equal(ara("Türkiye Cumhuriyet Merkez Bankası (TCMB)", "2023", "Türkiye Cumhuriyet Merkez Bankası (2023) raporu"), true);
});

test("Türkçe karakterler: büyük/küçük harf ve İ/ı ayrımı", () => {
  assert.equal(ara("İnce, M.", "2019", "(İNCE, 2019)"), true);
  assert.equal(ara("Işık, S.", "2018", "ışık (2018) bulmuştur"), true);
  assert.equal(ara("Öztürk, A.", "2020", "OZTURK 2020"), false, "harf düşürülmüş yazım eşleşmez (tahmin yok)");
});

test("aynı yılın a/b ekleri ayrılır", () => {
  const metin = "Fiyatlar (TÜİK, 2026a) yükselmiştir.";
  assert.equal(ara("TÜİK.", "2026a", metin), true);
  assert.equal(ara("TÜİK.", "2026b", metin), false, "metinde yalnızca 2026a var");
  assert.equal(yilAnahtari("2026b"), "2026b");
  assert.equal(yilAnahtari("(2009)."), "2009");
  assert.equal(yilAnahtari("t.y."), null);
});

test("soyad sözcük sınırıyla aranır (başka sözcüğün içinde değil)", () => {
  assert.equal(ara("Ak, B.", "2015", "Akdeniz bölgesinde 2015 yılında"), false);
  assert.equal(ara("Ak, B.", "2015", "Ak'ın (2015) çalışması"), true);
});

test("örnek tez kaynakçasındaki üç kaçak artık bulunuyor (Granger ve TÜİK a/b)", () => {
  const kaynaklar = [
    { id: "granger", authors: "Granger, C. W. J., & Newbold, P.", year: "1974" },
    { id: "a", authors: "TÜİK.", year: "2026a" },
    { id: "b", authors: "TÜİK.", year: "2026b" },
  ];
  const govde = "Granger ve Newbold'un (1974) uyardığı gibi … enflasyon (TÜİK, 2026a) ve işsizlik (TÜİK, 2026b) verileri …";
  assert.deepEqual(atifDurumlari(kaynaklar, { atifTuru: "yazar-tarih", govdeMetni: govde }), { granger: "metinde", a: "metinde", b: "metinde" });
});
