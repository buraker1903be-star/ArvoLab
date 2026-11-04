/*
  KONUM YOLU (breadcrumb, Signature OS 04.11.2026).

  Üst çubuktaki "neredeyim" kenar çubuğuyla aynı fonksiyonlardan
  türetiliyor; bu testler ikisinin aynı yeri göstermesini ve son öğenin
  bağlantısız (bulunulan sayfa) olmasını sabitliyor.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { konumYolu } from "@/lib/os/konum-yolu";
import { labUygulamalari } from "@/lib/os/uygulamalar";
import { ceviriciKur } from "@/lib/dil";

const uygulamalar = labUygulamalari();
const tez = { id: "abc", baslik: "Türkiye'de Enflasyon ve Büyüme", tur: "thesis" };
const yolu = (yol: string, sorgu = "", baglam: typeof tez | null = null) =>
  konumYolu({ yol, sorgu: new URLSearchParams(sorgu), uygulamalar, baglam });

test("çalışmanın Yazım bölümü: Çalışmalarım › çalışma › Yazım", () => {
  assert.deepEqual(yolu("/dashboard/editor/abc/write", "", tez), [
    { label: "Çalışmalarım", href: "/dashboard/editor" },
    { label: "Türkiye'de Enflasyon ve Büyüme", href: "/dashboard/editor?sec=abc" },
    { label: "Yazım", href: null },
  ]);
});

test("çalışmanın Özet sayfasında çalışmanın adı son öğedir (bölüm tekrarlanmaz)", () => {
  assert.deepEqual(yolu("/dashboard/editor", "sec=abc", tez), [
    { label: "Çalışmalarım", href: "/dashboard/editor" },
    { label: "Türkiye'de Enflasyon ve Büyüme", href: null },
  ]);
});

test("çalışmaya süzülmüş araç da çalışmanın içinde sayılır", () => {
  const ogeler = yolu("/dashboard/literature", "calisma=abc", tez);
  assert.equal(ogeler.length, 3);
  assert.deepEqual(ogeler[2], { label: "Kaynaklar", href: null });
});

test("başka çalışmanın sayfasında eski bağlam gösterilmez", () => {
  assert.deepEqual(yolu("/dashboard/editor/xyz/write", "", tez), [{ label: "Çalışmalarım", href: null }]);
});

test("genel sayfalar: uygulamanın adı tek öğe, bağlantısız", () => {
  assert.deepEqual(yolu("/dashboard"), [{ label: "Ana Sayfa", href: null }]);
  assert.deepEqual(yolu("/dashboard/analysis"), [{ label: "Analiz Merkezi", href: null }]);
  assert.deepEqual(yolu("/dashboard/citations"), [{ label: "Kaynaklar", href: null }]);
});

test("tanınmayan yol: genel bir ad, çökme yok", () => {
  assert.deepEqual(yolu("/dashboard/bilinmeyen"), [{ label: "Çalışma alanı", href: null }]);
});

test("İngilizce arayüzde etiketler İngilizce", () => {
  const t = ceviriciKur("en");
  const ogeler = konumYolu({
    yol: "/dashboard/editor/abc/write",
    sorgu: new URLSearchParams(),
    uygulamalar: labUygulamalari(t),
    baglam: tez,
    t,
  });
  assert.deepEqual(ogeler.map((o) => o.label), ["My works", "Türkiye'de Enflasyon ve Büyüme", "Writing"]);
});
