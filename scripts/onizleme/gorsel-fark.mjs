/*
  GÖRSEL FARK (Signature OS 2.0 Aşama 1, 08.11.2026).

  Tasarım sistemi değişikliklerinin çoğu "görünüm değişmemeli" iddiasıyla
  yapılıyor: token birleştirme, ham yarıçapı token'a taşıma, kullanılmayan
  palet adımlarını silme. Bu iddiayı gözle sınamak 144 ekranda mümkün
  değil; kabul betikleri ise yalnızca işlevi ölçüyor. Bu betik iki işi
  yapar:

    çek   — sayfa × genişlik × tema tam sayfa ekran görüntüsü
            (animasyon, geçiş ve imleç kapalı; saat gizli)
    karşılaştır — iki klasördeki aynı adlı görüntüleri piksel piksel
            karşılaştırır, fark varsa kırmızı işaretli bir fark görüntüsü
            yazar ve farkın kapsadığı kutuyu bildirir.

  Eşik: kanal başına 24'ten büyük fark "farklı" sayılır. Yazı kenarındaki
  alt piksel yumuşatma farkları bunun altında kalıyor; tek piksellik
  bir çizgi rengi değişimi üstünde.

  Önizleme sunucusu açık olmalı (npm run onizleme). Salt okunur.

    node scripts/onizleme/gorsel-fark.mjs cek <klasör> [sayfa,sayfa…] [--taban http://localhost:3123]
    node scripts/onizleme/gorsel-fark.mjs karsilastir <önce> <sonra> <fark-klasörü>

  Karşılaştırmanın çıkış kodu: fark yoksa 0, varsa 1 — "görünüm değişmedi"
  iddiası taşıyan bir commit'te 0 beklenir. Beklenen değişiklikte fark
  görüntüleri tek tek incelenir.
*/
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const TEZ = "00000000-0000-4000-8000-0000000000b1";
export const SAYFALAR = {
  dashboard: "/dashboard",
  calismalarim: `/dashboard/editor?sec=${TEZ}`,
  editor: `/dashboard/editor/${TEZ}/write`,
  kaynaklar: `/dashboard/literature?calisma=${TEZ}`,
  kaynakca: `/dashboard/citations?calisma=${TEZ}`,
  kanit: `/dashboard/editor/${TEZ}/kanit`,
  analiz: "/dashboard/analysis",
  belge: "/dashboard/documents",
  ayarlar: "/dashboard/settings",
  abonelik: "/dashboard/abonelik",
  yardim: "/dashboard/yardim",
  destek: "/dashboard/expert-requests",
};
export const GENISLIKLER = [1440, 1200, 1024, 768, 390, 360];
const TEMALAR = ["light", "dark"];
/*
  Görüntüyü rastgele yapan her şey sabitlenir: animasyon, geçiş, imleç,
  saat, Next'in geliştirme göstergesi (sol alttaki "N") ve göreli
  zamanlar ("11 dk önce" iki çekim arasında "12 dk önce" oluyordu;
  ilk gürültü ölçümünde 144 görüntünün 25'i bu yüzden farklı çıktı).
*/
const SAKIN = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.os-saat{visibility:hidden!important}nextjs-portal{display:none!important}`;
const GORELI_ZAMAN = String.raw`(az önce|şimdi|\d+\s*(sn|dk|dakika|sa|saat|gün|hafta|ay|yıl)\s*(önce|sonra)|just now|\d+\s*\w+\s+ago)`;
// Örnek veri zamanları "şimdi"den türetiyor: "Kaydedildi · 15:45" iki çekim arasında 15:52 oluyordu (08.11.2026, 44 görüntü).
const SAAT = String.raw`\b([01]?\d|2[0-3]):[0-5]\d\b`;
const ESIK = 24;

async function cek(klasor, suzgec, taban) {
  const { chromium } = require("playwright");
  fs.mkdirSync(klasor, { recursive: true });
  const tarayici = await chromium.launch();
  let hata = 0;
  for (const [ad, yol] of Object.entries(SAYFALAR)) {
    if (suzgec && !suzgec.includes(ad)) continue;
    for (const w of GENISLIKLER) {
      for (const tema of TEMALAR) {
        // Dokunma 1200 altında: dokunmatik kurallar ((pointer: coarse) ve ≤1199) ekranda gerçekte nasılsa öyle görünsün.
        const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: w < 1200, isMobile: w < 761, deviceScaleFactor: 1 });
        await ctx.addInitScript((t) => {
          try {
            localStorage.setItem("arvolab.theme", t);
          } catch {}
        }, tema);
        const sayfa = await ctx.newPage();
        try {
          await sayfa.goto(taban + yol, { waitUntil: "networkidle", timeout: 180000 });
          await sayfa.addStyleTag({ content: SAKIN });
          await sayfa.evaluate((kaliplar) => {
            const re = new RegExp(kaliplar[0], "gi");
            const yuruyucu = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const saat = new RegExp(kaliplar[1], "g");
            for (let d = yuruyucu.nextNode(); d; d = yuruyucu.nextNode()) {
              if (d.nodeValue.search(re) >= 0) d.nodeValue = d.nodeValue.replace(re, "— önce");
              if (d.nodeValue.search(saat) >= 0) d.nodeValue = d.nodeValue.replace(saat, "00:00");
            }
          }, [GORELI_ZAMAN, SAAT]);
          await sayfa.evaluate(() => document.fonts.ready);
          await sayfa.waitForTimeout(600);
          await sayfa.screenshot({ path: path.join(klasor, `${ad}-${w}-${tema}.png`), fullPage: true });
        } catch (e) {
          hata++;
          console.log(`✗ ${ad} ${w} ${tema}: ${String(e).slice(0, 120)}`);
        }
        await ctx.close();
      }
    }
  }
  await tarayici.close();
  console.log(`${fs.readdirSync(klasor).filter((f) => f.endsWith(".png")).length} görüntü → ${klasor}`);
  return hata ? 2 : 0;
}

async function ham(dosya, w, h) {
  const sharp = require("sharp");
  // Boyutlar farklıysa ikisi de büyüğe tamamlanır (boş alan macenta): yükseklik farkı da fark sayılır.
  return sharp(dosya).ensureAlpha().extend({ right: w, bottom: h, background: { r: 255, g: 0, b: 255, alpha: 1 } }).raw().toBuffer({ resolveWithObject: true });
}

async function karsilastir(once, sonra, farkKlasoru) {
  const sharp = require("sharp");
  fs.mkdirSync(farkKlasoru, { recursive: true });
  const satirlar = [];
  for (const ad of fs.readdirSync(sonra).filter((f) => f.endsWith(".png")).sort()) {
    const a = path.join(once, ad);
    const b = path.join(sonra, ad);
    if (!fs.existsSync(a)) {
      satirlar.push({ ad, n: -1, not: "önce yok" });
      continue;
    }
    const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
    const W = Math.max(ma.width, mb.width);
    const H = Math.max(ma.height, mb.height);
    const [ra, rb] = await Promise.all([ham(a, W - ma.width, H - ma.height), ham(b, W - mb.width, H - mb.height)]);
    const da = ra.data;
    const db = rb.data;
    const isaret = Buffer.alloc(W * H * 4);
    let n = 0;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0, p = 0; i < da.length; i += 4, p++) {
      const fark = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (fark > ESIK) {
        n++;
        const x = p % W, y = (p / W) | 0;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
        isaret[i] = 255; isaret[i + 1] = 0; isaret[i + 2] = 60; isaret[i + 3] = 255;
      } else {
        // Farksız pikseller soluk: fark kırmızısı öne çıksın.
        isaret[i] = 128 + (db[i] >> 1); isaret[i + 1] = 128 + (db[i + 1] >> 1); isaret[i + 2] = 128 + (db[i + 2] >> 1); isaret[i + 3] = 255;
      }
    }
    const boyut = ma.width !== mb.width || ma.height !== mb.height ? ` boyut ${ma.width}×${ma.height}→${mb.width}×${mb.height}` : "";
    if (n) await sharp(isaret, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(farkKlasoru, ad));
    satirlar.push({ ad, n, not: n ? `${n} px, kutu ${x0},${y0}–${x1},${y1}${boyut}` : "aynı" });
  }
  satirlar.sort((p, q) => q.n - p.n);
  for (const s of satirlar) console.log(`${s.n === 0 ? "=" : "≠"} ${s.ad.padEnd(34)} ${s.not}`);
  const farkli = satirlar.filter((s) => s.n !== 0).length;
  console.log(`\n${satirlar.length} görüntü, ${farkli} farklı`);
  return farkli ? 1 : 0;
}

const [, , komut, ...arg] = process.argv;
const tabanIdx = arg.indexOf("--taban");
const taban = tabanIdx >= 0 ? arg.splice(tabanIdx, 2)[1] : "http://localhost:3123";
let kod;
if (komut === "cek") kod = await cek(arg[0], arg[1]?.split(","), taban);
else if (komut === "karsilastir") kod = await karsilastir(arg[0], arg[1], arg[2]);
else {
  console.log("Kullanım: gorsel-fark.mjs cek <klasör> [sayfa,…] | karsilastir <önce> <sonra> <fark>");
  kod = 2;
}
process.exit(kod);
