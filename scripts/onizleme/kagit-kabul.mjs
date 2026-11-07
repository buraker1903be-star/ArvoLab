/*
  KOYU TEMADA EDİTÖR KÂĞIDI KABULÜ (UX S8, 07.11.2026).

  1440 ve 390 piksel × açık/koyu:
    - kâğıt rengi: açıkta beyaz, koyuda #ECE9E2 (yalnızca ekranda);
    - belgedeki her yazı öğesi kendi zeminiyle en az 4,5:1 (18 px ve üstü
      ya da 14 px kalın üstü için 3:1); zemin saydamsa kâğıt sayılır;
    - koyu temada belgenin içinde saf beyaz zeminli öğe yok (beyaz yama);
    - seçim zemini kâğıdın üstünde mürekkeple 4,5:1; imleç rengi kâğıtla 3:1;
    - tablo başlık hücresi, dipnot işareti ve bul vurgusu dahil (yorumlar
      belgede değil yan panelde);
    - yazdırma ortamında (emulateMedia print) kâğıt her temada beyaz.
  Salt okunur.
    npm run onizleme     (ya da onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/kagit-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
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
for (const genislik of [1440, 390]) {
  for (const tema of ["light", "dark"]) {
    const ad = `${genislik} ${tema}`;
    const ctx = await tarayici.newContext({ viewport: { width: genislik, height: 900 }, isMobile: genislik < 761, hasTouch: genislik < 761 });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("arvolab.theme", t);
      } catch {}
    }, tema);
    const sayfa = await ctx.newPage();
    await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
    await sayfa.locator(".ProseMirror table").first().waitFor({ timeout: 30000 });
    await sayfa.waitForTimeout(500);
    // Bul vurgusu da taransın: belgedeki eşleşmeler kâğıdın üstünde süsleme.
    await sayfa.locator(".ProseMirror p").nth(3).click();
    await sayfa.keyboard.press("Control+f");
    await sayfa.waitForTimeout(250);
    await sayfa.keyboard.type("enflasyon");
    await sayfa.waitForTimeout(400);
    const eslesme = await sayfa.locator(".ProseMirror .search-match").count();
    bekle(eslesme > 0, `${ad}: bul vurgusu oluşmadı`);
    const o = await sayfa.evaluate(() => {
      const rgba = (s) => {
        // color-mix() sonucu "color(srgb r g b / a)" biçiminde (0–1 aralığı) döner.
        const c = s.match(/color\(srgb ([^)]+)\)/);
        if (c) {
          const [r, g, b, a = 1] = c[1].split(/[ /]+/).filter(Boolean).map(Number);
          return [r * 255, g * 255, b * 255, a];
        }
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [r, g, b, a];
      };
      const ust = (on, alt) => [0, 1, 2].map((i) => on[i] * on[3] + alt[i] * (1 - on[3]));
      const parlak = ([r, g, b]) => {
        const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const oran = (a, b) => {
        const [x, y] = [parlak(a), parlak(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const icerik = document.querySelector(".manuscript-editor-content");
      const kagit = rgba(getComputedStyle(icerik).backgroundColor);
      const pm = document.querySelector(".ProseMirror");
      const zemin = (e) => {
        const katman = [];
        for (let x = e; x && x !== icerik; x = x.parentElement) {
          const c = rgba(getComputedStyle(x).backgroundColor);
          if (c && c[3] > 0) katman.push(c);
          if (c && c[3] >= 1) break;
        }
        return katman.reverse().reduce((alt, c) => ust(c, alt), kagit.slice(0, 3));
      };
      const dusuk = new Map();
      const beyaz = new Set();
      for (const e of [pm, ...pm.querySelectorAll("*")]) {
        if (!e.getClientRects().length) continue;
        const st = getComputedStyle(e);
        const bg = rgba(st.backgroundColor);
        if (bg && bg[3] >= 0.99 && bg[0] === 255 && bg[1] === 255 && bg[2] === 255) beyaz.add(`${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`);
        const metinVar = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!metinVar || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
        const renk = rgba(st.color);
        const z = zemin(e);
        const r = oran(ust(renk, z), z);
        const boy = parseFloat(st.fontSize);
        const buyuk = boy >= 24 || (boy >= 18.66 && Number(st.fontWeight) >= 700);
        const esik = buyuk ? 3 : 4.5;
        if (r < esik) {
          const k = `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`;
          if (!dusuk.has(k) || dusuk.get(k) > r) dusuk.set(k, Math.round(r * 100) / 100);
        }
      }
      const p = pm.querySelector("p");
      const secim = rgba(getComputedStyle(p, "::selection").backgroundColor) ?? [0, 0, 0, 0];
      const secimZemin = ust(secim, kagit);
      const ink = rgba(getComputedStyle(p).color);
      const imlecS = getComputedStyle(pm).caretColor;
      const imlec = rgba(imlecS === "auto" ? getComputedStyle(pm).color : imlecS);
      const th = pm.querySelector("th");
      return {
        kagit: kagit.slice(0, 3).map(Math.round).join(","),
        dusuk: [...dusuk].map(([k, r]) => `${k} ${r}`),
        beyaz: [...beyaz],
        secim: oran(ust(ink, secimZemin), secimZemin),
        imlec: oran(imlec, kagit),
        mursakkep: oran(ink, kagit),
        th: th ? oran(rgba(getComputedStyle(th).color), zemin(th)) : null,
      };
    });
    const beklenen = tema === "dark" ? "236,233,226" : "255,255,255";
    bekle(o.kagit === beklenen, `${ad}: kâğıt ${o.kagit}, beklenen ${beklenen}`);
    bekle(o.dusuk.length === 0, `${ad}: kontrastı düşük yazı: ${o.dusuk.join("; ")}`);
    if (tema === "dark") bekle(o.beyaz.length === 0, `${ad}: kâğıdın içinde beyaz zeminli öğe: ${o.beyaz.join(", ")}`);
    bekle(o.secim >= 4.5, `${ad}: seçimde mürekkep kontrastı ${o.secim.toFixed(2)}`);
    bekle(o.imlec >= 3, `${ad}: imleç kontrastı ${o.imlec.toFixed(2)}`);
    console.log(`${ad}: kâğıt ${o.kagit}, mürekkep ${o.mursakkep.toFixed(1)}:1, seçim ${o.secim.toFixed(1)}:1, imleç ${o.imlec.toFixed(1)}:1, tablo başlığı ${o.th?.toFixed(1)}:1`);

    await sayfa.emulateMedia({ media: "print" });
    const baski = await sayfa.evaluate(() => getComputedStyle(document.querySelector(".manuscript-editor-content")).backgroundColor);
    bekle(baski === "rgb(255, 255, 255)", `${ad}: yazdırmada kâğıt beyaz değil (${baski})`);
    await ctx.close();
  }
}
await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nKâğıt kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
