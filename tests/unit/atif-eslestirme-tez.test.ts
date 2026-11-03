import assert from "node:assert/strict";
import test from "node:test";
import { crossCheck, extractInTextCitations, parseReferenceEntry } from "@/lib/apa7";

/*
  Madde 7 (03.11.2026, örnek tez): yanlış "metinde anılmıyor" uyarıları ve
  doğru tespit edilip yanlış etiketlenen atıflar.
*/
const K = {
  buyrukoglu: "Buyrukoğlu, A., & Altunakar Mercan, Ş. (2022). Enflasyon ve işsizlik arasındaki ilişki. Dergi, 1(1), 1–10.",
  staiger: "Staiger, D., Stock, J. H., & Watson, M. W. (1997). The NAIRU, unemployment and monetary policy. Journal of Economic Perspectives, 11(1), 33–49.",
  engle: "Engle, R. F., & Granger, C. W. J. (1987). Co-integration and error correction. Econometrica, 55(2), 251–276.",
  newbold: "Granger, C. W. J., & Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111–120.",
  tuikA: "TÜİK. (2026a). Tüketici Fiyat Endeksi, Aralık 2025 [Haber bülteni]. Türkiye İstatistik Kurumu.",
  tuikB: "TÜİK. (2026b). İşgücü İstatistikleri, 2025 [Haber bülteni]. Türkiye İstatistik Kurumu.",
  gali: "Galí, J., & Gertler, M. (1999). Inflation dynamics. Journal of Monetary Economics, 44(2), 195–222.",
  kustepeli: "Kuştepeli, Y. (2005). A comprehensive short-run analysis. Applied Economics, 37(9), 1–10.",
  onder: "Önder, A. Ö. (2009). The stability of the Turkish Phillips curve. Applied Economics, 41(20), 1–10.",
  samuelson: "Samuelson, P. A., & Solow, R. M. (1960). Analytical aspects of anti-inflation policy. American Economic Review, 50(2), 177–194.",
  tuik2026: "TÜİK. (2026a). Haber. Kurum.",
};

const denetle = (govde: string, kunyeler: string[]) => {
  const refs = kunyeler.map((k) => parseReferenceEntry(k));
  const sonuc = crossCheck(extractInTextCitations(govde), refs, { govde });
  const ad = (r: { raw: string }) => r.raw.split(/[,.]/)[0];
  return {
    anilmayan: sonuc.referencesWithoutCitation.map(ad),
    tireli: (sonuc.tireliAtiflar ?? []).map((t) => ad(t.kaynak)),
    yilsiz: (sonuc.yilsizAnilanlar ?? []).map((y) => ad(y.kaynak)),
  };
};

test("çok sözcüklü soyad: Buyrukoğlu ve Altunakar Mercan (2022) → eşleşti", () => {
  assert.deepEqual(denetle("Buyrukoğlu ve Altunakar Mercan (2022) bunu gösterir.", [K.buyrukoglu]).anilmayan, []);
});

test("üç yazar: Staiger, Stock ve Watson (1997) → eşleşti; parantez içi de", () => {
  assert.deepEqual(denetle("Staiger, Stock ve Watson (1997) önerir.", [K.staiger]).anilmayan, []);
  assert.deepEqual(denetle("NAIRU zamanla değişir (Staiger, Stock ve Watson, 1997).", [K.staiger]).anilmayan, []);
});

test("tireli: Engle–Granger (1987) → eşleşti + biçim uyarısı", () => {
  const sonuc = denetle("Engle–Granger (1987) yöntemi uygulanmıştır.", [K.engle]);
  assert.deepEqual(sonuc.anilmayan, []);
  assert.deepEqual(sonuc.tireli, ["Engle"]);
});

test("yılsız: Granger ve Newbold'un … → yıl eksik (anılmıyor değil)", () => {
  const sonuc = denetle("Granger ve Newbold'un sahte regresyon uyarısı önemlidir.", [K.newbold]);
  assert.deepEqual(sonuc.anilmayan, []);
  assert.deepEqual(sonuc.yilsiz, ["Granger"]);
});

test("TÜİK (2026a) metinde yok → anılmıyor; 2026b anılırsa yalnızca a kalır", () => {
  assert.equal(denetle("Veriler TÜİK'ten alınmıştır.", [K.tuikA, K.tuikB]).anilmayan.length, 2);
  const sonuc = denetle("İşsizlik %8,3'tür (TÜİK, 2026b).", [K.tuikA, K.tuikB]);
  assert.equal(sonuc.anilmayan.length, 1);
});

test("desteklenen öteki biçimler", () => {
  const govde = [
    "Galí ve Gertler (1999) ileriye dönük bileşeni bulmuştur.",
    "Kuştepeli'nin (2005) bulguları ve Önder'in (2009) çalışması.",
    "Samuelson ile Solow'un (1960) çalışmaları.",
    "Kurum verisi TÜİK (2026a) bülteninde.",
  ].join(" ");
  assert.deepEqual(denetle(govde, [K.gali, K.kustepeli, K.onder, K.samuelson, K.tuik2026]).anilmayan, []);
  // Aksan yok sayılır: Gali = Galí.
  assert.deepEqual(denetle("Gali ve Gertler (1999).", [K.gali]).anilmayan, []);
  // "A & B (yıl)", "(A ve B, yıl; C, yıl)", "A vd. (yıl)"
  assert.deepEqual(denetle("Engle & Granger (1987).", [K.engle]).anilmayan, []);
  assert.deepEqual(denetle("(Engle ve Granger, 1987; Kuştepeli, 2005)", [K.engle, K.kustepeli]).anilmayan, []);
  assert.deepEqual(denetle("Staiger vd. (1997).", [K.staiger]).anilmayan, []);
});

test("tek yazarlı kaynak kavram adıyla 'yılsız' sayılmaz (Phillips eğrisi, Granger nedenselliği)", () => {
  const tek = "Granger, C. W. J. (1969). Investigating causal relations. Econometrica, 37(3), 424–438.";
  const sonuc = denetle("Granger nedenselliği testi uygulanmıştır.", [tek]);
  assert.deepEqual(sonuc.yilsiz, []);
  assert.deepEqual(sonuc.anilmayan, ["Granger"]);
});
