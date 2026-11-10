/*
  ANA SAYFA EYLEM HİYERARŞİSİ VE KAYNAKÇA KARTI KABULÜ (UX S6 + S7, 07.11.2026).

  S6 (ana sayfa, 360 / 1024 / 1440):
    - DOLU hesap: "Yazmaya devam et/başla" ekranda TEK kez, tez kartının
      birincil düğmesi; Yazım ritmi kartında bağlantı yok.
    - BOŞ hesap (ONIZLEME_BOS=1 ile başlatılmış önizleme): yazma eylemi
      hiç yok (yazılacak çalışma yok), ritim kartı yok; birincil eylem
      en fazla bir tane.
  S7 (Kaynaklar, yalnızca dolu hesapta; 1440×900, 1363×936, 1024×768,
  768, 390 × açık/koyu; denetimi olan ve olmayan çalışma):
    - Kaynakça kartı Literatür kartının boyuna gerilmiyor (iki sütunda
      kart içerik kadar; içeriği ızgara satırını aşarsa kendi içinde kayar);
    - sayfa yatay taşmıyor.
  Salt okunur.
    npm run onizleme                      → dolu
    ONIZLEME_BOS=1 npm run onizleme       → boş
    NODE_PATH=$(npm root -g) node scripts/onizleme/genel-bakis-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("genel-bakis-kabul", TABAN, null);
let hata = 0;
let denetim = 0;
const bekle = (kosul, mesaj) => {
  denetim++;
  if (!kosul) {
    hata++;
    console.log(`✗ ${mesaj}`);
  }
};

const tarayici = await chromium.launch();
let bos = false;
for (const w of [360, 1024, 1440]) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: 900 } });
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.waitForTimeout(400);
  const o = await sayfa.evaluate(() => {
    const gor = (e) => e.getClientRects().length > 0;
    const main = document.querySelector("main");
    const yazma = [...main.querySelectorAll("a, button")].filter(gor).filter((e) => /Yazmaya (devam et|başla)|Continue writing|Start writing/.test(e.textContent));
    const ritim = [...main.querySelectorAll("article.gb-kart")].find((a) => /Yazım ritmi|Writing rhythm/.test(a.textContent));
    return {
      tezKarti: Boolean(main.querySelector(".tez-kart")),
      yazma: yazma.map((e) => ({ birincil: e.classList.contains("projects-primary-button"), tezKartinda: Boolean(e.closest(".tez-kart")) })),
      birincil: [...main.querySelectorAll(".projects-primary-button")].filter(gor).length,
      ritim: Boolean(ritim),
      ritimBaglanti: ritim ? ritim.querySelectorAll("a").length : 0,
    };
  });
  bos = !o.tezKarti;
  const ad = `${w} ${bos ? "boş" : "dolu"}`;
  if (bos) {
    bekle(o.yazma.length === 0, `${ad}: boş hesapta yazma eylemi var`);
    bekle(!o.ritim, `${ad}: boş hesapta ritim kartı var`);
  } else {
    bekle(o.yazma.length === 1 && o.yazma[0].birincil && o.yazma[0].tezKartinda, `${ad}: yazma eylemi tek ve tez kartında birincil değil (${JSON.stringify(o.yazma)})`);
    bekle(o.ritim && o.ritimBaglanti === 0, `${ad}: ritim kartı yok ya da hâlâ bağlantı taşıyor`);
  }
  bekle(o.birincil <= 1, `${ad}: ${o.birincil} birincil eylem`);
  console.log(`${ad}: yazma ${o.yazma.length}, birincil ${o.birincil}, ritim ${o.ritim}`);
  await ctx.close();
}

if (!bos) {
  for (const [w, h] of [[1440, 900], [1363, 936], [1024, 768], [768, 1024], [390, 800]]) {
    for (const calisma of ["b1", "b2"]) {
      for (const tema of ["light", "dark"]) {
        const ctx = await tarayici.newContext({ viewport: { width: w, height: h } });
        await ctx.addInitScript((t) => {
          try {
            localStorage.setItem("arvolab.theme", t);
          } catch {}
        }, tema);
        const sayfa = await ctx.newPage();
        await sayfa.goto(`${TABAN}/dashboard/literature?calisma=00000000-0000-4000-8000-0000000000${calisma}`, { waitUntil: "networkidle", timeout: 150000 });
        await sayfa.locator(".kaynaklar-ikili").waitFor({ timeout: 30000 });
        await sayfa.waitForTimeout(300);
        const o = await sayfa.evaluate(async () => {
          const sec = document.querySelector(".kaynaklar-ikili");
          const [l, k] = sec.querySelectorAll(":scope > article");
          const yan = Math.abs(l.getBoundingClientRect().top - k.getBoundingClientRect().top) < 2;
          const icerik = k.scrollHeight;
          const kart = k.getBoundingClientRect().height;
          // İçerik satırı aşınca kart kendi içinde kayar (tek ekran düzeni ≥901×640).
          const dolgu = document.createElement("div");
          dolgu.className = "kabul-dolgu";
          dolgu.setAttribute("style", "height:2000px;flex:none");
          k.append(dolgu);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const uzun = { kayar: k.scrollHeight > k.clientHeight + 1, tasma: k.getBoundingClientRect().bottom - sec.getBoundingClientRect().bottom };
          dolgu.remove();
          return { yan, icerik, kart, lit: l.getBoundingClientRect().height, uzun, tekEkran: innerWidth >= 901 && innerHeight >= 640, sayfa: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        const ad = `${w}×${h} ${calisma} ${tema}`;
        bekle(o.sayfa <= 0, `${ad}: sayfa yatay taşıyor`);
        bekle(Math.abs(o.kart - o.icerik) <= 3, `${ad}: Kaynakça kartı içeriğinden uzun (${Math.round(o.kart)}/${o.icerik})`);
        if (o.yan) bekle(o.kart < o.lit || Math.abs(o.kart - o.lit) <= 3, `${ad}: Kaynakça kartı Literatür'den uzun`);
        if (o.tekEkran) bekle(o.uzun.kayar && o.uzun.tasma <= 1, `${ad}: uzun içerikte kart kendi içinde kaymıyor (${JSON.stringify(o.uzun)})`);
        console.log(`${ad}: Literatür ${Math.round(o.lit)}, Kaynakça ${Math.round(o.kart)}`);
        await ctx.close();
      }
    }
  }
}
await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nGenel bakış kabulü temiz (${denetim} denetim, ${bos ? "boş" : "dolu"} hesap)`);
process.exit(hata ? 1 : 0);
