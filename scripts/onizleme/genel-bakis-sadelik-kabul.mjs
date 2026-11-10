/*
  DASHBOARD VE ÇALIŞMALARIM SADELİK KABULÜ (Premium Simplicity Aşama 2, 08.11.2026).

  Ölçer (1440, 1024 dokunmatik, 390, 360 dokunmatik × açık/koyu):
    Dashboard (dolu hesap)
      - sayfa boyu: KAPI 1440 ≤ 1550, 1024 ≤ 1750, 390/360 ≤ 2000;
        HEDEF 1440 ≤ 1150, 1024 ≤ 1700, 390/360 ≤ 1800 (aşağıya bakın);
      - görünür bölüm (kart) sayısı ≤ 7 (katlı "Daha fazla" içindekiler hariç);
      - görünür bağlantılarda aynı yol: editör KAPI ≤ 3 / HEDEF ≤ 2,
        Kaynaklar ≤ 2, Belge kontrolü ≤ 1 (yol sorgu dizgesiz sayılır:
        "Yazmaya devam et", sıradaki adım ve "Teslim listesi" (?teslim=1)
        üçü de /write; Aşama 2 öncesi 10);
      - tez kartında eylem: en çok 2 düğme + 1 "sıradaki adım" bağlantısı;
      - açıklama metni ≤ 700 karakter;
      - tek dolgu birincil "Yazmaya devam et";
    Çalışmalarım (dolu hesap, tez seçili)
      - görünür "Yeni çalışma" ≤ 2 (kenar çubuğu dahil);
      - ayrıntıda görünür araç ≤ 4 (+ "Diğer araçlar" menüsü);
      - 390/360'ta seçili çalışmanın ayrıntısı listenin ÜSTÜNDE;
        sayfa KAPI ≤ 1600, HEDEF ≤ 1150;
      - tek dolgu birincil "Yazmaya devam et";
    Her ikisi: yatay taşma yok; dokunmatikte hedefler ≥ 40×40; klavyeyle
    her görünür eylem Tab sırasında ve odak halkası görünür.
  KAPI ile HEDEF ayrı (A2-12): KAPI gerilemeyi yakalar ve çıkış kodunu
  belirler; HEDEF denetim raporundaki (ASAMA-2-DENETIM) amaçtır ve
  karşılanmadığında "◦ HEDEF KARŞILANMADI" diye yazılır ama çıkışı
  düşürmez. Sayfa boyu hedefleri bugün karşılanmıyor: sağ sütunun en
  uzun kartı Abonelik ve kredi, onun kompakt hâli (A2-5) kredi modelindeki
  belirsizlik yüzünden uygulanmadı; Çalışmalarım'da ayrıntının kendisi
  telefonda ~960 px. Kapı, ulaşılan değerin biraz üstünde: hedefe
  yaklaşan her adımda kapı da daraltılmalı, gevşetilmemeli.
  HEDEF LİSTESİ: sadeleşmede kaldırılan/katlanan hiçbir hedef kaybolmaz:
    her biri Dashboard'da (katlı bölüm dahil) ya da Çalışmalarım ayrıntısında
    (menü dahil) DOM'da erişilebilir olmalı.
  Boş hesap için: ONIZLEME_BOS=1 ile başlatılmış önizlemede tek kart ve
  tek birincil eylem (değişmez).
  Salt okunur.
    npm run onizleme   →  NODE_PATH=$(npm root -g) node scripts/onizleme/genel-bakis-sadelik-kabul.mjs [taban] [--olc]
    --olc: eşikleri uygulamadan yalnız ölçüleri yazar (önce/sonra karşılaştırması).
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const SADECE_OLC = argv.includes("--olc");
const TABAN = argv.find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("genel-bakis-sadelik-kabul", TABAN, null);
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let hata = 0;
let denetim = 0;
const bekle = (kosul, mesaj) => {
  if (SADECE_OLC) return;
  denetim++;
  if (!kosul) {
    hata++;
    console.log(`✗ ${mesaj}`);
  }
};

const KARSILANMAYAN = [];
const hedef = (kosul, mesaj) => {
  if (SADECE_OLC || kosul) return;
  KARSILANMAYAN.push(mesaj);
};

const tarayici = await chromium.launch();
async function ac(w, yol, { tema = "light" } = {}) {
  const dokunma = w < 1200;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: dokunma, isMobile: w < 761 });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("arvolab.theme", t);
    } catch {}
  }, tema);
  const sayfa = await ctx.newPage();
  await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.waitForTimeout(700);
  return { ctx, sayfa };
}

const olc = (sayfa) =>
  sayfa.evaluate(() => {
    const gor = (e) => {
      if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === "hidden" || e.getBoundingClientRect().width <= 2) return false;
      // Kapalı <details> içindekiler görünür sayılmaz (özet satırı hariç).
      const d = e.closest("details:not([open])");
      return !d || e.closest("summary")?.parentElement === d;
    };
    const main = document.querySelector("main");
    const yolu = (a) => new URL(a.getAttribute("href"), location.origin).pathname.replace(/[0-9a-f-]{36}/g, "ID");
    const baglantilar = [...main.querySelectorAll("a[href]")].filter(gor);
    const hedefSay = (re) => baglantilar.filter((a) => re.test(yolu(a))).length;
    const kartlar = [...main.querySelectorAll(".tez-kart, article.gb-kart, .gb-kart, .geri-bildirim-karti, .ilk-adimlar")].filter((e, i, l) => gor(e) && !l.some((u) => u !== e && u.contains(e)));
    const tez = main.querySelector(".tez-kart");
    const tezEylem = tez ? [...tez.querySelectorAll("a[href], button")].filter(gor) : [];
    const aciklama = [...main.querySelectorAll("p, small, .gb-kart-bas p, .sirada-govde span")].filter(gor).reduce((t, e) => t + e.textContent.trim().length, 0);
    const birincil = [...main.querySelectorAll(".projects-primary-button")].filter(gor).map((e) => e.textContent.trim());
    const yeniCalisma = [...document.querySelectorAll("a, button")].filter((e) => gor(e) && /Yeni çalışma|New work|İlk çalışmayı oluştur|Create your first work/.test(e.textContent)).length;
    const durum = main.querySelector(".calisma-durum");
    const araclar = durum ? [...durum.querySelectorAll(".calisma-araclari > *")].filter((e) => gor(e) && !e.matches(".calisma-diger-araclar")).length : null;
    const liste = main.querySelector(".calismalar-ikili > article:not(.calisma-durum)");
    const ayrintiUstte = durum && liste ? durum.getBoundingClientRect().top < liste.getBoundingClientRect().top : null;
    const kucuk = [...main.querySelectorAll("a[href], button, summary, select")].filter(gor).filter((e) => !e.closest(".ProseMirror")).map((e) => { const r = e.getBoundingClientRect(); return { ad: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 24), w: r.width, h: r.height }; }).filter((x) => x.w < 39.5 || x.h < 39.5);
    return {
      boy: document.documentElement.scrollHeight,
      tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      kart: kartlar.length,
      kartAdlari: kartlar.map((k) => (k.querySelector("h2,h3")?.textContent ?? k.className).trim().slice(0, 24)),
      editor: hedefSay(/^\/dashboard\/editor\/ID\/write$/),
      kaynaklar: hedefSay(/^\/dashboard\/literature$/),
      belge: hedefSay(/^\/dashboard\/documents$/),
      tezEylem: tezEylem.map((e) => e.textContent.trim().slice(0, 24)),
      tezDugme: tezEylem.filter((e) => e.matches(".projects-primary-button, .projects-filter-button")).length,
      aciklama,
      birincil,
      yeniCalisma,
      araclar,
      ayrintiUstte,
      kucuk,
      hedefler: [...main.querySelectorAll("a[href]")].map((a) => a.getAttribute("href").replace(/[0-9a-f-]{36}/g, "ID")),
      pencereTetik: [...main.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 30)),
    };
  });

// Klavye: görünür her eylem Tab sırasında, odak halkası görünür.
async function klavye(sayfa, ad) {
  const beklenen = await sayfa.evaluate(() => [...document.querySelectorAll("main a[href], main button:not(:disabled), main summary")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 2 && !e.closest("details:not([open]) > :not(summary)")).length);
  await sayfa.evaluate(() => document.activeElement?.blur());
  const goruldu = new Set();
  let halkasiz = 0;
  for (let i = 0; i < beklenen + 40 && goruldu.size < beklenen; i++) {
    await sayfa.keyboard.press("Tab");
    const o = await sayfa.evaluate(() => {
      const a = document.activeElement;
      if (!a || !a.closest("main")) return null;
      const s = getComputedStyle(a);
      const halka = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 || (s.boxShadow && s.boxShadow !== "none");
      const yol = [];
      for (let x = a; x && x !== document.body; x = x.parentElement) yol.push([...x.parentElement.children].indexOf(x));
      return { anahtar: yol.join("."), halka };
    });
    if (!o) continue;
    if (!goruldu.has(o.anahtar) && !o.halka) halkasiz++;
    goruldu.add(o.anahtar);
  }
  bekle(goruldu.size >= beklenen, `${ad}: klavyeyle ${goruldu.size}/${beklenen} eyleme ulaşıldı`);
  bekle(halkasiz === 0, `${ad}: ${halkasiz} öğede odak halkası yok`);
  return `${goruldu.size}/${beklenen}`;
}

const SATIR = [];
// --- Dashboard ve Çalışmalarım, dolu hesap ---
const tumHedefler = new Set();
const tumTetikler = new Set();
let bos = false;
for (const w of [1440, 1024, 390, 360]) {
  for (const tema of ["light", "dark"]) {
    if (tema === "dark" && (w === 1024 || w === 360)) continue;
    // Dashboard
    {
      const { ctx, sayfa } = await ac(w, "/dashboard", { tema });
      const o = await olc(sayfa);
      bos = !(await sayfa.locator(".tez-kart").count());
      o.hedefler.forEach((h) => tumHedefler.add(h));
      o.pencereTetik.forEach((h) => tumTetikler.add(h));
      const ad = `Dashboard ${w} ${tema}`;
      if (bos) {
        bekle(o.kart <= 1 && o.birincil.length === 1, `${ad} (boş): tek kart ve tek birincil beklenirdi (${o.kart} / ${o.birincil.join(",")})`);
      } else {
        bekle(o.boy <= (w >= 1200 ? 1550 : w >= 761 ? 1750 : 2000), `${ad}: sayfa boyu ${o.boy} (kapı)`);
        hedef(o.boy <= (w >= 1200 ? 1150 : w >= 761 ? 1700 : 1800), `${ad}: sayfa boyu ${o.boy}, hedef ${w >= 1200 ? 1150 : w >= 761 ? 1700 : 1800}`);
        bekle(o.kart <= 7, `${ad}: ${o.kart} görünür bölüm (${o.kartAdlari.join(", ")})`);
        bekle(o.editor <= 3 && o.kaynaklar <= 2 && o.belge <= 1, `${ad}: aynı yol editör ${o.editor}, Kaynaklar ${o.kaynaklar}, Belge ${o.belge}`);
        hedef(o.editor <= 2, `${ad}: editöre giden ${o.editor} bağlantı, hedef 2`);
        bekle(o.tezDugme <= 2 && o.tezEylem.length <= 3, `${ad}: tez kartında ${o.tezEylem.length} eylem (${o.tezEylem.join(" | ")})`);
        bekle(o.aciklama <= 700, `${ad}: açıklama ${o.aciklama} karakter`);
        bekle(o.birincil.length === 1 && /Yazmaya/.test(o.birincil[0]), `${ad}: birincil ${o.birincil.join(", ")}`);
      }
      bekle(o.tasma <= 0, `${ad}: yatay taşma ${o.tasma}`);
      if (w < 1200) bekle(o.kucuk.length === 0, `${ad}: 40×40 altı: ${o.kucuk.map((x) => `${x.ad} ${Math.round(x.w)}×${Math.round(x.h)}`).join("; ")}`);
      const kl = tema === "light" && w === 1440 ? await klavye(sayfa, ad) : "—";
      SATIR.push(`${ad}${bos ? " (boş)" : ""}: boy ${o.boy}, kart ${o.kart}, editör/kaynak/belge ${o.editor}/${o.kaynaklar}/${o.belge}, tez eylem ${o.tezEylem.length}, açıklama ${o.aciklama}, birincil ${o.birincil.length}, klavye ${kl}`);
      await ctx.close();
    }
    // Çalışmalarım
    {
      const { ctx, sayfa } = await ac(w, bos ? "/dashboard/editor" : `/dashboard/editor?sec=${TEZ}`, { tema });
      const o = await olc(sayfa);
      o.hedefler.forEach((h) => tumHedefler.add(h));
      o.pencereTetik.forEach((h) => tumTetikler.add(h));
      const ad = `Çalışmalarım ${w} ${tema}`;
      if (!bos) {
        bekle(o.yeniCalisma <= 2, `${ad}: ${o.yeniCalisma} görünür "Yeni çalışma"`);
        bekle(o.araclar !== null && o.araclar <= 4, `${ad}: ayrıntıda ${o.araclar} görünür araç`);
        bekle(o.birincil.length === 1 && /Yazmaya/.test(o.birincil[0]), `${ad}: birincil ${o.birincil.join(", ")}`);
        if (w <= 760) {
          bekle(o.ayrintiUstte === true, `${ad}: seçili çalışmanın ayrıntısı listenin üstünde değil`);
          bekle(o.boy <= 1600, `${ad}: sayfa boyu ${o.boy} (kapı)`);
          hedef(o.boy <= 1150, `${ad}: sayfa boyu ${o.boy}, hedef 1150`);
        }
      } else bekle(o.birincil.length === 1, `${ad} (boş): birincil ${o.birincil.join(", ")}`);
      bekle(o.tasma <= 0, `${ad}: yatay taşma ${o.tasma}`);
      if (w < 1200) bekle(o.kucuk.length === 0, `${ad}: 40×40 altı: ${o.kucuk.map((x) => `${x.ad} ${Math.round(x.w)}×${Math.round(x.h)}`).join("; ")}`);
      const kl = tema === "light" && w === 1440 ? await klavye(sayfa, ad) : "—";
      SATIR.push(`${ad}${bos ? " (boş)" : ""}: boy ${o.boy}, "Yeni çalışma" ${o.yeniCalisma}, araç ${o.araclar}, ayrıntı üstte ${o.ayrintiUstte}, birincil ${o.birincil.length}, klavye ${kl}`);
      await ctx.close();
    }
  }
}

// --- Hedef listesi: hiçbir işlev kaybolmaz (dolu hesap) ---
if (!bos) {
  const HEDEF = [
    ["Yazmaya devam et", /^\/dashboard\/editor\/ID\/write$/],
    ["Çalışma özeti", /^\/dashboard\/editor\?sec=ID$/],
    ["Teslim kontrolü", /\/write\?teslim=1$/],
    ["Kaynaklar (çalışmaya bağlı)", /^\/dashboard\/literature\?calisma=ID$/],
    ["DOI ile kaynak ekle", /literature\?calisma=ID&ekle=1/],
    ["Kaynağa sor", /^\/dashboard\/citations\?calisma=ID$/],
    ["Belge kontrolü", /^\/dashboard\/documents\?calisma=ID$/],
    ["Yazım asistanı", /\/write\?asistan=1$/],
    ["Abonelik", /^\/dashboard\/abonelik$/],
    ["Danışmana PDF", /^\/print\/manuscript\/ID\?auto=1$/],
  ];
  const hepsi = [...tumHedefler];
  const eksik = HEDEF.filter(([, re]) => !hepsi.some((h) => re.test(h))).map(([ad]) => ad);
  bekle(eksik.length === 0, `erişilemeyen hedefler: ${eksik.join(", ")}`);
  // Pencere tetikleri ve menü düğmeleri (Danışmana Word ve ZIP "Dosya olarak gönder" menüsünde).
  const PENCERE = ["Kılavuz", "Takvim", "Literatür", "Kaynakça", "Kanıt matrisi", "Etik kurul", "Analiz", "Word (.docx)", "ZIP + kaynaklar", "Okuma bağlantısı oluştur"];
  const tetik = [...tumTetikler].join(" | ");
  const eksikPencere = PENCERE.filter((p) => !tetik.includes(p));
  bekle(eksikPencere.length === 0, `Çalışmalarım'da açılamayan pencereler: ${eksikPencere.join(", ")}`);
  // Hızlı eylemlerden kalkan "Veri analizi" kenar çubuğunda (Analiz Merkezi) olmalı.
  {
    const { ctx, sayfa } = await ac(1440, "/dashboard");
    const analiz = await sayfa.locator('#os-gezinme a[href="/dashboard/analysis"]').count();
    bekle(analiz > 0, "kenar çubuğunda Analiz Merkezi bağlantısı yok");
    await ctx.close();
  }
  SATIR.push(`Hedef listesi: ${HEDEF.length - eksik.length}/${HEDEF.length}; pencereler ${PENCERE.length - eksikPencere.length}/${PENCERE.length}`);
}

await tarayici.close();
console.log(SATIR.join("\n"));
if (KARSILANMAYAN.length) console.log(`\n${KARSILANMAYAN.map((m) => `◦ HEDEF KARŞILANMADI — ${m}`).join("\n")}`);
if (!SADECE_OLC) console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nGenel bakış sadelik kabulü temiz (${denetim} denetim, ${bos ? "boş" : "dolu"} hesap)`);
process.exit(hata ? 1 : 0);
