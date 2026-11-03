import assert from "node:assert/strict";
import test from "node:test";
import { belgeBolumleri, ekBasligiMi, kaynakcaGirdileri, kunyeAdayiMi, metniBol } from "@/lib/kaynakca-bolumu";
import { atifDenetimi, govdeMetni } from "@/lib/atif-denetimi";
import { checkStructure } from "@/lib/structure-check";
import { computeComplianceScore, parseReferenceEntry } from "@/lib/apa7";

/*
  03.11.2026, örnek tez ("Türkiye'de Enflasyon ve İşsizlik…"): kaynakça
  ekleri, CSV satırlarını ve Python kodunu da künye sayıyordu; APA puanı
  0/100 çıkıyordu.
*/
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const kod = (text: string) => ({ type: "codeBlock", attrs: { language: "python" }, content: [{ type: "text", text }] });

const KUNYELER = [
  "Friedman, M. (1968). The role of monetary policy. American Economic Review, 58(1), 1–17.",
  "Phillips, A. W. (1958). The relation between unemployment and the rate of change of money wage rates. Economica, 25(100), 283–299.",
  "TÜİK. (2026a). Tüketici Fiyat Endeksi, Aralık 2025 [Haber bülteni]. Türkiye İstatistik Kurumu. (Yıllık değişim %30,89; DergiPark değil, haber özeti)",
];

const TEZ = {
  type: "doc",
  content: [
    h(1, "Başlık"),
    h(2, "Giriş"),
    p("Friedman (1968) ve Phillips (1958) bu konuyu ele almıştır; güncel veri TÜİK (2026a) bültenindedir."),
    h(2, "Kaynakça"),
    ...KUNYELER.map(p),
    h(2, "Ek 1"),
    p("Enflasyon ve işsizlik serisi; kaynak TÜİK, yöntem değişikliği 2004 ve 2021."),
    kod("Yil,ENF,ISS\n2000,39.03,6.5\n2001,68.53,8.4"),
    p("Yil,ENF,ISS"),
    p("2000,39.03,6.5"),
    h(2, "Ek 2"),
    kod("import numpy as np\n# Birim kök"),
    p("import numpy as np, pandas as pd"),
    p("# Birim kök"),
  ],
};

test("kaynakça ek başlığında biter; ek içeriği künye değildir", () => {
  const bloklar = TEZ.content;
  const { kaynakca } = belgeBolumleri(bloklar);
  assert.deepEqual(kaynakca, { bas: 3, bit: 7 });
  assert.deepEqual(kaynakcaGirdileri(bloklar, kaynakca).girdiler, KUNYELER);
});

test("hepsi anılıyorsa puan 100; ek içeriği hiçbir bulguda geçmez", () => {
  const sonuc = atifDenetimi(TEZ as never, "apa7");
  assert.equal(sonuc.references.length, 3);
  assert.equal(sonuc.crossCheck.referencesWithoutCitation.length, 0);
  assert.equal(sonuc.complianceScore, 100);
  const yapi = checkStructure(TEZ, { citationStyle: "apa7", belgeDili: "tr" });
  const metin = yapi.map((s) => s.message).join("\n");
  for (const cop of ["Yil,ENF", "2000,39", "numpy", "Birim kök"]) assert.ok(!metin.includes(cop), `${cop} bulguda geçmemeli:\n${metin}`);
});

test("ek başlığı düzeyinden bağımsız olarak bölümü bitirir", () => {
  const bloklar = [h(1, "Kaynakça"), p(KUNYELER[0]), h(3, "EK-1 Veri"), p("2000,39.03,6.5")];
  assert.deepEqual(belgeBolumleri(bloklar).kaynakca, { bas: 0, bit: 2 });
  for (const ek of ["Ek 1. Veri Seti", "EK-2", "Ekler", "EKLER", "Ek A", "Appendix B", "Appendices"]) assert.ok(ekBasligiMi(ek), ek);
  for (const degil of ["Ekonomi", "Ekinci, A.", "Ek ve tablolar", "Eklenen veriler"]) assert.ok(!ekBasligiMi(degil), degil);
});

test("künye adayı: yazar/kurum + yıl", () => {
  for (const kunye of [
    ...KUNYELER,
    "Granger, C. W. J. (t.y.). Başlık. Yayınevi.",
    "Yılmaz, A. 2020. Başlık. Ankara: Yayınevi.",
    "[3] A. Yılmaz, “Başlık,” Dergi, vol. 3, no. 2, 2020.",
    "1. Yılmaz A. Başlık. Dergi. 2020;3(2):1-5.",
    // Yılı unutulmuş gerçek künye elenmez: "yıl yok" hatası almalı.
    "Kaya, M., & Öz, S. Yılsız bir başlık. Yayınevi.",
  ])
    assert.ok(kunyeAdayiMi(kunye), kunye);
  for (const cop of [
    "Yil,ENF,ISS",
    "2000,39.03,6.5",
    "import numpy as np, pandas as pd, statsmodels.api as sm",
    "# Birim kök",
    "df = pd.read_csv(\"veri.csv\", index_col=0)",
    "Enflasyon: TÜFE, Aralık–Aralık yıllık değişim (%). Kaynak: TÜİK; yöntem değişiklikleri 2004 ve 2021 yıllarındadır",
    "Ek 1. Veri Seti",
  ])
    assert.ok(!kunyeAdayiMi(cop), cop);
});

test("liste bölümleri (İçindekiler, Tablolar Listesi) gövde metni değildir", () => {
  const doc = {
    type: "doc",
    content: [
      h(2, "İçindekiler"),
      { type: "bulletList", content: [{ type: "listItem", content: [p("Kaynakça")] }] },
      h(2, "Tablolar Listesi"),
      { type: "bulletList", content: [{ type: "listItem", content: [p("Tablo 1. Değişkenler")] }] },
      h(2, "Giriş"),
      p("Gövde metni."),
    ],
  };
  const govde = govdeMetni(doc as never);
  assert.ok(govde.includes("Gövde metni"));
  assert.ok(!govde.includes("Tablo 1"));
  assert.ok(!govde.includes("Kaynakça"));
});

test("düz metin: İçindekiler'deki 'Kaynakça' satırı bölüm değildir; ekte biter", () => {
  const metin = [
    "İçindekiler",
    "Giriş",
    "Kaynakça",
    "Ek 1. Veri Seti",
    "Giriş",
    "Friedman (1968) bunu söyler.",
    "Kaynakça",
    KUNYELER[0],
    KUNYELER[1],
    "Ek 1. Veri Seti",
    "2000,39.03,6.5",
  ].join("\n");
  const { bodyText, referenceText } = metniBol(metin);
  assert.equal(referenceText, `${KUNYELER[0]}\n${KUNYELER[1]}`);
  assert.ok(bodyText.includes("Friedman (1968) bunu söyler."));
  assert.ok(bodyText.includes("2000,39.03,6.5"), "ekler gövdede kalır");
});

/*
  Puan formülü (lib/apa7.ts computeComplianceScore): oranlar, mutlak ceza
  değil. Eskiden 35 künyeli tezde 8 anılmayan kaynak −24 ediyordu.
*/
test("puan: oranlardan, kaynak sayısıyla ölçekli", () => {
  const ref = (i: number) => parseReferenceEntry(`Yazar${"abcdefghijklmnopqrstuvwxyzğüşöçıABCDEFGHI"[i]}, A. (2020). Başlık. Yayınevi.`);
  const refs = Array.from({ length: 35 }, (_, i) => ref(i));
  assert.equal(computeComplianceScore(refs, { citationsWithoutReference: [], referencesWithoutCitation: [] }), 100);
  // 27/35 anılıyor → 100 × (0,5 × 27/35 + 0,25 + 0,25) = 88,6
  assert.equal(computeComplianceScore(refs, { citationsWithoutReference: [], referencesWithoutCitation: refs.slice(0, 8) }), 89);
  assert.equal(computeComplianceScore([], { citationsWithoutReference: [], referencesWithoutCitation: [] }), 0);
});

/*
  Madde 2 (03.11.2026): anılmayan kaynak iki bölümde ayrı ayrı listeleniyordu.
  Bulgunun tek kaynağı yapı denetimi; uyarı sayısı (kontrolSayilari) yalnızca
  ondan sayılır, editör kontrolünün atıf bölümü yalnızca özet gösterir.
*/
test("anılmayan kaynak toplam uyarı sayısında bir kez sayılır", async () => {
  const { kontrolSayilari } = await import("@/lib/kontrol-gecmisi");
  const doc = {
    type: "doc",
    content: [h(1, "Giriş"), p("Friedman (1968) bunu söyler."), h(1, "Kaynakça"), p(KUNYELER[0]), p(KUNYELER[1])],
  };
  const yapi = checkStructure(doc, { citationStyle: "apa7", belgeDili: "tr" });
  const anilmayan = yapi.filter((s) => s.message.includes("metinde anılmıyor"));
  assert.equal(anilmayan.length, 1);
  assert.ok(anilmayan[0].message.includes("Phillips"));
  assert.equal(atifDenetimi(doc as never, "apa7").crossCheck.referencesWithoutCitation.length, 1);
  assert.equal(kontrolSayilari(yapi, 0, 0).uyari, yapi.filter((s) => s.tone === "warning").length);
  assert.equal(kontrolSayilari(yapi, 0, 0).uyari, 1);
});
