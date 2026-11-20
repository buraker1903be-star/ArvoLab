import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { crossrefKayitlari, kayitlariBirlestir, openAlexKayitlari } from "@/lib/literatur-arama";
import { formatInTextCitation, formatReferenceParts, splitAuthors, stilYazarlari } from "@/lib/citation-format";
import { cslYazarlari, cslOgesi } from "@/lib/atif/csl";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";
import { formatAuthors, parseCrossrefWork } from "@/lib/doi";
import { kaynakcaOzeti } from "@/lib/kaynakca-ozeti";
import { parseReferenceEntry } from "@/lib/apa7";

/*
  Canlı testte (20.11.2026) Makale Bul'dan eklenen iki yazarlı kaynak
  "(Edward W. Fisher, 2023)" atfı üretti, dergi adında "&amp;" göründü ve
  yazar uyarısı varken "APA 7 uyum 100/100" yazdı. Bu dosya üçünü sabitler.
*/
const crossref = (author: unknown[], ek: Record<string, unknown> = {}) =>
  crossrefKayitlari({
    message: {
      items: [{ DOI: "10.5555/x", title: ["Seasonal patterns"], author, "container-title": ["Journal of Science &amp; Society"], issued: { "date-parts": [[2023]] }, type: "journal-article", ...ek }],
    },
  })[0];

describe("yapılandırılmış yazar korunur", () => {
  test("Crossref given/family → künye dizesi, atıf iki soyadıyla", () => {
    const k = crossref([{ given: "Edward W.", family: "Fisher" }, { given: "Jane", family: "Other" }]);
    assert.equal(k.kunyeYazarlari, "Fisher, E. W., & Other, J.");
    assert.deepEqual(k.yazarlar, ["Edward W. Fisher", "Jane Other"]);
    assert.deepEqual(splitAuthors(k.kunyeYazarlari), ["Fisher, E. W.", "Other, J."]);
    const kaynak = { title: "x", authors: k.kunyeYazarlari, year: "2023", source_type: "article", doi_or_url: null };
    assert.equal(formatInTextCitation(kaynak, "apa7", 1), "(Fisher ve Other, 2023)");
    assert.equal(formatInTextCitation(kaynak, "apa7", 1, {}, "en"), "(Fisher & Other, 2023)");
  });

  test("çok parçalı soyadı, kurum ve tek adlı yazar bozulmaz", () => {
    const k = crossref([
      { given: "Jan", family: "van der Berg" },
      { name: "World Health Organization" },
      { family: "Plato" },
      { given: "Madonna" },
    ]);
    // Virgülsüz ad varken ayırıcı "; ": APA dizisinde kurum adı öncekiyle birleşiyordu.
    assert.equal(k.kunyeYazarlari, "van der Berg, J.; World Health Organization; Plato; Madonna");
    assert.deepEqual(cslYazarlari(k.kunyeYazarlari), [
      { family: "van der Berg", given: "J." },
      { literal: "World Health Organization" },
      { literal: "Plato" },
      { literal: "Madonna" },
    ]);
    assert.equal(stilYazarlari(k.kunyeYazarlari, "apa7"), "van der Berg, J., World Health Organization, Plato, & Madonna");
  });

  test("OpenAlex yalnızca görünen ad veriyor: künye dizesi kurulmaz (soyadı tahmin edilmez)", () => {
    const [k] = openAlexKayitlari({ results: [{ id: "W1", title: "T", publication_year: 2020, authorships: [{ author: { display_name: "José Ortega y Gasset" } }] }] });
    assert.equal(k.kunyeYazarlari, null);
    assert.deepEqual(k.yazarlar, ["José Ortega y Gasset"]);
  });

  test("birleştirmede Crossref'in yapılandırılmış adı OpenAlex kopyasına geçer", () => {
    const oa = openAlexKayitlari({ results: [{ id: "W1", title: "Seasonal patterns", doi: "https://doi.org/10.5555/x", publication_year: 2023, authorships: [{ author: { display_name: "Edward W. Fisher" } }] }] });
    const cr = [crossref([{ given: "Edward W.", family: "Fisher" }])];
    const [birlesik] = kayitlariBirlestir([oa, cr]);
    assert.equal(birlesik.kunyeYazarlari, "Fisher, E. W.");
  });

  test("eski biçim (\"Ad Soyad, Ad Soyad\") tek yazar sayılıyordu — hatanın kendisi", () => {
    assert.deepEqual(splitAuthors("Edward W. Fisher, Jane Other"), ["Edward W. Fisher, Jane Other"]);
    // "; " ile ve ters çevrilmeden saklanan geri dönüş biçimi iki yazara bölünür.
    assert.deepEqual(splitAuthors("Edward W. Fisher; Jane Other"), ["Edward W. Fisher", "Jane Other"]);
  });
});

describe("HTML varlıkları", () => {
  test("tek, çift ve sayısal kodlama çözülür; etiketler atılır; karşılaştırma işaretleri kalır", () => {
    assert.equal(htmlVarliklariniCoz("Science &amp; Society"), "Science & Society");
    assert.equal(htmlVarliklariniCoz("Science &amp;amp; Society"), "Science & Society");
    assert.equal(htmlVarliklariniCoz("A &#38; B &#x26; C"), "A & B & C");
    assert.equal(htmlVarliklariniCoz("<i>E. coli</i> growth"), "E. coli growth");
    assert.equal(htmlVarliklariniCoz("&lt;i&gt;E. coli&lt;/i&gt;"), "E. coli");
    assert.equal(htmlVarliklariniCoz("p < 0.05 and a<b"), "p < 0.05 and a<b");
    assert.equal(htmlVarliklariniCoz("&bilinmeyen; kalır"), "&bilinmeyen; kalır");
  });

  test("arama sonucu ve DOI künyesi dergi adını çözülmüş verir", () => {
    assert.equal(crossref([{ given: "A", family: "B" }]).dergi, "Journal of Science & Society");
    const meta = parseCrossrefWork({ title: ["T &amp;amp; U"], "container-title": ["J &amp;amp; K"] } as never, "10.1/x");
    assert.equal(meta?.title, "T & U");
    assert.equal(meta?.containerTitle, "J & K");
  });

  test("eski kayıttaki &amp; künyeye ve CSL öğesine çözülmüş girer", () => {
    const eski = { title: "Seasonal &amp; regional", authors: "Fisher, E. W.", year: "2023", source_type: "article", doi_or_url: null, container_title: "Journal of Science &amp; Society" };
    const metin = formatReferenceParts(eski, "apa7", 1).map((p) => p.text).join("");
    assert.ok(!metin.includes("&amp;"), metin);
    assert.ok(metin.includes("Journal of Science & Society"), metin);
    assert.equal(cslOgesi(eski)["container-title"], "Journal of Science & Society");
  });

  test("formatAuthors yalnızca given'ı olan yazarı düşürmez", () => {
    assert.equal(formatAuthors([{ given: "Madonna" }]), "Madonna");
  });
});

describe("kaynakça özeti: uyarı varken \"sorunsuz\" denmez", () => {
  test("yazar biçimi uyarısı açık sorun sayılır; ton yeşil değil", () => {
    const ref = parseReferenceEntry("Edward W. Fisher, Jane Other (2023). Seasonal patterns. Journal of Science & Society.");
    assert.ok(ref.issues.some((i) => i.severity === "warning"));
    const ozet = kaynakcaOzeti({ references: [ref], crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [] } });
    assert.equal(ozet.bicimUyarili, 1);
    assert.equal(ozet.acikSorun, 1);
    assert.equal(ozet.ton, "warning");
  });

  test("hata ve karşılıksız atıf kırmızı; temiz liste yeşil", () => {
    const temiz = { issues: [] };
    const hatali = { issues: [{ severity: "error" }] };
    const bos = { referencesWithoutCitation: [], citationsWithoutReference: [] };
    assert.equal(kaynakcaOzeti({ references: [temiz], crossCheck: bos }).ton, "success");
    assert.equal(kaynakcaOzeti({ references: [hatali], crossCheck: bos }).ton, "danger");
    assert.equal(kaynakcaOzeti({ references: [temiz], crossCheck: { referencesWithoutCitation: [], citationsWithoutReference: [{}] } }).ton, "danger");
    const dizin = kaynakcaOzeti({ references: [temiz, temiz], crossCheck: bos, verificationSummary: { notFound: 1, unreachable: 1 }, dogrulananSayisi: 2 });
    assert.deepEqual([dizin.acikSorun, dizin.ulasilamayan, dizin.dizindeBakilan, dizin.ton], [1, 1, 2, "warning"]);
  });
});
