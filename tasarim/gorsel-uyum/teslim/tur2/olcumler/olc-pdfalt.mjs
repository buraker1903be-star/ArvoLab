import { chromium, oturum, ac, yaz } from "./ortak.mjs";
const b = await chromium.launch();
for (const [g, h, adres] of [[1440, 900, "?sol=kaynaklar&sag=pdf"], [1280, 800, "?sag=pdf"], [1920, 1080, "?sag=pdf"], [1200, 800, "?sag=pdf"]]) {
  const { c, s } = await oturum(b, { genislik: g, yukseklik: h });
  await ac(s, `${yaz}${adres}`); await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(1200);
  const r = await s.evaluate(() => {
    const p = document.querySelector(".kaynak-pdf-paneli"); const pr = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    const kids = [...p.children].map((e) => { const q = e.getBoundingClientRect(); return `${e.className.split(" ")[0]}:${Math.round(q.top)}-${Math.round(q.bottom)}`; });
    const not = p.querySelector(".yazim-bos-not");
    const alt = p.querySelector(".kaynak-pdf-alt");
    const altIc = [...alt.querySelectorAll(":scope > *, :scope > * > *")].map((e) => `${String(e.className).split(" ")[0] || e.tagName}:${Math.round(e.getBoundingClientRect().height)}`);
    const nr = not?.getBoundingClientRect();
    return { panel: `${Math.round(pr.top)}-${Math.round(pr.bottom)}`, overflow: cs.overflow, sh: p.scrollHeight, ch: p.clientHeight, ekran: innerHeight, kids, not: nr ? `${Math.round(nr.top)}-${Math.round(nr.bottom)}` : null, altKayar: alt.scrollHeight > alt.clientHeight + 1, altIc, sayfaAlani: Math.round(p.querySelector(".pdf-sayfa-alani")?.getBoundingClientRect().height ?? 0) };
  });
  console.log(g, adres, JSON.stringify(r));
  await c.close();
}
await b.close();
