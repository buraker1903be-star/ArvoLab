import assert from "node:assert/strict";
import test from "node:test";
import { ilgiliSayfalar, kaynakCevabiCozumle, kaynakCevabiDenetle, kaynakIstemi, type Sayfa } from "@/lib/ai/kaynak-sohbeti";

/*
  Kaynakla sohbet (03.11.2026): cevap kaynaktan birebir alıntıyla
  kanıtlanır; alıntı metinde yoksa, sayı uydurulmuşsa ya da kaynakta
  olmayan bir künye yazılmışsa cevabın tamamı düşer.
*/
const SAYFALAR: Sayfa[] = [
  { num: 1, text: "The stability of the Turkish Phillips curve. Abstract: We study inflation and unemployment in Turkey." },
  { num: 2, text: "Data. The sample covers 1988–2006 with quarterly observations from TurkStat." },
  { num: 3, text: "Results. The coefficient on unemployment is −0.31 and significant at the 5% level, consistent with Gordon (1997)." },
];

test("doğru alıntı geçer; yanlış sayfa düzeltilir", () => {
  const cevap = {
    bulundu: true,
    cevap: "İşsizlik katsayısı −0.31 bulunmuş ve %5 düzeyinde anlamlıdır.",
    alintilar: [{ sayfa: 2, metin: "The coefficient on unemployment is −0.31 and significant" }],
  };
  const sonuc = kaynakCevabiDenetle(cevap, SAYFALAR, "Katsayı ne?");
  assert.equal(sonuc.gecti, true);
  assert.deepEqual(sonuc.gecti && sonuc.cevap.alintilar, [{ sayfa: 3, metin: "The coefficient on unemployment is −0.31 and significant" }]);
});

test("metinde olmayan alıntı cevabı düşürür", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Örneklem uzundur.", alintilar: [{ sayfa: 2, metin: "The sample covers 1980–2010 with monthly data" }] },
    SAYFALAR,
    "Örneklem?",
  );
  assert.equal(sonuc.gecti, false);
  assert.equal(sonuc.gecti === false && sonuc.neden, "alinti");
});

test("'bulundu' diyen cevap alıntısız olamaz; 'bulunamadı' alıntısız olabilir", () => {
  assert.equal(kaynakCevabiDenetle({ bulundu: true, cevap: "Evet.", alintilar: [] }, SAYFALAR, "?").gecti, false);
  assert.equal(kaynakCevabiDenetle({ bulundu: false, cevap: "Kaynakta etik onay bilgisi bulunamadı.", alintilar: [] }, SAYFALAR, "?").gecti, true);
});

test("kaynakta olmayan sayı ve künye cevabı düşürür", () => {
  const sayi = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Örneklem 250 gözlemdir.", alintilar: [{ sayfa: 2, metin: "The sample covers 1988–2006 with quarterly" }] },
    SAYFALAR,
    "Örneklem?",
  );
  assert.deepEqual(sayi, { gecti: false, neden: "uydurma_sayi", ayrinti: ["250"] });
  const kunye = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Bu bulgu Friedman (1968) ile uyumludur.", alintilar: [{ sayfa: 3, metin: "consistent with Gordon (1997)" }] },
    SAYFALAR,
    "?",
  );
  assert.equal(kunye.gecti === false && kunye.neden, "kunye");
  // Kaynakta geçen atfa değinmek serbest.
  assert.equal(
    kaynakCevabiDenetle({ bulundu: true, cevap: "Yazarlar sonucu Gordon (1997) ile uyumlu buluyor.", alintilar: [{ sayfa: 3, metin: "consistent with Gordon (1997)" }] }, SAYFALAR, "?").gecti,
    true,
  );
});

test("sayfa seçimi: sığıyorsa hepsi; sığmıyorsa ilk iki sayfa + ilgili olanlar", () => {
  assert.equal(ilgiliSayfalar(SAYFALAR, "katsayı").kirpildi, 0);
  const uzun: Sayfa[] = Array.from({ length: 10 }, (_, i) => ({ num: i + 1, text: `${i === 7 ? "ARDL bounds test results" : "filler text"} ${"x".repeat(200)}` }));
  const { secilen, kirpildi } = ilgiliSayfalar(uzun, "ARDL sınır testi sonucu nedir?", 700);
  assert.deepEqual(secilen.map((s) => s.num), [1, 2, 8]);
  assert.equal(kirpildi, 7);
});

test("çözümleme ve istem", () => {
  assert.deepEqual(kaynakCevabiCozumle('{"bulundu":true,"cevap":"A.","alintilar":[{"sayfa":"3","metin":" x "}]}'), {
    bulundu: true,
    cevap: "A.",
    alintilar: [{ sayfa: 3, metin: "x" }],
  });
  assert.equal(kaynakCevabiCozumle('{"bulundu":true,"cevap":""}'), null);
  const { kaynakMetni, kayitBaglami } = kaynakIstemi({ kunye: "Önder (2009)", sayfalar: SAYFALAR, soru: "Yöntem?", gecmis: [], dil: "tr" });
  assert.match(kaynakMetni, /--- SAYFA 3 ---\nResults\./);
  assert.match(kayitBaglami, /SAYFALAR: 1, 2, 3/);
  assert.ok(!kayitBaglami.includes("quarterly"), "kayda kaynağın tamamı girmez");
});
