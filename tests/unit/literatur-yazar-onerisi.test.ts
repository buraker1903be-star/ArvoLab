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
      "Öz yeterlik kuramı çerçeve olabilir.",
      "Türkiye'deki çalışmaları YÖK Tez'de arayın.",
      "Scopus'un yayın kapsamı sınırlıdır.",
      "Web of Science & Scopus filtrelerini kullanın.",
      "Türkçe ve İngilizce terimleri birlikte arayın.",
      "\"loneliness\" AND (\"distance learning\" OR \"online learning\")",
      "UCLA & SCS gibi ölçek kısaltmaları",
    ]) assert.deepEqual(eklenenYazarlar(metin, ""), [], metin);
  });

  /*
    PR #105 incelemesi: tek yazarlı öneri. İlk süzgeç ("Ad & Ad", "Ad vd.")
    bu cümleyi KAÇIRIYORDU (eklenenYazarlar → []); 17.11.2026'da
    92a0e91 üzerinde ölçüldü. Şimdi "ad + iyelik eki + eser sözcüğü"
    biçimi yakalıyor — ad listesi yok, genel ad yasağı yok.
  */
  test("tek yazarlı öneri: 'Weiss’in çalışmalarına bakın.' yakalanır", () => {
    assert.deepEqual(eklenenYazarlar("Weiss’in çalışmalarına bakın.", ""), ["Weiss’in çalışmalarına"]);
    assert.deepEqual(eklenenYazarlar("Weiss'in çalışmalarına bakın.", ""), ["Weiss'in çalışmalarına"]);
    assert.deepEqual(eklenenYazarlar("Bowlby'nin bağlanma kuramını inceleyin.", ""), ["Bowlby'nin bağlanma kuramını"]);
    assert.deepEqual(eklenenYazarlar("See Weiss's work on loneliness.", ""), ["Weiss's work"]);
    // Model kendisi eklediyse kuramcı adı da öneridir; kullanıcı sorusunda geçtiyse serbest.
    assert.deepEqual(eklenenYazarlar("Bandura'nın öz yeterlik kuramı çerçeve olabilir.", ""), ["Bandura'nın öz yeterlik kuramı"]);
    const { kaynak } = literaturIstemi({ arastirmaSorusu: "Bandura'nın öz yeterlik kuramına göre çevrimiçi öğrenme nasıl açıklanır?" });
    assert.deepEqual(eklenenYazarlar("Bandura'nın öz yeterlik kuramı çerçeve olabilir.", kaynak), []);
    // Ayıklama: öneriyi taşıyan bulgu kullanıcıya sunulmaz.
    const { sonuc } = yazarOnerileriniAyikla({ bulgular: [{ tur: "oneri", baslik: "Kuram", aciklama: "Weiss’in çalışmalarına bakın." }], aramalar: [] }, "");
    assert.equal(sonuc.bulgular.length, 0);
  });

  /*
    BİLİNEN AÇIK — bilerek kapatılmadı. Bu biçimler bugün GEÇİYOR; testin
    amacı sınırı görünür tutmak. Kapatmak ya genel bir büyük harfli ad
    yasağı ya da büyüyen bir ad/yer listesi gerektiriyor; ikisi de istenmedi
    (yanlış alarm doğru çalışan aracı bıraktırır). Yapısal alternatif PR
    açıklamasında: literatür bulgularını serbest metin yerine sunucunun
    çizdiği kategori kodlarına çevirmek. Biri kapanırsa bu listeden çıkarın.
  */
  test("BİLİNEN AÇIK: ad + belirtme/yönelme eki, 'gibi' ve iyeliksiz kullanım geçiyor", () => {
    for (const metin of ["Weiss'i okuyun.", "Weiss'e bakın.", "Weiss gibi kuramcıların yaklaşımı", "Weiss bu konuda öncüdür."]) {
      assert.deepEqual(eklenenYazarlar(metin, ""), [], `açık kapanmış görünüyor, listeden çıkarın: ${metin}`);
    }
  });

  /* BİLİNEN YANLIŞ ALARM: iyelikli yer adı + eser sözcüğü. Bedeli tek bulgunun düşmesi, cevabın değil. */
  test("BİLİNEN YANLIŞ ALARM: 'Türkiye'nin araştırma politikaları'", () => {
    assert.deepEqual(eklenenYazarlar("Türkiye'nin araştırma politikaları", ""), ["Türkiye'nin araştırma"]);
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
