/*
  KILAVUZ BİLDİRİMLERİ KABULÜ (Phase 4.5 V2, 09.11.2026).

  A) "Kılavuz bağlı değil" bandı (kılavuzsuz tez; varsayılan kip):
     - görünür; role="note", canlı bölge DEĞİL (her açılışta anons edilmez);
     - masaüstünde (≥1200) 36 px; tablet ≤ 44 px;
     - telefonda (390, 360) metin kesilmez; düğmeler en az 44×44 ve adlı;
     - açık ve koyu tema.
  B) "Kılavuz kuralları uygulandı" bildirimi (--kilavuz; sunucu
     ONIZLEME_SENARYO=kilavuz-eski):
     - kompakt özet: masaüstünde tek satır (≤ 52 px), telefonda ≤ 120 px;
       eskiden 157–184 px ve ayrıntı listesi sürekli açıktı;
     - ekran okuyucuya KISA durum (ayrı role="status", ≤ 140 karakter);
       ayrıntı listesi canlı bölgede değil;
     - "Değişiklikleri gör" listeyi açar (aria-expanded), bütün değişiklikler
       listede; "Kapat" bildirimi gizler;
     - kapatma aynı kılavuz sürümünde korunur (yeniden yüklemede gizli);
       başka bir sürümün kapatılmış olması bu sürümü gizlemez;
     - kılavuz ayarlarının uygulanması değişmez (kenar boşlukları uygulandı:
       metin sütunu 14,5 cm, belge-geometri-kabul --kilavuz ayrıca ölçer).
  Önizleme: npm run onizleme  (B için ONIZLEME_SENARYO=kilavuz-eski npm run onizleme)
    NODE_PATH=$(npm root -g) node scripts/onizleme/kilavuz-bildirim-kabul.mjs [taban] [--kilavuz]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const arg = process.argv.slice(2);
const KILAVUZ = arg.includes("--kilavuz");
const TABAN = arg.find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("kilavuz-bildirim-kabul", TABAN, KILAVUZ ? "kilavuz" : "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let toplam = 0;
const hatalar = [];
const tarayici = await chromium.launch();
const denetle = (kosul, mesaj) => {
  toplam++;
  if (!kosul) hatalar.push(mesaj);
};

async function ac(w, tema = "light", hazirla) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: w < 1200, isMobile: w < 761 });
  await ctx.addInitScript((t) => localStorage.setItem("arvolab.theme", t), tema);
  if (hazirla) await ctx.addInitScript(hazirla);
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.locator(".ProseMirror").waitFor();
  await sayfa.waitForTimeout(400);
  return { ctx, sayfa };
}

if (!KILAVUZ) {
  for (const w of [1440, 1366, 1200, 1024, 768, 390, 360]) for (const tema of ["light", "dark"]) {
    const { ctx, sayfa } = await ac(w, tema);
    const ad = `${w} ${tema}`;
    const o = await sayfa.evaluate(() => {
      const b = document.querySelector(".kilavuz-bandi");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const metin = b.querySelector(".kilavuz-bandi-metin");
      const gorunur = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
      const metinler = [...b.querySelectorAll(".kilavuz-bandi-metin > span")].filter(gorunur);
      const dugmeler = [...b.querySelectorAll("button")].filter(gorunur).map((d) => {
        const k = d.getBoundingClientRect();
        return { ad: (d.getAttribute("aria-label") || d.textContent || "").trim(), w: k.width, h: k.height };
      });
      return {
        h: r.height, rol: b.getAttribute("role"), canli: b.getAttribute("aria-live"),
        kesik: metin ? metin.scrollWidth > metin.clientWidth + 1 : true,
        metin: metinler.map((m) => m.textContent.trim()).join(" "),
        dugmeler, tasma: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    denetle(o, `${ad}: kılavuz bandı yok (görünür kalmalı)`);
    if (o) {
      denetle(o.rol === "note" && !o.canli, `${ad}: bant role="${o.rol}" aria-live="${o.canli}" (beklenen note, canlı değil)`);
      if (w >= 1200) denetle(Math.abs(o.h - 36) < 0.6, `${ad}: bant ${o.h} px (masaüstü hedef 36)`);
      else if (w > 760) denetle(o.h <= 44.5, `${ad}: bant ${o.h} px (tablet ≤ 44)`);
      denetle(!o.kesik && o.metin.length > 0, `${ad}: bant metni kesik ya da boş ("${o.metin}")`);
      for (const d of o.dugmeler) {
        denetle(d.ad.length > 0, `${ad}: adsız düğme`);
        if (w <= 760) denetle(d.w >= 43.5 && d.h >= 43.5, `${ad}: "${d.ad.slice(0, 30)}" ${Math.round(d.w)}×${Math.round(d.h)} (telefon ≥ 44)`);
      }
      denetle(!o.tasma, `${ad}: yatay taşma`);
    }
    await ctx.close();
  }
} else {
  const ANAHTAR_ONEK = "arvolab:kilavuz-uygulandi-kapali:";
  for (const w of [1440, 1024, 390, 360]) for (const tema of ["light", "dark"]) {
    const { ctx, sayfa } = await ac(w, tema);
    const ad = `${w} ${tema} kılavuz`;
    const bildirim = sayfa.locator(".kilavuz-uygulandi");
    denetle(await bildirim.count(), `${ad}: kompakt "kurallar uygulandı" bildirimi yok`);
    if (await bildirim.count()) {
      const o = await sayfa.evaluate(() => {
        const b = document.querySelector(".kilavuz-uygulandi");
        const r = b.getBoundingClientRect();
        const durum = document.querySelector(".kilavuz-uygulandi-durum");
        return {
          h: r.height, rol: b.getAttribute("role"), canli: b.getAttribute("aria-live"),
          durumRol: durum?.getAttribute("role"), durumMetin: (durum?.textContent ?? "").trim(),
          listeCanliMi: Boolean(b.querySelector("ul")?.closest("[role=status],[aria-live]")),
          tasma: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      denetle(w > 760 ? o.h <= 52.5 : o.h <= 120.5, `${ad}: bildirim ${o.h} px (masaüstü ≤ 52, telefon ≤ 120)`);
      denetle(o.rol !== "status" && !o.canli, `${ad}: bildirimin tamamı canlı bölge (role=${o.rol})`);
      denetle(o.durumRol === "status" && o.durumMetin.length > 0 && o.durumMetin.length <= 140 && /uygulandı|applied/i.test(o.durumMetin), `${ad}: kısa durum bildirimi yok ya da uzun ("${o.durumMetin.slice(0, 160)}")`);
      denetle(!o.listeCanliMi, `${ad}: ayrıntı listesi canlı bölgede`);
      denetle(!o.tasma, `${ad}: yatay taşma`);
      const goster = bildirim.getByRole("button", { name: /Değişiklikleri gör|View changes/ });
      denetle(await goster.count(), `${ad}: "Değişiklikleri gör" yok`);
      if (await goster.count()) {
        denetle((await goster.getAttribute("aria-expanded")) === "false", `${ad}: liste başlangıçta açık`);
        await goster.click();
        await sayfa.waitForTimeout(150);
        denetle((await goster.getAttribute("aria-expanded")) === "true", `${ad}: "Değişiklikleri gör" listeyi açmadı`);
        const liste = await bildirim.locator("li").allInnerTexts();
        denetle(liste.length === 2 && liste.some((l) => /Üst kenar|Top margin/i.test(l)) && liste.some((l) => /Sol kenar|Left margin/i.test(l)), `${ad}: değişiklik listesi eksik (${JSON.stringify(liste)})`);
        if (w <= 760) {
          for (const d of await bildirim.locator("button").all()) {
            const k = await d.boundingBox();
            if (k) denetle(k.width >= 43.5 && k.height >= 43.5, `${ad}: düğme ${Math.round(k.width)}×${Math.round(k.height)} (telefon ≥ 44)`);
          }
        }
      }
      if (w === 1440 && tema === "light") {
        const kapat = bildirim.getByRole("button", { name: /Kapat|Close/ });
        denetle(await kapat.count(), `${ad}: "Kapat" yok`);
        if (await kapat.count()) {
          await kapat.click();
          await sayfa.waitForTimeout(200);
          denetle(!(await sayfa.locator(".kilavuz-uygulandi").count()), `${ad}: Kapat bildirimi gizlemedi`);
          const anahtarlar = await sayfa.evaluate((onek) => Object.keys(localStorage).filter((k) => k.startsWith(onek)), ANAHTAR_ONEK);
          denetle(anahtarlar.length === 1, `${ad}: kapatma tercihi yazılmadı (${JSON.stringify(anahtarlar)})`);
          await sayfa.reload({ waitUntil: "networkidle" });
          await sayfa.locator(".ProseMirror").waitFor();
          await sayfa.waitForTimeout(400);
          denetle(!(await sayfa.locator(".kilavuz-uygulandi").count()), `${ad}: aynı sürümde yeniden yüklemede bildirim geri geldi`);
          // Kılavuz uygulanması değişmedi: sütun 14,5 cm (A4, sol 4 / sağ 2,5).
          const sutun = await sayfa.evaluate(() => { const pm = document.querySelector(".ProseMirror"); const s = getComputedStyle(pm); return pm.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); });
          denetle(Math.abs(sutun - 14.5 * 96 / 2.54) < 0.6, `${ad}: kılavuz uygulanmamış (sütun ${sutun.toFixed(1)})`);
        }
        await ctx.close();
        // Başka bir sürümün kapatılmış olması bu sürümü gizlemez (yeni sürüm uygulanınca bildirim yeniden görünür).
        const { ctx: c2, sayfa: s2 } = await ac(1440, "light", () => {
          for (const k of Object.keys(localStorage)) if (k.startsWith("arvolab:kilavuz-uygulandi-kapali:")) localStorage.removeItem(k);
          localStorage.setItem("arvolab:kilavuz-uygulandi-kapali:00000000-0000-4000-8000-0000000000b1:eski-surum", "1");
        });
        denetle(await s2.locator(".kilavuz-uygulandi").count(), "1440: başka sürümün kapatılması bu sürümü gizledi");
        await c2.close();
        continue;
      }
    }
    await ctx.close();
  }
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Kılavuz bildirimi kabulü: ${hatalar.length} denetim düştü (${toplam - hatalar.length}/${toplam})` : `Kılavuz bildirimi kabulü temiz (${toplam} denetim${KILAVUZ ? ", kılavuz senaryosu" : ""})`);
process.exit(hatalar.length ? 1 : 0);
