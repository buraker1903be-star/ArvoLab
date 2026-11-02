import assert from "node:assert/strict";
import test from "node:test";
import { dipnotNotu, formatInTextCitation, formatReferenceParts, type CitableSource } from "@/lib/citation-format";
import { dipnotAtiflari, metindekiDipnotlar, oncedenAtifYapildi } from "@/lib/atif/dipnot";
import { kunyeAyristir } from "@/lib/atif/kunye";
import { crossCheck } from "@/lib/apa7";
import { STIL_SECENEKLERI, stilTanimi, yilaBakilir } from "@/lib/atif/stiller";
import { atifYontemleri, yontemdenSistem } from "@/lib/atif-sistemi";
import { formaDoldur } from "@/lib/kilavuz-dogrulama";
import { metinListeTutarsizliklari } from "@/lib/calisma-tutarlilik";

/*
  Dipnotlu atıf (klasik yöntem, 02.11.2026). Örnekler DEÜ Sosyal Bilimler
  kılavuzunun kendi örnekleri (1.5.1 Dipnot Yöntemi, 2.3.1.1 Klasik Yöntem).
*/

const kitap: CitableSource = {
  title: "Tarih İçinde İzmir",
  authors: "Atay, M. Çınar",
  year: "1978",
  source_type: "book",
  doi_or_url: null,
  publisher: "Yaşar Eğitim ve Kültür Vakfı Yayını",
};
const makale: CitableSource = {
  title: "Liderlik Tipleri Açısından İşçi Sendikası Yöneticileri Üzerine Bir Araştırma",
  authors: "Demirbilek, Tunç",
  year: "2003",
  source_type: "article",
  doi_or_url: null,
  container_title: "D.E.Ü. Sosyal Bilimler Enstitüsü Dergisi",
  volume: "5",
  issue: "1",
  pages: "22-37",
};
const ikiYazarli: CitableSource = {
  title: "Devletler Hususi Hukuku",
  authors: "Nomer, Ergin; Şanlı, Cemal",
  year: "2008",
  source_type: "book",
  doi_or_url: null,
  publisher: "Beta Basım",
};
const cokYazarli: CitableSource = {
  title: "İnsan Hakları El Kitabı",
  authors: "Tezcan, Durmuş; Erdem, Mustafa Ruhan; Sancakdar, Oğuz",
  year: "2006",
  source_type: "book",
  doi_or_url: null,
  publisher: "Seçkin Yayıncılık",
};

test("stil listede ve türü dipnot", () => {
  assert.ok(STIL_SECENEKLERI.some((s) => s.deger === "dipnot"));
  const stil = stilTanimi("dipnot");
  assert.equal(stil.tur, "dipnot");
  // Kısa biçimde yıl yok: eşleşme yalnızca yazara bakmalı.
  assert.equal(yilaBakilir(stil), false);
});

test("ilk dipnot tam bilgiyle, sonrakiler kısa", () => {
  assert.equal(
    dipnotNotu(kitap, { sayfa: "51" }),
    "M. Çınar Atay, Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, 1978, s. 51.",
  );
  assert.equal(
    dipnotNotu(makale, { sayfa: "25" }),
    "Tunç Demirbilek, “Liderlik Tipleri Açısından İşçi Sendikası Yöneticileri Üzerine Bir Araştırma”, D.E.Ü. Sosyal Bilimler Enstitüsü Dergisi, Cilt: 5, Sayı: 1, 2003, s. 25.",
  );
  assert.equal(dipnotNotu(kitap, { sayfa: "55", kisa: true }), "Atay, s. 55.");
  assert.equal(dipnotNotu(kitap, { sayfa: "50-55", kisa: true }), "Atay, ss. 50-55.");
  assert.equal(dipnotNotu(ikiYazarli, { sayfa: "10", kisa: true }), "Nomer ve Şanlı, s. 10.");
  assert.equal(dipnotNotu(cokYazarli, { sayfa: "11", kisa: true }), "Tezcan ve diğerleri, s. 11.");
  assert.match(dipnotNotu(cokYazarli, { sayfa: "10" }), /^Durmuş Tezcan ve diğerleri, İnsan Hakları El Kitabı/);
  // Sayfa uydurulmaz: yazılmadıysa atıfta yok.
  assert.equal(dipnotNotu(kitap), "M. Çınar Atay, Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, 1978.");
  // Atıf penceresinin önizlemesi ilk atfın tam biçimi.
  assert.equal(formatInTextCitation(kitap, "dipnot", 1, { sayfa: "51" }), dipnotNotu(kitap, { sayfa: "51" }));
  // İngilizce tez: kısaltmalar tezin dilinde.
  assert.match(dipnotNotu(makale, { sayfa: "25" }, "en"), /Vol\.: 5, No\.: 1, 2003, p\. 25\.$/);
});

test("kaynakça klasik yöntemle ve kendi ayrıştırıcısından sorunsuz geçiyor", () => {
  const metin = (k: CitableSource) => formatReferenceParts(k, "dipnot", 1).map((p) => p.text).join("");
  assert.equal(metin(kitap), "Atay, M. Çınar. Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, 1978.");
  assert.equal(
    metin(makale),
    "Demirbilek, Tunç. “Liderlik Tipleri Açısından İşçi Sendikası Yöneticileri Üzerine Bir Araştırma”, D.E.Ü. Sosyal Bilimler Enstitüsü Dergisi, Cilt: 5, Sayı: 1, 2003, ss. 22-37.",
  );
  assert.equal(metin(cokYazarli), "Tezcan, Durmuş, Mustafa Ruhan Erdem ve Oğuz Sancakdar. İnsan Hakları El Kitabı, Seçkin Yayıncılık, 2006.");
  // Uygulamanın ürettiği künyeye kendi denetimi hata basmamalı.
  for (const k of [kitap, makale, ikiYazarli, cokYazarli]) {
    const ayrik = kunyeAyristir(metin(k), "dipnot");
    assert.deepEqual(ayrik.issues, [], `${metin(k)} → ${JSON.stringify(ayrik.issues)}`);
  }
});

test("kılavuzun kendi kaynakça örnekleri okunuyor", () => {
  const cetiner = kunyeAyristir("Çetiner, Ertuğrul. Konaklama Yönetim Muhasebesi, Güney Grafik, Ankara, 1989.", "dipnot");
  assert.deepEqual(cetiner.authors, ["Çetiner, Ertuğrul"]);
  assert.equal(cetiner.year, "1989");
  assert.equal(cetiner.title, "Konaklama Yönetim Muhasebesi");
  assert.deepEqual(cetiner.issues, []);

  const tezcan = kunyeAyristir(
    "Tezcan, Durmuş, Mustafa Ruhan Erdem, Oğuz Sancakdar ve Rıfat Murat Önok. İnsan Hakları El Kitabı, Seçkin Yayıncılık, Ankara, 2006.",
    "dipnot",
  );
  // Eskiden "Tezcan, Durmuş, Mustafa Ruhan Erdem" tek yazar sayılıp biçim uyarısı alırdı.
  assert.deepEqual(tezcan.authors, ["Tezcan, Durmuş", "Mustafa Ruhan Erdem", "Oğuz Sancakdar", "Rıfat Murat Önok"]);
  assert.deepEqual(tezcan.issues, []);

  const demirbilek = kunyeAyristir(
    "Demirbilek, Tunç. “Liderlik Tipleri Açısından İşçi Sendikası Yöneticileri Üzerine Bir Araştırma”, D.E.Ü. Sosyal Bilimler Enstitüsü Dergisi, Cilt:5, Sayı:1, 2003, ss. 22-37.",
    "dipnot",
  );
  assert.equal(demirbilek.title, "Liderlik Tipleri Açısından İşçi Sendikası Yöneticileri Üzerine Bir Araştırma");
  assert.equal(demirbilek.year, "2003");

  // Yıl yoksa hata (yıl sonda olmalı).
  assert.ok(kunyeAyristir("Yılmaz, Ahmet. Kitap, Yayınevi.", "dipnot").issues.some((i) => i.field === "year"));
});

test("dipnotlardan atıf okunuyor (kılavuzun dipnot örnekleri)", () => {
  const atiflar = dipnotAtiflari([
    "M. Çınar Atay, Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, İzmir, 1978, s. 51.",
    "Atay, s. 55.",
    "Ergin Nomer ve Cemal Şanlı, Devletler Hususi Hukuku, 16. Baskı, Beta Basım, İstanbul, 2008, 227.",
    "Tezcan ve diğerleri, s. 11.",
    "Ahmet Livaneli, Hukuk Devleti, Akademi Yayınları, İstanbul, 2003, s.40’dan aktaran Mehmet Altan, Piyasa ve Devlet, Bilim Yayınları, İstanbul, 2006, s.99.",
    "Bu konuda farklı görüşler için bkz. Atay, ss. 50-55.",
    // Açıklama dipnotu: atıf değil.
    "Burada kastedilen, kentin 19. yüzyıldaki liman bölgesidir.",
    // Yazarsız kaynak başlıkla başlar: eşleşmede kullanılır ama raporlanmaz.
    "“Avrupa’da Dil Öğrenimi”, Avrupa Dergisi, Aralık 1978, ss.15-16.",
  ]);
  assert.deepEqual(
    atiflar.map((a) => [a.authorKey, a.kind]),
    [
      ["m. çınar atay", "parenthetical"],
      ["atay", "parenthetical"],
      ["ergin nomer", "parenthetical"],
      ["tezcan", "parenthetical"],
      ["ahmet livaneli", "parenthetical"],
      ["mehmet altan", "parenthetical"],
      ["atay", "parenthetical"],
    ],
  );
});

test("dipnot atıfları kaynakçayla eşleşiyor; karşılıksız ve atıfsız raporlanıyor", () => {
  const kaynakca = [
    "Atay, M. Çınar. Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, İzmir, 1978.",
    "Nomer, Ergin ve Cemal Şanlı. Devletler Hususi Hukuku, Beta Basım, İstanbul, 2008.",
    "Çetiner, Ertuğrul. Konaklama Yönetim Muhasebesi, Güney Grafik, Ankara, 1989.",
  ].map((k) => kunyeAyristir(k, "dipnot"));
  const atiflar = dipnotAtiflari(["M. Çınar Atay, Tarih İçinde İzmir, 1978, s. 51.", "Nomer ve Şanlı, s. 10.", "Akıncı, CMR, s. 101."]);
  const sonuc = crossCheck(atiflar, kaynakca, { yilaBak: false });
  assert.deepEqual(sonuc.citationsWithoutReference.map((a) => a.authorKey), ["akıncı"]);
  assert.deepEqual(sonuc.referencesWithoutCitation.map((r) => r.authors?.[0]), ["Çetiner, Ertuğrul"]);
});

test("yapıştırılan metinde yalnızca numarayla başlayan satırlar dipnot", () => {
  const metin = "Kent 1978 yılında büyüdü.\n1 M. Çınar Atay, Tarih İçinde İzmir, 1978, s. 51.\n2 Atay, s. 55.";
  assert.deepEqual(metindekiDipnotlar(metin), ["1 M. Çınar Atay, Tarih İçinde İzmir, 1978, s. 51.", "2 Atay, s. 55."]);
  assert.deepEqual(dipnotAtiflari(metindekiDipnotlar(metin)).map((a) => a.authorKey), ["m. çınar atay", "atay"]);
});

test("ilk atıf yapılmış mı", () => {
  assert.equal(oncedenAtifYapildi(kitap.title, []), false);
  assert.equal(oncedenAtifYapildi(kitap.title, [dipnotNotu(kitap, { sayfa: "51" })]), true);
  assert.equal(oncedenAtifYapildi(kitap.title, ["Başka bir eser, 2001, s. 3."]), false);
});

test("kılavuz yalnızca dipnot yöntemini anlatıyorsa stil dipnot", () => {
  assert.equal(yontemdenSistem(atifYontemleri("Tezlerde dipnot yöntemi kullanılır.")), "dipnot");
  // İkisine de izin veren kılavuzda (DEÜ SBE) seçim öğrencinin.
  assert.equal(yontemdenSistem(atifYontemleri("dipnot yöntemi ve metin içi yöntem kullanılabilir")), null);
  // Açıklama dipnotundan söz etmek yöntem değil.
  assert.equal(yontemdenSistem(atifYontemleri("Açıklamalar dipnot olarak verilebilir.")), null);
});

test("onay formu tarayıcının stil KİMLİĞİNİ alıyor", () => {
  // Eskiden görünen ad ("APA 7") geçiyordu ve form stili hiç önceden seçmiyordu.
  assert.equal(formaDoldur({ citationStyle: "dipnot" }).atifStili, "dipnot");
  assert.equal(formaDoldur({ citationStyle: "APA 7" }).atifStili, "");
});

test("çalışma tutarlılığı dipnotlu stilde yanlış alarm vermiyor", () => {
  // Düz metin dipnotları taşımıyor; eskiden her "kullanıldı" kaynağı atıfsız görünürdü.
  const uzun = "Kent tarihi üzerine yapılan çalışmalar çoğaldı. ".repeat(10);
  const kaynak = { title: kitap.title, authors: kitap.authors, year: kitap.year, status: "used" };
  assert.deepEqual(metinListeTutarsizliklari(uzun, [kaynak] as never, "dipnot"), []);
});

test("basım yeri: dipnotta ve klasik kaynakçada yayınevinden sonra; yoksa yazılmıyor", () => {
  const yerli = { ...kitap, publication_place: "İzmir" };
  assert.equal(
    dipnotNotu(yerli, { sayfa: "51" }),
    "M. Çınar Atay, Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, İzmir, 1978, s. 51.",
  );
  const kunye = formatReferenceParts(yerli, "dipnot", 1).map((p) => p.text).join("");
  assert.equal(kunye, "Atay, M. Çınar. Tarih İçinde İzmir, Yaşar Eğitim ve Kültür Vakfı Yayını, İzmir, 1978.");
  assert.deepEqual(kunyeAyristir(kunye, "dipnot").issues, []);
  // Chicago ve Harvard: "Yer: Yayınevi".
  assert.match(formatReferenceParts(yerli, "chicago", 1).map((p) => p.text).join(""), /İzmir: Yaşar Eğitim/);
  assert.match(formatReferenceParts(yerli, "harvard", 1).map((p) => p.text).join(""), /İzmir: Yaşar Eğitim/);
  // APA 7 basım yeri istemiyor; değişmemeli.
  assert.doesNotMatch(formatReferenceParts(yerli, "apa7", 1).map((p) => p.text).join(""), /İzmir:/);
});
