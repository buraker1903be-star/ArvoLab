#!/usr/bin/env node
/*
  V4.2R revizyon ölçümü: aynı ölçüler eski v4 (V4.2) ve revize v4 üzerinde.
  "Sadece boşluk/renk değişti" sayılmasın diye ölçüler YAPIYA bakar:
  kutu sayısı, iç içe kutu derinliği, satır yeniden kırılması, eksen hizası,
  kesik sekme, görünür belge alanı.
    node ekranlar/revizyon-olc.mjs <eski-ekranlar-klasörü> [yeni-klasör]
*/
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const ESKI = path.resolve(process.argv[2]);
const YENI = path.resolve(process.argv[3] ?? KOK);

async function olc(b, kok, sayfa, w, fn) {
  const s = await b.newPage({ viewport: { width: w, height: w > 760 ? 900 : 844 } });
  await s.goto(`file://${path.join(kok, `${sayfa}.html`)}`);
  await s.evaluate((tel) => document.body.classList.add(tel ? "telefon" : "masaustu"), w < 761);
  await s.evaluate(() => document.fonts.ready);
  const r = await s.evaluate(fn);
  await s.close();
  return r;
}
// Tarayıcıda çalışan ortak yardımcılar (her fn içine metin olarak eklenir).
const ORTAK = `
  const gor = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden"; };
  const kok = document.querySelector(document.body.classList.contains("telefon") ? ".telefon-yalniz" : ".masaustu-yalniz");
  // "Kutu": en az üç kenarı çizgili ya da zemini ebeveyninden farklı ve köşesi yuvarlak öğe; düğme, girdi, rozet, çip hariç.
  const kutuMu = (e) => {
    if (!gor(e) || e.matches(".d, button, a.bag, .rozet, .cip, .gonder, svg, svg *, kbd, .suzgec, .ikon, .isaret, del, ins, .avatar, .uc-simge")) return false;
    const st = getComputedStyle(e); const r = e.getBoundingClientRect(); if (r.width * r.height < 2500) return false;
    const kenar = ["Top", "Right", "Bottom", "Left"].filter((k) => parseFloat(st["border" + k + "Width"]) >= 1 && st["border" + k + "Style"] !== "none").length;
    const zemin = st.backgroundColor; const ust = e.parentElement ? getComputedStyle(e.parentElement).backgroundColor : zemin;
    return kenar >= 3 || (zemin !== "rgba(0, 0, 0, 0)" && zemin !== ust && parseFloat(st.borderRadius) >= 4);
  };
  const kutular = (alan) => [...alan.querySelectorAll("*")].filter(kutuMu);
  const derinlik = (alan) => { let m = 0; for (const e of kutular(alan)) { let d = 0; for (let x = e; x && x !== alan; x = x.parentElement) if (kutuMu(x)) d++; m = Math.max(m, d); } return m; };
`;
const f = (govde) => new Function(`${ORTAK}\n${govde}`);

const b = await chromium.launch();
const sonuc = {};
for (const [etiket, kok] of [["eski", ESKI], ["yeni", YENI]]) {
  const r = {};
  // 1. Editör + AI masaüstü
  r.edAiMasa = await olc(b, kok, "editor-ai", 1440, f(`
    const panel = kok.querySelector(".bolme"); const akis = panel.querySelector(".akis");
    const kagit = kok.querySelector(".kagit"); const st = getComputedStyle(kagit);
    const p = kagit.querySelectorAll("p")[0]; const lh = parseFloat(getComputedStyle(p).lineHeight);
    return { panelKutu: kutular(akis).length, icIceDerinlik: derinlik(akis), metinSutunu: Math.round(kagit.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)), p1Satir: Math.round(p.getBoundingClientRect().height / lh), kagitSol: Math.round(kagit.getBoundingClientRect().left) };`));
  r.edMasa = await olc(b, kok, "editor", 1440, f(`
    const kagit = kok.querySelector(".kagit"); const st = getComputedStyle(kagit);
    const p = kagit.querySelectorAll("p")[0]; const lh = parseFloat(getComputedStyle(p).lineHeight);
    return { metinSutunu: Math.round(kagit.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)), p1Satir: Math.round(p.getBoundingClientRect().height / lh), kagitSol: Math.round(kagit.getBoundingClientRect().left) };`));
  // 2. Editör + AI telefon
  r.edAiTel = await olc(b, kok, "editor-ai", 390, f(`
    const as = kok.querySelector(".alt-sayfa"); const kagit = kok.querySelector(".tel-kagit"); const ust = as.getBoundingClientRect().top;
    const sec = kagit.querySelector(".secili-metin, .secim-ai");
    const gorunurMu = (sel) => { const e = kok.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const kap = e.closest(".akis"); const kr = kap ? kap.getBoundingClientRect() : { bottom: innerHeight }; return r.bottom <= Math.min(innerHeight, kr.bottom) + 1 && r.height > 0; };
    return { altSayfaYuksekligi: Math.round(as.getBoundingClientRect().height), gorunurBelge: Math.max(0, Math.round(ust - kagit.getBoundingClientRect().top)), ortu: !!kok.querySelector(".ortu"), seciliCumleGorunur: !!sec && sec.getBoundingClientRect().top < ust, dayanakGorunur: gorunurMu(".dayanak, .dayanak-not"), kararGorunur: [...kok.querySelectorAll(".alt-sayfa .d-birincil")].some((e) => e.getBoundingClientRect().bottom <= innerHeight), panelKutu: kutular(as.querySelector(".akis")).length };`));
  // 3. Çalışmalarım masaüstü
  r.calMasa = await olc(b, kok, "calismalarim", 1440, f(`
    const liste = kok.querySelector(".liste-sutun, .liste-ayrinti > section"); const ayr = kok.querySelector(".ayr-r, .ayr");
    const lr = liste.getBoundingClientRect(), ar = ayr.getBoundingClientRect();
    const sonSatir = [...liste.querySelectorAll("li, .yeni-satir")].filter(gor).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
    const listeZeminli = getComputedStyle(liste).backgroundColor !== "rgba(0, 0, 0, 0)";
    return { listeGenislik: Math.round(lr.width), ayrintiGenislik: Math.round(ar.width), oran: (lr.width / ar.width).toFixed(2), yuzeySayisi: kutular(kok.querySelector("main")).filter((e) => e.getBoundingClientRect().height > 300).length, yuzeyDisiBosluk: listeZeminli ? 0 : Math.max(0, Math.round(ar.bottom - sonSatir)), yeniCalismaYeri: kok.querySelector(".yeni-satir") ? "listenin son satırı" : "sayfa başlığında düğme" };`));
  // 4-5. Çalışmalarım ve ayrıntı telefon
  for (const w of [390, 360]) {
    r["calTel" + w] = await olc(b, kok, "calismalarim", w, f(`
      const satirlar = [...kok.querySelectorAll(".cl > li")];
      return { satir: satirlar.length, acikGecisBolgesi: satirlar.filter((li) => { const g = li.querySelector(".cl-gec"); return g && g.getBoundingClientRect().height >= 44; }).length };`));
    r["ayrTel" + w] = await olc(b, kok, "calisma-ayrinti", w, f(`
      const serit = kok.querySelector(".serit"); const ogeler = [...serit.querySelectorAll("a, button")];
      const kesik = ogeler.filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }).length;
      return { seritOgesi: ogeler.length, kesikSekme: kesik, kayan: serit.scrollWidth > serit.clientWidth + 1 };`));
  }
  // 6. Ana Sayfa
  r.ana = await olc(b, kok, "ana-sayfa", 1440, f(`
    const alt = [...kok.querySelectorAll(".iki, .iki-r, .dip, .dip-serit")];
    const say = (sel) => alt.reduce((t, a) => t + a.querySelectorAll(sel).length, 0);
    const komutaAlt = kok.querySelector(".komuta").getBoundingClientRect().bottom; const son = kok.querySelector(".gb").getBoundingClientRect().top;
    return { altRozet: say(".rozet"), anahtarDegerSatiri: say(".kanit-satir"), ayarBlogu: kok.querySelectorAll(".dip > div").length, eylemFiilliMadde: say(".teslim-yolu .bag"), altBolumYuksekligi: Math.round(son - komutaAlt), sayfa: document.documentElement.scrollHeight, birincil: [...kok.querySelectorAll(".d-birincil")].filter(gor).length };`));
  // 7. Kaynak Kütüphanesi
  r.kay = await olc(b, kok, "kaynaklar", 1440, f(`
    const satirlar = [...kok.querySelectorAll(".kt-satir, .ks-liste > li")].filter(gor);
    const pdfX = satirlar.map((s) => { const e = s.querySelectorAll(".kt-h")[1] ?? s.querySelectorAll(".iz > span")[1]; return e ? e.getBoundingClientRect().left : null; }).filter((x) => x !== null);
    const ort = pdfX.reduce((a, x) => a + x, 0) / pdfX.length; const sapma = Math.sqrt(pdfX.reduce((a, x) => a + (x - ort) ** 2, 0) / pdfX.length);
    const panel = kok.querySelector(".kaynak-ayr"); const kayan = panel.querySelector(".kar-govde");
    return { ortSatir: Math.round(satirlar.reduce((a, s) => a + s.getBoundingClientRect().height, 0) / satirlar.length), pdfEkseniXSapma: Math.round(sapma), panelYukseklik: Math.round(panel.getBoundingClientRect().height), panelGorunumeSigar: panel.getBoundingClientRect().bottom <= innerHeight, panelIcKaydirma: !!kayan && kayan.scrollHeight > kayan.clientHeight, sayfa: document.documentElement.scrollHeight, kaynagaSor: [...kok.querySelectorAll("a")].filter((a) => a.textContent.includes("Kaynağa sor")).length, pdfAc: [...kok.querySelectorAll("a")].filter((a) => a.textContent.includes("PDF'i aç")).length };`));
  sonuc[etiket] = r;
}
await b.close();
console.log(JSON.stringify(sonuc, null, 1));
