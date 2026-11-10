/*
  KOYU TEMADA EDİTÖR KÂĞIDI KABULÜ (UX S8, 07.11.2026).

  1440 ve 390 piksel × açık/koyu:
    - kâğıt rengi: açıkta beyaz, koyuda loş kâğıt (yalnızca ekranda;
      V4.3-A2-3. 07–09.11.2026 arası #ECE9E2, 10.11.2026'ya kadar #182231;
      Phase 4.6 D3'ten beri yazım ekranında #1B2636, masa #06090E);
    - belgedeki her yazı öğesi kendi zeminiyle en az 4,5:1 (18 px ve üstü
      ya da 14 px kalın üstü için 3:1); zemin saydamsa kâğıt sayılır;
    - koyu temada belgenin içinde saf beyaz zeminli öğe yok (beyaz yama);
    - seçim zemini kâğıdın üstünde mürekkeple 4,5:1; imleç rengi kâğıtla 3:1;
    - tablo başlık hücresi, dipnot işareti ve bul vurgusu dahil (yorumlar
      belgede değil yan panelde);
    - yazdırma ortamında (emulateMedia print) kâğıt her temada beyaz;
    - akademik öğeler (atıf, dipnot, korunan öğe, satır içi öneri, asistan
      izi, bul vurgusu, alıntı, tablo, başlık, bağlantı) ve Arvo AI fark
      listesi kendi zeminleriyle eşik üstünde (V4.3-A2-3).
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
    // Koyu: yazım ekranının kâğıdı #1B2636 (Phase 4.6 D3; 10.11.2026'ya kadar #182231).
    const beklenen = tema === "dark" ? "27,38,54" : "255,255,255";
    bekle(o.kagit === beklenen, `${ad}: kâğıt ${o.kagit}, beklenen ${beklenen}`);
    bekle(o.dusuk.length === 0, `${ad}: kontrastı düşük yazı: ${o.dusuk.join("; ")}`);
    if (tema === "dark") bekle(o.beyaz.length === 0, `${ad}: kâğıdın içinde beyaz zeminli öğe: ${o.beyaz.join(", ")}`);
    bekle(o.secim >= 4.5, `${ad}: seçimde mürekkep kontrastı ${o.secim.toFixed(2)}`);
    bekle(o.imlec >= 3, `${ad}: imleç kontrastı ${o.imlec.toFixed(2)}`);
    console.log(`${ad}: kâğıt ${o.kagit}, mürekkep ${o.mursakkep.toFixed(1)}:1, seçim ${o.secim.toFixed(1)}:1, imleç ${o.imlec.toFixed(1)}:1, tablo başlığı ${o.th?.toFixed(1)}:1`);

    /*
      AKADEMİK ÖĞELER (V4.3-A2-3). Örnek belgede dipnot, korunan öğe,
      satır içi öneri ve asistan izi yok; kâğıt koyulaşınca en kolay
      kaçacak olanlar bunlar (açık zemin için seçilmiş renkler). Kâğıdın
      yanına AYNI sınıflarla (manuscript-editor-content kagit) bir örnek
      kutu konur, gerçek CSS'le çizilir ve her öğe kendi etkin zeminine
      karşı ölçülür. AI fark listesi (Arvo AI kartı) kâğıtta değil panel
      kartında: yüzey-1 ve yüzey-2 zeminlerinin İKİSİNE karşı ölçülür.
    */
    const ornek = await sayfa.evaluate(() => {
      const rgba = (s) => {
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
      const asil = document.querySelector(".manuscript-editor-content");
      const kutu = document.createElement("div");
      kutu.className = "manuscript-editor-content kagit";
      kutu.setAttribute("data-kabul-ornegi", "");
      kutu.innerHTML = `
        <p data-ad="atıf">Enflasyon beklentileri belirleyicidir (Yılmaz, 2020, s. 14).</p>
        <p data-ad="dipnot-metni">Metin<span class="footnote-marker" data-ad="dipnot"></span> sürer.</p>
        <div class="korunan-oge" data-ad="korunan-oge">Korunan özgün içerik</div>
        <p>Önce <span class="satir-ici-oneri" data-ad="satır-içi-öneri">asistanın gri önerisi</span></p>
        <div class="asistan-vurgu"><p><span class="asistan-izi" data-ad="asistan-izi">asistanın yazdığı metin</span></p></div>
        <p><span class="search-match" data-ad="bul-vurgusu">enflasyon</span> <span class="search-match is-current" data-ad="bul-geçerli">enflasyon</span></p>
        <blockquote><p data-ad="alıntı">Doğrudan alıntı metni.</p></blockquote>
        <p data-caption="table" data-ad="tablo-başlığı">Değişkenler</p>
        <table><tbody><tr><th data-ad="tablo-th">Değişken</th></tr><tr><td data-ad="tablo-td">Enflasyon</td></tr></tbody></table>
        <p><a href="#" data-ad="bağlantı">https://doi.org/10.1/x</a> <em data-ad="italik">italik</em> <strong data-ad="kalın">kalın</strong></p>
        <h2 data-ad="başlık">Başlık</h2>`;
      asil.after(kutu);
      const sonda = document.createElement("span");
      sonda.style.background = "var(--kagit)";
      kutu.append(sonda);
      const kagitRenk = rgba(getComputedStyle(sonda).backgroundColor);
      const zeminBul = (e, sinir, taban) => {
        const katman = [];
        for (let x = e; x && x !== sinir; x = x.parentElement) {
          const c = rgba(getComputedStyle(x).backgroundColor);
          if (c && c[3] > 0) katman.push(c);
          if (c && c[3] >= 1) break;
        }
        return katman.reverse().reduce((alt, c) => ust(c, alt), taban);
      };
      const olcum = [];
      for (const e of kutu.querySelectorAll("[data-ad]")) {
        const st = getComputedStyle(e, e.classList.contains("footnote-marker") ? "::after" : null);
        const renk = rgba(st.color);
        const z = zeminBul(e, kutu, kagitRenk.slice(0, 3));
        const boy = parseFloat(st.fontSize);
        const esik = boy >= 24 || (boy >= 18.66 && Number(st.fontWeight) >= 700) ? 3 : 4.5;
        olcum.push({ ad: e.dataset.ad, oran: Math.round(oran(ust([...renk.slice(0, 3), renk[3] * Number(getComputedStyle(e).opacity)], z), z) * 100) / 100, esik });
      }
      // Arvo AI fark listesi: panel kartının zemininde (yüzey-1 / yüzey-2).
      const kart = document.createElement("div");
      kart.innerHTML = `<ol class="diff-list"><li class="diff-changed"><del data-ad="AI-fark-silinen">eski ifade</del> <ins data-ad="AI-fark-eklenen">yeni ifade</ins></li><li class="diff-same" data-ad="AI-fark-aynı">aynı kalan</li></ol>`;
      document.body.append(kart);
      for (const yuzey of ["--surface", "--surface-2"]) {
        kart.style.background = `var(${yuzey})`;
        const taban = rgba(getComputedStyle(kart).backgroundColor).slice(0, 3);
        for (const e of kart.querySelectorAll("[data-ad]")) {
          const st = getComputedStyle(e);
          const renk = rgba(st.color);
          const z = zeminBul(e, kart, taban);
          olcum.push({ ad: `${e.dataset.ad} (${yuzey})`, oran: Math.round(oran(ust(renk, z), z) * 100) / 100, esik: 4.5 });
        }
      }
      kutu.remove();
      kart.remove();
      return olcum;
    });
    for (const o2 of ornek) bekle(o2.oran >= o2.esik, `${ad}: ${o2.ad} kontrastı ${o2.oran} < ${o2.esik}`);
    console.log(`${ad}: akademik öğeler ${ornek.map((x) => `${x.ad} ${x.oran}`).join(" · ")}`);

    await sayfa.emulateMedia({ media: "print" });
    const baski = await sayfa.evaluate(() => getComputedStyle(document.querySelector(".manuscript-editor-content")).backgroundColor);
    bekle(baski === "rgb(255, 255, 255)", `${ad}: yazdırmada kâğıt beyaz değil (${baski})`);
    await ctx.close();
  }
}
await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nKâğıt kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
