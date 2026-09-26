import assert from "node:assert/strict";
import test from "node:test";
import { govdeOlcusu } from "@/lib/kilavuz-olcusu";
import { PARAGRAPH_INDENT_CM } from "@/lib/guideline-scan";
import { validIndentCm } from "@/lib/paragraph-format";

const PUNTO = /(\d{1,2}(?:[,.]\d+)?)\s*(?:punto|pt)\b/iu;
const ARALIK = /(\d(?:[,.]\d+)?)\s*(?:satır\s+aralığı|satır\s+aralıklı)/iu;

test("gövde ölçüsü ilk eşleşme değildir", async (t) => {
  await t.test("başlık kuralı gövdenin kuralı sanılmıyor", () => {
    /*
      Gerileme: Adıyaman kılavuzu bu cümleyle gövde boyutu 14 punto olarak
      ONAYLANDI. Yazı boyutu öğrencinin belgesine doğrudan indiği için
      yanlış değer görünür bir hata üretiyordu.
    */
    const metin = "Tez yazımında bilgisayar (MS Office vb.) “Times New Roman” karakterinde, "
      + "Ana bölüm başlıkları (GİRİŞ, GENEL BİLGİLER, KAYNAKLAR vb. gibi) 14 punto, "
      + "alt bölüm başlıkları ve metin kısmı 12 punto büyüklüğünde yazılmalıdır.";
    assert.equal(govdeOlcusu(metin, PUNTO), 12);
  });

  await t.test("dipnot, tablo ve içindekiler kuralları atlanıyor", () => {
    const metin = "Şekil ve tablo adları 12 punto, tablo altı dipnotlar 10 punto yazılır. "
      + "İçindekiler listesi 12 punto ve 1,5 satır aralığıyla yazılır. "
      + "Tez metni 11 punto ve 2 satır aralıklı olmalıdır.";
    assert.equal(govdeOlcusu(metin, PUNTO), 11);
    assert.equal(govdeOlcusu(metin, ARALIK), 2);
  });

  await t.test("gövde işareti, aynı cümledeki başlık işaretinden sonraysa kazanır", () => {
    // "Tablo ve şekiller DIŞINDAKİ tüm metin" gövdenin kuralıdır.
    assert.equal(govdeOlcusu("Tablo ve şekiller dışındaki tüm metin 12 punto yazılır.", PUNTO), 12);
  });

  await t.test("işaretsiz sade kılavuzda ilk ölçü alınmaya devam ediyor", () => {
    // Çoğu kılavuz tek cümleyle söylüyor; denetim onları kaybetmemeli.
    assert.equal(govdeOlcusu("Yazı boyutu 12 punto olmalıdır.", PUNTO), 12);
    assert.equal(govdeOlcusu("Metin 1,5 satır aralığı ile yazılır.", ARALIK), 1.5);
  });

  await t.test("önceki cümlenin başlık kuralı sonraki cümleyi kirletmiyor", () => {
    assert.equal(govdeOlcusu("Başlıklar 14 punto yazılır. Yazı boyutu 12 punto olmalıdır.", PUNTO), 12);
  });

  await t.test("kısaltma noktası cümleyi bölmüyor", () => {
    // "vb." bir cümle sonu değildir; bölerse başlık kuralı gövdeye karışır.
    assert.equal(govdeOlcusu("Ana başlıklar (GİRİŞ, KAYNAKLAR vb.) 14 punto yazılır.", PUNTO), undefined);
  });

  await t.test("blok alıntının girintisi gövdenin girintisi sanılmıyor", () => {
    /*
      Gerileme: Adıyaman kılavuzunda gövde girintisi 2 cm çıktı. Belge
      gerçek kuralı iki cümle sonra söylüyor. Girinti öğrencinin belgesine
      doğrudan iner.
    */
    const metin = "3 satırdan uzun olan doğrudan alıntılar, ayrı bir paragraf olarak soldan 2 cm içeriden başlar. "
      + "Alt başlıklardan önce bir satır boşluk bırakılır. 2.7. Satır Başı Her paragraf, soldan 1 cm içeriden başlar.";
    assert.equal(govdeOlcusu(metin, PARAGRAPH_INDENT_CM, (deger) => validIndentCm(deger) !== undefined), 1);
  });

  await t.test("aralık dışı göreli ölçü aramayı bitirmiyor", () => {
    /*
      "ana metinden 2 punto küçük" gövdeden söz ediyor, yani elenmiyor; 2
      punto geçersiz bulununca arama DURMAMALI, gerçek kural ötede.
    */
    const metin = "Tablo/çizelgelerde yazı büyüklüğü ana metinden 2 punto küçük olmalıdır. "
      + "Tez metni 12 punto yazılır.";
    assert.equal(govdeOlcusu(metin, PUNTO, (deger) => deger >= 8 && deger <= 24), 12);
  });

  await t.test("yalnızca gövde dışı kural varsa ölçü hiç yazılmıyor", () => {
    // Eksik ölçü yöneticiye sorulur; yanlış ölçü sessizce belgeye iner.
    assert.equal(govdeOlcusu("Dipnotlarda 10 punto kullanılır.", PUNTO), undefined);
  });
});
