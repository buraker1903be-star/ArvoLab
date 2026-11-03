import assert from "node:assert/strict";
import test from "node:test";
import { anlamliSozcukler, cumleSorgusu, kutuphanedenEslesenler } from "@/lib/cumle-kaynak";

/* Cümleye kaynak bul (03.11.2026): kuralla ifade, kütüphanede kök eşleşmesi. */
const CUMLE = "Yapılan çalışmalar Türkiye'de enflasyon ile işsizlik arasındaki Phillips eğrisi ilişkisinin ARDL modeliyle zayıfladığını göstermektedir (Yılmaz, 2020).";

test("ifade: atıf, sayı, durak sözcük ayıklanır; kısaltma kalır", () => {
  const s = anlamliSozcukler(CUMLE);
  assert.ok(!s.includes("yılmaz") && !s.includes("2020") && !s.includes("ile") && !s.includes("göstermektedir"));
  const sorgu = cumleSorgusu(CUMLE);
  assert.match(sorgu, /enflasyon/);
  assert.match(sorgu, /phillips/);
  assert.match(sorgu, /ARDL|ardl/);
  assert.ok(sorgu.split(" ").length <= 10);
  assert.equal(cumleSorgusu("Bu ve şu ile."), "");
});

test("kütüphane: en az iki ortak kök; Türkçe ek eşleşmeyi bozmaz", () => {
  const kaynaklar = [
    { id: "1", title: "Türkiye'de enflasyon ve işsizlik: Phillips eğrisinin istikrarı" },
    { id: "2", title: "Enflasyon hedeflemesi ve merkez bankası bağımsızlığı" },
    { id: "3", title: "Futbol kulüplerinde finansal performans" },
  ];
  const sonuc = kutuphanedenEslesenler(CUMLE, kaynaklar);
  assert.deepEqual(sonuc.map((k) => k.id), ["1"]);
  assert.ok(sonuc[0].ortak.length >= 3);
  assert.deepEqual(kutuphanedenEslesenler("", kaynaklar), []);
});
