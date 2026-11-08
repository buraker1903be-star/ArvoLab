#!/usr/bin/env node
/*
  Maket kalite ölçümü (talimat §9). Her ekranda aynı ölçüler:
  ana eylemin konumu, yüzey (kart) sayısı, başlık, içerik genişliği, sayfa
  boyu, yatay taşma, en düşük metin kontrastı, 44 px altı dokunma hedefi.
    node docs/tasarim/asama-3/v3/olc.mjs
*/
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const V2 = path.resolve(KOK, "..");
const ISLER = [
  ["v2", V2, "dashboard", 1440], ["v3", KOK, "dashboard", 1440], ["v2", V2, "dashboard", 390], ["v3", KOK, "dashboard", 390], ["v3", KOK, "dashboard", 360],
  ["v2", V2, "calismalarim", 1440], ["v3", KOK, "calismalarim", 1440], ["v2", V2, "calismalarim", 390], ["v3", KOK, "calismalarim", 390],
  ["v2", V2, "calismalarim-ayrinti", 390], ["v3", KOK, "calisma-ayrinti", 390], ["v3", KOK, "calisma-ayrinti", 360],
  ["v3", KOK, "editor", 1440], ["v3", KOK, "editor", 390], ["v3", KOK, "editor", 360], ["v3", KOK, "editor-ai", 1440], ["v3", KOK, "editor-ai", 390],
  ["v3", KOK, "kaynaklar", 1440], ["v3", KOK, "kaynaklar", 390], ["v3", KOK, "kaynaklar", 360],
];
const b = await chromium.launch();
const sonuc = [];
for (const [surum, kok, sayfa, w] of ISLER) for (const tema of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 760 ? 900 : 844 } });
  const s = await ctx.newPage();
  await s.goto(`file://${path.join(kok, `${sayfa}.html`)}`);
  const r = await s.evaluate(([tel, tema]) => {
    document.body.classList.add(tel ? "telefon" : "masaustu");
    document.documentElement.dataset.theme = tema;
    const kok = document.querySelector(tel ? ".telefon-yalniz" : ".masaustu-yalniz");
    const gorunur = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    const rgb = (c) => { const n = (c.match(/[\d.]+/g) || []).map(Number); return c.startsWith("color(") ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
    const lum = ([r, g, b]) => [r, g, b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
    const zemin = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
    let enDusuk = 99, enDusukMetin = "";
    for (const e of kok.querySelectorAll("*")) {
      if (!gorunur(e) || e.closest(".ortu, .ac .ikon, svg")) continue;
      const metin = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
      if (!metin) continue;
      const f = lum(rgb(getComputedStyle(e).color)), z = lum(zemin(e));
      const k = (Math.max(f, z) + 0.05) / (Math.min(f, z) + 0.05);
      if (k < enDusuk) { enDusuk = k; enDusukMetin = metin.slice(0, 30); }
    }
    const yuzeyler = [...kok.querySelectorAll("*")].filter((e) => {
      if (!gorunur(e) || e.closest(".kc, .uc, .tu, .ac")) return false;
      const st = getComputedStyle(e), r = e.getBoundingClientRect();
      const golge = st.boxShadow !== "none";
      const kutulu = parseFloat(st.borderRadius) >= 8 && parseFloat(st.borderTopWidth) >= 1 && r.width * r.height > 30000 && rgb(st.backgroundColor)[3] !== 0;
      return (golge && r.width * r.height > 30000) || kutulu;
    });
    const golgeli = yuzeyler.filter((e) => getComputedStyle(e).boxShadow !== "none").length;
    const cta = kok.querySelector(".d-birincil, .dugme-birincil");
    const baslik = kok.querySelector(".calisma-baslik, .calisma-adi");
    const bs = baslik ? getComputedStyle(baslik) : null;
    const icerik = kok.querySelector("main, .masa .sayfa, .tel-sayfa");
    let kucuk = 0, enKucuk = 99;
    if (tel) for (const e of kok.querySelectorAll("a, button, [role=tab], summary")) {
      if (!gorunur(e) || e.closest("p")) continue;
      const r = e.getBoundingClientRect(); const m = Math.min(r.width, r.height);
      if (m < 44) { kucuk++; enKucuk = Math.min(enKucuk, Math.round(m)); }
    }
    return {
      cta: cta ? Math.round(cta.getBoundingClientRect().bottom) : null,
      yuzey: yuzeyler.length, golgeli,
      baslik: bs ? `${bs.fontSize}/${Math.round(baslik.getBoundingClientRect().height / parseFloat(bs.lineHeight))} satır` : "—",
      genislik: icerik ? Math.round(icerik.getBoundingClientRect().width) : null,
      yukseklik: document.documentElement.scrollHeight,
      tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      kontrast: Math.round(enDusuk * 100) / 100, kontrastMetin: enDusukMetin,
      dokunma: tel ? `${kucuk} öğe <44 (en küçük ${enKucuk === 99 ? "—" : enKucuk})` : "—",
    };
  }, [w < 761, tema]);
  sonuc.push({ surum, sayfa, w, tema, ...r });
  await ctx.close();
}
await b.close();
for (const x of sonuc) console.log(JSON.stringify(x));
