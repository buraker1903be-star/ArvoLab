import assert from "node:assert/strict";
import test from "node:test";
import { diffTexts, diffWords } from "@/lib/text-diff";

/*
  Sürüm karşılaştırması: kullanıcı "önceki sürüme dön" kararını bu ekrana
  bakarak veriyor. Farkı eksik göstermek, geri dönülen sürümde ne
  kaybedileceğini gizler.

  Paragraf düzeyinde LCS, değişen paragraflarda kelime düzeyinde fark. Aynı
  kalan baş ve son atılıyor, yani LCS yalnızca ortada çalışıyor — bu
  kırpmada bir kayma bütün blok dizisini kaydırır.
*/
const say = (metin: string) => metin.split("\n").length;

test("kelime farkı", async (t) => {
  await t.test("aynı metinde her şey 'same'", () => {
    const parcalar = diffWords("bir iki üç", "bir iki üç");
    assert.deepEqual(parcalar, [{ type: "same", text: "bir iki üç" }]);
  });

  await t.test("boşluklar korunuyor", () => {
    // Fark ekranında metin yeniden kurulabilmeli: parçalar birleşince özgün
    // metin çıkmalı, yoksa kullanıcı bozuk bir önizleme görür.
    const eski = "bir  iki üç";
    const yeni = "bir  iki dört";
    const parcalar = diffWords(eski, yeni);
    const geriEski = parcalar.filter((p) => p.type !== "added").map((p) => p.text).join("");
    const geriYeni = parcalar.filter((p) => p.type !== "removed").map((p) => p.text).join("");
    assert.equal(geriEski, eski);
    assert.equal(geriYeni, yeni);
  });

  await t.test("aynı türden KOMŞU parça kalmıyor", () => {
    /*
      Değişmez: komşu iki parçanın türü asla aynı olmaz, aksi halde fark
      ekranı aynı rengi yan yana iki kez çizer.

      Ardışık silinen kelimelerin tek parçada toplanmasını beklemek YANLIŞ
      olurdu: aralarındaki boşluk gerçekten değişmiyor, yani araya "same"
      bir parça girer. Boşlukları korumanın bedeli bu.
    */
    for (const [eski, yeni] of [
      ["a b c d", "x y c d"],
      ["bir iki üç dört beş", "bir altı yedi dört beş"],
      ["tek", "bambaşka bir metin"],
    ]) {
      const parcalar = diffWords(eski, yeni);
      for (let i = 1; i < parcalar.length; i += 1) {
        assert.notEqual(parcalar[i].type, parcalar[i - 1].type, `${eski} → ${yeni}: ${JSON.stringify(parcalar)}`);
      }
    }
  });

  await t.test("boş metinler", () => {
    assert.deepEqual(diffWords("", ""), []);
    assert.deepEqual(diffWords("", "yeni"), [{ type: "added", text: "yeni" }]);
    assert.deepEqual(diffWords("eski", ""), [{ type: "removed", text: "eski" }]);
  });
});

test("metin farkı", async (t) => {
  await t.test("aynı metin 'identical'", () => {
    const fark = diffTexts("Birinci paragraf.\n\nİkinci paragraf.", "Birinci paragraf.\n\nİkinci paragraf.");
    assert.equal(fark.identical, true);
    assert.deepEqual(fark.blocks, [{ kind: "same", count: 2 }]);
    assert.deepEqual(fark.stats, {
      addedWords: 0, removedWords: 0, addedParagraphs: 0, removedParagraphs: 0, changedParagraphs: 0,
    });
  });

  await t.test("yalnızca boşluk farkı değişiklik sayılmıyor", () => {
    // Paragraf içi boşluklar tekleniyor ve baştaki/sondaki kırpılıyor:
    // biçimsel bir kayma "metin değişti" diye gösterilmemeli.
    const fark = diffTexts("Bir   iki üç.", "  Bir iki üç.  ");
    assert.equal(fark.identical, true);
  });

  await t.test("boş satırlar paragraf sayılmıyor", () => {
    const fark = diffTexts("A\n\n\n\nB", "A\nB");
    assert.equal(fark.identical, true);
  });

  await t.test("sona eklenen paragraf", () => {
    const fark = diffTexts("A paragrafı.", "A paragrafı.\n\nYeni iki kelime.");
    assert.deepEqual(fark.blocks, [{ kind: "same", count: 1 }, { kind: "added", text: "Yeni iki kelime." }]);
    assert.equal(fark.stats.addedParagraphs, 1);
    assert.equal(fark.stats.addedWords, 3);
    assert.equal(fark.stats.removedParagraphs, 0);
    assert.equal(fark.identical, false);
  });

  await t.test("silinen paragraf", () => {
    const fark = diffTexts("A.\n\nSilinecek olan paragraf.\n\nC.", "A.\n\nC.");
    assert.equal(fark.stats.removedParagraphs, 1);
    assert.equal(fark.stats.removedWords, 3);
    assert.equal(fark.stats.addedParagraphs, 0);
    const silinen = fark.blocks.find((b) => b.kind === "removed");
    assert.equal(silinen && "text" in silinen ? silinen.text : null, "Silinecek olan paragraf.");
  });

  await t.test("düzenlenen paragraf 'changed' olarak eşleşiyor", () => {
    /*
      Benzer paragraf sil+ekle olarak GÖSTERİLMEMELİ: kullanıcı iki bloğu
      gözle karşılaştırmak zorunda kalır. Kelime düzeyinde fark verilir.
    */
    const fark = diffTexts(
      "Araştırmanın amacı öğrenci başarısını incelemektir.",
      "Araştırmanın amacı öğrenci motivasyonunu incelemektir.",
    );
    assert.equal(fark.stats.changedParagraphs, 1);
    assert.equal(fark.stats.addedParagraphs, 0);
    assert.equal(fark.stats.removedParagraphs, 0);
    const degisen = fark.blocks.find((b) => b.kind === "changed");
    assert.ok(degisen && "parts" in degisen);
    assert.ok(degisen!.parts.some((p) => p.type === "removed" && p.text.includes("başarısını")));
    assert.ok(degisen!.parts.some((p) => p.type === "added" && p.text.includes("motivasyonunu")));
  });

  await t.test("tümüyle farklı paragraf 'changed' sayılmıyor", () => {
    // Benzerlik eşiğinin altındaki çift, sil + ekle olarak ayrı gösterilir.
    const fark = diffTexts("Kedi bahçede oturuyordu.", "Ekonometrik modelin varsayımları sınandı.");
    assert.equal(fark.stats.changedParagraphs, 0);
    assert.equal(fark.stats.removedParagraphs, 1);
    assert.equal(fark.stats.addedParagraphs, 1);
  });

  await t.test("benzerlik Türkçe büyük/küçük harfe takılmıyor", () => {
    /*
      Öğrenci başlığı büyük harfe çevirdiğinde paragraf "silindi + eklendi"
      görünmemeli. tr-TR küçük harf dönüşümü: İ→i, I→ı.
    */
    const fark = diffTexts(
      "GİRİŞ VE ARAŞTIRMANIN AMACI BURADA ANLATILIR",
      "Giriş ve araştırmanın amacı burada anlatılır.",
    );
    assert.equal(fark.stats.changedParagraphs, 1, JSON.stringify(fark.stats));
  });

  await t.test("ortadaki değişiklik baş ve sonu kaydırmıyor", () => {
    const eski = ["A.", "B.", "Orta paragraf burada.", "D.", "E."].join("\n\n");
    const yeni = ["A.", "B.", "Orta paragraf değişti burada.", "D.", "E."].join("\n\n");
    const fark = diffTexts(eski, yeni);
    assert.deepEqual(
      fark.blocks.map((b) => b.kind),
      ["same", "changed", "same"],
    );
    const [bas, , son] = fark.blocks;
    assert.equal(bas.kind === "same" ? bas.count : null, 2);
    assert.equal(son.kind === "same" ? son.count : null, 2);
  });

  await t.test("boş sürümler", () => {
    assert.equal(diffTexts("", "").identical, true);
    assert.equal(diffTexts("", "Yeni metin.").stats.addedParagraphs, 1);
    assert.equal(diffTexts("Eski metin.", "").stats.removedParagraphs, 1);
  });

  await t.test("paragraf sayısı korunuyor", () => {
    // Blokların kapsadığı paragraf sayısı iki sürümde de tutmalı; tutmazsa
    // ekranda paragraf kaybolur ya da iki kez görünür.
    const eski = "A.\n\nB.\n\nC.";
    const yeni = "A.\n\nC.\n\nD.";
    const fark = diffTexts(eski, yeni);
    const eskiSayi = fark.blocks.reduce(
      (t, b) => t + (b.kind === "same" ? b.count : b.kind === "added" ? 0 : 1), 0);
    const yeniSayi = fark.blocks.reduce(
      (t, b) => t + (b.kind === "same" ? b.count : b.kind === "removed" ? 0 : 1), 0);
    assert.equal(eskiSayi, say(eski.replace(/\n\n/g, "\n")));
    assert.equal(yeniSayi, say(yeni.replace(/\n\n/g, "\n")));
  });
});
