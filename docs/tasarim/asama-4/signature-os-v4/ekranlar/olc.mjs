#!/usr/bin/env node
/*
  V4.2 ekran ölçümü. v3/olc.mjs'nin ölçüleri + v4'e özgü üç ölçü:
  birincil düğme SAYISI (ilke 1: ekranda bir kez), editörde metin sütunu
  genişliği (panel açıkken ≥600 px) ve yazı alanının başladığı nokta.
    node ekranlar/olc.mjs > ekranlar/olcum.json
*/
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const ISLER = [["ana-sayfa", 1440], ["ana-sayfa", 390], ["ana-sayfa", 360], ["calismalarim", 1440], ["calismalarim", 390], ["calismalarim", 360],
  ["calisma-ayrinti", 390], ["calisma-ayrinti", 360], ["editor", 1440], ["editor", 390], ["editor", 360], ["editor-ai", 1440], ["editor-ai", 390], ["editor-ai", 360],
  ["kaynaklar", 1440], ["kaynaklar", 390], ["kaynaklar", 360],
  ["konsept-editor-pdf", 1440], ["konsept-editor-pdf-ai", 1440], ["konsept-editor-pdf-ai-1024", 1024]];
const b = await chromium.launch();
const sonuc = [];
for (const [sayfa, w] of ISLER) for (const tema of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 760 ? 900 : 844 } });
  const s = await ctx.newPage();
  await s.goto(`file://${path.join(KOK, `${sayfa}.html`)}`);
  const r = await s.evaluate(([tel, tema]) => {
    document.body.classList.add(tel ? "telefon" : "masaustu");
    document.documentElement.dataset.theme = tema;
    const kok = document.querySelector(tel ? ".telefon-yalniz" : ".masaustu-yalniz");
    const gorunur = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    // Ekran içinde mi (alt sayfanın arkasında kalan ya da sayfa dışına kaymış öğe dokunma ölçüsüne girmez).
    const ekranda = (e) => { const r = e.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; };
    const rgb = (c) => { const n = (c.match(/[\d.]+/g) || []).map(Number); return c.startsWith("color(") ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
    const lum = ([r, g, b]) => [r, g, b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
    const zemin = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
    let enDusuk = 99, enDusukMetin = "";
    for (const e of kok.querySelectorAll("*")) {
      // .pdf-sayfa dış belgenin benzetimi (kendi renkleri var), .ortu altındakiler örtülü; ölçüme girmez.
      if (!gorunur(e) || e.closest(".ortu, .pdf-sayfa, svg")) continue;
      const metin = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
      if (!metin) continue;
      const f = lum(rgb(getComputedStyle(e).color)), z = lum(zemin(e));
      const k = (Math.max(f, z) + 0.05) / (Math.min(f, z) + 0.05);
      if (k < enDusuk) { enDusuk = k; enDusukMetin = metin.slice(0, 30); }
    }
    const birincil = [...kok.querySelectorAll(".d-birincil")].filter(gorunur);
    const cta = birincil[0];
    let kucuk = 0, enKucuk = 99, kucukler = [];
    if (tel) for (const e of kok.querySelectorAll("a, button, [role=tab], summary")) {
      if (!gorunur(e) || !ekranda(e) || e.closest("p")) continue;
      const r = e.getBoundingClientRect(); const m = Math.min(r.width, r.height);
      if (m < 44) { kucuk++; enKucuk = Math.min(enKucuk, Math.round(m)); kucukler.push((e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20)); }
    }
    const kagit = kok.querySelector(".kagit, .tel-kagit");
    let sutun = null, yaziBaslar = null;
    if (kagit) {
      const st = getComputedStyle(kagit);
      sutun = Math.round(kagit.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight));
      const ilk = kagit.querySelector("h2, p");
      yaziBaslar = ilk ? Math.round(ilk.getBoundingClientRect().top) : null;
    }
    const imza = [...kok.querySelectorAll("*")].filter((e) => gorunur(e) && !e.closest(".logo-acik, .logo-koyu, .tema-gunes, .tema-ay")).map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; });
    // Yatay taşma: belge VE kök içindeki kaydırılmayan kutular. Bilerek kayan şeritler (overflow-x:auto) sayılmaz.
    const tasan = [...kok.querySelectorAll("*")].filter((e) => gorunur(e) && !e.closest("[data-kayan], .serit, .suzgecler, .sekmeler, .bolme-sekme") && e.getBoundingClientRect().right > innerWidth + 1).length;
    let altta = null;
    const ac = kok.querySelector(".ac");
    if (tel && ac) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const son = [...kok.querySelectorAll("main *, .tel > *:not(.ac) *")].filter((e) => gorunur(e) && !e.closest(".ac")).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
      altta = Math.round(ac.getBoundingClientRect().top - son);
      window.scrollTo(0, 0);
    }
    return {
      imza, birincil: birincil.length, cta: cta ? Math.round(cta.getBoundingClientRect().bottom) : null,
      sutun, yaziBaslar, altta,
      yukseklik: document.documentElement.scrollHeight,
      tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth, tasan,
      kontrast: Math.round(enDusuk * 100) / 100, kontrastMetin: enDusukMetin,
      dokunma: tel ? kucuk : null, enKucuk: tel && enKucuk < 99 ? enKucuk : null, kucukler: kucukler.slice(0, 6),
    };
  }, [w < 761, tema]);
  sonuc.push({ sayfa, w, tema, ...r });
  await ctx.close();
}
await b.close();
for (const x of sonuc) {
  const es = sonuc.find((y) => y.sayfa === x.sayfa && y.w === x.w && y.tema !== x.tema);
  x.temaFarki = es ? x.imza.filter((v, i) => v !== es.imza[i]).length + Math.abs(x.imza.length - es.imza.length) : null;
}
for (const x of sonuc) delete x.imza;
console.log(JSON.stringify(sonuc, null, 1));
