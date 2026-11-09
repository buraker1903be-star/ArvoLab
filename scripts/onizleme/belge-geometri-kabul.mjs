/*
  BELGE GEOMETRİSİ KABULÜ (V4.3-C1, karar K-4) — akademik belgenin ekrandaki
  metin sütunu ekranın durumundan bağımsız mı?

  Dört ölçü AYRI denetlenir (biri öbürünü örtmesin):
    kâğıt genişliği   en çok 760 px (638 + 2 × 61); yer yetmezse kabın tamamı
    metin sütunu      638 px (kılavuz ölçüsü yoksa); kılavuzda sayfa − boşluklar
    iç kenar payı     masaüstünde ≥ 24 px; metin kâğıdın kenarına değmez
    satır yüksekliği  font × 1,75 (kılavuz satır aralığı yoksa)

  Sınanan:
    1. Masaüstü (1920, 1600, 1440, 1366, 1280, 1200) × kenar (geniş/dar)
       × panel (açık/kapalı): sütun her durumda 638; yatay taşma yok.
    2. Aynı sayfada panel aç/kapa ve kenar daralt/genişlet: ilk on bloğun
       yüksekliği (satır sayısı) ve belge yüksekliği DEĞİŞMEZ; kaydırma
       konumu korunur (görünen paragrafın üstü ±1 px).
    3. Sütun sığmıyorsa (638 px'te 1200–1343, kılavuzun 548 px'inde 1200–1253) geniş kenar + yerleşik panel: kenar çubuğu yazım
       sayfasında raya iner (yazım rayı), panel kapanınca geri gelir;
       kullanıcının kenar tercihi (localStorage) değişmez. Odak modunda
       yazım rayı yok.
    4. Tablet (1024, 900, 768): panel belgenin ÜSTÜNE açılır, sütun
       açık/kapalı aynı; sütun min(638, kap − 2 × iç pay).
    5. Telefon (390, 360): sütun C1 öncesiyle aynı (317 / 290 px).
    6. Kılavuz senaryosu (ONIZLEME_SENARYO=kilavuz-eski, A4, sol 4 / sağ
       2,5 cm): sütun 14,5 cm (≈ 548 px); panel aç/kapa yine değiştirmez.
       Bu senaryo yalnız sunucu o senaryoyla açıksa koşar (--kilavuz).
  Önizleme: npm run onizleme  (6. için: ONIZLEME_SENARYO=kilavuz-eski npm run onizleme)
    NODE_PATH=$(npm root -g) node scripts/onizleme/belge-geometri-kabul.mjs [taban] [--kilavuz]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const arg = process.argv.slice(2);
const KILAVUZ = arg.includes("--kilavuz");
const TABAN = arg.find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const EDITOR = `/dashboard/editor/${TEZ}/write`;
const CM = 96 / 2.54;
const SUTUN = KILAVUZ ? (21 - 4 - 2.5) * CM : 638;
/*
  Yazım rayı beklentisi sütundan türer (lib/os/kirilimlar.ts yazimRayiGerekli):
  geniş kenar (236) + panel (340) + sayfa payları (~82, ölçüldü) ile belgenin
  kabı w − 658; sütun + 2 × 24 sığmıyorsa ray. 638 px'te w < 1344, kılavuzun
  548 px'inde w < 1254. Sabit "≤1355" yazmak kılavuz senaryosunda yanlıştı.
*/
const rayGerekir = (w) => w - 658 < SUTUN + 48;
let gecen = 0;
let toplam = 0;
const hatalar = [];
const tarayici = await chromium.launch();

function denetle(kosul, mesaj) {
  toplam++;
  if (kosul) gecen++;
  else hatalar.push(mesaj);
}
const yakin = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

async function ac(w, { kenar = "genis", panel = "acik" } = {}) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: w < 1200, isMobile: w < 761 });
  await ctx.addInitScript(([k, p]) => {
    localStorage.setItem("arvolab.kenar", k);
    localStorage.setItem("arvolab:inceleme-paneli", p === "acik" ? "1" : "0");
  }, [kenar, panel]);
  const sayfa = await ctx.newPage();
  await sayfa.goto(TABAN + EDITOR, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.evaluate(() => document.fonts.ready);
  await sayfa.waitForTimeout(300);
  return { ctx, sayfa };
}

const olc = (sayfa) =>
  sayfa.evaluate(() => {
    const pm = document.querySelector(".ProseMirror");
    const r = pm.getBoundingClientRect();
    const s = getComputedStyle(pm);
    const pl = parseFloat(s.paddingLeft);
    const pr = parseFloat(s.paddingRight);
    // Kâğıt: arka plan katmanının yarı genişliği (--sayfa-yari) kabın yarısıyla sınırlı.
    const yariHam = s.getPropertyValue("--sayfa-yari").trim();
    const olcer = document.createElement("div");
    olcer.style.cssText = `position:absolute;visibility:hidden;width:${yariHam}`;
    pm.appendChild(olcer);
    const yari = olcer.getBoundingClientRect().width;
    olcer.remove();
    const kagit = Math.min(2 * yari, r.width);
    const bloklar = [...pm.querySelectorAll(":scope > *")].slice(0, 12).map((e) => Math.round(e.getBoundingClientRect().height * 2) / 2);
    const nav = document.querySelector(".os-gezinme");
    return {
      kap: r.width, sutun: r.width - pl - pr, pl, pr, kagit,
      kagitPayi: (kagit - (r.width - pl - pr)) / 2,
      font: parseFloat(s.fontSize), satir: parseFloat(s.lineHeight),
      yukseklik: pm.scrollHeight, bloklar,
      nav: nav ? Math.round(nav.getBoundingClientRect().width) : 0,
      yazimRayi: document.documentElement.hasAttribute("data-yazim-ray"),
      kenarTercihi: localStorage.getItem("arvolab.kenar"),
      inceleme: Boolean(document.querySelector(".manuscript-layout[data-inceleme]")),
      tasma: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

/*
  Düğmeye DOM üzerinden basılır: Playwright'ın click'i düğmeyi görünür
  kılmak için sayfayı başa kaydırıyor ve kaydırma denetimi hiçbir şey
  ölçmüyordu. Kullanıcı aynı işi kaydırmadan yapabiliyor (panelin kendi
  "Paneli kapat" düğmesi yapışık panelde, kenar düğmesi yapışık kenar
  çubuğunda).
*/
const bas = (konum) => konum.evaluate((d) => d.click());
const panelDugmesi = (sayfa) => ({ click: () => bas(sayfa.locator(".yazma-panel-dugmesi")) });

// 1 + 3: masaüstü durumları
const MASA = [1920, 1600, 1440, 1366, 1280, 1200];
for (const w of MASA) for (const kenar of ["genis", "dar"]) for (const panel of ["acik", "kapali"]) {
  const { ctx, sayfa } = await ac(w, { kenar, panel });
  const o = await olc(sayfa);
  const ad = `${w} ${kenar} panel-${panel}`;
  denetle(o.inceleme === (panel === "acik"), `${ad}: panel durumu beklenen değil (inceleme=${o.inceleme})`);
  denetle(yakin(o.sutun, SUTUN), `${ad}: metin sütunu ${o.sutun.toFixed(1)} ≠ ${SUTUN.toFixed(1)}`);
  denetle(o.kagit <= 760.5 + (KILAVUZ ? 0 : 0) && o.kagit >= o.sutun, `${ad}: kâğıt ${o.kagit.toFixed(1)} (en çok 760, sütundan küçük olamaz)`);
  denetle(o.kagitPayi >= 23.5, `${ad}: kâğıt iç payı ${o.kagitPayi.toFixed(1)} < 24`);
  denetle(yakin(o.satir, o.font * 1.75, 0.3), `${ad}: satır yüksekliği ${o.satir} ≠ ${o.font} × 1,75`);
  denetle(!o.tasma, `${ad}: yatay taşma`);
  const rayBekleniyor = kenar === "genis" && panel === "acik" && rayGerekir(w);
  denetle(o.yazimRayi === rayBekleniyor, `${ad}: yazım rayı ${o.yazimRayi} (beklenen ${rayBekleniyor})`);
  denetle(o.nav === (kenar === "dar" || rayBekleniyor ? 64 : 236), `${ad}: gezinme ${o.nav} px`);
  denetle(o.kenarTercihi === kenar, `${ad}: kenar tercihi değişti (${o.kenarTercihi})`);
  await ctx.close();
}

// 2: aynı sayfada panel ve kenar değişimi — satırlar ve kaydırma
for (const w of [1440, 1280, 1200]) {
  const { ctx, sayfa } = await ac(w, { kenar: "genis", panel: "acik" });
  await sayfa.evaluate(() => {
    const hedef = document.querySelectorAll(".ProseMirror > p")[30];
    hedef.scrollIntoView({ block: "center" });
  });
  await sayfa.waitForTimeout(200);
  const ust = () => sayfa.evaluate(() => document.querySelectorAll(".ProseMirror > p")[30].getBoundingClientRect().top);
  const once = await olc(sayfa);
  const ustOnce = await ust();
  await panelDugmesi(sayfa).click();
  await sayfa.waitForTimeout(400);
  const kapali = await olc(sayfa);
  const ustKapali = await ust();
  denetle(!kapali.inceleme, `${w}: panel kapanmadı`);
  denetle(JSON.stringify(kapali.bloklar) === JSON.stringify(once.bloklar), `${w}: panel kapanınca bloklar yeniden kırıldı ${JSON.stringify(once.bloklar)} → ${JSON.stringify(kapali.bloklar)}`);
  denetle(kapali.yukseklik === once.yukseklik, `${w}: panel kapanınca belge yüksekliği ${once.yukseklik} → ${kapali.yukseklik}`);
  denetle(Math.abs(ustKapali - ustOnce) <= 1, `${w}: panel kapanınca kaydırma kaydı (${ustOnce.toFixed(0)} → ${ustKapali.toFixed(0)})`);
  // Kenar çubuğu daralt / genişlet (panel kapalıyken düğme görünür)
  await bas(sayfa.locator(".os-gezinme-daralt"));
  await sayfa.waitForTimeout(300);
  const dar = await olc(sayfa);
  denetle(JSON.stringify(dar.bloklar) === JSON.stringify(once.bloklar) && dar.yukseklik === once.yukseklik, `${w}: kenar daralınca belge yeniden kırıldı`);
  await bas(sayfa.locator(".os-gezinme-daralt"));
  await sayfa.waitForTimeout(300);
  await panelDugmesi(sayfa).click();
  await sayfa.waitForTimeout(400);
  const yeniden = await olc(sayfa);
  denetle(yeniden.inceleme && JSON.stringify(yeniden.bloklar) === JSON.stringify(once.bloklar), `${w}: panel yeniden açılınca bloklar değişti`);
  denetle(yeniden.kenarTercihi === "genis", `${w}: kenar tercihi korunmadı (${yeniden.kenarTercihi})`);
  denetle(yeniden.yazimRayi === rayGerekir(w), `${w}: panel yeniden açılınca yazım rayı ${yeniden.yazimRayi}`);
  await ctx.close();
}

// 3 (ek): odak modunda yazım rayı yok
{
  const W = KILAVUZ ? 1200 : 1280; // yazım rayının kurulduğu bir genişlik
  const { ctx, sayfa } = await ac(W, { kenar: "genis", panel: "acik" });
  denetle((await olc(sayfa)).yazimRayi, `${W}: odak öncesi yazım rayı yok`);
  // Odak düğmesi çubukta ya da dar ekranda taşma menüsünde ("⋯").
  let odak = sayfa.locator('[data-arac-grup="odak"]:not([hidden]) button').first();
  if (!(await odak.count())) {
    await sayfa.locator(".manuscript-araclar .arac-menu-dugme[aria-expanded]").last().click();
    odak = sayfa.getByRole("button", { name: /Odak modu/ }).first();
  }
  if (await odak.count()) {
    await odak.click();
    await sayfa.waitForTimeout(400);
    const o = await olc(sayfa);
    denetle(!o.yazimRayi && o.nav === 236, `${W} odak modu: yazım rayı ${o.yazimRayi}, gezinme ${o.nav}`);
    denetle(yakin(o.sutun, SUTUN), `${W} odak modu: sütun ${o.sutun.toFixed(1)}`);
  } else denetle(false, "odak modu düğmesi bulunamadı");
  await ctx.close();
}

// 4: tablet
for (const w of [1024, 900, 768]) {
  const { ctx, sayfa } = await ac(w);
  const kapali = await olc(sayfa);
  await sayfa.locator("button[aria-controls='yazim-yan-panel']:visible").first().click();
  await sayfa.waitForTimeout(500);
  const acik = await olc(sayfa);
  const beklenen = Math.min(SUTUN, kapali.kap - kapali.pl - kapali.pr);
  denetle(yakin(kapali.sutun, beklenen) && kapali.sutun <= SUTUN + 0.5, `${w} tablet: sütun ${kapali.sutun.toFixed(1)}`);
  denetle(JSON.stringify(acik.bloklar) === JSON.stringify(kapali.bloklar) && yakin(acik.sutun, kapali.sutun), `${w} tablet: panel açılınca belge değişti`);
  denetle(!kapali.tasma && !acik.tasma, `${w} tablet: yatay taşma`);
  denetle(!acik.yazimRayi, `${w} tablet: yazım rayı tablette kurulmamalı`);
  await ctx.close();
}

// 5: telefon — C1 öncesiyle aynı sütun
if (!KILAVUZ) {
  for (const [w, eski] of [[390, 317], [360, 290]]) {
    const { ctx, sayfa } = await ac(w, { panel: "kapali" });
    const o = await olc(sayfa);
    denetle(yakin(o.sutun, eski), `${w} telefon: sütun ${o.sutun.toFixed(1)} ≠ ${eski} (C1 öncesi)`);
    denetle(!o.tasma, `${w} telefon: yatay taşma`);
    await ctx.close();
  }
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Belge geometrisi kabulü: ${hatalar.length} denetim düştü (${gecen}/${toplam})` : `Belge geometrisi kabulü temiz (${toplam} denetim${KILAVUZ ? ", kılavuz senaryosu" : ""})`);
process.exit(hatalar.length ? 1 : 0);
