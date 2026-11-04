/*
  DUYARLILIK DENETİMİ (Phase 3, 04.11.2026). Önizleme sunucusu
  (`npm run onizleme`) açıkken çalışır; panel sayfalarını üç ekran
  boyunda gerçek tarayıcıda açar ve ölçer:

  - yatay taşma: belgenin genişliği ekranı aşıyor mu (sayfa yana kayar)
  - ekran dışına taşan öğeler (en geniş üç tanesi, sınıf adıyla)
  - telefonda küçük dokunma hedefleri (40 pikselden kısa/dar düğme ve bağlantılar)
  - sabit gezinmenin (dock / alt çubuk) altında kalan tıklanabilir öğeler

  CI'da DEĞİL: oturum ve veri gerektiriyor, önizleme sahte istemciyle
  çalışıyor. Kullanım:
    NODE_PATH=$(npm root -g) node scripts/onizleme/duyarlilik.mjs [--json] [--ekran-goruntusu <klasör>]
  Çıkış kodu: yatay taşma varsa 1.
*/
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.env.ONIZLEME_ADRESI ?? "http://localhost:3123";
const P = "00000000-0000-4000-8000-0000000000b1";
const P2 = "00000000-0000-4000-8000-0000000000b2";
export const SAYFALAR = [
  "/dashboard",
  "/dashboard/editor",
  `/dashboard/editor?sec=${P}`,
  `/dashboard/editor/${P}/write`,
  `/dashboard/editor/${P}/kanit`,
  `/dashboard/editor/${P}/etik`,
  `/dashboard/editor/${P2}/makale`,
  `/dashboard/literature?calisma=${P}`,
  "/dashboard/analysis",
  `/dashboard/documents?calisma=${P}`,
  "/dashboard/expert-requests",
  "/dashboard/settings",
  "/dashboard/abonelik",
  "/dashboard/yardim",
];
export const EKRANLAR = [
  { ad: "telefon", width: 390, height: 844 },
  { ad: "tablet", width: 820, height: 1180 },
  { ad: "masaustu", width: 1440, height: 900 },
];

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const gorselKlasoru = argv.includes("--ekran-goruntusu") ? argv[argv.indexOf("--ekran-goruntusu") + 1] : null;
if (gorselKlasoru) fs.mkdirSync(gorselKlasoru, { recursive: true });

function olc() {
  const genislik = document.documentElement.clientWidth;
  const tasma = document.documentElement.scrollWidth - genislik;
  const disari = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const stil = getComputedStyle(el);
    if (stil.visibility === "hidden" || stil.display === "none") continue;
    // Kendi kaydırma kabı içinde taşan öğe sayfayı kaydırmaz; yalnızca kaydırma kabı olmayan atalar.
    let kapta = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { kapta = true; break; }
    }
    if (!kapta && r.right > genislik + 1) disari.push({ sinif: (el.className && typeof el.className === "string" ? el.className : el.tagName).slice(0, 60), sag: Math.round(r.right) });
  }
  disari.sort((a, b) => b.sag - a.sag);
  const hedefler = [...document.querySelectorAll("a[href], button, [role=button], input, select, textarea")].filter((el) => {
    const r = el.getBoundingClientRect();
    // Kapalı çekmeceler (drawer) ve gizli pencereler DOM'da duruyor ama görünmüyor;
    // sayılırsa "dock altında 21 düğme" gibi yanlış alarmlar çıkıyordu.
    const gorunur = el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && getComputedStyle(el).pointerEvents !== "none";
    return gorunur && r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
  });
  const kucuk = hedefler.filter((el) => {
    const r = el.getBoundingClientRect();
    return (r.height < 40 || r.width < 40) && !el.closest(".ProseMirror");
  }).length;
  // Sabit alt gezinme (dock/alt çubuk) altında kalan, ona ait olmayan tıklanabilirler
  const sabitler = [...document.querySelectorAll("body *")].filter((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.position === "fixed" && r.bottom >= innerHeight - 2 && r.height < innerHeight / 3 && r.width > innerWidth / 3;
  });
  let ortulen = 0;
  for (const sabit of sabitler) {
    const sr = sabit.getBoundingClientRect();
    for (const el of hedefler) {
      if (sabit.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > sr.top + 4 && r.top < sr.bottom && r.right > sr.left && r.left < sr.right) ortulen++;
    }
  }
  return { tasma, disari: disari.slice(0, 3), kucukHedef: kucuk, toplamHedef: hedefler.length, dockAltinda: ortulen };
}

const tarayici = await chromium.launch();
const sonuc = [];
let tasmaVar = false;
for (const ekran of EKRANLAR) {
  const sayfa = await tarayici.newPage({ viewport: { width: ekran.width, height: ekran.height } });
  for (const yol of SAYFALAR) {
    try {
      await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
      await sayfa.waitForTimeout(800);
      // Sayfanın sonuna kaydır: dockun ilk ekranda içeriği örtmesi değil, sona kadar örtüp örtmediği önemli.
      await sayfa.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sayfa.waitForTimeout(300);
      const o = await sayfa.evaluate(olc);
      if (o.tasma > 1) tasmaVar = true;
      sonuc.push({ ekran: ekran.ad, yol, ...o });
      if (gorselKlasoru) {
        await sayfa.evaluate(() => window.scrollTo(0, 0));
        const ad = `${ekran.ad}${yol.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.png`;
        await sayfa.screenshot({ path: path.join(gorselKlasoru, ad) });
      }
    } catch (hata) {
      sonuc.push({ ekran: ekran.ad, yol, hata: String(hata.message).slice(0, 120) });
    }
  }
  await sayfa.close();
}
await tarayici.close();

if (json) console.log(JSON.stringify(sonuc, null, 2));
else
  for (const s of sonuc)
    console.log(
      s.hata
        ? `${s.ekran.padEnd(9)} ${s.yol.padEnd(58)} HATA ${s.hata}`
        : `${s.ekran.padEnd(9)} ${s.yol.padEnd(58)} taşma=${String(s.tasma).padStart(4)}  küçük=${String(s.kucukHedef).padStart(3)}/${s.toplamHedef}  dock-altı=${s.dockAltinda}  ${s.disari.map((d) => `${d.sinif}→${d.sag}`).join(" | ")}`,
    );
process.exitCode = tasmaVar ? 1 : 0;
