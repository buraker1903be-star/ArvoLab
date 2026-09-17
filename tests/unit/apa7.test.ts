import assert from "node:assert/strict";
import test from "node:test";
import {
  computeComplianceScore,
  crossCheck,
  extractInTextCitations,
  parseReferenceEntry,
  parseReferenceList,
} from "@/lib/apa7";

test("APA kaynakça girdisi ayrıştırılır", () => {
  const ref = parseReferenceEntry("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  assert.equal(ref.year, "2020");
  assert.ok(ref.authors && ref.authors.length > 0);
  assert.ok(ref.title);
});

test("tarihsiz kaynaklar: n.d. ve t.y.", () => {
  assert.equal(parseReferenceEntry("Yılmaz, A. (n.d.). Başlık. Yayınevi.").year, "n.d.");
  assert.equal(parseReferenceEntry("Yılmaz, A. (t.y.). Başlık. Yayınevi.").year, "t.y.");
});

test("aynı yılın farklı kaynakları (2020a, 2020b)", () => {
  assert.equal(parseReferenceEntry("Yılmaz, A. (2020a). Birinci. Yayınevi.").year, "2020a");
  assert.equal(parseReferenceEntry("Yılmaz, A. (2020b). İkinci. Yayınevi.").year, "2020b");
});

test("yılı olmayan girdi sorun olarak işaretlenir", () => {
  const ref = parseReferenceEntry("Yılmaz, A. Akademik yazım. Ankara Yayınları.");
  assert.equal(ref.year, null);
  assert.ok(ref.issues.length > 0, "en az bir sorun bildirilmeli");
});

test("kaynakça listesi satırlara bölünür, boşlar atılır", () => {
  const liste = parseReferenceList(
    "Yılmaz, A. (2020). Bir. Yayınevi.\n\n  \nDemir, B. (2019). İki. Yayınevi.\n",
  );
  assert.equal(liste.length, 2);
  assert.equal(liste[0].year, "2020");
  assert.equal(liste[1].year, "2019");
});

test("parantez içi ve anlatı atıfları ayrılır", () => {
  const atiflar = extractInTextCitations("Bu konu incelenmiştir (Yılmaz, 2020). Demir (2019) farklı bulmuştur.");
  const parantez = atiflar.filter((a) => a.kind === "parenthetical");
  const anlati = atiflar.filter((a) => a.kind === "narrative");
  assert.equal(parantez.length, 1);
  assert.equal(anlati.length, 1);
  assert.equal(parantez[0].year, "2020");
  assert.equal(anlati[0].year, "2019");
});

test("noktalı virgülle ayrılmış çoklu atıf", () => {
  const atiflar = extractInTextCitations("Birçok çalışma (Yılmaz, 2020; Demir, 2019) bunu gösterir.");
  assert.equal(atiflar.length, 2);
  assert.deepEqual(atiflar.map((a) => a.year).sort(), ["2019", "2020"]);
});

test("aynı yazarın birden çok yılı", () => {
  const atiflar = extractInTextCitations("Önceki çalışmalar (Yılmaz, 2018, 2020) bunu destekler.");
  assert.deepEqual(atiflar.map((a) => a.year).sort(), ["2018", "2020"]);
});

test("rakam içeren parantezler atıf sayılmaz", () => {
  // "Tablo 3", "COVID-19" gibi ifadeler yanlış alarm üretmemeli.
  for (const metin of ["Sonuçlar tabloda verilmiştir (Tablo 3, 2020).", "Salgın (COVID-19, 2020) etkiledi."]) {
    assert.equal(extractInTextCitations(metin).length, 0, metin);
  }
});

test("çapraz kontrol: eşleşen atıf ve kaynak sorun üretmez", () => {
  const refs = parseReferenceList("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  const atiflar = extractInTextCitations("Bu konu incelenmiştir (Yılmaz, 2020).");
  const sonuc = crossCheck(atiflar, refs);
  assert.equal(sonuc.citationsWithoutReference.length, 0);
  assert.equal(sonuc.referencesWithoutCitation.length, 0);
});

test("kaynakçada olmayan atıf yakalanır", () => {
  const refs = parseReferenceList("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  const atiflar = extractInTextCitations("Farklı bir kaynak (Demir, 2019) belirtmiştir.");
  const sonuc = crossCheck(atiflar, refs);
  assert.equal(sonuc.citationsWithoutReference.length, 1);
  assert.equal(sonuc.referencesWithoutCitation.length, 1, "Yılmaz de atıfsız kalır");
});

test("yıl uyuşmazlığı yakalanır", () => {
  const refs = parseReferenceList("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  const sonuc = crossCheck(extractInTextCitations("(Yılmaz, 2019) demiştir."), refs);
  assert.equal(sonuc.citationsWithoutReference.length, 1);
});

test("aynı karşılıksız atıf iki kez raporlanmaz", () => {
  const sonuc = crossCheck(
    extractInTextCitations("(Demir, 2019) ve yine (Demir, 2019) belirtmiştir."),
    [],
  );
  assert.equal(sonuc.citationsWithoutReference.length, 1);
});

test("karşılıksız atıf yalnızca parantez içi biçimde raporlanır", () => {
  // "Türkiye (2020)" gibi anlatıya benzeyen her ifade atıf değildir;
  // yanlış alarm olmasın diye anlatı biçimi bu listeye girmez.
  const sonuc = crossCheck(extractInTextCitations("Türkiye (2020) yılında büyümüştür."), []);
  assert.equal(sonuc.citationsWithoutReference.length, 0);
});

test("uyum skoru: temiz çalışma 100", () => {
  const refs = parseReferenceList("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  const atiflar = extractInTextCitations("(Yılmaz, 2020) demiştir.");
  assert.equal(computeComplianceScore(refs, crossCheck(atiflar, refs)), 100);
});

test("uyum skoru: kaynak yoksa 0", () => {
  assert.equal(computeComplianceScore([], { citationsWithoutReference: [], referencesWithoutCitation: [] }), 0);
});

test("uyum skoru hiç negatife düşmez", () => {
  const refs = parseReferenceList(
    Array.from({ length: 40 }, (_, i) => `Bozuk kaynak ${i} hiçbir alanı yok`).join("\n"),
  );
  const skor = computeComplianceScore(refs, {
    citationsWithoutReference: [],
    referencesWithoutCitation: refs,
  });
  assert.ok(skor >= 0 && skor <= 100, `skor=${skor}`);
});

test("her uyuşmazlık skoru düşürür", () => {
  const refs = parseReferenceList("Yılmaz, A. (2020). Akademik yazım. Ankara Yayınları.");
  const temiz = computeComplianceScore(refs, { citationsWithoutReference: [], referencesWithoutCitation: [] });
  const eksik = computeComplianceScore(refs, { citationsWithoutReference: [], referencesWithoutCitation: refs });
  assert.ok(eksik < temiz, `${eksik} < ${temiz} olmalı`);
});
