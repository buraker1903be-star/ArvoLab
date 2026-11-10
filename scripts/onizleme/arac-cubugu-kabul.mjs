/*
  YAZIM ARAÇ ÇUBUĞU KABULÜ (UX S3+S4, 07.11.2026).

  Matris: 1440, 1366, 1280, 1024, 768, 390, 360 piksel × açık/koyu tema ×
  sağ panel açık/kapalı (panel sütunu yalnızca ≥1200'de; altında panel
  belgenin üstüne açılan sayfa, çubuğu daraltmaz) × dolu/boş çalışma.
  Telefon ve tablet genişliklerinde dokunmatik bağlam (hasTouch, isMobile).

  Her durumda:
    - çubuk yana kaymıyor (scrollWidth ≤ clientWidth);
    - görünen her düğme ve seçim kutusu en az 40×40;
    - görünen her araç çubuğun kutusunun içinde;
    - "⋯" görünür; atıf ya çubukta ya "⋯" menüsünde;
    - çubuktaki ve "⋯"deki her menü ekranın içinde açılıyor;
    - "⋯" klavyeyle açılıyor (↓ ilk öğeye odak), Esc odağı düğmeye döndürüyor;
    - telefonda "⋯" dokunarak açılıyor.
  Ayrıca: editörü salt açmak sıfır sunucu yazma isteği üretir (açılış
  okumalarından sonra 4 sn boşta hiçbir sunucu işlemi).

  BOŞ çalışma için belge tarayıcıda boşaltılır (yazma kipinde kayıt
  sahte veriye gider); betikten sonra önizleme yeniden başlatılmalı.
    ONIZLEME_YAZ=1 npm run onizleme:ai
    NODE_PATH=$(npm root -g) node scripts/onizleme/arac-cubugu-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";
import { anlat, eylemIzci, hataMi } from "./eylem-izci.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("arac-cubugu-kabul", TABAN, "varsayilan");
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

async function baglam(genislik, tema, panel) {
  const dokunmatik = genislik < 1200;
  const ctx = await tarayici.newContext({
    viewport: { width: genislik, height: genislik < 761 ? 800 : 900 },
    hasTouch: dokunmatik,
    isMobile: genislik < 761,
  });
  await ctx.addInitScript(
    ([t, p]) => {
      try {
        localStorage.setItem("arvolab.theme", t);
        localStorage.setItem("arvolab:inceleme-paneli", p ? "1" : "0");
      } catch {}
    },
    [tema, panel],
  );
  return ctx;
}

const olc = (sayfa) =>
  sayfa.evaluate(() => {
    const bar = document.querySelector(".manuscript-araclar");
    const b = bar.getBoundingClientRect();
    const gorunur = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const ogeler = [...bar.querySelectorAll(":scope > .arac-grup button, :scope > .arac-grup select")].filter(gorunur);
    const kucuk = [];
    const disarida = [];
    for (const e of ogeler) {
      const r = e.getBoundingClientRect();
      const ad = (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30);
      if (r.width < 39.5 || r.height < 39.5) kucuk.push(`${ad} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < b.left - 1 || r.right > b.right + 1) disarida.push(ad);
    }
    const gizli = [...bar.querySelectorAll("[data-arac-grup][hidden]")].map((e) => e.dataset.aracGrup);
    return {
      yukseklik: b.height,
      kayiyor: bar.scrollWidth > bar.clientWidth + 1,
      kucuk,
      disarida,
      gizli,
      atifCubukta: Boolean([...bar.querySelectorAll('[aria-label="Kaynaktan atıf ekle"]')].find(gorunur)),
      geriAl: (() => {
        const e = [...bar.querySelectorAll('[aria-label="Geri al (Ctrl+Z)"]')].find(gorunur);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })(),
      ucNokta: Boolean([...bar.querySelectorAll('button[aria-label^="Bul, sayfa ayarı"]')].find(gorunur)),
      panelSutun: Boolean(document.querySelector('#yazim-yan-panel[data-bicim="sutun"]:not([hidden])')),
    };
  });

const pencereEkranda = (sayfa) =>
  sayfa.evaluate(() => {
    const p = [...document.querySelectorAll(".arac-menu-pencere")].find((e) => e.matches(":popover-open") || !e.hidden);
    if (!p) return { var: false };
    const r = p.getBoundingClientRect();
    return { var: true, ekranda: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, metin: p.textContent };
  });

async function menuleriDene(sayfa, ad) {
  const dugmeler = sayfa.locator(".manuscript-araclar > .arac-grup:not([hidden]) .arac-menu-dugme");
  const n = await dugmeler.count();
  for (let i = 0; i < n; i++) {
    const d = dugmeler.nth(i);
    if (!(await d.isVisible())) continue;
    await d.click();
    await sayfa.waitForTimeout(150);
    const p = await pencereEkranda(sayfa);
    bekle(p.var && p.ekranda, `${ad}: "${await d.getAttribute("aria-label")}" menüsü ekranın içinde açılmadı`);
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(80);
  }
}

/*
  Açılışın bittiği an sabit 700 ms ile değil, açılış okumalarının
  tamamlanmasıyla belirlenir (scripts/onizleme/eylem-izci.mjs). Eskiden yük
  altında gecikmiş bir açılış okuması "boştayken sunucu isteği" sayılıyordu.
*/
async function editoruAc(ctx) {
  const sayfa = await ctx.newPage();
  const izci = eylemIzci(sayfa);
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 30000 });
  const acilis = await izci.acilisiBekle();
  return { sayfa, izci, acilis };
}

async function durum(sayfa, ad, { dokunmatik, genislik }) {
  const o = await olc(sayfa);
  // Telefonda Geri al çubukta ve en az 40×40 (kurum sahibinin kararı, 07.11.2026); Yinele "⋯"de olabilir.
  if (genislik <= 390) bekle(o.geriAl && o.geriAl.w >= 40 && o.geriAl.h >= 40, `${ad}: Geri al çubukta görünmüyor ya da 40×40 altı (${JSON.stringify(o.geriAl)})`);
  bekle(!o.kayiyor, `${ad}: çubuk yana kayıyor`);
  // V1 (Phase 4.5): çubuk 48 px (--arac-cubugu-h); denetimler 40×40 kalır. Eskiden 54 px'ti (6 + 6 dolgu).
  bekle(Math.abs(o.yukseklik - 48) < 0.6, `${ad}: çubuk ${o.yukseklik} px (beklenen 48)`);
  bekle(o.kucuk.length === 0, `${ad}: 40×40 altı: ${o.kucuk.join(", ")}`);
  bekle(o.disarida.length === 0, `${ad}: çubuğun dışında: ${o.disarida.join(", ")}`);
  bekle(o.ucNokta, `${ad}: "⋯" görünmüyor`);
  await menuleriDene(sayfa, ad);
  // "⋯": klavye (ya da dokunma) ile aç; gizli gruplar ve atıf orada
  const uc = sayfa.locator('.manuscript-araclar button[aria-label^="Bul, sayfa ayarı"]').first();
  if (dokunmatik) {
    await uc.tap();
  } else {
    await uc.focus();
    await sayfa.keyboard.press("ArrowDown");
  }
  await sayfa.waitForTimeout(200);
  const p = await pencereEkranda(sayfa);
  bekle(p.var && p.ekranda, `${ad}: "⋯" menüsü ekranın içinde açılmadı`);
  if (o.gizli.includes("yinele")) bekle(/Yinele/.test(p.metin ?? ""), `${ad}: Yinele ne çubukta ne "⋯" menüsünde`);
  if (!o.atifCubukta) bekle(/Atıf|Citation/.test(p.metin ?? ""), `${ad}: atıf ne çubukta ne "⋯" menüsünde`);
  bekle(o.gizli.length === 0 || /Bul ve değiştir/.test(p.metin ?? ""), `${ad}: "⋯" belge araçlarını kaybetti`);
  if (!dokunmatik) {
    const odak = await sayfa.evaluate(() => Boolean(document.activeElement?.closest(".arac-menu-pencere")));
    bekle(odak, `${ad}: ↓ ile odak menüye girmedi`);
  }
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(100);
  if (!dokunmatik) {
    const geri = await sayfa.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    bekle(/^Bul, sayfa ayarı/.test(geri), `${ad}: Esc odağı "⋯"ye döndürmedi (${geri})`);
  }
  return o;
}

const ozet = [];
for (const genislik of [1440, 1366, 1280, 1024, 768, 390, 360]) {
  for (const tema of ["light", "dark"]) {
    for (const panel of genislik >= 1200 ? [true, false] : [false]) {
      const ctx = await baglam(genislik, tema, panel);
      const { sayfa, izci, acilis } = await editoruAc(ctx);
      const ad = `${genislik} ${tema} panel-${panel ? "açık" : "kapalı"}`;
      const o = await durum(sayfa, ad, { dokunmatik: genislik < 1200, genislik });
      if (genislik >= 1200) bekle(o.panelSutun === panel, `${ad}: panel durumu beklenen değil`);
      if (tema === "light") {
        /*
          Salt açma: açılış okumalarından sonra boşta belge yazımı ya da
          açılışta görülmemiş bir sunucu eylemi olmamalı (kayıt, sürüm dahil).
          Açılış okumasının gecikmiş tekrarı hata değil; bilgi olarak yazılır.
        */
        await sayfa.waitForTimeout(4000);
        const bostaki = izci.bostakiler(acilis);
        const hatali = bostaki.filter(hataMi);
        bekle(hatali.length === 0, `${ad}: editör boştayken ${hatali.length} beklenmeyen sunucu eylemi: ${hatali.map(anlat).join(" | ")}`);
        const tekrar = bostaki.filter((i) => !hataMi(i));
        if (tekrar.length) console.log(`  bilgi — ${ad}: açılış okumasının gecikmiş tekrarı (hata değil): ${tekrar.map(anlat).join(" | ")}`);
        if (acilis.bekleyen) console.log(`  bilgi — ${ad}: açılış ${acilis.sure} ms sınırında ${acilis.bekleyen} eylem hâlâ bekliyordu`);
      }
      ozet.push(`${ad}: menüde ${o.gizli.length ? o.gizli.join(",") : "—"}`);
      await ctx.close();
    }
  }
}
// Telefon ve tablette panel AÇIK (belgenin üstüne açılan sayfa): çubuk aynı kalır.
for (const genislik of [1024, 390]) {
  const ctx = await baglam(genislik, "light", false);
  const { sayfa } = await editoruAc(ctx);
  // Telefonda panel düğmesi "Belge" menüsünde (Premium Simplicity Aşama 1, 08.11.2026).
  if (genislik <= 760) {
    await sayfa.locator("button.yazma-belge-menu").tap();
    await sayfa.locator(".arac-menu-pencere:popover-open button", { hasText: "Yazım paneli" }).tap();
  } else await sayfa.locator("button.yazma-panel-dugmesi").first().tap();
  await sayfa.waitForTimeout(400);
  const o = await olc(sayfa);
  bekle(!o.kayiyor && o.kucuk.length === 0, `${genislik} panel-açık (sayfa): çubuk bozuldu`);
  await ctx.close();
}
/*
  V1 (Phase 4.5): "Bul ve değiştir" şeridi (.manuscript-ust) kaydırınca
  araç çubuğunun HEMEN altına yapışır: üst üste binmez, arada boşluk
  kalmaz. Şeridin konumu çubuk yüksekliğinden türer (--arac-cubugu-h);
  eskiden 54 elle yazılıydı ve çubuk değişince şerit kayardı.
*/
for (const genislik of [1440, 1024, 390]) {
  for (const tema of ["light", "dark"]) {
    const ctx = await baglam(genislik, tema, false);
    const { sayfa } = await editoruAc(ctx);
    const ad = `${genislik} ${tema} bul şeridi`;
    await sayfa.locator(".ProseMirror").click();
    await sayfa.keyboard.press("Control+f");
    await sayfa.locator(".manuscript-ust").waitFor({ timeout: 10000 });
    await sayfa.evaluate(() => window.scrollTo(0, 3000));
    await sayfa.waitForTimeout(300);
    const r = await sayfa.evaluate(() => {
      const bar = document.querySelector(".manuscript-araclar").getBoundingClientRect();
      const ust = document.querySelector(".manuscript-ust").getBoundingClientRect();
      return { barAlt: bar.bottom, ustUst: ust.top, barH: bar.height };
    });
    bekle(Math.abs(r.ustUst - r.barAlt) <= 1, `${ad}: şerit çubuğa yapışmıyor (çubuk altı ${r.barAlt.toFixed(1)}, şerit üstü ${r.ustUst.toFixed(1)})`);
    await ctx.close();
  }
}
// BOŞ çalışma (belge tarayıcıda boşaltılır)
for (const genislik of [1440, 390]) {
  const ctx = await baglam(genislik, "light", true);
  const { sayfa } = await editoruAc(ctx);
  await sayfa.locator(".ProseMirror").click();
  await sayfa.keyboard.press("Control+a");
  await sayfa.keyboard.press("Delete");
  await sayfa.waitForTimeout(400);
  const bos = await sayfa.evaluate(() => (document.querySelector(".ProseMirror")?.textContent ?? "").trim().length === 0);
  bekle(bos, `${genislik} boş: belge boşaltılamadı`);
  await durum(sayfa, `${genislik} boş çalışma`, { dokunmatik: genislik < 1200, genislik });
  await ctx.close();
}

await tarayici.close();
console.log(ozet.join("\n"));
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nAraç çubuğu kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
