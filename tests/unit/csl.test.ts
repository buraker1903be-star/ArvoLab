import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cslCoz, cslGorunenAd, ustSimge, ustSimgedenRakam } from "@/lib/atif/csl-kimlik";
import { atifCikarmaStili, stilAdi, stilTanimi } from "@/lib/atif/stiller";
import { cslAra, cslBul } from "@/lib/atif/csl-dizin";
import { cslBicimle, cslKaynakcaBicimle, cslOgesi, ebeveynStil, htmldenParcalar, numarayiYaz } from "@/lib/atif/csl";
import { kunyeAyristir } from "@/lib/atif/kunye";
import { checkStructure } from "@/lib/structure-check";
import YEREL from "@/lib/atif/csl-yerel.json";

/*
  CSL atıf stilleri (03.11.2026). Gerçek stil dosyaları
  tests/fixtures/csl/ altında: biçimleme citeproc'un kendisiyle sınanıyor,
  taklitle değil.
*/
const yerel = (dil: string) => (YEREL as Record<string, string>)[dil] ?? false;
const stil = (ad: string) => fs.readFileSync(`tests/fixtures/csl/${ad}.csl`, "utf8");
const KAYNAK = {
  title: "Enflasyon ve işsizlik ilişkisi",
  authors: "Yılmaz, Ahmet; Demir, B. C.; Kaya, D.",
  year: "2020",
  source_type: "article",
  doi_or_url: "https://doi.org/10.1234/abc.5",
  container_title: "İktisat Dergisi",
  volume: "12",
  issue: "3",
  pages: "45-67",
};
const duz = (parcalar: { text: string }[]) => parcalar.map((p) => p.text).join("");

test("kimlik: desen, çözme, görünen ad", () => {
  assert.deepEqual(cslCoz("csl:s:american-medical-association"), { kod: "s", ad: "american-medical-association" });
  for (const yanlis of ["csl:x:apa", "csl:a:APA", "csl:a:", "apa7", null, "csl:a:a b"]) assert.equal(cslCoz(yanlis), null, String(yanlis));
  assert.equal(cslGorunenAd("csl:a:elsevier-harvard"), "Elsevier Harvard");
  assert.equal(cslGorunenAd("csl:k:ieee"), "IEEE");
  assert.equal(ustSimgedenRakam(ustSimge("1,3-5")), "1,3–5");
});

test("dizin: arama, bağımlı stil ve kodun dizinle tutarlılığı", () => {
  const nature = cslAra("nature genetics");
  assert.equal(nature[0]?.deger, "csl:s:nature-genetics");
  assert.equal(cslAra("ama manual")[0]?.deger, "csl:s:american-medical-association");
  assert.equal(cslAra("ieee")[0]?.deger, "csl:k:ieee");
  assert.ok(cslBul("apa", "a"));
  // Elle yazılmış ama kodu yanlış kimlik tanınmaz: denetçi atfı yanlış biçimde arardı.
  assert.equal(cslBul("apa", "k"), null);
  assert.equal(cslAra("x").length <= 30, true);
  assert.equal(ebeveynStil(stil("nature-genetics")), "nature");
});

test("stil tanımı: CSL kimliği aileye iner, yazar biçimi denetlenmez", () => {
  const ama = stilTanimi("csl:s:american-medical-association");
  assert.equal(ama.id, "csl:s:american-medical-association");
  assert.equal(ama.tur, "numara");
  assert.equal(ama.yazarBicimi, null);
  assert.equal(ama.numara?.ustSimge, true);
  assert.equal(stilTanimi("csl:a:elsevier-harvard").tur, "yazar-tarih");
  assert.equal(stilTanimi("csl:d:chicago-notes-bibliography-16th-edition").tur, "dipnot");
  assert.equal(atifCikarmaStili(stilTanimi("csl:a:apa")), "chicago");
  assert.equal(atifCikarmaStili(stilTanimi("csl:y:modern-language-association")), "mla");
  assert.equal(stilAdi("csl:a:elsevier-harvard"), "Elsevier Harvard");
  // Yerleşik stiller değişmedi.
  assert.equal(stilTanimi("apa7").id, "apa7");
  assert.equal(stilTanimi("bilinmeyen").id, "apa7");
});

test("biçimleme: yazar-tarih, numaralı, üst simge, dipnot", () => {
  const apa = cslBicimle({ stilXml: stil("apa"), yerel, kod: "a", kaynak: KAYNAK, numara: 1, sayfa: "50", dil: "tr" });
  assert.equal(duz(apa.atif), "(Yılmaz vd., 2020, s. 50)");
  assert.match(duz(apa.kunye), /^Yılmaz, A\., Demir, B\. C\., & Kaya, D\. \(2020\)\. Enflasyon ve işsizlik ilişkisi\. İktisat Dergisi, 12\(3\), 45-67\. https:\/\/doi\.org\/10\.1234\/abc\.5$/);
  assert.deepEqual(apa.kunye.find((p) => p.italic), { text: "İktisat Dergisi", italic: true });

  const ieee = cslBicimle({ stilXml: stil("ieee"), yerel, kod: "k", kaynak: KAYNAK, numara: 7, dil: "en" });
  assert.equal(duz(ieee.atif), "[7]");
  assert.match(duz(ieee.kunye), /^\[7\] A\. Yılmaz, B\. C\. Demir, and D\. Kaya, “Enflasyon/);

  const ama = cslBicimle({ stilXml: stil("american-medical-association"), yerel, kod: "s", kaynak: KAYNAK, numara: 12, sayfa: "50", dil: "en" });
  assert.equal(duz(ama.atif), "¹²⁽ᵖ⁵⁰⁾");
  assert.match(duz(ama.kunye), /^12\. Yılmaz A, Demir BC, Kaya D\./);

  const chicago = stil("chicago-notes-bibliography-16th-edition");
  const ilk = cslBicimle({ stilXml: chicago, yerel, kod: "d", kaynak: KAYNAK, numara: 1, sayfa: "50", dil: "tr" });
  const kisa = cslBicimle({ stilXml: chicago, yerel, kod: "d", kaynak: KAYNAK, numara: 1, sayfa: "52", dil: "tr", kisa: true });
  assert.match(duz(ilk.atif), /^Ahmet Yılmaz, B\. C\. Demir, ve D\. Kaya, “Enflasyon/);
  assert.ok(duz(kisa.atif).length < duz(ilk.atif).length / 2, duz(kisa.atif));
});

test("kaynakça: yazar-tarih stilinde alfabetik", () => {
  const satirlar = cslKaynakcaBicimle({
    stilXml: stil("elsevier-harvard"),
    yerel,
    dil: "tr",
    kaynaklar: [
      { ...KAYNAK, authors: "Zengin, C.", title: "Z" },
      { ...KAYNAK, authors: "Akın, B.", title: "A" },
    ],
  });
  assert.deepEqual(satirlar.map((s) => duz(s).slice(0, 5)), ["Akın,", "Zengi"]);
});

test("HTML → parçalar ve numara", () => {
  assert.deepEqual(htmldenParcalar('<div class="csl-entry">A &amp; B, <i>Dergi</i>. <span style="font-style:italic;">X</span></div>'), [
    { text: "A & B, " },
    { text: "Dergi", italic: true },
    { text: ". " },
    { text: "X", italic: true },
  ]);
  assert.deepEqual(htmldenParcalar('<div class="csl-left-margin">1.</div><div class="csl-right-inline">Yılmaz</div>'), [{ text: "1. Yılmaz" }]);
  // Sayfadaki "1" değil, numara değişir.
  assert.deepEqual(numarayiYaz([{ text: "[1, p. 1]" }], 4, false), [{ text: "[4, p. 1]" }]);
  assert.deepEqual(numarayiYaz([{ text: "¹" }], 23, true), [{ text: "²³" }]);
});

test("CSL-JSON: kurum adı parçalanmaz, DOI ayrılır, yıl okunur", () => {
  const oge = cslOgesi({ ...KAYNAK, authors: "Türkiye İstatistik Kurumu; Yılmaz, A." });
  assert.deepEqual(oge.author, [{ literal: "Türkiye İstatistik Kurumu" }, { family: "Yılmaz", given: "A." }]);
  assert.equal(oge.DOI, "10.1234/abc.5");
  assert.deepEqual(oge.issued, { "date-parts": [[2020]] });
  assert.equal(cslOgesi({ ...KAYNAK, doi_or_url: "https://example.org/x" }).URL, "https://example.org/x");
});

test("denetçi: esnek yıl — CSL yazar-tarih künyesi yıl nerede olursa okunur", () => {
  const harvard = kunyeAyristir("Yılmaz, A., Demir, B.C., Kaya, D., 2020. Enflasyon ve işsizlik ilişkisi. İktisat Dergisi 12, 45–67.", "csl:a:elsevier-harvard");
  assert.equal(harvard.year, "2020");
  assert.equal(harvard.authors?.[0], "Yılmaz, A.");
  assert.deepEqual(harvard.issues, []);
  const apa = kunyeAyristir("Yılmaz, A. (2020). Başlık. Dergi, 12(3), 45-67.", "csl:a:apa");
  assert.equal(apa.year, "2020");
  assert.deepEqual(apa.issues, []);
  // Cilt/sayfa dört haneli olsa da ilk yıl alınır; sayfa "1234" yıl sayılmaz.
  assert.equal(kunyeAyristir("Smith, J. Title. Journal 1234, 1998.", "csl:a:x").year, "1998");
  const yilsiz = kunyeAyristir("Yılmaz, A. Başlık. Dergi.", "csl:a:apa");
  assert.ok(yilsiz.issues.some((s) => s.field === "year"));
});

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });
const numaraSorunlari = (govde: string[], kaynaklar: string[], citationStyle: string) =>
  checkStructure({ content: [h("Giriş"), ...govde.map(p), h("Kaynakça"), ...kaynaklar.map(p)] as never }, { citationStyle, belgeDili: "tr" })
    .map((s) => s.message)
    .filter((m) => /atıf|kaynağa/.test(m));

test("denetçi: üst simge atıf okunur, R² ve m² atıf sayılmaz", () => {
  const kaynaklar = ["1. Yılmaz A. Başlık. Dergi. 2020;1:1-2.", "2. Demir B. Başlık. Dergi. 2021;1:1-2."];
  const ama = "csl:s:american-medical-association";
  assert.deepEqual(numaraSorunlari(["Enflasyon yükselmiştir.¹ Model iyi uyum gösterdi.²"], kaynaklar, ama), []);
  const eksik = numaraSorunlari(["Enflasyon yükselmiştir.¹ Modelin R² değeri yüksek; alan 5 m²."], kaynaklar, ama);
  assert.deepEqual(eksik, ["Kaynakçadaki 2. kaynağa metinde atıf yapılmamış."]);
  // Sayfa ekli atıf: "¹⁽ᵖ⁵⁰⁾" yalnızca 1 numaralı atıftır.
  assert.deepEqual(numaraSorunlari(["Bulgu böyledir¹⁽ᵖ⁵⁰⁾ ve şöyledir.²"], kaynaklar, ama), []);
});

test("denetçi: köşeli/parantez numaralı CSL atfı sayfa ekiyle tanınır; yıl parantezi atıf değil", () => {
  const kaynaklar = ["[1] A. Yılmaz, “Başlık,” Dergi, 2020.", "[2] B. Demir, “Başlık,” Dergi, 2021."];
  assert.deepEqual(numaraSorunlari(["Bulgu [1, p. 5] ve [2]."], kaynaklar, "csl:k:ieee"), []);
  const parantez = ["1. Yılmaz A. Başlık. 2020.", "2. Demir B. Başlık. 2021."];
  assert.deepEqual(numaraSorunlari(["Bulgu (1, s. 5) ve (2). 2008 krizi (2008) önemlidir."], parantez, "csl:p:x"), []);
});
