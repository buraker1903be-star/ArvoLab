#!/usr/bin/env node
/* Örnek bileşen sayfası görüntüleri (1440, açık/koyu). */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const CIKTI = path.resolve(process.argv[2] ?? KOK);
fs.mkdirSync(CIKTI, { recursive: true });
const b = await chromium.launch();
for (const tema of ["light", "dark"]) {
  const s = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await s.goto(`file://${path.join(KOK, "bilesenler.html")}`, { waitUntil: "networkidle" });
  await s.evaluate((t) => { document.documentElement.dataset.theme = t; dispatchEvent(new Event("load")); }, tema);
  await s.evaluate(() => document.fonts.ready);
  const yuklu = await s.evaluate(() => document.fonts.check('500 24px Newsreader'));
  await s.screenshot({ path: path.join(CIKTI, `bilesenler-${tema === "light" ? "acik" : "koyu"}.png`), fullPage: true });
  console.log(tema, "Newsreader yüklü:", yuklu);
  await s.close();
}
await b.close();
