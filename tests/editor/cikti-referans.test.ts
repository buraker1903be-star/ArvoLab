import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import tez from "@/tests/fixtures/tez-enflasyon-issizlik.json";
import { editorSchema, type JsonNode } from "./ortam";
// @ts-expect-error -- düz JS modülü; tarayıcı betiği de aynı dosyayı kullanıyor
import { wordOzeti, htmlOzeti, basliklar } from "./cikti-ozet.mjs";

/*
  ÇIKTI REFERANS TESTİ (R0, 07.11.2026).

  Word ve yazdırma/PDF çıktısının YAPISINI, referans sürümde (d12de9f —
  Phase 4.5 tasarım dilimlerinden önceki son ürün sürümü) üretilmiş
  özetle karşılaştırır. Özet: başlık düzeyi ve numarası, paragraf stili,
  hizalama, girinti, satır aralığı, kalın/italik/altı çizili/üst simge
  parçaları, tablolar, dipnotlar (tests/editor/cikti-ozet.mjs).

  Neden ayrıca bu test: cikti-yollari.test.ts her biçim KURALININ üç
  çıktıda da var olduğunu sınıyor, ama tek paragraflık belgelerle. Gerçek
  bir tezde kuralların ETKİLEŞİMİ (başlık numarasının tablo başlığıyla
  karışması, listenin içindeki kalın metin, kaynakça girintisi) ve
  "hiçbir şey değişmedi" sorusu orada görünmüyor. Tasarım dilimleri
  editörün kabuğunu değiştirirken çıktıyı değiştirmemeli; bu test onu
  sabitler.

  İki belge:
  1. tests/fixtures/tez-enflasyon-issizlik.json — önizlemedeki tezin
     kendisi (50 başlık, 14 tablo, 13 başlık etiketi, listeler, metin içi
     atıflar, Kaynakça).
  2. BICIM — tezde OLMAYAN biçimler: hizalama, ilk satır ve asılı girinti,
     satır aralığı, altı çizili, üst simge, dipnotta atıf, alıntı bloğu.

  Referansı yenilemek (çıktı BİLEREK değiştiğinde): ilgili değişikliği
  açıklayan commit'te `CIKTI_REFERANS_YAZ=1 npm run test:editor` ile
  yeniden yazın ve farkı gözden geçirin. Referans dosyasının farkı,
  değişikliğin belgeye etkisinin okunabilir kaydıdır.
*/

const KLASOR = join(dirname(fileURLToPath(import.meta.url)), "referans");
const YAZ = process.env.CIKTI_REFERANS_YAZ === "1";

const metin = (t: string, marks?: JsonNode["marks"]): JsonNode => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const par = (attrs: Record<string, unknown> | null, ...content: JsonNode[]): JsonNode => ({ type: "paragraph", ...(attrs ? { attrs } : {}), content });
const baslik = (level: number, t: string): JsonNode => ({ type: "heading", attrs: { level }, content: [metin(t)] });

const BICIM: { type: "doc"; content: JsonNode[] } = {
  type: "doc",
  content: [
    baslik(1, "Giriş"),
    par(
      { textAlign: "justify", firstLineIndent: 1.25, lineSpacing: "1.5" },
      metin("Enflasyon ile işsizlik arasındaki ilişki "),
      metin("Phillips eğrisi", [{ type: "italic" }]),
      metin(" ile tanımlanır (Phillips, 1958). Bu çalışma "),
      metin("Türkiye", [{ type: "bold" }]),
      metin(" için "),
      metin("ARDL", [{ type: "underline" }]),
      metin(" yöntemini kullanır"),
      { type: "footnoteReference", attrs: { id: "fn-1", text: "Ayrıntılı tartışma için bkz. Friedman, M. (1968). The role of monetary policy. American Economic Review, 58(1), 1–17." } },
      metin(". R"),
      metin("2", [{ type: "superscript" }]),
      metin(" değeri raporlanır."),
    ),
    baslik(2, "Kuramsal Çerçeve"),
    par({ textAlign: "center" }, metin("Ortalanmış kısa paragraf.")),
    { type: "blockquote", content: [par(null, metin("Uzun doğrudan alıntı; kırk sözcüğü aşan alıntılar blok olarak verilir (Samuelson ve Solow, 1960, s. 185)."))] },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        { type: "listItem", content: [par(null, metin("Birinci hipotez "), metin("kalın", [{ type: "bold" }]))] },
        { type: "listItem", content: [par(null, metin("İkinci hipotez"))] },
      ],
    },
    par({ caption: "table" }, metin("Değişkenlerin tanımlayıcı istatistikleri")),
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", content: [par(null, metin("Değişken"))] }, { type: "tableHeader", content: [par(null, metin("Ortalama"))] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [par(null, metin("Enflasyon"))] }, { type: "tableCell", content: [par(null, metin("12,4"))] }] },
      ],
    },
    baslik(1, "Kaynakça"),
    par({ hangingIndent: 1.25 }, metin("Friedman, M. (1968). The role of monetary policy. "), metin("American Economic Review", [{ type: "italic" }]), metin(", 58(1), 1–17.")),
    par({ hangingIndent: 1.25 }, metin("Phillips, A. W. (1958). The relation between unemployment and the rate of change of money wage rates. "), metin("Economica", [{ type: "italic" }]), metin(", 25(100), 283–299.")),
    par({ hangingIndent: 1.25 }, metin("Samuelson, P. A. ve Solow, R. M. (1960). Analytical aspects of anti-inflation policy. "), metin("American Economic Review", [{ type: "italic" }]), metin(", 50(2), 177–194.")),
  ],
};

const BELGELER: { ad: string; doc: { type: "doc"; content?: JsonNode[] } }[] = [
  { ad: "tez", doc: tez as never },
  { ad: "bicim", doc: BICIM },
];

/* Ürünün varsayılan dışa aktarma seçenekleri: başlık numaralı, bölüm yeni sayfada. */
async function word(doc: unknown) {
  const d = await buildDocxFromTiptap({ title: "Referans", doc: doc as never, fetchImage: async () => null, headingNumbering: true } as never);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(d));
  const xml = await zip.file("word/document.xml")!.async("string");
  const fn = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
  return wordOzeti(xml, fn);
}
function yazdirma(doc: unknown) {
  const { html, footnotes } = renderTiptapHtml(doc as never, { headingNumbering: true, chapterNewPage: true });
  return htmlOzeti(html, footnotes);
}

/** Kaynak belgedeki metin içi atıflar: "(Soyad, 1958)", "(Soyad ve Soyad, 1960, s. 185)". */
function atiflar(doc: unknown): string[] {
  const s = JSON.stringify(doc);
  const metinler = [...s.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string).join(" ");
  return [...new Set([...metinler.matchAll(/\(([A-ZÇĞİÖŞÜ][^()]{0,80}?,\s*\d{4}[a-z]?(?:,\s*s\.\s*[\d–-]+)?)\)/g)].map((m) => m[1]))];
}
/** Kaynak belgedeki başlıklar: [{ duzey, metin }]. */
function kaynakBasliklari(doc: { content?: JsonNode[] }) {
  const out: { duzey: number; metin: string }[] = [];
  const gez = (n: JsonNode) => {
    if (n.type === "heading") out.push({ duzey: Number(n.attrs?.level), metin: (n.content ?? []).map((c) => c.text ?? "").join("").trim() });
    (n.content ?? []).forEach(gez);
  };
  (doc.content ?? []).forEach(gez);
  return out;
}

for (const { ad, doc } of BELGELER) {
  test(`çıktı referansı: ${ad}`, async (t) => {
    // Belge editörün şemasından geçmeli: kaydedilemeyecek bir belgeyi sınamak anlamsız.
    editorSchema.nodeFromJSON(doc).check();

    const ozet = { word: await word(doc), yazdirma: yazdirma(doc) };

    await t.test("başlıklar sırasıyla ve doğru düzeyde iki çıktıda da var", () => {
      const beklenen = kaynakBasliklari(doc);
      for (const yol of ["word", "yazdirma"] as const) {
        const bulunan = basliklar(ozet[yol]) as { duzey: number; metin: string }[];
        assert.equal(bulunan.length, beklenen.length, `${yol}: başlık sayısı`);
        bulunan.forEach((b, i) => {
          assert.equal(b.duzey, beklenen[i].duzey, `${yol}: "${beklenen[i].metin}" düzeyi`);
          // Numara (ör. "2.1 ") önde olabilir; başlığın kendisi sonda kalmalı.
          assert.ok(b.metin.replace(/…\s*\[.*\]$/, "").length > 0 && (b.metin.endsWith(beklenen[i].metin) || b.metin.includes(beklenen[i].metin.slice(0, 40))), `${yol}: "${b.metin}" ↔ "${beklenen[i].metin}"`);
        });
      }
    });

    await t.test("metin içi atıfların hepsi iki çıktıda da var", async () => {
      const liste = atiflar(doc);
      assert.ok(liste.length > 0, "belgede atıf bulunamadı — test bir şey sınamıyor");
      // Özet uzun paragrafları kısaltıyor; atıf kısaltılmamış metinde aranır.
      const ham = await hamMetin(doc);
      for (const a of liste) {
        assert.ok(ham.word.includes(a), `Word'de yok: (${a})`);
        assert.ok(ham.yazdirma.includes(a), `Yazdırmada yok: (${a})`);
      }
    });

    await t.test("kaynakça bölümü ve satırları iki çıktıda da var", () => {
      for (const yol of ["word", "yazdirma"] as const) {
        const b = ozet[yol].bloklar as { metin?: string }[];
        const i = b.findIndex((x) => /Kaynak(ça|lar)$/.test(x.metin ?? ""));
        assert.ok(i >= 0, `${yol}: Kaynakça başlığı yok`);
        assert.ok(b.slice(i + 1).filter((x) => /\(\d{4}[a-z]?\)/.test(x.metin ?? "")).length >= 3, `${yol}: kaynakça satırları eksik`);
      }
    });

    await t.test("yapı referans sürümle aynı", () => {
      const dosya = join(KLASOR, `${ad}.json`);
      const yeni = JSON.stringify(ozet, null, 1) + "\n";
      if (YAZ || !existsSync(dosya)) {
        assert.ok(YAZ, `Referans yok: ${dosya}. Referans sürümde CIKTI_REFERANS_YAZ=1 ile üretin.`);
        mkdirSync(KLASOR, { recursive: true });
        writeFileSync(dosya, yeni);
        return;
      }
      const eski = JSON.parse(readFileSync(dosya, "utf8"));
      // Önce yol yol karşılaştır: hangi çıktının saptığı mesajda görünsün.
      for (const yol of ["word", "yazdirma"] as const) {
        assert.deepEqual(ozet[yol].dipnotlar, eski[yol].dipnotlar, `${ad}/${yol}: dipnotlar değişti`);
        const n = Math.max(ozet[yol].bloklar.length, eski[yol].bloklar.length);
        for (let i = 0; i < n; i++) {
          assert.deepEqual(ozet[yol].bloklar[i], eski[yol].bloklar[i], `${ad}/${yol}: ${i}. blok değişti`);
        }
      }
      assert.deepEqual(JSON.parse(yeni), eski);
    });
  });
}

/* Atıf denetimi için kısaltılmamış ham metin (gövde + dipnotlar). */
async function hamMetin(doc: unknown) {
  const d = await buildDocxFromTiptap({ title: "Referans", doc: doc as never, fetchImage: async () => null, headingNumbering: true } as never);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(d));
  const xml = (await zip.file("word/document.xml")!.async("string")) + ((await zip.file("word/footnotes.xml")?.async("string")) ?? "");
  const word = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("").replace(/&amp;/g, "&");
  const { html, footnotes } = renderTiptapHtml(doc as never, { headingNumbering: true, chapterNewPage: true });
  const yazdirma = (html + footnotes.join(" ")).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  return { word, yazdirma };
}
