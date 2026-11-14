/*
  PHASE 5.1d-1 TARAYICI KABULÜ: kısa ekranda gezinme, hesap menüsü ve
  "Daha fazla".

  Denetimde (14.11.2026) ölçüldü: iç ekipte hesap menüsü 583 px'ti ve
  yükseklik sınırı yoktu. Kenar çubuğunda (yukarı açılır) 1366×600'de
  üstü 51 px, 1366×500'de 151 px ekranın dışındaydı; üst çubukta (aşağı
  açılır) "Çıkış yap" ekranın altında kalıyordu. "Daha fazla"nın son öğesi
  500 px yükseklikte görünmüyor, liste kaymıyordu.

  Her ekran boyu ve hâl için: gezinme hedeflerine Tab ile ulaşılır ve
  odaklanan her hedef görünür; hesap menüsü ve "Daha fazla" ekranın
  içinde kalır, doğru yöne açılır, taşan içerik kendi içinde kayar
  (tekerlekle ve odakla), Shift+Tab geri gider, Escape kapatır ve odak
  tetikleyiciye döner.

  Rol sunucunun ONIZLEME_ROL'üyle belirlenir (scripts/onizleme/veri.ts);
  betik yalnızca rapora yazar. Öğrenci ve personel ayrı koşulur:
    ARVOLAB_ONIZLEME=1 next dev -p 3123                       → öğrenci
    ARVOLAB_ONIZLEME=1 ONIZLEME_ROL=employee next dev -p 3123 → personel
  CI'da DEĞİL: önizleme sunucusu ve Chromium ister. Kullanım:
    node scripts/onizleme/kisa-ekran-kabul.mjs [taban-adres] [rol-etiketi]
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const ROL = process.argv[3] ?? "?";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const sonuclar = [];

async function senaryo(ad, govde) {
  try {
    const not = await govde();
    sonuclar.push({ ad, tamam: true, not });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n")[0].slice(0, 700) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const tarayici = await chromium.launch();

async function sayfaAc({ w, h, dar, tema = "light", yol = "/dashboard" }) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, colorScheme: tema });
  await ctx.addInitScript((dar) => {
    try {
      if (!sessionStorage.getItem("kabul-kuruldu")) {
        sessionStorage.setItem("kabul-kuruldu", "1");
        if (dar) localStorage.setItem("arvolab.gezinme.dar", "1"); else localStorage.removeItem("arvolab.gezinme.dar");
      }
    } catch {}
  }, dar);
  /* Geliştirme sunucusunun "N" göstergesi sol altta tıklamayı yutuyor; üretimde yok. */
  await ctx.addInitScript(() => {
    const gizle = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) gizle(); else document.addEventListener("DOMContentLoaded", gizle);
  });
  const sayfa = await ctx.newPage();
  const hatalar = [];
  sayfa.on("pageerror", (e) => hatalar.push(String(e).slice(0, 160)));
  sayfa.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) hatalar.push(m.text().slice(0, 160)); });
  await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
  return { ctx, sayfa, hatalar };
}

/** Odaktaki öğe ekranın ve (varsa) kaydırma kabının görünür alanının içinde mi? */
const odakGorunur = (sayfa) =>
  sayfa.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return { ad: "body", gorunur: false };
    const b = e.getBoundingClientRect();
    let gorunur = b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1 && b.height > 0;
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll" || o === "hidden") {
        const k = p.getBoundingClientRect();
        if (b.top < k.top - 1 || b.bottom > k.bottom + 1) gorunur = false;
      }
    }
    const odakHalkasi = getComputedStyle(e).outlineStyle !== "none" || getComputedStyle(e).boxShadow !== "none";
    return { ad: (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 32), gorunur, odakHalkasi };
  });

const DURUMLAR = [
  { ad: "1366×600 açık", w: 1366, h: 600, dar: false },
  { ad: "1366×600 dar", w: 1366, h: 600, dar: true },
  { ad: "1366×500 açık", w: 1366, h: 500, dar: false },
  { ad: "1366×500 dar", w: 1366, h: 500, dar: true },
  { ad: "1366×500 açık · yazım", w: 1366, h: 500, dar: false, yol: `/dashboard/editor/${TEZ}/write` },
  { ad: "1024×500 tablet", w: 1024, h: 500, dar: false },
  { ad: "1024×500 tablet · yazım", w: 1024, h: 500, dar: false, yol: `/dashboard/editor/${TEZ}/write` },
  { ad: "390×500 telefon", w: 390, h: 500, dar: false },
];

for (const d of DURUMLAR) {
  await senaryo(`[${ROL}] ${d.ad}: gezinme hedeflerine Tab ile ulaşılır, odaklanan her hedef görünür`, async () => {
    const { ctx, sayfa, hatalar } = await sayfaAc(d);
    /*
      Kapalı <details>'in içindeki hesap menüsü bağlantıları Chromium'da
      getClientRects ile "var" görünüyor ama Tab sırasına girmiyor; onlar
      ayrıca, menü senaryosunda sınanıyor.
    */
    const hedefSayisi = await sayfa.evaluate(() =>
      [...document.querySelectorAll("#os-ana-gezinme a, #os-ana-gezinme button, #os-ana-gezinme summary")].filter(
        (e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("details:not([open]) > :not(summary)"),
      ).length,
    );
    await sayfa.locator("#os-ana-gezinme").locator("a, button").filter({ visible: true }).first().focus();
    const gorulen = new Set();
    const gorunmeyen = [];
    for (let i = 0; i < 60; i++) {
      const icinde = await sayfa.evaluate(() => Boolean(document.activeElement?.closest("#os-ana-gezinme")));
      if (!icinde) break;
      const o = await odakGorunur(sayfa);
      gorulen.add(o.ad);
      if (!o.gorunur) gorunmeyen.push(o.ad);
      await sayfa.keyboard.press("Tab");
    }
    bekle(!gorunmeyen.length, `odakta görünmeyen: ${gorunmeyen.join(", ")}`);
    bekle(gorulen.size >= hedefSayisi, `Tab ${gorulen.size}/${hedefSayisi} hedefe ulaştı`);
    bekle(!hatalar.length, `sayfa hatası: ${hatalar.join(" | ")}`);
    await ctx.close();
    return `${gorulen.size}/${hedefSayisi} hedef`;
  });

  await senaryo(`[${ROL}] ${d.ad}: hesap menüsü ekranda, doğru yöne açılır, kayar; Tab/Shift+Tab/Escape`, async () => {
    const { ctx, sayfa } = await sayfaAc(d);
    const ozet = sayfa.locator("details.os-kullanici > summary").filter({ visible: true }).first();
    await ozet.focus();
    await sayfa.keyboard.press("Enter");
    const m = await sayfa.evaluate(() => {
      const d = document.querySelector("details.os-kullanici[open]");
      const menu = d?.querySelector(".os-kullanici-menu");
      if (!menu) return null;
      const b = menu.getBoundingClientRect();
      const s = d.querySelector("summary").getBoundingClientRect();
      return {
        kenar: d.classList.contains("os-kullanici--kenar"),
        ust: b.top, alt: b.bottom, sol: b.left, sag: b.right, vh: innerHeight, vw: innerWidth,
        ozetUst: s.top, ozetAlt: s.bottom, kayar: menu.scrollHeight > menu.clientHeight + 1, tasma: getComputedStyle(menu).overflowY,
        yukseklik: Math.round(b.height), icerik: menu.scrollHeight,
      };
    });
    bekle(m, "menü açılmadı");
    bekle(m.ust >= 0 && m.alt <= m.vh && m.sol >= 0 && m.sag <= m.vw, `menü ekran dışında: ${JSON.stringify(m)}`);
    bekle(m.kenar ? m.alt <= m.ozetUst : m.ust >= m.ozetAlt, `yön yanlış (kenar: yukarı, üst: aşağı): ${JSON.stringify(m)}`);
    if (m.kayar) {
      bekle(m.tasma === "auto", `taşan menü kaymıyor (${m.tasma})`);
      const menu = sayfa.locator("details.os-kullanici[open] .os-kullanici-menu");
      const kutu = await menu.boundingBox();
      await sayfa.mouse.move(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
      await sayfa.mouse.wheel(0, 400);
      await sayfa.waitForTimeout(150);
      bekle((await menu.evaluate((e) => e.scrollTop)) > 0, "tekerlek menüyü kaydırmadı");
      await menu.evaluate((e) => { e.scrollTop = 0; });
    }
    // Tab ile menünün sonuna kadar; odaklanan her öğe görünür.
    const gorunmeyen = [];
    const ileri = [];
    for (let i = 0; i < 40; i++) {
      await sayfa.keyboard.press("Tab");
      const icinde = await sayfa.evaluate(() => Boolean(document.activeElement?.closest("details.os-kullanici[open] .os-kullanici-menu")));
      if (!icinde) break;
      const o = await odakGorunur(sayfa);
      ileri.push(o.ad);
      if (!o.gorunur) gorunmeyen.push(o.ad);
    }
    bekle(ileri.some((x) => /Çıkış|Sign out/.test(x)), `Çıkış'a Tab ile ulaşılamadı: ${ileri.join(", ")}`);
    bekle(!gorunmeyen.length, `Tab'da görünmeyen: ${gorunmeyen.join(", ")}`);
    // Son öğeye dönüp Shift+Tab ile başa: yine görünür.
    await sayfa.locator("details.os-kullanici[open] .os-kullanici-cikis button").focus();
    const geri = [];
    for (let i = 0; i < 40; i++) {
      const icinde = await sayfa.evaluate(() => Boolean(document.activeElement?.closest("details.os-kullanici[open] .os-kullanici-menu")));
      if (!icinde) break;
      const o = await odakGorunur(sayfa);
      if (!o.gorunur) geri.push(o.ad);
      await sayfa.keyboard.press("Shift+Tab");
    }
    bekle(!geri.length, `Shift+Tab'da görünmeyen: ${geri.join(", ")}`);
    // Escape: kapanır, odak tetikleyicide.
    await sayfa.locator("details.os-kullanici[open] .os-kullanici-cikis button").focus();
    await sayfa.keyboard.press("Escape");
    const kapandi = await sayfa.evaluate(() => ({ acik: Boolean(document.querySelector("details.os-kullanici[open]")), odak: document.activeElement?.tagName }));
    bekle(!kapandi.acik && kapandi.odak === "SUMMARY", `Escape: ${JSON.stringify(kapandi)}`);
    await ctx.close();
    return `${m.kenar ? "kenar↑" : "üst↓"} ${m.yukseklik}/${m.icerik}px${m.kayar ? " kayar" : ""}, ${ileri.length} odak`;
  });

  await senaryo(`[${ROL}] ${d.ad}: "Daha fazla" ekranda, liste kayar; son öğe; Escape odağı geri verir`, async () => {
    const { ctx, sayfa } = await sayfaAc(d);
    const dugme = sayfa.locator(".os-gezinme-daha").filter({ visible: true }).first();
    if (!(await dugme.count())) {
      await ctx.close();
      return "bu hâlde yok (masaüstü açık)";
    }
    await dugme.focus();
    await sayfa.keyboard.press("Enter");
    await sayfa.waitForTimeout(350);
    const p = await sayfa.evaluate(() => {
      const d = document.querySelector("dialog.os-daha");
      const b = d.getBoundingClientRect();
      const l = d.querySelector(".os-daha-liste");
      return { acik: d.open, ust: b.top, alt: b.bottom, vh: innerHeight, kayar: l.scrollHeight > l.clientHeight + 1, oge: l.querySelectorAll("a").length, yukseklik: Math.round(b.height) };
    });
    bekle(p.acik && p.ust >= 0 && p.alt <= p.vh + 1, `pencere ekran dışında: ${JSON.stringify(p)}`);
    /*
      Son öğeye FAREYLE ulaşılabilmeli (dokunmatikte parmakla). Klavye
      tek başına yetmiyor: tarayıcı odaklanan öğeyi overflow:hidden bir
      kabın içinde de programla kaydırıyor, yani eski hâlde Tab çalışıyor
      ama tekerlek ve parmak son öğeye hiç ulaşamıyordu. Bu yüzden önce
      odak vermeden tekerlek çevrilir, son öğe görünür olmalı.
    */
    const tekerlekSonu = async () => {
      const kutu = await sayfa.locator("dialog.os-daha .os-daha-liste a").first().boundingBox();
      await sayfa.mouse.move(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
      await sayfa.mouse.wheel(0, 1200);
      await sayfa.waitForTimeout(200);
      return sayfa.evaluate(() => {
        const d = document.querySelector("dialog.os-daha").getBoundingClientRect();
        const b = [...document.querySelectorAll("dialog.os-daha .os-daha-liste a")].at(-1).getBoundingClientRect();
        return b.top >= d.top - 1 && b.bottom <= Math.min(d.bottom, innerHeight) + 1;
      });
    };
    bekle(await tekerlekSonu(), "son öğeye tekerlekle ulaşılamıyor (liste kaymıyor)");
    await sayfa.evaluate(() => { const l = document.querySelector("dialog.os-daha .os-daha-liste"); l.scrollTop = 0; document.querySelector("dialog.os-daha").scrollTop = 0; });
    const gorunmeyen = [];
    let odak = 0;
    await sayfa.locator("dialog.os-daha .os-daha-liste a").first().focus();
    for (let i = 0; i < p.oge; i++) {
      const o = await odakGorunur(sayfa);
      odak++;
      if (!o.gorunur) gorunmeyen.push(o.ad);
      await sayfa.keyboard.press("Tab");
    }
    bekle(!gorunmeyen.length, `odakta görünmeyen: ${gorunmeyen.join(", ")}`);
    // Son bağlantı tıklanabilir: üstünü başka bir öğe örtmüyor.
    const son = sayfa.locator("dialog.os-daha .os-daha-liste a").last();
    await son.scrollIntoViewIfNeeded();
    const tiklanir = await son.evaluate((e) => { const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return Boolean(h && (h === e || e.contains(h))); });
    bekle(tiklanir, "son öğe tıklanabilir değil");
    await sayfa.keyboard.press("Escape");
    const sonra = await sayfa.evaluate(() => ({ acik: document.querySelector("dialog.os-daha").open, odakDaha: Boolean(document.activeElement?.classList.contains("os-gezinme-daha")) }));
    bekle(!sonra.acik && sonra.odakDaha, `Escape: ${JSON.stringify(sonra)}`);
    await ctx.close();
    return `${p.yukseklik}px, ${p.oge} öğe${p.kayar ? " kayar" : ""}`;
  });
}

await senaryo(`[${ROL}] koyu tema 1366×500: hesap menüsü ekranda ve kayar`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ w: 1366, h: 500, dar: false, tema: "dark" });
  await sayfa.locator("details.os-kullanici--kenar > summary").click();
  const m = await sayfa.evaluate(() => { const b = document.querySelector("details.os-kullanici[open] .os-kullanici-menu").getBoundingClientRect(); return { ust: b.top, alt: b.bottom, vh: innerHeight, tema: document.documentElement.dataset.theme }; });
  bekle(m.ust >= 0 && m.alt <= m.vh, JSON.stringify(m));
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return `tema=${m.tema}`;
});

await tarayici.close();
let dusen = 0;
for (const s of sonuclar) {
  console.log(`${s.tamam ? "PASS" : "FAIL"}  ${s.ad}${s.tamam ? (s.not ? `  — ${s.not}` : "") : `\n      → ${s.neden}`}`);
  if (!s.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
