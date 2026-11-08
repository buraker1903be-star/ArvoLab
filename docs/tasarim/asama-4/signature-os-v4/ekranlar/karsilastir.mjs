#!/usr/bin/env node
/* v3 (revize) ↔ v4 yan yana: node ekranlar/karsilastir.mjs <v3-görüntü-klasörü> <çıktı>
   v3 görüntüleri docs/tasarim/asama-3/v3/cek.mjs ile üretilir; v4 görüntüleri ekran-goruntuleri/. */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const V3 = path.resolve(process.argv[2]);
const CIKTI = path.resolve(process.argv[3] ?? path.join(KOK, "../karsilastirma"));
const V4 = path.resolve(KOK, "../ekran-goruntuleri");
fs.mkdirSync(CIKTI, { recursive: true });
// [ad, v3 dosyası, v4 dosyası, telefon mu]
const CIFTLER = [
  ["ana-sayfa-1440", "dashboard-1440", "01-ana-sayfa-1440", false],
  ["calismalarim-1440", "calismalarim-1440", "03-calismalarim-1440", false],
  ["editor-ai-1440", "editor-ai-1440", "08-editor-ai-1440", false],
  ["kaynaklar-1440", "kaynaklar-1440", "10-kaynaklar-1440", false],
  ["telefon-ana-ayrinti", null, null, true],
  ["telefon-editor-kaynak", null, null, true],
];
const TEL = {
  "telefon-ana-ayrinti": [["Ana Sayfa", "dashboard-390", "02-ana-sayfa-390"], ["Çalışma ayrıntısı", "calisma-ayrinti-390", "05-calisma-ayrinti-390"]],
  "telefon-editor-kaynak": [["Editör + AI", "editor-ai-390", "09-editor-ai-390"], ["Kaynaklar", "kaynaklar-390", "11-kaynaklar-390"]],
};
const veri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
const b = await chromium.launch();
for (const [ad, v3, v4, tel] of CIFTLER) for (const tema of ["acik", "koyu"]) {
  const s = await b.newPage({ viewport: { width: tel ? 1680 : 2000, height: 900 }, deviceScaleFactor: 1 });
  const sutun = (baslik, dosya) => `<figure><figcaption>${baslik}</figcaption><img src="${veri(dosya)}"/></figure>`;
  const govde = tel
    ? `<div class="cift">${TEL[ad].map(([e, a, c]) => `${sutun(`v3 revize · ${e}`, path.join(V3, `${a}-${tema}.png`))}${sutun(`v4 · ${e}`, path.join(V4, `${c}-${tema}.png`))}`).join("")}</div>`
    : `<div class="cift">${sutun("v3 revize", path.join(V3, `${v3}-${tema}.png`))}${sutun("v4 Signature Academic OS", path.join(V4, `${v4}-${tema}.png`))}</div>`;
  await s.setContent(`<!doctype html><style>
    body{margin:0;padding:24px;background:${tema === "acik" ? "#e7eaee" : "#05080d"};font:600 22px/1.3 Inter,system-ui,sans-serif;color:${tema === "acik" ? "#15233a" : "#e4e9f0"}}
    .cift{display:flex;gap:24px;align-items:flex-start;margin-bottom:24px}
    figure{margin:0;flex:1}figcaption{margin-bottom:10px}img{width:100%;display:block;border:1px solid #8793a5}
  </style>${govde}`);
  await s.waitForLoadState("load");
  await s.screenshot({ path: path.join(CIKTI, `${ad}-${tema}.png`), fullPage: true });
  await s.close();
}
await b.close();
console.log(`${CIFTLER.length * 2} karşılaştırma → ${CIKTI}`);
