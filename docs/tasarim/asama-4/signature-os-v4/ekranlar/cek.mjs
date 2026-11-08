#!/usr/bin/env node
/* V4.2 ekran görüntüleri: node ekranlar/cek.mjs <klasör> [genişlik-süzgeci]
   22 zorunlu ekran (11 × açık/koyu) + 6 konsept görseli. */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const CIKTI = path.resolve(process.argv[2] ?? path.join(KOK, "cikti"));
fs.mkdirSync(CIKTI, { recursive: true });
// [no, sayfa, genişlik, tam sayfa mı]
// Editör ekranları görünüm boyunda çekilir: editörün "ilk ekranı" ölçütün kendisi.
export const ISLER = [
  ["01", "ana-sayfa", 1440, true], ["02", "ana-sayfa", 390, true],
  ["03", "calismalarim", 1440, true], ["04", "calismalarim", 390, true],
  ["05", "calisma-ayrinti", 390, true],
  ["06", "editor", 1440, false], ["07", "editor", 390, false],
  ["08", "editor-ai", 1440, false], ["09", "editor-ai", 390, false],
  ["10", "kaynaklar", 1440, true], ["11", "kaynaklar", 390, true],
  ["K1", "konsept-editor-pdf", 1440, false],
  ["K2", "konsept-editor-pdf-ai", 1440, false],
  ["K3", "konsept-editor-pdf-ai-1024", 1024, false],
];
const suzgec = process.argv[3];
const tarayici = await chromium.launch();
let n = 0;
for (const [no, sayfa, w, tam] of ISLER) for (const tema of ["light", "dark"]) {
  if (suzgec && !`${no}-${sayfa}`.includes(suzgec)) continue;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w > 760 ? 900 : 844 }, deviceScaleFactor: 2 });
  const s = await ctx.newPage();
  await s.goto(`file://${path.join(KOK, `${sayfa}.html`)}`, { waitUntil: "networkidle" });
  await s.evaluate(([tel, tema]) => { document.body.classList.add(tel ? "telefon" : "masaustu"); document.documentElement.dataset.theme = tema; }, [w < 761, tema]);
  await s.evaluate(() => document.fonts.ready);
  const ad = `${no}-${sayfa.endsWith(`-${w}`) ? sayfa : `${sayfa}-${w}`}-${tema === "light" ? "acik" : "koyu"}.png`;
  // Sabit alt gezinme: tam sayfa çekimde ilk görünümün altına çizilmesin diye görünüm sayfa boyuna büyütülür (v3'te öğrenildi).
  if (tam && w < 761) {
    const boy = await s.evaluate(() => document.documentElement.scrollHeight);
    await s.setViewportSize({ width: w, height: boy });
    await s.screenshot({ path: path.join(CIKTI, ad) });
  } else await s.screenshot({ path: path.join(CIKTI, ad), fullPage: tam });
  n++;
  await ctx.close();
}
await tarayici.close();
console.log(`${n} görüntü → ${CIKTI}`);
