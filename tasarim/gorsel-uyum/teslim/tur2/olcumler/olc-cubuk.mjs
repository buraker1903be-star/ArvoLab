// Klasik kaydırma çubuğuyla 1195–1220 px: JS kararı (clientWidth) ile CSS kırılımı (min-width:1200) ayrışıyor mu, sonucu ne?
import { chromium, H, UYG, yaz } from "./ortak.mjs";
const b = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
const c = await b.newContext({ baseURL: UYG, viewport: { width: 1300, height: 800 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
const s = await c.newPage();
await s.goto("/"); await s.fill('input[name="email"]', H.A.adres); await s.fill('input[name="password"]', H.A.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
const OLC = () => {
  const y = document.querySelector(".manuscript-layout"); const de = document.documentElement;
  const R = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const kagit = R(".manuscript-editor-content"), panel = R(".kaynak-pdf-paneli") || R(".yazim-paneli"), sol = R(".os-gezinme") , solAlan = R(".os-sol-alan[data-acik]");
  const arac = document.querySelector(".manuscript-araclar");
  const ogeler = arac ? [...arac.querySelectorAll("button, select")].filter((e) => e.offsetParent) : [];
  const ar = arac?.getBoundingClientRect();
  const erisilemez = ogeler.filter((e) => { const q = e.getBoundingClientRect(); const x = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !(e === x || e.contains(x)) || q.right > ar.right + 1 || q.left < ar.left - 1; }).length;
  const ust = ["Kontroller", "Word, PDF ya da LaTeX"].map((n) => { const e = [...document.querySelectorAll("#ust-cubuk-yuva button")].find((x) => (x.getAttribute("aria-label") || x.textContent).includes(n)); if (!e) return n + ":yok"; const q = e.getBoundingClientRect(); const x = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return n + ":" + (e === x || e.contains(x) ? "ok" : "örtülü"); });
  const solKenar = solAlan ?? sol;
  return {
    inner: innerWidth, client: de.clientWidth, cubuk: innerWidth - de.clientWidth, cssMasaustu: matchMedia("(min-width: 1200px)").matches,
    jsMasaustu: y?.hasAttribute("data-sabit-kagit") ?? null, cekmece: y?.hasAttribute("data-sag-cekmece") ?? null,
    olcek: kagit ? Number(getComputedStyle(document.querySelector(".manuscript-editor-content")).zoom) : null,
    yatayTasma: de.scrollWidth > de.clientWidth + 1,
    kagitSolOrtusme: Boolean(kagit && solKenar && kagit.left < solKenar.right - 1),
    kagitPanelOrtusme: Boolean(kagit && panel && !y?.hasAttribute("data-sag-cekmece") && kagit.right > panel.left + 1),
    kagitSagTasma: Boolean(kagit && kagit.right > de.clientWidth + 1),
    aracErisilemez: erisilemez, ust: ust.join(" "),
  };
};
const satirlar = [];
for (const [ad, adres] of [["panelsiz", ""], ["ai", "?sag=ai"], ["pdf", "?sag=pdf"], ["liste", "?sol=kaynaklar"], ["liste+pdf", "?sol=kaynaklar&sag=pdf"]]) {
  await s.setViewportSize({ width: 1300, height: 800 });
  await s.goto(`${yaz}${adres}`); await s.waitForSelector(".ProseMirror", { timeout: 60000 }); await s.waitForTimeout(1500);
  for (const g of [1195, 1199, 1200, 1203, 1207, 1211, 1214, 1215, 1216, 1220]) {
    await s.setViewportSize({ width: g, height: 800 }); await s.waitForTimeout(700);
    const r = await s.evaluate(OLC);
    satirlar.push({ ad, g, ...r });
    console.log(ad.padEnd(10), String(g), JSON.stringify(r));
  }
}
await b.close();
