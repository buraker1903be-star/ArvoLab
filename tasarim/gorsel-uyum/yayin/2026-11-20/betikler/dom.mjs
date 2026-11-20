import { createRequire } from "node:module";
const require = createRequire("/home/user/arvolab-tasarim/package.json");
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const b = await chromium.launch();
const c = await b.newContext({ baseURL: "https://lab.arvo-os.com", storageState: `${D}oturum.json`, viewport: { width: 1440, height: 900 } });
const s = await c.newPage(); await s.goto("/dashboard"); await s.waitForLoadState("networkidle");
console.log(await s.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.children.length < 3 && /Yeni çalışma/.test(e.textContent || "") && (e.tagName === "BUTTON" || e.tagName === "A" || e.tagName === "SUMMARY")).map((e) => `${e.tagName} visible=${!!e.offsetParent} cls=${e.className} text=${JSON.stringify(e.textContent.trim())}`).join("\n")));
await b.close();
