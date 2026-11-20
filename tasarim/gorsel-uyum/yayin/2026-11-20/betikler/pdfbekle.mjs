import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/home/user/arvolab-tasarim/package.json");
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const P = JSON.parse(fs.readFileSync(`${D}iz.json`, "utf8")).calisma;
const b = await chromium.launch();
for (const [w, h, tema] of [[1440, 900, "light"], [1280, 800, "dark"], [1440, 900, "dark"], [1280, 800, "light"]]) {
  const c = await b.newContext({ baseURL: "https://lab.arvo-os.com", storageState: `${D}oturum.json`, viewport: { width: w, height: h }, colorScheme: tema });
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 150)));
  const kotu = []; s.on("response", (r) => { if (r.status() >= 400) kotu.push(`${r.status()} ${r.url().slice(0, 90)}`); });
  const t0 = Date.now();
  await s.goto(`/dashboard/editor/${P}/write?sol=kaynaklar&sag=pdf`);
  const ok = await s.locator(".kaynak-pdf-paneli canvas").first().waitFor({ state: "visible", timeout: 45000 }).then(() => true).catch(() => false);
  const sure = Date.now() - t0;
  await s.waitForTimeout(1500);
  const liste = await s.evaluate(() => /Kaynaklar yükleniyor/.test(document.body.innerText));
  await s.screenshot({ path: `${D}pdfbekle-${w}-${tema}.png` });
  console.log(JSON.stringify({ w, tema, pdfCizildi: ok, ms: sure, listeHalaYukleniyor: liste, hata, kotu }));
  await c.close();
}
await b.close();
