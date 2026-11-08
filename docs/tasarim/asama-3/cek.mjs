#!/usr/bin/env node
/*
  Maketlerin ekran görüntüleri: 1440 masaüstü ve 390 telefon, açık ve koyu.
    node docs/tasarim/asama-3/cek.mjs <çıktı-klasörü>
*/
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const CIKTI = path.resolve(process.argv[2] ?? path.join(KOK, "cikti"));
fs.mkdirSync(CIKTI, { recursive: true });

const tarayici = await chromium.launch();
const isler = [];
for (const sayfa of ["dashboard", "calismalarim"]) for (const w of [1440, 390]) for (const tema of ["light", "dark"]) isler.push({ sayfa, w, tema });
for (const tema of ["light", "dark"]) isler.push({ sayfa: "calismalarim-ayrinti", w: 390, tema });

for (const { sayfa, w, tema } of isler) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w > 760 ? 900 : 844 }, deviceScaleFactor: 2 });
  const s = await ctx.newPage();
  await s.goto(`file://${path.join(KOK, `${sayfa}.html`)}`);
  await s.evaluate(([tel, tema]) => {
    document.body.classList.add(tel ? "telefon" : "masaustu");
    document.documentElement.dataset.theme = tema;
  }, [w < 761, tema]);
  await s.evaluate(() => document.fonts.ready);
  const ad = `${sayfa}-${w}-${tema === "light" ? "acik" : "koyu"}.png`;
  await s.screenshot({ path: path.join(CIKTI, ad), fullPage: true });
  await ctx.close();
  console.log(ad);
}
await tarayici.close();
