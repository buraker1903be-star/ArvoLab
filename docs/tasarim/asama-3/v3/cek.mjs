#!/usr/bin/env node
/* v3 maket görüntüleri: node docs/tasarim/asama-3/v3/cek.mjs <klasör> */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const CIKTI = path.resolve(process.argv[2] ?? path.join(KOK, "cikti"));
fs.mkdirSync(CIKTI, { recursive: true });
// [sayfa, genişlik, tam sayfa mı]
const ISLER = [
  ["dashboard", 1440, true], ["dashboard", 390, true],
  ["calismalarim", 1440, true], ["calismalarim", 390, true],
  ["calisma-ayrinti", 390, true],
  ["editor", 1440, false], ["editor", 390, false],
  ["editor-ai", 1440, false], ["editor-ai", 390, false],
  ["kaynaklar", 1440, true], ["kaynaklar", 390, true],
  ["tokenlar", 1440, true],
];
const tarayici = await chromium.launch();
for (const [sayfa, w, tam] of ISLER) for (const tema of ["light", "dark"]) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w > 760 ? 900 : 844 }, deviceScaleFactor: 2 });
  const s = await ctx.newPage();
  await s.goto(`file://${path.join(KOK, `${sayfa}.html`)}`);
  await s.evaluate(([tel, tema]) => { document.body.classList.add(tel ? "telefon" : "masaustu"); document.documentElement.dataset.theme = tema; }, [w < 761, tema]);
  await s.evaluate(() => document.fonts.ready);
  const ad = `${sayfa}-${w}-${tema === "light" ? "acik" : "koyu"}.png`;
  await s.screenshot({ path: path.join(CIKTI, ad), fullPage: tam });
  await ctx.close();
}
await tarayici.close();
console.log(`${ISLER.length * 2} görüntü → ${CIKTI}`);
