/*
  PHASE 5.1d-4 TARAYICI KABULÜ: çalışma sekmeleri tek kaynaktan ve Ctrl+K
  kenar çubuğu komutu.

  - Çalışma sekmeleri her ekran boyunda aynı adları, aynı sırayı ve aynı
    etkin bölümü gösterir; Makale yalnızca makale türünde. 17.11.2026'ya
    kadar açık masaüstünde sekmeler gizli, aynı liste kenar çubuğunun alt
    menüsündeydi; alt menü kalktı (editör açılınca gezinme değişmez).
    Sekme sırasının sonundaki araç bağlantıları (Kaynaklar, Analiz, Belge
    Kontrol) bölüm sayılmaz, ayrıca denetlenir. Telefonda yazım ekranı
    sekmeleri gizler; oradan geri düğmesi çalışma özetine (sekmelere) götürür.
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
    return nav ? [...nav.querySelectorAll("a:not(.calisma-sekmeleri-arac)")].map((a) => [a.textContent.trim(), a.getAttribute("aria-current") === "page"]) : null;
  });
/** Sekme sırasının sonundaki, bu çalışmaya süzülü araçlar: [ad, adres]. */
const araclar = (s) =>
  s.evaluate(() => {
    const nav = [...document.querySelectorAll("nav.calisma-sekmeleri")].find((n) => n.checkVisibility());
    return nav ? [...nav.querySelectorAll("a.calisma-sekmeleri-arac")].map((a) => [a.textContent.trim(), a.getAttribute("href")]) : null;
  });
const ARACLAR = ["Kaynaklar", "Analiz", "Belge Kontrol"];

const SAYFALAR = [
  [`/dashboard/editor/${TEZ}/write`, "Yazım", TEZ_BOLUMLERI],
  [`/dashboard/editor/${TEZ}/kanit`, "Kanıt matrisi", TEZ_BOLUMLERI],
  [`/dashboard/editor/${TEZ}/etik`, "Etik kurul", TEZ_BOLUMLERI],
  [`/dashboard/editor/${MAKALE}/makale`, "Makale", MAKALE_BOLUMLERI],
];

for (const d of [{ ad: "1024 tablet", w: 1024, h: 768 }, { ad: "390 telefon", w: 390, h: 844, telefon: true }, { ad: "1366 dar", w: 1366, h: 800, dar: true }, { ad: "1366 açık", w: 1366, h: 800 }]) {
  await senaryo(`[${ROL}] ${d.ad}: çalışma sekmeleri ad, sıra ve etkin bölüm doğru; Makale yalnızca makalede; araçlar bu çalışmaya süzülü`, async () => {
    const { ctx, sayfa, hatalar } = await sayfaAc(d);
    for (const [yol, etkin, beklenen] of SAYFALAR) {
      await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
      bekle(!(await sayfa.locator("#os-gezinme-calisma, .os-gezinme-baglam").count()), `${yol}: kenar çubuğunda çalışma alt menüsü var`);
      if (d.telefon && yol.endsWith("/write")) {
        // Telefonda yazım ekranı sekmeleri gizler (metin ilk ekranda görünsün); geri düğmesi özete götürür.
        bekle((await sekmeler(sayfa)) === null, `${yol}: telefonda yazım ekranında sekmeler görünmemeli`);
        const geri = sayfa.locator(".yazma-basligi a.projects-filter-button").first();
        bekle(await geri.isVisible(), `${yol}: geri düğmesi yok`);
        await geri.click();
        await sayfa.waitForURL((u) => !u.pathname.endsWith("/write"), { timeout: 60000 });
        await sayfa.waitForLoadState("networkidle");
        const ozet = await sekmeler(sayfa);
        bekle(ozet && ozet.find(([a, e]) => a === "Özet" && e), `geri düğmesi özete götürmedi: ${sayfa.url()}`);
        continue;
      }
      const s = await sekmeler(sayfa);
      bekle(s, `${yol}: sekme yok`);
      bekle(JSON.stringify(s.map(([a]) => a)) === JSON.stringify(beklenen), `${yol}: ${s.map(([a]) => a).join(", ")}`);
      const etkinler = s.filter(([, e]) => e).map(([a]) => a);
      bekle(JSON.stringify(etkinler) === JSON.stringify([etkin]), `${yol}: etkin ${etkinler.join(",")}`);
      const id = yol.split("/")[3];
      const a = await araclar(sayfa);
      bekle(JSON.stringify(a.map(([x]) => x)) === JSON.stringify(ARACLAR), `${yol}: araçlar ${a.map(([x]) => x).join(", ")}`);
      bekle(a.every(([, h]) => h.includes(`calisma=${id}`)), `${yol}: araç bu çalışmaya süzülü değil ${JSON.stringify(a)}`);
    }
    bekle(!hatalar.length, hatalar.join(" | "));
    await ctx.close();
    return `${SAYFALAR.length} sayfa`;
  });
}

/*
  Sekmeler klavyeyle: Tab sırasıyla her bölüme ulaşılır, Enter götürür.
  (Eskiden aynı senaryo kenar çubuğu alt menüsünün ad/sıra eşleşmesini sınıyordu.)
*/
await senaryo(`[${ROL}] 1366 açık: sekmeler klavyeyle gezilir; Enter bölüme götürür, kenar çubuğu aynı kalır`, async () => {
  const { ctx, sayfa } = await sayfaAc({ w: 1366, h: 800, yol: `/dashboard/editor/${TEZ}/write` });
  const kenarOnce = await sayfa.locator("nav.os-gezinme").innerText();
  await sayfa.locator("nav.calisma-sekmeleri a").first().focus();
  const sira = [];
  for (let i = 0; i < 4; i++) {
    sira.push(await sayfa.evaluate(() => document.activeElement?.textContent?.trim()));
    await sayfa.keyboard.press("Tab");
  }
  bekle(JSON.stringify(sira) === JSON.stringify(TEZ_BOLUMLERI), `Tab sırası: ${sira.join(", ")}`);
  await sayfa.locator("nav.calisma-sekmeleri a", { hasText: "Kanıt matrisi" }).focus();
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForURL(/\/kanit/, { timeout: 60000 });
  await sayfa.waitForLoadState("networkidle");
  const s = await sekmeler(sayfa);
  bekle(s.find(([a, e]) => a === "Kanıt matrisi" && e), "Kanıt matrisi etkin değil");
  bekle((await sayfa.locator("nav.os-gezinme").innerText()) === kenarOnce, "kenar çubuğu değişti");
  await ctx.close();
  return sira.join(" → ");
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
