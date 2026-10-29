import { test } from "node:test";
import assert from "node:assert/strict";
import { kagitOku, kagitOlcusu, kilavuzdanKagit } from "@/lib/kagit-boyutu";
import { Packer } from "docx";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { buildPrintSheet } from "@/lib/print-sheet";
import { estimatePages } from "@/lib/page-estimate";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";
import type { TiptapDoc } from "@/lib/tiptap-text";
import type { AppliedGuideline } from "@/lib/guideline-rules";

test("bilinmeyen değer A4", () => {
  assert.equal(kagitOku(null), "a4");
  assert.equal(kagitOku("legal"), "a4");
  assert.equal(kagitOku("letter"), "letter");
  assert.equal(kagitOlcusu("letter").yukseklikCm, 27.94);
  // Twip ve cm aynı kâğıdı anlatmalı (1 inç = 1440 twip = 2,54 cm).
  for (const k of ["a4", "letter"]) {
    const o = kagitOlcusu(k);
    assert.ok(Math.abs((o.genislikTwip / 1440) * 2.54 - o.genislikCm) < 0.01, k);
    assert.ok(Math.abs((o.yukseklikTwip / 1440) * 2.54 - o.yukseklikCm) < 0.01, k);
  }
});

test("kılavuzdan kâğıt boyutu", () => {
  assert.equal(kilavuzdanKagit('Use 8.5" x 11" white paper with 1-inch margins.'), "letter");
  assert.equal(kilavuzdanKagit("Print on standard letter-size paper."), "letter");
  assert.equal(kilavuzdanKagit("Tez A4 boyutunda birinci hamur kâğıda basılır."), "a4");
  assert.equal(kilavuzdanKagit("Margins of 1 inch."), null, "söylenmeyen boyut tahmin edilmez");
  assert.equal(kilavuzdanKagit("A4 or US Letter paper may be used."), null, "ikisi birden");
  assert.equal(kilavuzdanKagit("A44 numaralı form"), null);
});

/* Kâğıt boyutu üç çıktıya ve hesaplara iniyor mu (29.10.2026'ya kadar her yer A4'e sabitti). */

const BELGE = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Metin." }] }] } as unknown as TiptapDoc;

test("yazdırma: @page boyutu ve kâğıt ölçüsü değişkenleri", () => {
  const a4 = buildPrintSheet({ margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 } }, null, BELGE as never);
  const letter = buildPrintSheet({ margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }, pageSize: "letter" }, null, BELGE as never);
  assert.match(a4.pageRule, /size: A4;/);
  assert.match(letter.pageRule, /size: letter;/);
  assert.equal((letter.style as Record<string, string>)["--print-page-height"], "27.94cm");
});

test("Word: sayfa ölçüsü twip olarak", async () => {
  const xml = async (pageSize?: "a4" | "letter") => {
    const doc = await buildDocxFromTiptap({ title: "T", doc: BELGE, fetchImage: async () => null, pageSize });
    const zip = await Packer.toBuffer(doc);
    const { default: JSZip } = await import("jszip");
    return (await JSZip.loadAsync(zip)).file("word/document.xml")!.async("string");
  };
  assert.match(await xml(), /<w:pgSz w:w="11906" w:h="16838"/);
  assert.match(await xml("letter"), /<w:pgSz w:w="12240" w:h="15840"/);
});

test("sayfa tahmini: Letter kısa olduğu için aynı metin daha çok sayfa", () => {
  const ayar = { fontSizePt: 12, lineSpacing: 2, margins: { top: 2.54, bottom: 2.54, left: 3.81, right: 2.54 } };
  assert.ok(estimatePages(60000, { ...ayar, pageSize: "letter" }) > estimatePages(60000, ayar));
});

test("eşitleme ve sayfa düzeni farkı kâğıt boyutunu da taşıyor", () => {
  const kilavuz = {
    id: "k", version: "v2", label: "", universityName: "", instituteName: null, versionLabel: null, sourceUrl: null,
    citationStyle: "apa7", numberFormat: {}, requiredSections: [], minPages: null, maxPages: null,
    settings: { pageSize: "letter" }, lastCheckedAt: null, updatePending: false, dogrulandi: false,
  } as unknown as AppliedGuideline;
  const metin = {
    margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }, showPageNumbers: true, headingNumbering: false,
    settingsSource: { guidelineId: "k", version: "v1", customized: false },
  };
  const sonuc = resolveGuidelineSync(kilavuz, metin, "en");
  assert.equal(sonuc.mode, "auto-applied");
  assert.equal(sonuc.pageSize, "letter");
  assert.deepEqual(sonuc.changes.map((d) => `${d.label}: ${d.from} → ${d.to}`), ["Paper size: A4 → US Letter (8.5 × 11 in)"]);
  assert.equal(resolveGuidelineSync(null, metin).pageSize, "a4", "eski kayıt A4");

  const farklar = sayfaDuzeniFarklari({ margins: metin.margins, showPageNumbers: true, pageSize: "a4", kilavuz: { pageSize: "letter" } });
  assert.deepEqual(farklar, [{ alan: "Kâğıt boyutu", simdi: "A4", kilavuz: "US Letter (8,5 × 11 inç)" }]);
});
