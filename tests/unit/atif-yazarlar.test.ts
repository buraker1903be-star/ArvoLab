/*
  Yazar ayrıştırma, stile göre yazar listesi, DOI ve tekrar anahtarı
  (29.10.2026 kaynakça incelemesi). Her senaryo eski davranışı da yazıyor.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { authorLabel, formatReferenceParts, splitAuthors, type CitableSource } from "@/lib/citation-format";
import { doiAyikla as kunyeDoisi, soyadlar } from "@/lib/kanit/kunye-karsilastirma";
import { doiAyikla, kaynakAnahtarlari, kaynakDosyasiOku } from "@/lib/kaynak-aktarim";
import { kunyeAyristir } from "@/lib/atif/kunye";

const kaynak = (authors: string): CitableSource => ({
  title: "Başlık",
  authors,
  year: "2020",
  source_type: "article",
  doi_or_url: null,
  container_title: "Dergi",
  volume: "3",
  issue: "2",
  pages: "1-10",
});
const metin = (k: CitableSource, stil: Parameters<typeof formatReferenceParts>[1], dil: "tr" | "en" = "en") =>
  formatReferenceParts(k, stil, 1, {}, dil).map((p) => p.text).join("");

describe("yazar ayrıştırma", () => {
  test("Türkçe harfli soyadındaki 've' bağlaç sayılmaz", () => {
    // Eskiden \b ASCII olduğu için "Güve" bölünüyor, atıf "(Gü vd.)" oluyordu.
    assert.deepEqual(splitAuthors("Güve, A., & Demir, B."), ["Güve, A.", "Demir, B."]);
    assert.equal(authorLabel(kaynak("Güve, A., & Demir, B."), "tr"), "Güve ve Demir");
  });

  test("küçük harfli önekli soyadı bölmeyi durdurmaz", () => {
    // Eskiden iki yazar sayılıyor, atıf "vd." yerine "Yılmaz ve Kaya" oluyordu.
    assert.deepEqual(splitAuthors("Yılmaz, A., de Souza, A., & Kaya, B."), ["Yılmaz, A.", "de Souza, A.", "Kaya, B."]);
    assert.equal(authorLabel(kaynak("Yılmaz, A., de Souza, A., & Kaya, B."), "tr"), "Yılmaz vd.");
  });

  test("künye karşılaştırması öneki soyadında tutar", () => {
    assert.deepEqual(soyadlar("Yılmaz, A., de Souza, A., and van Dijk, B."), ["Yılmaz", "de Souza", "van Dijk"]);
  });
});

describe("stile göre yazar listesi", () => {
  const k = kaynak("Yılmaz, A., Demir, B. C., & Kaya, D.");

  test("Vancouver: soyad + bitişik baş harfler", () => {
    assert.match(metin(k, "vancouver"), /^1\. Yılmaz A, Demir BC, Kaya D\. Başlık\./);
  });

  test("IEEE: baş harf önce, sıralı virgül İngilizcede", () => {
    assert.match(metin(k, "ieee"), /^\[1\] A\. Yılmaz, B\. C\. Demir, and D\. Kaya, "/);
    assert.match(metin(k, "ieee", "tr"), /^\[1\] A\. Yılmaz, B\. C\. Demir ve D\. Kaya, "/);
  });

  test("Chicago ve MLA ilk yazarı ters, ötekileri düz yazar", () => {
    assert.match(metin(k, "chicago"), /^Yılmaz, A\., B\. C\. Demir, and D\. Kaya\. 2020\./);
    assert.match(metin(k, "mla"), /^Yılmaz, A\., et al\. “Başlık\.”/);
  });

  test("uygulamanın kendi denetimi Vancouver çıktısına yazar uyarısı vermez", () => {
    // Eskiden APA dizesi olduğu gibi basılıyor, denetim dört uyarı veriyordu.
    const sonuc = kunyeAyristir(metin(k, "vancouver"), "vancouver");
    assert.deepEqual(sonuc.authors, ["Yılmaz A", "Demir BC", "Kaya D"]);
    assert.deepEqual(sonuc.issues.filter((i) => i.field === "author_format"), []);
  });

  test("kurum yazarı parçalanmaz", () => {
    assert.match(metin(kaynak("Dünya Sağlık Örgütü"), "vancouver", "tr"), /^1\. Dünya Sağlık Örgütü\. Başlık/);
  });

  test("Türkçe APA kitap bölümü 'İçinde' yazar", () => {
    const bolum = { ...kaynak("Yılmaz, A."), source_type: "chapter" };
    assert.match(metin(bolum, "apa7", "tr"), /Başlık\. İçinde /);
    assert.match(metin(bolum, "apa7", "en"), /Başlık\. In /);
  });
});

describe("DOI ve tekrar", () => {
  const sici = "10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-0";

  test("açılı parantezli eski Wiley DOI'si kesilmez", () => {
    // Eskiden "<"da kesiliyor, dizinde bulunamayıp kalıcı "doğrulanamadı" yazılıyordu.
    assert.equal(kunyeDoisi(sici), sici.toLowerCase());
    assert.deepEqual(doiAyikla(`bkz. ${sici}`), [sici]);
  });

  test("'doi:' önekli DOI bağlantıya dönüşür", () => {
    assert.match(metin({ ...kaynak("Yılmaz, A."), doi_or_url: "doi:10.1000/xyz" }, "apa7"), /https:\/\/doi\.org\/10\.1000\/xyz$/);
  });

  test("tekrar: DOI'siz elle girilmiş kayıt DOI'li aktarımla eşleşir, yüzde kodlu DOI çıplakla aynıdır", () => {
    const elle = kaynakAnahtarlari({ title: "Öz Yeterlik", year: "2020", doiOrUrl: null });
    const aktarilan = kaynakAnahtarlari({ title: "Öz yeterlik", year: "2020", doiOrUrl: "10.1000/ABC" });
    assert.ok(aktarilan.some((a) => elle.includes(a)));
    assert.deepEqual(
      kaynakAnahtarlari({ title: "", year: null, doiOrUrl: "https://doi.org/10.1000%2Fabc" })[0],
      kaynakAnahtarlari({ title: "", year: null, doiOrUrl: "doi:10.1000/ABC" })[0],
    );
  });

  test("BibTeX 'and others' yazar sayılmaz", () => {
    // Eskiden "Yılmaz, A., Demir, B., & others" kaydediliyordu.
    const { kayitlar } = kaynakDosyasiOku("a.bib", "@article{x, author={Yılmaz, Ahmet and Demir, B. and others}, title={T}, year={2020}}");
    assert.equal(kayitlar[0].authors, "Yılmaz, A., & Demir, B.");
  });
});
