import assert from "node:assert/strict";
import test from "node:test";
import { latexKacis, tiptapLatex } from "@/lib/tiptap-latex";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { belge } from "./ortam";

/*
  LaTeX çıktısı (03.11.2026). Dördüncü çıktı yolu: başlık ve şekil/tablo
  numaraları yazdırmayla AYNI olmalı (iki çıktı ayrışırsa öğrenci
  Overleaf'te başka bir tez görür). Belge önce gerçek şemadan geçiriliyor:
  test, editörün üretemeyeceği bir JSON'u dönüştürüp yeşil kalmasın.
*/
const yazi = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [yazi(text)] });

const icerik = [
  h(1, "Özet"),
  p(yazi("Kısa özet.")),
  h(1, "Giriş"),
  p(yazi("Enflasyon %5 arttı & işsizlik "), yazi("düştü", [{ type: "italic" }]), yazi(" (Yılmaz, 2020)."), { type: "footnoteReference", attrs: { text: "Bkz. TÜİK_2020 {veri}." } }),
  h(2, "Amaç"),
  p(yazi("R² = 0,45; χ² ≤ 3 ve sonuç.¹")),
  { type: "paragraph", attrs: { caption: "table" }, content: [yazi("Değişkenler")] },
  {
    type: "table",
    content: [
      { type: "tableRow", content: [{ type: "tableHeader", content: [p(yazi("A"))] }, { type: "tableHeader", content: [p(yazi("B"))] }] },
      { type: "tableRow", content: [{ type: "tableCell", content: [p(yazi("1"))] }, { type: "tableCell", content: [p(yazi("2"))] }] },
    ],
  },
  p(yazi("Asistanın cümlesi.", [{ type: "asistanIzi", attrs: { kayit: "k1" } }])),
  h(1, "Kaynakça"),
  p(yazi("Yılmaz, A. (2020). "), yazi("Kitap", [{ type: "italic" }]), yazi(". Yayınevi.")),
];
const doc = belge(...(icerik as never[])).toJSON() as never;

test("kaçış: özel karakterler ve simgeler", () => {
  assert.equal(latexKacis("50% & $_#{}~^\\"), "50\\% \\& \\$\\_\\#\\{\\}\\textasciitilde{}\\textasciicircum{}\\textbackslash{}");
  assert.equal(latexKacis("R² ve x¹²"), "R\\textsuperscript{2} ve x\\textsuperscript{12}");
  assert.equal(latexKacis("¹⁽ᵖ⁵⁰⁾"), "\\textsuperscript{1(p50)}");
  assert.equal(latexKacis("H₂O −1 ± 2"), "H\\textsubscript{2}O $-$1 $\\pm$ 2");
  assert.equal(latexKacis('"alıntı"'), "``alıntı''");
});

test("belge: başlık numaraları yazdırmayla aynı, numarasız bölüm numarasız", () => {
  const { tex } = tiptapLatex(doc, { baslik: "Tez & Deneme", headingNumbering: true });
  const html = renderTiptapHtml(doc, { headingNumbering: true }).html;
  // Yazdırmada "1 Giriş" / "1.1 Amaç" ne ise LaTeX'te de o.
  const yazdirmaNumaralari = [...html.matchAll(/<h\d[^>]*>([\d.]+) /g)].map((m) => m[1]);
  const latexNumaralari = [...tex.matchAll(/\\(?:sub)*section\*\{([\d.]+) /g)].map((m) => m[1]);
  assert.deepEqual(latexNumaralari, yazdirmaNumaralari);
  assert.ok(yazdirmaNumaralari.length >= 2);
  assert.match(tex, /\\section\*\{Özet\}/);
  assert.match(tex, /\\section\*\{Kaynakça\}/);
  assert.match(tex, /\\title\{Tez \\& Deneme\}/);
});

test("belge: biçim, dipnot, tablo, başlık; asistan izi görünmez", () => {
  const { tex, gorseller } = tiptapLatex(doc, { baslik: "T" });
  assert.match(tex, /Enflasyon \\%5 arttı \\& işsizlik \\textit\{düştü\} \(Yılmaz, 2020\)\.\\footnote\{Bkz\. TÜİK\\_2020 \\\{veri\\\}\.\}/);
  assert.match(tex, /R\\textsuperscript\{2\} = 0,45; \$\\chi\$\\textsuperscript\{2\} \$\\leq\$ 3 ve sonuç\.\\textsuperscript\{1\}/);
  assert.match(tex, /\\textbf\{Tablo 1\.\} Değişkenler/);
  assert.match(tex, /\\begin\{tabularx\}\{\\linewidth\}\{\|X\|X\|\}/);
  assert.match(tex, /\\textbf\{A\} & \\textbf\{B\} \\\\ \\hline/);
  assert.match(tex, /Asistanın cümlesi\./);
  assert.ok(!/asistan/i.test(tex.replace("Asistanın cümlesi.", "")));
  assert.match(tex, /Yılmaz, A\. \(2020\)\. \\textit\{Kitap\}\. Yayınevi\./);
  assert.deepEqual(gorseller, []);
  assert.match(tex, /\\begin\{document\}[\s\S]*\\end\{document\}\s*$/);
});

test("görsel pakete dosya olarak girer; İngilizce belgede etiket ve dil", () => {
  const gorselli = belge(p(yazi("x")) as never, { type: "image", attrs: { src: "data:image/jpeg;base64,AAAA" } } as never).toJSON() as never;
  const { tex, gorseller } = tiptapLatex(gorselli, { baslik: "T", dil: "en" });
  assert.deepEqual(gorseller, [{ ad: "gorseller/gorsel-1.jpg", src: "data:image/jpeg;base64,AAAA" }]);
  assert.match(tex, /\\includegraphics\[width=0\.9\\linewidth\]\{gorseller\/gorsel-1\.jpg\}/);
  assert.match(tex, /\\usepackage\[english\]\{babel\}/);
});
