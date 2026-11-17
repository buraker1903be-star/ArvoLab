import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eklenenYazarlar, kunyeIzi, literaturIstemi, SISTEM_ISTEMI, yazarOnerileriniAyikla, type LiteraturSonucu } from "../../lib/ai/literatur-taramasi";

/*
  RC06k (17.11.2026): gerçek Haiku cevabı "(Peplau & Perlman, Weiss vb.)"
  biçiminde doğrulanmamış bir yazar önerisi taşıyordu; kunyeIzi yalnızca
  yıl/DOI biçimini aradığı için cevap kullanıcıya sunuldu. Örnek tablo o
  cevabın birebir kaydı (sentetik çalışma).
*/
const RC06K = JSON.parse(readFileSync(new URL("../fixtures/rc06k-haiku-literatur.json", import.meta.url), "utf8")) as LiteraturSonucu & { baglam: string };

describe("literatür: modelin eklediği yazar önerisi", () => {
  test("RC06k regresyonu: eski denetim (kunyeIzi) cevabı geçiriyordu", () => {
    assert.equal(kunyeIzi(RC06K), false);
  });

  test("RC06k regresyonu: yazar önerisi taşıyan bulgu ayıklanır, gerisi kalır", () => {
    const { sonuc, ayiklanan } = yazarOnerileriniAyikla(RC06K, RC06K.baglam);
    assert.deepEqual(ayiklanan, ["Peplau & Perlman"]);
    assert.equal(sonuc.bulgular.length, RC06K.bulgular.length - 1);
    assert.ok(!sonuc.bulgular.some((b) => /Peplau|Weiss/.test(`${b.baslik} ${b.aciklama}`)));
    // Arama dizeleri ve öteki bulgular yerinde: Web of Science/Scopus, YÖK Tez, TR Dizin yanlış alarm değil.
    assert.deepEqual(sonuc.aramalar, RC06K.aramalar);
    assert.ok(sonuc.bulgular.some((b) => b.baslik === "Türkçe gri literatür taraması"));
  });

  test("kullanıcının sorusunda geçen araştırmacılar serbest, model ekledikleri değil", () => {
    const { kaynak } = literaturIstemi({ arastirmaSorusu: "Peplau ve Perlman'ın yalnızlık tanımı çevrimiçi derslerde nasıl işler?" });
    assert.deepEqual(eklenenYazarlar("Peplau & Perlman tanımını ölçeklerle eşleştirin.", kaynak), []);
    assert.deepEqual(eklenenYazarlar("Peplau & Perlman ile Cacioppo et al. karşılaştırılmalı.", kaynak), ["Cacioppo et al."]);
    // Çiftin yalnızca biri girdide geçiyorsa öneri sayılır.
    assert.deepEqual(eklenenYazarlar("Peplau & Weiss", kaynak), ["Peplau & Weiss"]);
  });

  test("toplanan kaynakların yazarları ve dergileri serbest (liste denetimi)", () => {
    const { kaynak } = literaturIstemi({
      arastirmaSorusu: "Harmanlanmış öğrenme özyeterliği nasıl etkiler?",
      kayitlar: [{ baslik: "Blended learning", yazarlar: "Kaya, M.", yil: "2018", yayin: "Computers & Education" }],
    });
    assert.deepEqual(eklenenYazarlar("Kaynakların biri Computers & Education'da; Kaya vd. dışında yazar çeşitliliği yok.", kaynak), []);
  });

  test("biçimler: ve ark., vd., et al.; genel kişi adı yasağı yok", () => {
    assert.deepEqual(eklenenYazarlar("Yılmaz ve ark. ölçeği uyarladı.", ""), ["Yılmaz ve ark."]);
    assert.deepEqual(eklenenYazarlar("Smith vd. bulguları", ""), ["Smith vd."]);
    // Tek başına özel ad, veri tabanı adı ve "ve" bağlacı yanlış alarm değil.
    for (const metin of [
      "Bandura'nın öz yeterlik kuramı çerçeve olabilir.",
      "Web of Science & Scopus filtrelerini kullanın.",
      "Türkçe ve İngilizce terimleri birlikte arayın.",
      "\"loneliness\" AND (\"distance learning\" OR \"online learning\")",
      "UCLA & SCS gibi ölçek kısaltmaları",
    ]) assert.deepEqual(eklenenYazarlar(metin, ""), [], metin);
  });

  test("her şey ayıklanırsa boş sonuç döner (çağıran 'kunye' ile reddeder)", () => {
    const { sonuc } = yazarOnerileriniAyikla({ bulgular: [{ tur: "oneri", baslik: "Kuram", aciklama: "Weiss & Rook okuyun." }], aramalar: ["\"Hawkley & Cacioppo\""] }, "");
    assert.equal(sonuc.bulgular.length + sonuc.aramalar.length, 0);
  });

  test("istem görevi araştırma sorusu/arama terimiyle sınırlar ve yazar önermeyi yasaklar", () => {
    assert.match(SISTEM_ISTEMI, /GÖREVİNİN SINIRI/);
    assert.match(SISTEM_ISTEMI, /yazar çiftlerini/);
  });
});
