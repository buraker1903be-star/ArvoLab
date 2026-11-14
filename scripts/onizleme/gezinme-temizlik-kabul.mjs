/*
  PHASE 5.1d-4 TARAYICI KABULÜ: çalışma sekmeleri tek kaynaktan ve Ctrl+K
  kenar çubuğu komutu.

  - Sayfadaki sekmeler (tablet, telefon, dar masaüstü) ile açık masaüstündeki
    kenar çubuğu alt menüsü aynı adları, aynı sırayı ve aynı etkin bölümü
    gösterir; Makale yalnızca makale türünde.
  - Ctrl+K'daki "Kenar çubuğunu daralt/genişlet" yalnızca ≥1200 px'te
    listelenir, kenar çubuğundaki düğmeyle AYNI tercihi değiştirir (yeni
    depolama anahtarı yok), tercih yeniden yüklemede kalır. Ctrl+B kenar
    çubuğuna dokunmaz (editörde kalın yazı).

  Rol sunucunun ONIZLEME_ROL'üyle belirlenir; betik yalnızca rapora yazar:
    node scripts/onizleme/gezinme-temizlik-kabul.mjs [taban] [rol-etiketi]
  CI'da DEĞİL. Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const ROL = process.argv[3] ?? "?";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const MAKALE = "00000000-0000-4000-8000-0000000000b2";
const TEZ_BOLUMLERI = ["Özet", "Yazım", "Kanıt matrisi", "Etik kurul"];
const MAKALE_BOLUMLERI = [...TEZ_BOLUMLERI, "Makale"];

const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    const not = await govde();
    sonuclar.push({ ad, tamam: true, not });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n")[0].slice(0, 600) });
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

/** Görünen çalışma sekmeleri: [ad, etkin mi]. */
const sekmeler = (s) =>
  s.evaluate(() => {
    const nav = [...document.querySelectorAll("nav.calisma-sekmeleri")].find((n) => n.checkVisibility());
    return nav ? [...nav.querySelectorAll("a")].map((a) => [a.textContent.trim(), a.getAttribute("aria-current") === "page"]) : null;
  });
/** Kenar çubuğundaki çalışma alt menüsü (açık masaüstü): [ad, etkin mi]. */
const altMenu = (s) =>
  s.evaluate(() => {
    const ul = document.querySelector("#os-gezinme-calisma ul");
    return ul && ul.checkVisibility() ? [...ul.querySelectorAll("a")].map((a) => [a.textContent.trim(), a.getAttribute("aria-current") === "page"]) : null;
  });

const SAYFALAR = [
  [`/dashboard/editor/${TEZ}/write`, "Yazım", TEZ_BOLUMLERI],
  [`/dashboard/editor/${TEZ}/kanit`, "Kanıt matrisi", TEZ_BOLUMLERI],
  [`/dashboard/editor/${TEZ}/etik`, "Etik kurul", TEZ_BOLUMLERI],
  [`/dashboard/editor/${MAKALE}/makale`, "Makale", MAKALE_BOLUMLERI],
];

for (const d of [{ ad: "1024 tablet", w: 1024, h: 768 }, { ad: "390 telefon", w: 390, h: 844 }, { ad: "1366 dar", w: 1366, h: 800, dar: true }]) {
  await senaryo(`[${ROL}] ${d.ad}: çalışma sekmeleri ad, sıra ve etkin bölüm doğru; Makale yalnızca makalede`, async () => {
    const { ctx, sayfa, hatalar } = await sayfaAc(d);
    for (const [yol, etkin, beklenen] of SAYFALAR) {
      await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
      const s = await sekmeler(sayfa);
      bekle(s, `${yol}: sekme yok`);
      bekle(JSON.stringify(s.map(([a]) => a)) === JSON.stringify(beklenen), `${yol}: ${s.map(([a]) => a).join(", ")}`);
      const etkinler = s.filter(([, e]) => e).map(([a]) => a);
      bekle(JSON.stringify(etkinler) === JSON.stringify([etkin]), `${yol}: etkin ${etkinler.join(",")}`);
    }
    bekle(!hatalar.length, hatalar.join(" | "));
    await ctx.close();
    return `${SAYFALAR.length} sayfa`;
  });
}

await senaryo(`[${ROL}] 1366 açık: kenar çubuğu alt menüsü sekmelerle aynı ad/sıra/etkin; sayfadaki sekmeler gizli`, async () => {
  const { ctx, sayfa } = await sayfaAc({ w: 1366, h: 800 });
  for (const [yol, etkin, beklenen] of SAYFALAR) {
    await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
    const m = await altMenu(sayfa);
    bekle(m, `${yol}: alt menü yok`);
    bekle(JSON.stringify(m.map(([a]) => a)) === JSON.stringify(beklenen), `${yol}: ${m.map(([a]) => a).join(", ")}`);
    bekle(JSON.stringify(m.filter(([, e]) => e).map(([a]) => a)) === JSON.stringify([etkin]), `${yol}: etkin`);
    bekle((await sekmeler(sayfa)) === null, `${yol}: açık masaüstünde sekmeler görünüyor`);
  }
  await ctx.close();
});

async function paletAc(s) {
  await s.keyboard.press("Control+k");
  await s.waitForFunction(() => document.querySelector("dialog.os-palette")?.open, null, { timeout: 5000 });
  await s.waitForTimeout(400);
}
const kenarKomutu = (s) => s.evaluate(() => [...document.querySelectorAll(".os-palette-label")].map((e) => e.textContent.trim()).filter((l) => /Kenar çubuğunu/.test(l)));
const depo = (s) => s.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));

await senaryo(`[${ROL}] 1366: Ctrl+K "Kenar çubuğunu daralt/genişlet" düğmeyle aynı tercihi değiştirir, yeni anahtar yok, yeniden yüklemede kalır`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ w: 1366, h: 800 });
  const once = await depo(sayfa);
  await paletAc(sayfa);
  bekle(JSON.stringify(await kenarKomutu(sayfa)) === JSON.stringify(["Kenar çubuğunu daralt"]), `açıkken: ${await kenarKomutu(sayfa)}`);
  await sayfa.locator(".os-palette-input input").fill("kenar");
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForTimeout(450);
  let d = await sayfa.evaluate(() => ({ attr: document.documentElement.getAttribute("data-gezinme"), k: localStorage.getItem("arvolab.gezinme.dar"), acik: document.querySelector("dialog.os-palette").open, w: Math.round(document.querySelector("#os-ana-gezinme").getBoundingClientRect().width), aria: document.querySelector(".os-gezinme-daralt").getAttribute("aria-expanded") }));
  bekle(d.attr === "dar" && d.k === "1" && !d.acik && d.w === 64 && d.aria === "false", `daraltma: ${JSON.stringify(d)}`);
  await sayfa.reload({ waitUntil: "networkidle" });
  d = await sayfa.evaluate(() => ({ attr: document.documentElement.getAttribute("data-gezinme"), w: Math.round(document.querySelector("#os-ana-gezinme").getBoundingClientRect().width) }));
  bekle(d.attr === "dar" && d.w === 64, `yeniden yükleme: ${JSON.stringify(d)}`);
  await paletAc(sayfa);
  bekle(JSON.stringify(await kenarKomutu(sayfa)) === JSON.stringify(["Kenar çubuğunu genişlet"]), `darken: ${await kenarKomutu(sayfa)}`);
  await sayfa.locator(".os-palette-input input").fill("kenar");
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForTimeout(450);
  d = await sayfa.evaluate(() => ({ attr: document.documentElement.getAttribute("data-gezinme"), k: localStorage.getItem("arvolab.gezinme.dar"), w: Math.round(document.querySelector("#os-ana-gezinme").getBoundingClientRect().width) }));
  bekle(d.attr === null && d.k === "0" && d.w === 240, `genişletme: ${JSON.stringify(d)}`);
  const sonra = await depo(sayfa);
  const yeni = Object.keys(sonra).filter((k) => !(k in once) && k !== "arvolab.gezinme.dar");
  bekle(!yeni.length, `yeni depolama anahtarı: ${yeni.join(", ")}`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return "daralt → 64 px, yeniden yükle → 64 px, genişlet → 240 px";
});

for (const d of [{ ad: "1024 tablet", w: 1024, h: 768 }, { ad: "390 telefon", w: 390, h: 844 }]) {
  await senaryo(`[${ROL}] ${d.ad}: Ctrl+K'da kenar çubuğu komutu yok`, async () => {
    const { ctx, sayfa } = await sayfaAc(d);
    await paletAc(sayfa);
    bekle(!(await kenarKomutu(sayfa)).length, `listeleniyor: ${await kenarKomutu(sayfa)}`);
    await sayfa.locator(".os-palette-input input").fill("kenar");
    await sayfa.waitForTimeout(150);
    bekle(!(await kenarKomutu(sayfa)).length, "aramada çıkıyor");
    await ctx.close();
  });
}

await senaryo(`[${ROL}] Ctrl+B kenar çubuğuna dokunmaz (editör dışında ve palet kapalıyken)`, async () => {
  const { ctx, sayfa } = await sayfaAc({ w: 1366, h: 800 });
  await sayfa.locator("body").click({ position: { x: 700, y: 400 } }).catch(() => {});
  await sayfa.keyboard.press("Control+b");
  await sayfa.waitForTimeout(300);
  const d = await sayfa.evaluate(() => ({ attr: document.documentElement.getAttribute("data-gezinme"), k: localStorage.getItem("arvolab.gezinme.dar"), palet: document.querySelector("dialog.os-palette").open }));
  bekle(d.attr === null && d.k === null && !d.palet, JSON.stringify(d));
  await ctx.close();
});

await senaryo(`[${ROL}] koyu tema: sekmeler ve kenar komutu sayfa hatasız`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ w: 1366, h: 800, tema: "dark", dar: true, yol: `/dashboard/editor/${TEZ}/write` });
  const s = await sekmeler(sayfa);
  bekle(s && s.length === 4, `sekmeler: ${JSON.stringify(s)}`);
  await paletAc(sayfa);
  bekle(JSON.stringify(await kenarKomutu(sayfa)) === JSON.stringify(["Kenar çubuğunu genişlet"]), "komut");
  await sayfa.keyboard.press("Escape");
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
});

await tarayici.close();
let dusen = 0;
for (const s of sonuclar) {
  console.log(`${s.tamam ? "PASS" : "FAIL"}  ${s.ad}${s.tamam ? (s.not ? `  — ${s.not}` : "") : `\n      → ${s.neden}`}`);
  if (!s.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
