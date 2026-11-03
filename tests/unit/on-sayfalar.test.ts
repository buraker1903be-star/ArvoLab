import assert from "node:assert/strict";
import test from "node:test";
import { mevcutOnSayfalar, onSayfaDugumleri, onSayfaYerlesimi, yerTutuculari, type OnSayfaKimligi } from "@/lib/on-sayfalar";
import { anaMetinBaslangici, onSayfaBasligiMi } from "@/lib/heading-numbering";
import { checkStructure } from "@/lib/structure-check";

/* Ön sayfa şablonları (02.11.2026): yapı ve yer tutucu, resmî metin değil. */

const h1 = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const metin = (d: { text?: string; content?: unknown[] }): string =>
  d.text ?? ((d.content ?? []) as { text?: string; content?: unknown[] }[]).map(metin).join("");

const KAPAK = {
  university: "Dokuz Eylül Üniversitesi",
  institute: "Sosyal Bilimler Enstitüsü",
  department: "İktisat Anabilim Dalı",
  program: "İktisat Programı",
  degreeType: "Yüksek Lisans Tezi",
  title: "Enflasyon Beklentileri",
  authorName: "Ayşe Yılmaz",
  advisorName: "",
  city: "İzmir",
  year: "2026",
};

test("iç kapak kapak bilgisinden; eksik alan yer tutucu", () => {
  const satirlar = onSayfaDugumleri("ic-kapak", { kapak: KAPAK, dil: "tr" }).map(metin);
  assert.ok(satirlar.includes("DOKUZ EYLÜL ÜNİVERSİTESİ"), satirlar.join(" | "));
  assert.ok(satirlar.includes("ENFLASYON BEKLENTİLERİ"));
  assert.ok(satirlar.includes("Danışman: [Unvanı Adı Soyadı]"));
  assert.ok(satirlar.includes("İzmir – 2026"));
  // Başlıksız: içindekilere ve numaralandırmaya girmez.
  assert.ok(onSayfaDugumleri("ic-kapak", { kapak: KAPAK, dil: "tr" }).every((d) => d.type === "paragraph"));
});

test("resmî metin uydurulmuyor; özet kılavuz sınırını söylüyor", () => {
  const yemin = onSayfaDugumleri("yemin", { kapak: KAPAK, dil: "tr" }).map(metin);
  assert.equal(yemin[0], "YEMİN METNİ");
  assert.match(yemin[1], /^\[Kurumunuzun yemin metnini/);
  const ozet = onSayfaDugumleri("ozet", { kapak: KAPAK, dil: "tr", ozet: { maxWords: 250, keywordsMin: 3, keywordsMax: 5 } }).map(metin);
  assert.deepEqual(ozet, ["ÖZET", "[Araştırma sorusu, yöntem ve bulgular; en fazla 250 kelime]", "Anahtar Kelimeler: [3–5 anahtar kelime]"]);
  const abstract = onSayfaDugumleri("abstract", { kapak: KAPAK, dil: "tr" }).map(metin);
  assert.equal(abstract[2], "Keywords: [keywords]");
  // İngilizce tez: başlıklar İngilizce.
  assert.equal(metin(onSayfaDugumleri("yemin", { kapak: KAPAK, dil: "en" })[0]), "DECLARATION");
});

test("şablon başlıkları ön sayfa: Romen numaralandırma ana metni doğru yerde başlatıyor", () => {
  for (const ad of ["TEZ ONAY SAYFASI", "YEMİN METNİ", "ÖZET", "ABSTRACT", "KISALTMALAR", "DECLARATION", "THESIS APPROVAL PAGE"]) {
    assert.ok(onSayfaBasligiMi(ad), ad);
  }
  const ids: OnSayfaKimligi[] = ["ic-kapak", "onay", "yemin", "ozet", "abstract", "kisaltmalar"];
  const onTaraf = ids.flatMap((id) => onSayfaDugumleri(id, { kapak: KAPAK, dil: "tr" }));
  const doc = { content: [...onTaraf, h1("GİRİŞ"), p("Metin.")] };
  assert.equal(anaMetinBaslangici(doc), onTaraf.length);
});

test("var olan sayfalar tanınıyor", () => {
  const doc = { content: [p("ENFLASYON BEKLENTİLERİ"), h1("Özet"), p("..."), h1("Abstract"), h1("GİRİŞ")] };
  assert.deepEqual([...mevcutOnSayfalar(doc, "Enflasyon Beklentileri")].sort(), ["abstract", "ic-kapak", "ozet"]);
  // Baştaki metin başlığı taşımıyorsa iç kapak sayılmaz.
  assert.ok(!mevcutOnSayfalar({ content: [p("Taslak not"), h1("GİRİŞ")] }, "Enflasyon").has("ic-kapak"));
});

test("yerleşim: kanonik sırada, var olanların arasına, ana metinden önce", () => {
  const doc = { content: [h1("ÖZET"), p("x"), h1("GİRİŞ"), p("y"), h1("KAYNAKÇA")] };
  assert.deepEqual(onSayfaYerlesimi(doc, ["ic-kapak", "onay", "yemin", "ozet", "abstract", "kisaltmalar"]), [
    { sira: 0, idler: ["ic-kapak", "onay", "yemin"] }, // Özet'in önüne
    { sira: 2, idler: ["abstract", "kisaltmalar"] }, // Giriş'in önüne
  ]);
  // Ana metin yoksa (boş belge) en başa.
  assert.deepEqual(onSayfaYerlesimi({ content: [] }, ["ozet"]), [{ sira: 0, idler: ["ozet"] }]);
  // Var olan eklenmez.
  assert.deepEqual(onSayfaYerlesimi(doc, ["ozet"]), []);
});

test("yer tutucu: şablonun yerleri evet, numaralı atıf hayır", () => {
  assert.deepEqual(yerTutuculari("Danışman: [Unvanı Adı Soyadı], tarih [gg.aa.yyyy]."), ["[Unvanı Adı Soyadı]", "[gg.aa.yyyy]"]);
  assert.deepEqual(yerTutuculari("Bu bulgu desteklenmiştir [1], [2, 5–7]."), []);
  assert.deepEqual(yerTutuculari("Alıntıda hata [sic] korunmuştur."), []);
});

test("teslim kontrolü doldurulmamış yeri söylüyor", () => {
  const doc = { content: onSayfaDugumleri("yemin", { kapak: KAPAK, dil: "tr" }) };
  const sorunlar = checkStructure(doc as never, {}, "tr");
  assert.ok(sorunlar.some((s) => s.message.startsWith("Doldurulmamış yer: “[Kurumunuzun yemin")), sorunlar.map((s) => s.message).join(" | "));
  const dolu = { content: [h1("YEMİN METNİ"), p("Tezimi bilimsel etik kurallarına uygun yazdığımı beyan ederim.")] };
  assert.ok(!checkStructure(dolu as never, {}, "tr").some((s) => s.message.startsWith("Doldurulmamış yer")));
});

/*
  03.11.2026: kılavuzun istediği ön sayfalar editöre kendiliğinden ve
  şablonlarıyla iniyor; eskiden "Taslak oluştur" Yemin Metni'ni de düz
  başlık olarak ekliyordu.
*/
test("kılavuzun ön sayfaları ayrılıyor, kanonik sırada", async () => {
  const { kilavuzOnSayfalari, onSayfaAdiKimligi } = await import("@/lib/on-sayfalar");
  const deu = ["Yemin Metni", "Özet", "Abstract", "Giriş", "Sonuç ve Öneriler", "Kaynakça", "Ekler"];
  assert.deepEqual(kilavuzOnSayfalari(deu), ["yemin", "ozet", "abstract"]);
  // Sıra kılavuzdaki yazıma değil kanonik sıraya göre.
  assert.deepEqual(kilavuzOnSayfalari(["Abstract", "Özet", "Kısaltmalar", "İç Kapak"]), ["ic-kapak", "ozet", "abstract", "kisaltmalar"]);
  assert.equal(onSayfaAdiKimligi("Bilimsel Etik Bildirimi"), "yemin");
  assert.equal(onSayfaAdiKimligi("Giriş"), null);
  assert.deepEqual(kilavuzOnSayfalari(["Giriş", "Yöntem", "Kaynakça"]), []);
});

test("taslak: ön sayfalar şablonla ve kılavuzun adıyla, gövde başlık olarak", async () => {
  const { taslakDugumleri } = await import("@/lib/on-sayfalar");
  const dugumler = taslakDugumleri(["Bilimsel Etik Bildirimi", "Özet", "Giriş", "Kaynakça"], { kapak: null, dil: "tr" });
  const basliklar = dugumler
    .filter((d) => d.type === "heading")
    .map((d) => (d.content ?? []).map((c) => c.text ?? "").join(""));
  assert.deepEqual(basliklar, ["BİLİMSEL ETİK BİLDİRİMİ", "ÖZET", "Giriş", "Kaynakça"]);
  // Özet şablonu anahtar kelime satırını taşıyor (düz başlık değil).
  const metin = JSON.stringify(dugumler);
  assert.match(metin, /Anahtar [Kk]elimeler/);
});
