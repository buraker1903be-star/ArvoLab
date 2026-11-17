import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ParsedReference } from "@/lib/apa7";
import { verifyAcademicReferences, pdfSatirinaDoi, type DogrulamaOnbellegi, type OnbellekKaydi } from "@/lib/academic-reference-verification";

/*
  KAYNAK DOĞRULAMA ÖNBELLEĞİ: KİMLİK (RC06k, 17.11.2026).

  Önbellek bütün kullanıcılar için ortak ve anahtarı "başlık kelimeleri|yıl"
  idi. Aynı başlık ve yılı taşıyan iki FARKLI eser (iki DOI) aynı kutuya
  düşüyordu: A kullanıcısının künyesi (DOI X) doğrulanıp önbelleğe yazılınca
  B kullanıcısının künyesi (DOI Y) önbellekten X'in kaydını "en iyi eşleşme"
  olarak alıyor, PDF satırına X yazılıyor ve atıf kesin eşleşmeye
  ulaşamıyordu. RC06k tam zincir kabulünde görüldü; gerçekte "Editorial",
  "Introduction", "Book review" gibi genel başlıklarda olur.

  Bu dosya iki kullanıcı ve soğuk/sıcak önbellekle o hatayı sabitler.
*/

const X = "10.5555/ornek.a";
const Y = "10.5555/ornek.b";
const BASLIK = "Remote learning and student wellbeing";

const kunye = (doi: string | null, yazar = "Kaya, A."): ParsedReference => ({
  raw: `${yazar} (2021). ${BASLIK}. Journal of Synthetic Studies, 12(3), 201-219.${doi ? ` https://doi.org/${doi}` : ""}`,
  authors: [yazar],
  year: "2021",
  title: BASLIK,
  issues: [],
});

const kayit = (doi: string, aile: string) => ({
  DOI: doi,
  title: [BASLIK],
  author: [{ given: "A.", family: aile }],
  issued: { "date-parts": [[2021]] },
  "container-title": ["Journal of Synthetic Studies"],
});

/** Aynı başlık/yıl iki eser dizinde: X (Kaya) ve Y (Kaya, başka eser). Arama ikisini de, X önce döner. */
const DIZIN: Record<string, ReturnType<typeof kayit>> = { [X]: kayit(X, "Kaya"), [Y]: kayit(Y, "Kaya") };

const gercekFetch = globalThis.fetch;
let istekler: string[] = [];

beforeEach(() => {
  istekler = [];
  globalThis.fetch = (async (adres: string) => {
    const u = new URL(String(adres));
    istekler.push(`${u.hostname}${u.pathname}`);
    if (u.hostname === "api.crossref.org" && u.pathname.startsWith("/works/")) {
      const doi = decodeURIComponent(u.pathname.slice("/works/".length)).toLowerCase();
      const oge = DIZIN[doi];
      return oge
        ? new Response(JSON.stringify({ message: oge }), { status: 200 })
        : new Response(JSON.stringify({ status: "error" }), { status: 404 });
    }
    const govde = u.hostname === "api.crossref.org" ? { message: { items: [DIZIN[X], DIZIN[Y]] } } : { results: [] };
    return new Response(JSON.stringify(govde), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
});

/** Paylaşılan (iki kullanıcının ortak) önbellek: Supabase tablosunun bellek içi karşılığı. */
function ortakOnbellek(baslangic: Record<string, OnbellekKaydi> = {}) {
  const tablo = new Map<string, OnbellekKaydi>(Object.entries(baslangic));
  const onbellek: DogrulamaOnbellegi = {
    async oku(anahtarlar) {
      return new Map(anahtarlar.filter((a) => tablo.has(a)).map((a) => [a, tablo.get(a)!]));
    },
    async yaz(girisler) {
      for (const g of girisler) tablo.set(g.anahtar, g.kayit);
    },
  };
  return { onbellek, tablo };
}

const enIyiDoi = (s: { bestMatch: { doi: string | null } | null }) => s.bestMatch?.doi?.toLowerCase() ?? null;

describe("doğrulama önbelleği: aynı başlık/yıl, farklı DOI", () => {
  test("HATA ÜRETİMİ → düzeltme: B kullanıcısı (DOI Y) A'nın önbelleğe yazdığı X kaydını almaz (soğuk → sıcak)", async () => {
    const { onbellek } = ortakOnbellek();
    // A: soğuk önbellek.
    const [a] = await verifyAcademicReferences([kunye(X)], 25, onbellek);
    assert.equal(enIyiDoi(a), X);
    // B: aynı başlık/yıl, farklı DOI. Eskiden önbellekten X dönüyordu.
    const [b] = await verifyAcademicReferences([kunye(Y)], 25, onbellek);
    assert.equal(enIyiDoi(b), Y);
    // Sıcak önbellek: ikisi de kendi kaydını, dizine gitmeden alır.
    istekler = [];
    const [a2] = await verifyAcademicReferences([kunye(X)], 25, onbellek);
    const [b2] = await verifyAcademicReferences([kunye(Y)], 25, onbellek);
    assert.equal(enIyiDoi(a2), X);
    assert.equal(enIyiDoi(b2), Y);
    assert.deepEqual(istekler, []);
  });

  test("eski biçimli (başlık|yıl) hatalı önbellek kaydı yeniden kullanılmaz", async () => {
    // Production'da 7–90 gün yaşayan eski satırın birebir biçimi: X'in kaydı başlık|yıl anahtarında.
    const eski: OnbellekKaydi = {
      status: "verified",
      bestMatch: { provider: "crossref", title: BASLIK, year: 2021, doi: X, authors: ["A. Kaya"], venue: null, url: `https://doi.org/${X}`, citedByCount: null, confidence: 1 },
      matches: [],
    };
    const { onbellek } = ortakOnbellek({ "remote learning student wellbeing|2021": eski });
    const [b] = await verifyAcademicReferences([kunye(Y)], 25, onbellek);
    assert.equal(enIyiDoi(b), Y);
    // DOI'siz künye de eski satırı okumaz (anahtar sürümü değişti): dizine yeniden sorulur.
    istekler = [];
    await verifyAcademicReferences([kunye(null)], 25, onbellek);
    assert.ok(istekler.length > 0, "eski satır kullanıldı, dizine gidilmedi");
  });

  test("istenen DOI ile dönen eserin kimliği yazmadan önce doğrulanır: DOI dizinde yoksa başka DOI 'doğrulandı' sayılmaz ve önbelleğe girmez", async () => {
    const { onbellek, tablo } = ortakOnbellek();
    const Z = "10.5555/ornek.yok";
    const [z] = await verifyAcademicReferences([kunye(Z)], 25, onbellek);
    // Başlık araması X'i buldu ama künyenin DOI'si Z: X künyenin eseri değil.
    assert.notEqual(z.status, "verified");
    // X yalnızca "olası eşleşme" adayı olarak görünebilir; PDF satırına/eşleşmeye kimlik olarak geçmez.
    assert.equal(z.status, "possible_match");
    assert.equal(pdfSatirinaDoi(z), null);
    for (const [anahtar, deger] of tablo) assert.ok(!(anahtar.includes(Z) && deger.bestMatch?.doi?.toLowerCase() === X), "Z anahtarına X yazıldı");
  });

  test("DOI büyük-küçük harf ve doi.org biçimi kimliği değiştirmez", async () => {
    const { onbellek } = ortakOnbellek();
    const [a] = await verifyAcademicReferences([kunye(X.toUpperCase())], 25, onbellek);
    assert.equal(enIyiDoi(a), X);
    assert.equal(a.status, "verified");
  });
});

describe("pdfSatirinaDoi: belirsiz eşleşme kesin eşleşme sayılmaz", () => {
  const eser = (doi: string) => ({ provider: "crossref" as const, title: BASLIK, year: 2021, doi, authors: [], venue: null, url: `https://doi.org/${doi}`, citedByCount: null, confidence: 0.9 });
  test("DOI'li künye: yalnızca aynı DOI yazılır (büyük-küçük harf fark etmez)", () => {
    assert.equal(pdfSatirinaDoi({ status: "verified", bestMatch: eser("10.5555/ORNEK.A"), istenenDoi: X }), "10.5555/ORNEK.A");
    assert.equal(pdfSatirinaDoi({ status: "verified", bestMatch: eser(Y), istenenDoi: X }), null);
  });
  test("DOI'siz künye: olası eşleşmenin DOI'si yazılmaz, doğrulananınki yazılır", () => {
    assert.equal(pdfSatirinaDoi({ status: "possible_match", bestMatch: eser(X), istenenDoi: null }), null);
    assert.equal(pdfSatirinaDoi({ status: "verified", bestMatch: eser(X), istenenDoi: null }), X);
    assert.equal(pdfSatirinaDoi(null), null);
  });
});
