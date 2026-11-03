import assert from "node:assert/strict";
import test from "node:test";
import { checkStructure } from "@/lib/structure-check";
import { baslikYerlesimSorunlari } from "@/lib/alinti-ve-baslik";
import { anilanNumaralar, baslikAdlandirmaSorunu } from "@/lib/sekil-tablo-numaralari";
import { bolumDuzeyi } from "@/lib/section-match";
import { gorselAltyazilari } from "@/lib/docx-import";

/*
  Örnek tezle yapılan karşılaştırmanın 3–6. maddeleri (03.11.2026).
*/
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const cap = (kind: "table" | "figure", text: string) => ({ type: "paragraph", attrs: { caption: kind }, content: [{ type: "text", text }] });
const tablo = () => ({
  type: "table",
  content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("hücre")] }] }],
});
const liste = (...maddeler: string[]) => ({
  type: "orderedList",
  content: maddeler.map((m) => ({ type: "listItem", content: [p(m)] })),
});
const duzeyUyarilari = (content: unknown[]) =>
  checkStructure({ content: content as never }, { belgeDili: "tr" }).filter((s) => /H\d/.test(s.message));

// ---------- 3. Başlık düzeyi ----------
test("numaralı liste sonrası '## 1. Giriş' → '### 1.1.' uyarı vermez", () => {
  const uyarilar = duzeyUyarilari([
    h(1, "Başlık"),
    h(2, "Kapak"),
    liste("Giriş", "Kuramsal Çerçeve"),
    h(2, "1. Giriş"),
    p("Metin."),
    h(3, "1.1. X"),
    p("Metin."),
  ]);
  assert.deepEqual(uyarilar, []);
});

test("arada H2 yoksa H1 → H3 uyarı verir", () => {
  const uyarilar = duzeyUyarilari([h(1, "Başlık"), h(3, "1.1. X"), p("Metin.")]);
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0].message, /H1'den H3'e/);
});

test("karışık bölüm düzeyi bir kez, bölüm başlığında söylenir", () => {
  const uyarilar = duzeyUyarilari([
    h(1, "Giriş"),
    p("Metin."),
    h(3, "Amaç"),
    p("Metin."),
    h(3, "Hipotezler"),
    p("Metin."),
    h(2, "Kuramsal Çerçeve"),
    p("Metin."),
    h(3, "Orijinal Eğri"),
    p("Metin."),
  ]);
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0].message, /“Giriş” bölüm başlığı H1; oysa “Kuramsal Çerçeve” gibi öteki bölümler H2/);
  assert.equal(uyarilar[0].target, "Giriş");
});

test("eksik bölüm belgenin kendi bölüm düzeyinde açılır", () => {
  const basliklar = [
    { level: 1, text: "Tezin Başlığı" },
    { level: 2, text: "Kuramsal Çerçeve" },
    { level: 3, text: "Alt" },
    { level: 2, text: "Yöntem" },
    { level: 3, text: "Alt" },
  ];
  assert.equal(bolumDuzeyi(basliklar, ["Giriş", "Sonuç"]), 2);
  assert.equal(bolumDuzeyi([{ level: 2, text: "1. Giriş" }], ["Giriş"]), 2);
  assert.equal(bolumDuzeyi([], ["Giriş"]), 1);
});

// ---------- 4. Tablo başlığı konumu ----------
test("[başlık][tablo][Not] uyarı vermez", () => {
  assert.deepEqual(baslikYerlesimSorunlari({ content: [cap("table", "Başlık"), tablo(), p("Not: açıklama.")] as never }), []);
});

test("[tablo][başlık] uyarı verir", () => {
  const sorunlar = baslikYerlesimSorunlari({ content: [p("Metin."), tablo(), cap("table", "Başlık"), p("Metin.")] as never });
  assert.deepEqual(sorunlar, [{ tur: "table", baslik: "Başlık" }]);
});

test("panel: [başlık][tablo][tablo] uyarı vermez", () => {
  assert.deepEqual(baslikYerlesimSorunlari({ content: [cap("table", "ARDL"), tablo(), tablo(), p("Metin.")] as never }), []);
});

test("[tablo][başlık][tablo]: başlık sonraki tablonundur, yer sorunu değil", () => {
  assert.deepEqual(baslikYerlesimSorunlari({ content: [tablo(), cap("table", "İkinci"), tablo()] as never }), []);
});

test("[başlık][tablo][Not][başlık][tablo][Not] uyarı vermez (örnek tezin düzeni)", () => {
  const icerik = [cap("table", "Bir"), tablo(), p("Not: a."), p("Metin."), cap("table", "İki"), tablo(), p("Not: b.")];
  assert.deepEqual(baslikYerlesimSorunlari({ content: icerik as never }), []);
});

// ---------- 5. Şekil/tablo atfı ve şekil başlığı ----------
test("metin içi atıf Türkçe eklerle, listeyle ve aralıkla tanınır", () => {
  const say = (metin: string, etiket = "Tablo") => [...anilanNumaralar(metin, etiket)].sort();
  assert.deepEqual(say("Şekil 1'de görülmektedir.", "Şekil"), ["1"]);
  assert.deepEqual(say("Şekil 1’deki eğilim", "Şekil"), ["1"]);
  assert.deepEqual(say("Tablo 3'te ve Tablo 8'den"), ["3", "8"]);
  assert.deepEqual(say("Tablo 4 ve 5 birlikte"), ["4", "5"]);
  assert.deepEqual(say("Tablo 4–6 arasında"), ["4", "5", "6"]);
  assert.deepEqual(say("(bkz. Tablo 2)"), ["2"]);
  assert.deepEqual(say("Tablolar 4, 5 ve 6"), ["4", "5", "6"]);
  assert.deepEqual(say("Tablo 3.1'de"), ["3.1"]);
  // Virgülden sonraki yıl tablo numarası sayılmaz.
  assert.deepEqual(say("Tablo 2, 2020 yılında hazırlandı"), ["2"]);
  assert.deepEqual(say("Tablo 12 ve sonrası"), ["12"]);
});

test("'Şekil 1'de …' atıfı + adlandırıcı başlık: atıf var, uyarı yok", () => {
  const doc = {
    content: [
      h(1, "Giriş"),
      p("Şekil 1'de enflasyonun seyri görülmektedir."),
      { type: "paragraph", content: [{ type: "image", attrs: { src: "x.png" } }] },
      cap("figure", "Enflasyon ve işsizlik"),
    ],
  };
  const sekil = checkStructure(doc as never, { belgeDili: "tr" }).filter((s) => s.kategori === "sekil");
  assert.deepEqual(sekil, []);
});

test("yalnızca kaynak taşıyan şekil başlığı: adlandırıcı başlık eksik", () => {
  assert.equal(baslikAdlandirmaSorunu("Kaynak: TÜİK"), "kaynak-yalniz");
  assert.equal(baslikAdlandirmaSorunu("'de enflasyondaki büyük sıçramalar"), "atif-cumlesi");
  assert.equal(baslikAdlandirmaSorunu("Enflasyon ve işsizlik"), null);
  const doc = {
    content: [
      h(1, "Giriş"),
      p("Şekil 1'de görülmektedir."),
      { type: "paragraph", content: [{ type: "image", attrs: { src: "x.png" } }] },
      cap("figure", "Kaynak: TÜİK"),
    ],
  };
  const mesajlar = checkStructure(doc as never, { belgeDili: "tr" }).map((s) => s.message);
  assert.ok(mesajlar.some((m) => m.includes("Şekil 1 için adlandırıcı başlık eksik")), mesajlar.join("\n"));
});

test("Word: görselin açıklama alanı, altında başlık yoksa başlık olur", () => {
  const tek = gorselAltyazilari('<p><img alt="Şekil 1. Enflasyon ve işsizlik" src="a.png" /></p><p>Metin</p>');
  assert.equal(tek.eklenen, 1);
  assert.match(tek.html, /<p data-caption="figure">Enflasyon ve işsizlik<\/p>/);
  // Başlık paragrafı zaten varsa ikinci kez eklenmez.
  const var_ = gorselAltyazilari('<p><img alt="Şekil 1. A" src="a.png" /></p><p data-caption="figure">A</p>');
  assert.equal(var_.eklenen, 0);
  // Açıklama "Şekil N." ile başlamıyorsa başlık sayılmaz.
  assert.equal(gorselAltyazilari('<p><img alt="logo" src="a.png" /></p>').eklenen, 0);
});

// ---------- 6. Eklerin metin içi atfı ----------
test("ek atfı Türkçe eklerle tanınır; anılmayan ek uyarı alır", () => {
  const doc = {
    content: [
      h(1, "Yöntem"),
      p("Veri seti Ek 1'de verilmiştir (bkz. Ek 1)."),
      h(1, "Ekler"),
      h(2, "Ek 1. Veri Seti"),
      p("2000,39.03,6.5"),
      h(2, "Ek 2. Kod"),
      p("print(1)"),
    ],
  };
  const ek = checkStructure(doc as never, { belgeDili: "tr" }).filter((s) => s.kategori === "ek").map((s) => s.message);
  assert.equal(ek.length, 1, ek.join("\n"));
  assert.match(ek[0], /^Ek 2 .*metinde anılmıyor/);
  // "Ek 2'deki" de atıftır.
  const doc2 = { content: [...doc.content.slice(0, 2), p("Kodun özeti Ek 2'deki gibidir."), ...doc.content.slice(2)] };
  assert.deepEqual(checkStructure(doc2 as never, { belgeDili: "tr" }).filter((s) => s.kategori === "ek"), []);
});
