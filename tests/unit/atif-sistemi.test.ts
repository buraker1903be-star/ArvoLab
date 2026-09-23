import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { atifSistemiSec } from "@/lib/atif-sistemi";

/** Kılavuz metni: adın kaç kez geçtiği belirleyici olduğu için tekrarlı. */
const govde = (ad: string, kez: number) =>
  Array.from({ length: kez }, (_, i) => `Kaynak gösteriminde ${ad} kurallarına uyulur (${i + 1}).`).join(" ");

describe("atıf sistemi seçimi", () => {
  test("baskın sistem seçilir", () => {
    const secim = atifSistemiSec(govde("APA", 8));
    assert.equal(secim?.sistem, "apa7");
    assert.equal(secim?.etiket, "APA 7");
  });

  test("tek geçiş sistem saymaz", () => {
    /*
      Eski kod ilk eşleşeni alıyordu: baştan sona APA anlatan bir kılavuzda
      geçen tek bir "Chicago" sistemi Chicago yapıyordu. Canlıda 18
      kılavuzun 5'inde Chicago algılanmıştı.
    */
    assert.equal(atifSistemiSec("Kaynakça Chicago biçiminde de hazırlanabilir."), null);
  });

  test("örnek listesinde geçen adlar kılavuzun sistemi sayılmaz", () => {
    const metin = `${govde("APA", 9)} Ayrıca APA, Chicago, MLA ve Vancouver gibi sistemler vardır.`;
    const secim = atifSistemiSec(metin);
    assert.equal(secim?.sistem, "apa7", "baskın olan APA kazanmalı");
    assert.match(secim?.uyarilar.join(" ") ?? "", /adı da 1 kez geçiyor/);
  });

  test("iki sistem yarışıyorsa karar verilmez", () => {
    // "Bilmiyorum" demek, yanlış bilmekten iyidir: yönetici elle seçer.
    assert.equal(atifSistemiSec(`${govde("APA", 5)} ${govde("Vancouver", 4)}`), null);
  });

  test("baskın MLA de seçilir", () => {
    // Eskiden MLA saklanamadığı için baskın MLA kılavuzları null'a
    // düşüyor, yönetici stili elle seçmek zorunda kalıyordu.
    const secim = atifSistemiSec(govde("MLA", 10));
    assert.equal(secim?.sistem, "mla");
    assert.equal(secim?.etiket, "MLA 9");
  });

  test("düz APA de eşleşir", () => {
    // Eskiden yalnızca "APA 7"/"APA7" eşleşiyordu; sürümsüz APA yazan
    // kılavuzlar metindeki başka bir sistemin adına düşüyordu.
    const secim = atifSistemiSec(govde("APA", 6));
    assert.equal(secim?.sistem, "apa7");
  });

  test("eski APA baskısı uyarı üretir", () => {
    const secim = atifSistemiSec(`${govde("APA", 6)} Kaynaklar APA 6 kurallarına göre yazılır.`);
    assert.equal(secim?.sistem, "apa7");
    assert.match(secim?.uyarilar.join(" ") ?? "", /eski bir baskı/);
  });

  test("APA 7 yazan kılavuzda eski baskı uyarısı çıkmaz", () => {
    const secim = atifSistemiSec(`${govde("APA", 6)} APA 7 esas alınır.`);
    assert.deepEqual(secim?.uyarilar, []);
  });

  test("hiç sistem geçmiyorsa null", () => {
    assert.equal(atifSistemiSec("Tez, enstitünün belirlediği biçimde hazırlanır."), null);
  });

  test("kelime sınırı: apart, chicagoland gibi sözcükler sayılmaz", () => {
    assert.equal(atifSistemiSec("apart apart apart chicagoland chicagoland chicagoland"), null);
  });
});
