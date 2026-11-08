/*
  EDİTÖR MERKEZİ KABULÜ (Premium Simplicity Aşama 1, 08.11.2026).

  Belge arayüzün önünde mi? 390 / 360 / 1024 / 1440 (panel açık ve
  kapalı) × açık/koyu:
    - yazının ilk satırının üst kenarı eşiğin altında (önce/sonra ölçüsü:
      390'da 425 → 305 px; 1440 panel açıkken 428 → 321 px);
    - yazım sayfasında DOLGU birincil düğme yok (Arvo AI yumuşak vurgu;
      kenar çubuğu sayılmaz) ve Arvo AI kontrastı ≥ 4,5:1;
    - kılavuz bandı tek satır (≤ 52 px), "Kılavuz bağla" menüsünde iki
      seçenek doğru adreslerle; "Gizle" → bant kalkar, yenilemede gizli
      kalır, masaüstünde durum çubuğundan, her genişlikte "⋯"den geri gelir;
    - telefonda başlık satırı tek satır (≤ 48 px), Belge menüsünde beş
      öğe (paylaş, Word, PDF, LaTeX, yazım paneli), başlıktaki her hedef
      ≥ 40×40;
    - ≥1200 px'te başlık satırındaki ad görünmez ama h1 olarak yerinde;
      kenar çubuğu daraltılınca görünür;
    - yazım sayfasında üst çubuk saati yok, ana sayfada (masaüstü) var;
    - sayfa yatay taşmıyor.
  Salt okunur: tercihler yalnızca tarayıcının kendi depolamasında.
    npm run onizleme     (ya da onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/editor-merkezi-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const YAZIM = `${TABAN}/dashboard/editor/${TEZ}/write`;
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
async function ac(genislik, yukseklik, { tema = "light", panel = false, bantGizli = false, kenar = null } = {}) {
  const dokunma = genislik < 1200;
  const ctx = await tarayici.newContext({ viewport: { width: genislik, height: yukseklik }, hasTouch: dokunma, isMobile: genislik < 761 });
  await ctx.addInitScript(
    ([t, p, g, k]) => {
      try {
        localStorage.setItem("arvolab.theme", t);
        localStorage.setItem("arvolab:inceleme-paneli", p ? "1" : "0");
        if (g) localStorage.setItem("arvolab:kilavuz-bandi-dar", "1");
        if (k) localStorage.setItem("arvolab.kenar", k);
      } catch {}
    },
    [tema, panel, bantGizli, kenar],
  );
  const sayfa = await ctx.newPage();
  await sayfa.goto(YAZIM, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror p").first().waitFor({ timeout: 30000 });
  await sayfa.waitForTimeout(600);
  return { ctx, sayfa, bas: (l) => (dokunma ? l.tap() : l.click()) };
}

const olc = (sayfa) =>
  sayfa.evaluate(() => {
    const gor = (e) => Boolean(e) && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 2;
    const pm = document.querySelector(".ProseMirror");
    const ilk = [...pm.querySelectorAll("h1,h2,h3,p")].find((e) => e.textContent.trim());
    const r = document.createRange();
    r.selectNodeContents(ilk);
    const bant = document.querySelector(".kilavuz-bandi");
    const ai = document.querySelector("button.yazma-ai");
    const st = getComputedStyle(ai);
    // Yarı saydam zemin sayfa zeminiyle karıştırılarak ölçülür.
    const renk = (c) => { const m = c.match(/color\(srgb ([^)]+)\)/); if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1]; } const v = c.match(/[\d.]+/g).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; };
    const alt = renk(getComputedStyle(document.body).backgroundColor);
    const z = renk(st.backgroundColor);
    const zemin = [0, 1, 2].map((i) => z[i] * z[3] + alt[i] * (1 - z[3]));
    const L = ([a, b, c]) => { const f = (x) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(a) + 0.7152 * f(b) + 0.0722 * f(c); };
    const [x, y] = [L(renk(st.color)), L(zemin)].sort((p, q) => q - p);
    const h1 = document.querySelector(".yazma-baslik h1");
    return {
      ilkSatir: Math.round(r.getClientRects()[0].top),
      dolguBirincil: [...document.querySelectorAll("main .projects-primary-button")].filter(gor).map((e) => e.textContent.trim().slice(0, 20)),
      aiKontrast: (x + 0.05) / (y + 0.05),
      aiAdi: ai.textContent.trim(),
      bant: gor(bant) ? Math.round(bant.getBoundingClientRect().height) : 0,
      baslikSatiri: Math.round(document.querySelector(".yazma-basligi").getBoundingClientRect().height),
      h1Gorunur: gor(h1),
      h1Metin: (h1?.textContent ?? "").trim().length,
      saat: gor(document.querySelector(".os-saat")),
      hedefler: [...document.querySelectorAll(".yazma-basligi :is(a, button)")].filter(gor).map((e) => { const q = e.getBoundingClientRect(); return { ad: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20), w: q.width, h: q.height }; }),
      tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

// 1) Ölçüler ve eşikler
const DURUMLAR = [
  { w: 390, h: 844, esik: 320 },
  { w: 360, h: 780, esik: 320 },
  { w: 1024, h: 768, esik: 400 },
  { w: 1440, h: 900, panel: true, esik: 340 },
  { w: 1440, h: 900, panel: false, esik: 340 },
];
for (const d of DURUMLAR) {
  for (const tema of ["light", "dark"]) {
    const ad = `${d.w}${d.panel === undefined ? "" : d.panel ? " panel-açık" : " panel-kapalı"} ${tema}`;
    const { ctx, sayfa } = await ac(d.w, d.h, { tema, panel: d.panel });
    const o = await olc(sayfa);
    bekle(o.ilkSatir <= d.esik, `${ad}: yazının ilk satırı ${o.ilkSatir} px (eşik ${d.esik})`);
    bekle(o.dolguBirincil.length === 0, `${ad}: yazım sayfasında dolgu birincil: ${o.dolguBirincil.join(", ")}`);
    bekle(o.aiKontrast >= 4.5 && o.aiAdi === "Arvo AI", `${ad}: Arvo AI kontrast ${o.aiKontrast.toFixed(2)} / ad "${o.aiAdi}"`);
    bekle(o.bant > 0 && o.bant <= 52, `${ad}: kılavuz bandı tek satır değil (${o.bant} px)`);
    bekle(!o.saat, `${ad}: yazım sayfasında saat görünüyor`);
    bekle(o.tasma <= 0, `${ad}: yatay taşma ${o.tasma}`);
    bekle(o.h1Metin > 0, `${ad}: başlık satırında h1 yok`);
    if (d.w >= 1200) bekle(!o.h1Gorunur, `${ad}: ≥1200'de başlık satırındaki ad hâlâ görünüyor`);
    if (d.w <= 760) {
      bekle(o.baslikSatiri <= 48, `${ad}: telefonda başlık satırı ${o.baslikSatiri} px (tek satır değil)`);
      const kucuk = o.hedefler.filter((x) => x.w < 39.5 || x.h < 39.5);
      bekle(kucuk.length === 0, `${ad}: başlıkta 40×40 altı: ${kucuk.map((x) => `${x.ad} ${Math.round(x.w)}×${Math.round(x.h)}`).join("; ")}`);
    }
    console.log(`${ad}: ilk satır ${o.ilkSatir}, bant ${o.bant}, başlık satırı ${o.baslikSatiri}, AI ${o.aiKontrast.toFixed(1)}:1`);
    await ctx.close();
  }
}

// 2) Kılavuz bandı akışı (menü, gizle, yenileme, geri getirme)
for (const w of [1440, 390]) {
  const { ctx, sayfa, bas } = await ac(w, 844);
  await bas(sayfa.locator(".kilavuz-bandi .kilavuz-bandi-menu"));
  await sayfa.waitForTimeout(250);
  const hedef = await sayfa.evaluate(() => [...document.querySelectorAll(".arac-menu-pencere:popover-open a")].map((a) => a.getAttribute("href")));
  bekle(hedef.length === 2 && /kilavuz=1/.test(hedef[0]) && /\/edit$/.test(hedef[1]), `${w}: kılavuz menüsü beklenen iki seçenek değil (${hedef.join(" | ")})`);
  await sayfa.keyboard.press("Escape");
  await bas(sayfa.locator(".kilavuz-bandi-gizle"));
  await sayfa.waitForTimeout(250);
  bekle((await sayfa.locator(".kilavuz-bandi").count()) === 0, `${w}: Gizle bandı kaldırmadı`);
  await sayfa.reload({ waitUntil: "networkidle" });
  await sayfa.locator(".ProseMirror p").first().waitFor();
  await sayfa.waitForTimeout(500);
  bekle((await sayfa.locator(".kilavuz-bandi").count()) === 0, `${w}: yenilemede bant geri geldi`);
  if (w >= 761) {
    bekle(await sayfa.locator(".yazim-durum-kilavuz-dugme").isVisible(), `${w}: durum çubuğunda "Kılavuz bağlı değil" yok`);
    const o = await olc(sayfa);
    bekle(o.ilkSatir <= 280, `${w}: bant gizliyken ilk satır ${o.ilkSatir}`);
  } else {
    const o = await olc(sayfa);
    bekle(o.ilkSatir <= 260, `${w}: bant gizliyken ilk satır ${o.ilkSatir}`);
  }
  await bas(sayfa.locator('.manuscript-araclar button[aria-label^="Bul, sayfa ayarı"]').first());
  await sayfa.waitForTimeout(250);
  await bas(sayfa.locator('.arac-menu-pencere:popover-open button[aria-label="Kılavuz uyarısını göster"]'));
  await sayfa.waitForTimeout(300);
  bekle((await sayfa.locator(".kilavuz-bandi").count()) === 1, `${w}: "⋯" menüsünden bant geri gelmedi`);
  await ctx.close();
}

// 3) Telefonda Belge menüsü: beş öğe, paylaşım penceresi ve panel açılır
{
  const { ctx, sayfa, bas } = await ac(390, 844);
  await bas(sayfa.locator("button.yazma-belge-menu"));
  await sayfa.waitForTimeout(250);
  const ogeler = await sayfa.evaluate(() => [...document.querySelectorAll(".arac-menu-pencere:popover-open button")].map((b) => b.textContent.trim()));
  bekle(ogeler.length === 5 && /paylaş/i.test(ogeler[0]) && /Word/.test(ogeler[1]) && /PDF/.test(ogeler[2]) && /LaTeX/.test(ogeler[3]) && /panel/i.test(ogeler[4]), `390: Belge menüsü beklenen beş öğe değil (${ogeler.join(" | ")})`);
  await bas(sayfa.locator(".arac-menu-pencere:popover-open button", { hasText: "Yazım paneli" }));
  await sayfa.waitForTimeout(500);
  bekle(await sayfa.evaluate(() => !document.querySelector("#yazim-yan-panel")?.hidden), "390: Belge menüsünden yazım paneli açılmadı");
  await ctx.close();
}

// 4) Kenar çubuğu daraltılınca başlık görünür; ana sayfada saat yerinde
{
  const { ctx, sayfa } = await ac(1440, 900, { kenar: "dar" });
  bekle((await olc(sayfa)).h1Gorunur, "1440 kenar dar: başlık satırındaki ad görünmüyor");
  await sayfa.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.waitForTimeout(500);
  bekle(await sayfa.locator(".os-saat").isVisible(), "ana sayfada saat kayboldu (yalnız yazım sayfasında gizli olmalı)");
  await ctx.close();
}

await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nEditör merkezi kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
