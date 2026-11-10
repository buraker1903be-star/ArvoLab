/*
  MOBİL TABLO KABULÜ (UX M1, 07.11.2026).

  Örnek tezde 4–6 sütunlu tablolar 360 pikselde editörden (326 px) geniş.
  Eskiden editör kabuğu taşanı kesiyordu: sağ sütunlar görünmüyordu.
  Sınanan, 360 / 390 / 768 / 1024 / 1363 / 1440 × açık/koyu:
    - sayfa ve belge yatay taşmıyor (taşma tablonun kendi kutusunda);
    - her tablonun her sütununa ulaşılıyor (sarmalayıcı sona kaydırılınca
      son sütunun sağ kenarı sarmalayıcının içinde);
    - kaydırılabilen tabloda görünür ipucu (kenar gölgesi arka planı);
    - masaüstünde (≥1363) tablolar sığıyor, kaydırma yok, tablo eni değişmedi
      (sarmalayıcının eni);
  360'ta ayrıca: sona kaydırılmış tabloda son sütundaki hücreye dokununca
  imleç O hücrede; ← ile soldaki hücrelere geçilince imleç görünür kalıyor;
  fareyle iki hücre üzerinden sürükleyince hücre seçimi (selectedCell).
  Salt okunur: belgeye yazmaz.
    npm run onizleme     (ya da onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/tablo-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("tablo-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
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
for (const genislik of [360, 390, 768, 1024, 1363, 1440]) {
  for (const tema of ["light", "dark"]) {
    const ctx = await tarayici.newContext({ viewport: { width: genislik, height: 900 }, hasTouch: genislik < 1200, isMobile: genislik < 761 });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("arvolab.theme", t);
      } catch {}
    }, tema);
    const sayfa = await ctx.newPage();
    await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
    await sayfa.locator(".ProseMirror table").first().waitFor({ timeout: 30000 });
    await sayfa.waitForTimeout(600);
    const ad = `${genislik} ${tema}`;
    const o = await sayfa.evaluate(() => {
      const d = document.documentElement;
      const pm = document.querySelector(".ProseMirror");
      const tablolar = [...pm.querySelectorAll(".tableWrapper")].map((w) => {
        const t = w.querySelector("table");
        const kayar = w.scrollWidth > w.clientWidth + 1;
        w.scrollLeft = w.scrollWidth;
        const son = t.querySelector("tr:first-child > :last-child").getBoundingClientRect();
        const wr = w.getBoundingClientRect();
        const ulasilir = son.right <= wr.right + 1 && son.left >= wr.left - 1;
        w.scrollLeft = 0;
        const st = getComputedStyle(w);
        return { kayar, ulasilir, ox: st.overflowX, ipucu: st.backgroundImage.includes("gradient"), tabloEn: Math.round(t.getBoundingClientRect().width), sarmalayiciEn: w.clientWidth, sutun: t.querySelectorAll("tr:first-child > *").length };
      });
      return { sayfaTasma: d.scrollWidth - d.clientWidth, belgeTasma: pm.scrollWidth - pm.clientWidth, tablolar };
    });
    bekle(o.sayfaTasma <= 0, `${ad}: sayfa yatay taşıyor (${o.sayfaTasma})`);
    bekle(o.belgeTasma <= 0, `${ad}: belge yatay taşıyor (${o.belgeTasma})`);
    bekle(o.tablolar.length > 0, `${ad}: tablo bulunamadı`);
    for (const [i, t] of o.tablolar.entries()) {
      bekle(t.ulasilir, `${ad}: tablo ${i} (${t.sutun} sütun) son sütuna ulaşılamıyor`);
      if (t.kayar) bekle(t.ox === "auto" && t.ipucu, `${ad}: tablo ${i} kayıyor ama ipucu/kaydırma yok`);
      if (genislik >= 1363) bekle(!t.kayar && t.tabloEn === t.sarmalayiciEn, `${ad}: masaüstünde tablo ${i} sığmıyor ya da eni değişti (${t.tabloEn}/${t.sarmalayiciEn})`);
    }
    const genis = o.tablolar.filter((t) => t.sutun >= 4 && t.kayar).length;
    if (genislik <= 390) bekle(genis > 0, `${ad}: 4+ sütunlu kayan tablo beklenirdi`);
    console.log(`${ad}: ${o.tablolar.length} tablo, ${o.tablolar.filter((t) => t.kayar).length} kayıyor (4–6 sütunlu kayan: ${genis})`);

    if (genislik === 360 && tema === "light") {
      // İmleç ve hücre seçimi, sona kaydırılmış geniş tabloda.
      const i = o.tablolar.findIndex((t) => t.kayar && t.sutun >= 4);
      const w = sayfa.locator(".ProseMirror .tableWrapper").nth(i);
      await w.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      const hucre = w.locator("tr:nth-child(2) > :last-child");
      // Hücre ekranın ortasına: yapışık araç çubuğunun altında kalırsa tıklama çubuğa gider.
      await hucre.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await sayfa.waitForTimeout(200);
      const kutu = await hucre.boundingBox();
      await sayfa.mouse.click(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
      await sayfa.waitForTimeout(150);
      const imlec = await sayfa.evaluate(() => {
        const s = getSelection();
        const td = (s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement)?.closest("td, th");
        return td ? [...td.parentElement.children].indexOf(td) === td.parentElement.children.length - 1 : false;
      });
      bekle(imlec, "360: son sütundaki hücreye dokununca imleç o hücrede değil");
      // ← ile soldaki hücrelere: Home hücrenin başına, ← bir önceki hücrenin sonuna.
      // Her adımda imleç (daraltılmış seçim) sarmalayıcının görünür alanında olmalı.
      let gorunur = true;
      for (let k = 0; k < 3; k++) {
        await sayfa.keyboard.press("Home");
        await sayfa.keyboard.press("ArrowLeft");
        await sayfa.waitForTimeout(150);
        gorunur &&= await w.evaluate((el) => {
          const s = getSelection();
          if (!s.rangeCount) return false;
          const r = s.getRangeAt(0).getBoundingClientRect();
          const wr = el.getBoundingClientRect();
          return r.left >= wr.left - 2 && r.right <= wr.right + 2;
        });
      }
      bekle(gorunur, "360: önceki hücrelere geçince imleç görünür alanda kalmadı");
      await w.evaluate((el) => (el.scrollLeft = 0));
      await w.locator("tr:nth-child(2) > :first-child").evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
      await sayfa.waitForTimeout(200);
      // Hücre ortasından ortasına: kenara yakın basış sütun genişliği tutamacına düşer.
      const a = await w.locator("tr:nth-child(2) > :first-child").boundingBox();
      const b = await w.locator("tr:nth-child(3) > :nth-child(2)").boundingBox();
      await sayfa.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await sayfa.mouse.down();
      await sayfa.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await sayfa.mouse.up();
      const secili = await w.locator(".selectedCell").count();
      bekle(secili >= 2, `360: sürükleyince hücre seçimi oluşmadı (${secili})`);
      console.log(`360: imleç son sütunda ${imlec}, geri giderken görünür ${gorunur}, seçili hücre ${secili}`);
    }
    await ctx.close();
  }
}
await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nTablo kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
