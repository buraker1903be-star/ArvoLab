/*
  MOBİL ODAK MODU KABULÜ (Phase 4.6 D1, 10.11.2026).

  Eskiden telefonda odak modu yalnızca başlık satırını (44 px) gizliyordu:
  üst çubuk, alt gezinme ve kılavuz bandı yerinde kalıyordu ve kaydırınca
  odak açık/kapalı arasında hiçbir fark yoktu (yazım alanı ikisinde de
  ekranın %80'i). Bu betik ≤760 px'te odak açıkken:
    - üst çubuk, alt gezinme ve kılavuz bandı gizli; kılavuz tercihi
      (localStorage) DEĞİŞMEZ;
    - araç çubuğu ekranın üstüne yapışık (kaydırınca da);
    - araç çubuğunda her an görünür, ≥ 44×44, adlı "Odaktan çık" düğmesi;
    - bul şeridi çubuğun hemen altında (üst üste binmez);
    - yatay taşma yok; belge sütunu ve satır kırılımı odakla değişmez;
    - belgenin son satırı sabit bir öğenin altında kalmaz;
    - çıkınca üst çubuk, alt gezinme ve bant geri gelir;
    - odak kalıcı değil (yeniden yüklemede kapalı);
    - döndürme / geniş ekrana geçiş: >760'ta mobil kurallar bırakılır,
      çıkış yolu kalır; geri dönünce odak hâlâ açık ve kurallar geri gelir.
  768 ve 1024'te (tablet) davranış DEĞİŞMEZ: üst çubuk görünür kalır, Esc çıkar.
  Önizleme: npm run onizleme
    NODE_PATH=$(npm root -g) node scripts/onizleme/mobil-odak-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let toplam = 0;
const hatalar = [];
const denetle = (kosul, mesaj) => {
  toplam++;
  if (!kosul) hatalar.push(mesaj);
};
const tarayici = await chromium.launch();

async function ac(w, tema) {
  const h = w < 761 ? 844 : 900;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1200, isMobile: w < 761 });
  await ctx.addInitScript((t) => { localStorage.setItem("arvolab.theme", t); localStorage.setItem("arvolab:inceleme-paneli", "0"); }, tema);
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.locator(".ProseMirror").waitFor();
  await sayfa.evaluate(() => document.fonts.ready);
  await sayfa.waitForTimeout(400);
  return { ctx, sayfa };
}

/* Sayfanın kabuk ve belge ölçüleri. */
const olc = (sayfa) => sayfa.evaluate(() => {
  const gorunur = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight && !(s.transform && s.transform !== "none" && r.top >= innerHeight - 1);
  };
  const ust = document.querySelector(".dashboard-header");
  const nav = document.querySelector("nav.os-gezinme");
  const navR = nav?.getBoundingClientRect();
  const arac = document.querySelector(".manuscript-araclar").getBoundingClientRect();
  const pm = document.querySelector(".ProseMirror"); const ps = getComputedStyle(pm);
  const paragraf = [...pm.querySelectorAll("p")].find((p) => p.textContent.trim().length > 120);
  const satir = paragraf ? (() => { const rng = document.createRange(); rng.selectNodeContents(paragraf); return new Set([...rng.getClientRects()].map((r) => Math.round(r.top))).size; })() : 0;
  return {
    ustGorunur: gorunur(ust), navGorunur: Boolean(nav) && gorunur(nav) && navR.top < innerHeight - 1,
    bantGorunur: gorunur(document.querySelector(".kilavuz-bandi")),
    aracUst: arac.top, aracAlt: arac.bottom,
    sutun: pm.getBoundingClientRect().width - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight),
    paragrafSatir: satir, paragrafMetin: paragraf?.textContent.slice(0, 40) ?? "",
    tasma: document.documentElement.scrollWidth > innerWidth + 1,
    yukseklik: innerHeight, odak: Boolean(document.querySelector(".manuscript-layout[data-odak]")),
  };
});

/* Odak modunu kullanıcının yolundan açar: çubukta görünüyorsa oradan, değilse "⋯" menüsünden. */
async function odakAc(sayfa) {
  const cubukta = sayfa.locator(".manuscript-araclar [data-arac-grup=odak]:not([hidden]) button");
  if (await cubukta.count()) { await cubukta.first().click(); }
  else {
    await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Bul, sayfa ayarı|^Find, page setup/ }).first().click();
    await sayfa.getByRole("button", { name: /^Odak modu|^Focus mode/ }).first().click();
  }
  await sayfa.waitForTimeout(250);
}
/* Geniş ekranın (>760) mevcut çıkış yolu: çubuktaki odak düğmesi ya da "⋯" menüsündeki. Var mı, varsa basar. */
async function genisCikis(sayfa, bas) {
  const cubukta = sayfa.locator(".manuscript-araclar [data-arac-grup=odak]:not([hidden]) button");
  if (await cubukta.count()) { if (bas) await cubukta.first().click(); return /çık|exit/i.test((await cubukta.first().getAttribute("aria-label")) ?? ""); }
  await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Bul, sayfa ayarı|^Find, page setup/ }).first().click();
  const menude = sayfa.getByRole("button", { name: /^Odak modundan çık|^Exit focus mode/ }).first();
  const var_ = await menude.isVisible().catch(() => false);
  if (var_ && bas) await menude.click(); else await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(200);
  return var_;
}
const cikisDugmesi = (sayfa) => sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Odaktan çık|^Exit focus/ });

for (const w of [360, 390, 768, 1024]) for (const tema of ["light", "dark"]) {
  const ad = `${w} ${tema}`;
  const { ctx, sayfa } = await ac(w, tema);
  const yerelOnce = await sayfa.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const kapali = await olc(sayfa);
  await sayfa.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" })); await sayfa.waitForTimeout(200);
  const kapaliKay = await olc(sayfa);
  await sayfa.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await odakAc(sayfa);
  const acik = await olc(sayfa);
  denetle(acik.odak, `${ad}: odak modu açılamadı`);
  denetle(!acik.tasma, `${ad}: odak açıkken yatay taşma`);
  denetle(Math.abs(acik.sutun - kapali.sutun) < 0.6, `${ad}: belge sütunu değişti (${kapali.sutun.toFixed(1)} → ${acik.sutun.toFixed(1)})`);
  denetle(acik.paragrafSatir === kapali.paragrafSatir, `${ad}: satır kırılımı değişti (${kapali.paragrafSatir} → ${acik.paragrafSatir} satır)`);
  if (w <= 760) {
    denetle(kapali.ustGorunur && kapali.navGorunur, `${ad}: odak kapalıyken üst çubuk/alt gezinme görünmüyor (normal mod değişmiş)`);
    denetle(!acik.ustGorunur, `${ad}: odak açıkken üst çubuk görünür`);
    denetle(!acik.navGorunur, `${ad}: odak açıkken alt gezinme görünür`);
    denetle(!acik.bantGorunur, `${ad}: odak açıkken kılavuz bandı görünür`);
    denetle(acik.aracUst <= 1, `${ad}: araç çubuğu üstte değil (y=${acik.aracUst.toFixed(1)})`);
    // Çıkış düğmesi: görünür, ≥ 44×44, ekranın içinde.
    const cik = cikisDugmesi(sayfa);
    const kutu = (await cik.count()) ? await cik.first().boundingBox() : null;
    denetle(kutu && (await cik.first().isVisible()), `${ad}: "Odaktan çık" düğmesi araç çubuğunda görünmüyor`);
    if (kutu) {
      denetle(kutu.width >= 43.5 && kutu.height >= 43.5, `${ad}: "Odaktan çık" ${Math.round(kutu.width)}×${Math.round(kutu.height)} (≥ 44)`);
      denetle(kutu.x >= 0 && kutu.x + kutu.width <= w + 0.5, `${ad}: "Odaktan çık" ekranın dışında (x=${kutu.x.toFixed(0)})`);
    }
    // Kaydırınca: çubuk üstte, çıkış hâlâ görünür; yazım alanı.
    await sayfa.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" })); await sayfa.waitForTimeout(200);
    const acikKay = await olc(sayfa);
    denetle(acikKay.aracUst <= 1, `${ad}: kaydırınca araç çubuğu üstte değil (y=${acikKay.aracUst.toFixed(1)})`);
    denetle(await cik.first().isVisible().catch(() => false), `${ad}: kaydırınca "Odaktan çık" görünmüyor`);
    const alanOnce = (kapaliKay.navGorunur ? 844 - 64 : 844) - kapaliKay.aracAlt;
    const alanSonra = acikKay.yukseklik - acikKay.aracAlt;
    denetle(alanSonra >= acikKay.yukseklik - 50, `${ad}: yazım alanı ${Math.round(alanSonra)} px (odak kapalı ${Math.round(alanOnce)})`);
    console.log(`  ${ad}: yazım alanı (kaydırınca) kapalı ${Math.round(alanOnce)} px → açık ${Math.round(alanSonra)} px`);
    // Bul şeridi çubuğun hemen altında.
    await sayfa.locator(".ProseMirror p").nth(3).click();
    await sayfa.keyboard.press("Control+f");
    const serit = sayfa.locator(".manuscript-ust");
    if (await serit.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
      await sayfa.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" })); await sayfa.waitForTimeout(250);
      const r = await sayfa.evaluate(() => ({ bar: document.querySelector(".manuscript-araclar").getBoundingClientRect().bottom, ust: document.querySelector(".manuscript-ust").getBoundingClientRect().top }));
      denetle(Math.abs(r.ust - r.bar) <= 1, `${ad}: bul şeridi çubuğa yapışmıyor (çubuk altı ${r.bar.toFixed(1)}, şerit üstü ${r.ust.toFixed(1)})`);
      await sayfa.keyboard.press("Escape").catch(() => {});
      await sayfa.waitForTimeout(150);
      // Esc şeridi kapatır; odak hâlâ açık mı? Değilse yeniden aç (yalnızca ölçüm için).
      if (!(await olc(sayfa)).odak) await odakAc(sayfa);
    } else denetle(false, `${ad}: bul şeridi açılmadı`);
    // Belgenin son satırı: sona kaydırınca sabit bir öğenin altında kalmamalı.
    // Belge kaydırdıkça uzuyor (geç çizim): konum durana kadar sona in.
    for (let i = 0, onceki = -1; i < 12; i++) {
      const y = await sayfa.evaluate(() => { window.scrollTo({ top: 1e7, behavior: "instant" }); return scrollY; });
      await sayfa.waitForTimeout(250);
      if (Math.abs(y - onceki) < 1) break;
      onceki = y;
    }
    const son = await sayfa.evaluate(() => {
      const bloklar = [...document.querySelectorAll(".ProseMirror > *")].filter((b) => b.textContent.trim());
      const b = bloklar.at(-1); const r = b.getBoundingClientRect();
      const x = Math.min(r.left + 20, innerWidth - 2), y = r.bottom - 4;
      const ust = document.elementFromPoint(x, y);
      return { alt: r.bottom, h: innerHeight, icinde: Boolean(ust && b.contains(ust)) || ust === b };
    });
    denetle(son.alt <= son.h && son.icinde, `${ad}: son satır görünmüyor ya da bir öğenin altında (alt=${son.alt.toFixed(0)}, ekran=${son.h})`);
    // Çıkış (düğme yoksa — kırmızı koşu — Esc ile, ölçüm sürsün diye).
    if (await cik.first().isVisible().catch(() => false)) await cik.first().click();
    else { await sayfa.locator(".ProseMirror p").nth(3).click().catch(() => {}); await sayfa.keyboard.press("Escape"); }
    await sayfa.waitForTimeout(250);
    // Editörden odağı al: klavye açıkken alt gezinmenin aşağı çekilmesi (os-shell.css) olağan davranış, odakla ilgisi yok.
    await sayfa.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: "instant" }); }); await sayfa.waitForTimeout(200);
    const cikti = await olc(sayfa);
    denetle(!cikti.odak, `${ad}: "Odaktan çık" odaktan çıkarmadı`);
    denetle(cikti.ustGorunur && cikti.navGorunur, `${ad}: çıkınca üst çubuk/alt gezinme geri gelmedi`);
    denetle(cikti.bantGorunur === kapali.bantGorunur, `${ad}: çıkınca kılavuz bandı geri gelmedi`);
    denetle(Math.abs(cikti.aracUst - kapali.aracUst) <= 1, `${ad}: çıkınca araç çubuğu yerine dönmedi (${kapali.aracUst.toFixed(0)} → ${cikti.aracUst.toFixed(0)})`);
    const yerelSonra = await sayfa.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => !k.startsWith("arvolab:taslak")).sort()));
    denetle(yerelSonra === JSON.stringify(JSON.parse(yerelOnce).filter(([k]) => !k.startsWith("arvolab:taslak"))), `${ad}: odak localStorage'ı değiştirdi (kılavuz tercihi ya da odak kalıcı yazıldı)`);
  } else {
    // Tablet: davranış değişmez — üst çubuk görünür kalır, telefona özgü çıkış düğmesi çıkmaz, mevcut düğme çıkarır.
    // (Esc ile çıkış bu dalda önceden de çalışmıyordu: kapalı çekmeceler role="dialog" taşıyor; D1 kapsamı dışında, raporda.)
    denetle(acik.ustGorunur, `${ad}: tablette odak üst çubuğu gizledi (davranış değişmemeli)`);
    denetle(acik.bantGorunur === kapali.bantGorunur, `${ad}: tablette odak kılavuz bandını değiştirdi`);
    denetle(acik.aracUst >= 56, `${ad}: tablette araç çubuğu ekranın en üstüne taşındı (y=${acik.aracUst.toFixed(0)})`);
    denetle(!(await cikisDugmesi(sayfa).first().isVisible().catch(() => false)), `${ad}: telefona özgü "Odaktan çık" tablette görünüyor`);
    denetle(await genisCikis(sayfa, true), `${ad}: tablette odaktan çıkış düğmesi yok`);
    denetle(!(await olc(sayfa)).odak, `${ad}: tablette odak düğmesi odaktan çıkarmadı`);
  }
  await ctx.close();
}

/* Döndürme ve geniş ekrana geçiş: odak açıkken. */
for (const [hedefW, hedefH, ad] of [[844, 390, "yatay telefon"], [1024, 900, "geniş ekran"]]) {
  const { ctx, sayfa } = await ac(390, "light");
  await odakAc(sayfa);
  await sayfa.setViewportSize({ width: hedefW, height: hedefH }); await sayfa.waitForTimeout(400);
  const genis = await olc(sayfa);
  denetle(genis.odak, `390 → ${ad}: odak kendiliğinden kapandı`);
  denetle(genis.ustGorunur, `390 → ${ad}: >760'ta üst çubuk gizli kaldı (mobil kural sızdı)`);
  denetle(!genis.tasma, `390 → ${ad}: yatay taşma`);
  // Çıkış yolu: geniş ekranın mevcut odak düğmesi (çubukta ya da "⋯" menüsünde); üst çubuk da görünür.
  denetle(await genisCikis(sayfa, false), `390 → ${ad}: odaktan çıkış yolu yok`);
  await sayfa.setViewportSize({ width: 390, height: 844 }); await sayfa.waitForTimeout(400);
  const geri = await olc(sayfa);
  denetle(geri.odak && !geri.ustGorunur && !geri.navGorunur && geri.aracUst <= 1, `${ad} → 390: odak kuralları geri gelmedi (odak=${geri.odak}, üst=${geri.ustGorunur}, alt=${geri.navGorunur}, çubuk y=${geri.aracUst.toFixed(0)})`);
  denetle(await cikisDugmesi(sayfa).first().isVisible().catch(() => false), `${ad} → 390: "Odaktan çık" görünmüyor`);
  await ctx.close();
}

/* Kalıcı değil: odak açıkken yeniden yükleme → kapalı, gezinme görünür. */
{
  const { ctx, sayfa } = await ac(390, "light");
  await odakAc(sayfa);
  await sayfa.reload({ waitUntil: "networkidle" }); await sayfa.locator(".ProseMirror").waitFor(); await sayfa.waitForTimeout(400);
  const o = await olc(sayfa);
  denetle(!o.odak && o.ustGorunur && o.navGorunur, `390: yeniden yüklemede odak kalıcı kaldı (odak=${o.odak})`);
  await ctx.close();
}

/* Odak açıkken yazım: metin girer, Ctrl+Z geri alır (editör davranışı değişmez). */
{
  const { ctx, sayfa } = await ac(390, "light");
  await odakAc(sayfa);
  const p = sayfa.locator(".ProseMirror p").nth(4);
  await p.click();
  await sayfa.keyboard.press("End");
  const once = await p.innerText();
  await sayfa.keyboard.type(" odakdeneme");
  denetle((await p.innerText()).includes("odakdeneme"), "390 odak: yazılan metin belgeye girmedi");
  const r = await sayfa.evaluate(() => { const s = getSelection(); const k = s.rangeCount ? s.getRangeAt(0).getBoundingClientRect() : null; const bar = document.querySelector(".manuscript-araclar").getBoundingClientRect(); return k ? { y: k.top, alt: k.bottom, bar: bar.bottom, h: innerHeight } : null; });
  denetle(r && r.y >= r.bar - 1 && r.alt <= r.h, `390 odak: imleç satırı görünür alanda değil (${JSON.stringify(r)})`);
  await sayfa.keyboard.press("Control+z");
  await sayfa.waitForTimeout(150);
  denetle((await p.innerText()) === once, "390 odak: Ctrl+Z yazılanı geri almadı");
  await ctx.close();
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Mobil odak kabulü: ${hatalar.length} denetim düştü (${toplam - hatalar.length}/${toplam})` : `Mobil odak kabulü temiz (${toplam} denetim)`);
process.exit(hatalar.length ? 1 : 0);
