// CSL stil dizinini (lib/atif/csl-dizini.json) yeniden üretir.
//
//   git clone --depth 1 https://github.com/citation-style-language/styles /tmp/csl-styles
//   node scripts/csl-dizini-uret.mjs /tmp/csl-styles
//
// Kod (lib/atif/csl-kimlik.ts) stilin metin içi atfının biçimi. Numaralı
// stillerde XML'den okunmuyor, citeproc ile ÇİZİLİP okunuyor: köşeli
// parantez stilden stile farklı yerde yazılıyor (layout öneki, group,
// text öğesi) ve XML'e bakan ilk sürüm IEEE'yi bile kaçırmıştı. Kodu
// çıkmayan stil (etiket "[Smi20]", öneksiz "1") dizine girmez.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// citeproc yalnızca CommonJS olarak yayımlanıyor.
const CSL = createRequire(import.meta.url)("citeproc");

const kok = process.argv[2];
if (!kok) throw new Error("Kullanım: node scripts/csl-dizini-uret.mjs <styles deposu>");
const en = JSON.parse(fs.readFileSync("lib/atif/csl-yerel.json", "utf8"))["en-US"];
const ORNEK = { id: "k", type: "article-journal", title: "T", author: [{ family: "Smith", given: "J" }], issued: { "date-parts": [[2020]] }, "container-title": "J", volume: "1", page: "1-2" };
const coz = (s) => (s ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function numaraKodu(xml) {
  try {
    const m = new CSL.Engine({ retrieveLocale: () => en, retrieveItem: () => ORNEK }, xml, "en-US", true);
    m.setOutputFormat("html");
    m.updateItems(["k"]);
    const c = m.makeCitationCluster([{ id: "k" }]).trim();
    const d = c.replace(/<[^>]+>/g, "").trim();
    if (/^<sup>|vertical-align:\s*sup/.test(c)) return "s";
    if (/^\[1[\]\s,]/.test(d)) return "k";
    if (/^\(1[)\s,]/.test(d)) return "p";
    if (/^\(Smith,? 2020\)$/.test(d)) return "a"; // "numeric" yazılmış ama yazar-tarih çizen stiller
  } catch {
    // Bozuk stil dizine girmez.
  }
  return null;
}

const bagimsiz = new Map();
for (const f of fs.readdirSync(kok).filter((x) => x.endsWith(".csl"))) {
  const xml = fs.readFileSync(path.join(kok, f), "utf8");
  const bicim = xml.match(/citation-format="([^"]+)"/)?.[1];
  const kod = { "author-date": "a", note: "d", author: "y" }[bicim] ?? (bicim === "numeric" ? numaraKodu(xml) : null);
  bagimsiz.set(f.replace(/\.csl$/, ""), { baslik: coz(xml.match(/<title>([^<]*)<\/title>/)?.[1]), kod });
}
const satirlar = [...bagimsiz].filter(([, v]) => v.kod).map(([ad, v]) => [ad, v.baslik, v.kod]);
const dkok = path.join(kok, "dependent");
for (const f of fs.readdirSync(dkok).filter((x) => x.endsWith(".csl"))) {
  const xml = fs.readFileSync(path.join(dkok, f), "utf8");
  const ebeveyn = /<link[^>]*rel="independent-parent"[^>]*>/.exec(xml)?.[0].match(/styles\/([a-z0-9-]+)"/)?.[1];
  const ust = ebeveyn && bagimsiz.get(ebeveyn);
  if (ust?.kod) satirlar.push([f.replace(/\.csl$/, ""), coz(xml.match(/<title>([^<]*)<\/title>/)?.[1]), ust.kod, ebeveyn]);
}
fs.writeFileSync("lib/atif/csl-dizini.json", JSON.stringify(satirlar));
console.log(`✓ ${satirlar.length} stil yazıldı`);
