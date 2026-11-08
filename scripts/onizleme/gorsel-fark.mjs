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
    node scripts/onizleme/gorsel-fark.mjs geometri <klasör> [sayfa,…]   (öğe kutuları, JSON)
    node scripts/onizleme/gorsel-fark.mjs geokarsilastir <önce> <sonra>

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
  ilk gürültü ölçümünde 144 görüntünün 25'i bu yüzden farklı çıktı) ve
  editörün content-visibility'si (ekran dışındaki paragraflar tam sayfa
  çekimde bazen boş çiziliyordu: 08.11.2026, editör 1440 açıkta bir kez
  508 bin piksel sahte fark).
*/
const SAKIN = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.os-saat{visibility:hidden!important}nextjs-portal{display:none!important}*{content-visibility:visible!important}`;
const GORELI_ZAMAN = String.raw`(az önce|şimdi|\d+\s*(sn|dk|dakika|sa|saat|gün|hafta|ay|yıl)\s*(önce|sonra)|just now|\d+\s*\w+\s+ago)`;
// Örnek veri zamanları "şimdi"den türetiyor: "Kaydedildi · 15:45" iki çekim arasında 15:52 oluyordu (08.11.2026, 44 görüntü).
const SAAT = String.raw`\b([01]?\d|2[0-3]):[0-5]\d\b`;
/*
  Ana Sayfa selamlaması günün saatine bağlı (lib/genel-bakis.ts, selamlama).
  V4.3-A1'de taban "İyi akşamlar", sonraki çekim "İyi geceler" dönemine
  denk geldi: 12 görüntü, görünüm değişikliği olmadan "farklı" çıktı.
  Dört kalıp tek bir sabit metne indirilir; sözcük uzunluğu da sabitlenir.
*/
// \b kullanılmaz: JS'te (u bayraksız) "İ" sözcük karakteri sayılmıyor ve "İyi …" hiç eşleşmiyordu.
const SELAMLAMA = String.raw`(Günaydın|İyi günler|İyi akşamlar|İyi geceler|Good morning|Good afternoon|Good evening)`;
const ESIK = 24;

async function cek(klasor, suzgec, taban, kip = "goruntu") {
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
            const selam = new RegExp(kaliplar[2], "g");
            for (let d = yuruyucu.nextNode(); d; d = yuruyucu.nextNode()) {
              /*
                Üst çubuktaki tarih (görünmez ama yer kaplar): gün değişince
                "8 Kasım Pazar" → "9 Kasım Pazartesi" genişliği değiştirip
                konum yolunu ve arama kutusunu kaydırıyordu (V4.3-A2-2'de
                78 sayfada sahte "yerleşim değişti"). Sabit metne indirilir.
              */
              if (d.parentElement?.closest(".os-saat") && d.nodeValue.trim()) {
                d.nodeValue = /\d{1,2}:\d{2}/.test(d.nodeValue) ? "00:00" : "1 Ocak Pazartesi";
                continue;
              }
              if (d.nodeValue.search(re) >= 0) d.nodeValue = d.nodeValue.replace(re, "— önce");
              if (d.nodeValue.search(saat) >= 0) d.nodeValue = d.nodeValue.replace(saat, "00:00");
              if (d.nodeValue.search(selam) >= 0) d.nodeValue = d.nodeValue.replace(selam, "İyi günler");
            }
          }, [GORELI_ZAMAN, SAAT, SELAMLAMA]);
          await sayfa.evaluate(() => document.fonts.ready);
          await sayfa.waitForTimeout(600);
          if (kip === "geometri") fs.writeFileSync(path.join(klasor, `${ad}-${w}-${tema}.json`), JSON.stringify(await sayfa.evaluate(GEOMETRI)));
          else if (kip === "kontrast") fs.writeFileSync(path.join(klasor, `${ad}-${w}-${tema}.json`), JSON.stringify(await kontrastOlc(sayfa)));
          else await sayfa.screenshot({ path: path.join(klasor, `${ad}-${w}-${tema}.png`), fullPage: true });
        } catch (e) {
          hata++;
          console.log(`✗ ${ad} ${w} ${tema}: ${String(e).slice(0, 120)}`);
        }
        await ctx.close();
      }
    }
  }
  await tarayici.close();
  console.log(`${fs.readdirSync(klasor).filter((f) => f.endsWith(kip === "goruntu" ? ".png" : ".json")).length} ${kip === "goruntu" ? "görüntü" : kip} → ${klasor}`);
  return hata ? 2 : 0;
}

/*
  GEOMETRİ (V4.3-A2, 08.11.2026). Renk göçünde piksel farkı her ekranda
  BEKLENİYOR; asıl soru yerleşimin değişip değişmediği. Piksel farkı
  bunu ayıramıyor: renk farkı yerleşim farkını örtüyor. Bu kip her
  görünür öğenin kutusunu (yarım piksele yuvarlanmış) ve yazı ölçüsünü
  yazar; iki çekim arasında tek bir kutu kayarsa "yerleşim değişti" denir.
*/
const GEOMETRI = () => {
  const y = (v) => Math.round(v * 2) / 2;
  const satirlar = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const s = getComputedStyle(el);
    const yol = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) yol.unshift(e.tagName.toLowerCase() + (e.classList[0] ? "." + e.classList[0] : ""));
    satirlar.push([yol.slice(-4).join(">"), y(r.x), y(r.y + window.scrollY), y(r.width), y(r.height), s.fontSize, s.lineHeight, s.fontWeight, s.borderTopWidth, s.borderRadius]);
  }
  return { genislik: document.documentElement.scrollWidth, yukseklik: document.documentElement.scrollHeight, satirlar };
};

/*
  KONTRAST (V4.3-A2). Renk göçünün asıl riski: bir metin rengi ya da
  zemini değişir, oran AA'nın altına iner ve hiçbir kabul betiği bunu
  görmez. Zemin CSS'ten hesaplanmıyor, EKRANDAN okunuyor: kâğıt bir
  degradeyle çiziliyor (kenarlarda masa, ortada kâğıt) ve tablo
  kaydırma gölgeleri de degrade; her durağı aday saymak koyu temada
  metni masanın rengine karşı ölçüp 1770 sahte hata üretti. Yöntem:
  doğrudan metin taşıyan her görünür öğenin kutusu ve yazı rengi
  okunur, sonra BÜTÜN yazılar saydam yapılıp sayfa çekilir ve kutunun
  altındaki piksellerin ortancası zemin sayılır. Eşik WCAG: 4,5; ≥24px
  ya da ≥18,66px kalın yazıda 3. Devre dışı öğeler (WCAG'de muaf)
  işaretlenir, toplama girmez.
*/
const KONTRAST_TOPLA = () => {
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (![...el.childNodes].some((d) => d.nodeType === 3 && d.nodeValue.trim())) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden") continue;
    // Kapalı <details> içeriğinin kutusu var ama çizilmiyor (kullanıcı menüsü): ölçülürse oran 1 çıkar.
    if (el.closest("details:not([open])") && !el.closest("summary")) continue;
    /* Kaydırma kabının (tablo, panel) dışında kalan kısım ekranda yok: kutu kırpılır. */
    let { left: x0, top: y0, right: x1, bottom: y1 } = el.getBoundingClientRect();
    let saydamlik = 1;
    for (let e = el; e; e = e.parentElement) {
      const es = getComputedStyle(e);
      saydamlik *= +es.opacity;
      if (e !== el && e !== document.body && e !== document.documentElement && (es.overflowX !== "visible" || es.overflowY !== "visible")) {
        const k = e.getBoundingClientRect();
        x0 = Math.max(x0, k.left); y0 = Math.max(y0, k.top); x1 = Math.min(x1, k.right); y1 = Math.min(y1, k.bottom);
      }
    }
    // Kapalı menü gibi saydam katmandaki yazı görünmüyor: ölçülmez (yoksa oran 1 çıkar).
    if (x1 - x0 < 2 || y1 - y0 < 2 || saydamlik < 0.05) continue;
    const yol = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) yol.unshift(e.tagName.toLowerCase() + (e.classList[0] ? "." + e.classList[0] : ""));
    let sabit = 0;
    for (let e = el; e && e !== document.body; e = e.parentElement) if (/^(fixed|sticky)$/.test(getComputedStyle(e).position)) { sabit = 1; break; }
    out.push({ sabit, yol: yol.slice(-3).join(">"), x: x0 + scrollX, y: y0 + scrollY, w: x1 - x0, h: y1 - y0, renk: s.color, px: parseFloat(s.fontSize), agirlik: +s.fontWeight, saydamlik, muaf: el.closest("[disabled],[aria-disabled='true'],:disabled") ? 1 : 0, metin: el.textContent.trim().slice(0, 30) });
  }
  return out;
};
const YAZI_GIZLE = `*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}`;

function renkCoz(c) {
  let m = c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = c.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  return null;
}
function oranHesap(yazi, zemin) {
  const isik = (c) => {
    const k = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  const x = isik(yazi), y = isik(zemin);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function kontrastOlc(sayfa) {
  const sharp = require("sharp");
  const ogeler = await sayfa.evaluate(KONTRAST_TOPLA);
  await sayfa.addStyleTag({ content: YAZI_GIZLE });
  await sayfa.waitForTimeout(100);
  const ham = async () => sharp(await sayfa.screenshot({ fullPage: true })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  /*
    Tam sayfa çekimde sabit/yapışkan çubuklar (alt gezinme, durum çubuğu)
    ilk ekranın yerinde çizilir ve altlarındaki metnin "zemini" olur:
    ilk sürüm kâğıttaki metni 1,2:1 ölçtü (gerçekte 12,99:1). Çubuğun
    altındaki metin kullanıcı kaydırınca açığa çıkar; zemini çubuklar
    GİZLİ (visibility, yerleşimi değiştirmez) çekimden okunur. Çubukların
    kendi yazısı çubuklu çekimden okunur.
  */
  const cubuklu = await ham();
  await sayfa.evaluate(() => {
    for (const e of document.querySelectorAll("body *")) if (/^(fixed|sticky)$/.test(getComputedStyle(e).position)) e.style.setProperty("visibility", "hidden", "important");
  });
  await sayfa.waitForTimeout(100);
  const cubuksuz = await ham();
  const dusuk = [];
  let olculen = 0, olculemedi = 0;
  for (const o of ogeler) {
    const { data, info } = o.sabit ? cubuklu : cubuksuz;
    const yazi = renkCoz(o.renk);
    const x0 = Math.max(0, Math.round(o.x)), y0 = Math.max(0, Math.round(o.y));
    const x1 = Math.min(info.width, Math.round(o.x + o.w)), y1 = Math.min(info.height, Math.round(o.y + o.h));
    if (!yazi || x1 - x0 < 1 || y1 - y0 < 1) { olculemedi++; continue; }
    const kanal = [[], [], []];
    const adim = Math.max(1, Math.floor(((x1 - x0) * (y1 - y0)) / 4000));
    let i = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (i++ % adim) continue;
      const p = (y * info.width + x) * 3;
      kanal[0].push(data[p]); kanal[1].push(data[p + 1]); kanal[2].push(data[p + 2]);
    }
    const zemin = kanal.map((k) => k.sort((a, b) => a - b)[k.length >> 1]);
    const a = yazi[3] * o.saydamlik;
    const etkin = [0, 1, 2].map((j) => yazi[j] * a + zemin[j] * (1 - a));
    olculen++;
    const oran = oranHesap(etkin, zemin);
    const esik = o.px >= 24 || (o.px >= 18.66 && o.agirlik >= 700) ? 3 : 4.5;
    if (oran < esik) dusuk.push([o.yol, Math.round(oran * 100) / 100, esik, o.muaf, o.metin]);
  }
  return { olculen, olculemedi, dusuk };
}

function geoKarsilastir(once, sonra) {
  let farkli = 0, toplam = 0;
  for (const ad of fs.readdirSync(sonra).filter((f) => f.endsWith(".json")).sort()) {
    toplam++;
    const a = JSON.parse(fs.readFileSync(path.join(once, ad), "utf8"));
    const b = JSON.parse(fs.readFileSync(path.join(sonra, ad), "utf8"));
    const notlar = [];
    if (a.genislik !== b.genislik || a.yukseklik !== b.yukseklik) notlar.push(`sayfa ${a.genislik}×${a.yukseklik}→${b.genislik}×${b.yukseklik}`);
    if (a.satirlar.length !== b.satirlar.length) notlar.push(`öğe sayısı ${a.satirlar.length}→${b.satirlar.length}`);
    const n = Math.min(a.satirlar.length, b.satirlar.length);
    let ilk = null, sayi = 0;
    for (let i = 0; i < n; i++) {
      if (JSON.stringify(a.satirlar[i]) !== JSON.stringify(b.satirlar[i])) {
        sayi++;
        ilk ??= `${JSON.stringify(a.satirlar[i])} → ${JSON.stringify(b.satirlar[i])}`;
      }
    }
    if (sayi) notlar.push(`${sayi} öğe farklı; ilki ${ilk}`);
    if (notlar.length) farkli++;
    console.log(`${notlar.length ? "≠" : "="} ${ad.padEnd(34)} ${notlar.join(" · ") || `aynı (${a.satirlar.length} öğe)`}`);
  }
  console.log(`\n${toplam} geometri, ${farkli} farklı`);
  return farkli ? 1 : 0;
}

/* Muaf olmayan düşük kontrastlı öğeler: önce/sonra. "sonra"da yeni çıkan her biri çıkış kodunu 1 yapar. */
function kontrastOzet(once, sonra) {
  let yeni = 0, toplamOnce = 0, toplamSonra = 0, olculen = 0, olculemedi = 0;
  const anahtar = (d) => `${d[0]}|${d[4]}`;
  for (const ad of fs.readdirSync(sonra).filter((f) => f.endsWith(".json")).sort()) {
    const b = JSON.parse(fs.readFileSync(path.join(sonra, ad), "utf8"));
    const a = once && once !== "-" ? JSON.parse(fs.readFileSync(path.join(once, ad), "utf8")) : { dusuk: [] };
    olculen += b.olculen; olculemedi += b.olculemedi;
    const da = a.dusuk.filter((d) => !d[3]), dbb = b.dusuk.filter((d) => !d[3]);
    toplamOnce += da.length; toplamSonra += dbb.length;
    const eski = new Set(da.map(anahtar));
    for (const d of dbb) if (!eski.has(anahtar(d))) { yeni++; console.log(`YENİ ${ad.padEnd(28)} ${d[1]} < ${d[2]}  ${d[0]}  «${d[4]}»`); }
    for (const d of da) if (!dbb.some((x) => anahtar(x) === anahtar(d))) console.log(`DÜZELDİ ${ad.padEnd(25)} ${d[0]}  «${d[4]}»`);
  }
  console.log(`\nölçülen ${olculen}, ölçülemedi ${olculemedi}; eşik altı (muaf olmayan) önce ${toplamOnce}, sonra ${toplamSonra}, yeni ${yeni}`);
  return yeni ? 1 : 0;
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
else if (komut === "geometri") kod = await cek(arg[0], arg[1]?.split(","), taban, "geometri");
else if (komut === "geokarsilastir") kod = geoKarsilastir(arg[0], arg[1]);
else if (komut === "kontrast") kod = await cek(arg[0], arg[1]?.split(","), taban, "kontrast");
else if (komut === "kontrastozet") kod = kontrastOzet(arg[0], arg[1]);
else if (komut === "karsilastir") kod = await karsilastir(arg[0], arg[1], arg[2]);
else {
  console.log("Kullanım: gorsel-fark.mjs cek <klasör> [sayfa,…] | karsilastir <önce> <sonra> <fark>");
  kod = 2;
}
process.exit(kod);
