/*
  PHASE 5.1d-2 TARAYICI KABULÜ: Ctrl+K komut paleti.

  14.11.2026'ya kadar beş uygulama (Doçentlik Puanı, Kullanım Kılavuzu,
  Abonelik ve Kredi, Asistan Kayıtları, Ekip Yönetimi) paletin hem
  "Uygulamalar" hem "Sayfalar" grubunda çıkıyordu. Bu betik gerçek
  tarayıcıda sınar: hiçbir sonuç iki kez yok, rolün göremeyeceği komut yok,
  hızlı işlemler yerinde, seçim doğru adrese gidiyor, Ctrl+K / arama /
  ok tuşları / Enter / Escape ve odak davranışı, editörde Ctrl+K, kenar
  çubuğu tercihi.

  Rol sunucunun ONIZLEME_ROL'üyle belirlenir (scripts/onizleme/veri.ts);
  betiğe aynı rol verilir ki beklentiyi seçsin:
    ARVOLAB_ONIZLEME=1 next dev -p 3123                            → client
    ARVOLAB_ONIZLEME=1 ONIZLEME_ROL=employee next dev -p 3123      → employee
    ARVOLAB_ONIZLEME=1 ONIZLEME_ROL=system_admin next dev -p 3123  → system_admin
  CI'da DEĞİL. Kullanım:
    node scripts/onizleme/komut-paleti-kabul.mjs [taban-adres] [client|employee|system_admin]
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const ROL = process.argv[3] ?? "client";
const TEZ = "00000000-0000-4000-8000-0000000000b1";

/* Rolün görmesi gereken uygulamalar (lib/os/uygulamalar.ts + gorunenUygulamalar). */
const TEMEL = ["Ana Sayfa", "Çalışmalarım", "Kaynaklar", "Analiz Merkezi", "Belge Kontrol", "Destek", "Ayarlar", "Kullanım Kılavuzu", "Abonelik ve Kredi"];
const BEKLENEN = {
  client: { var: TEMEL, yok: ["Doçentlik Puanı", "Asistan Kayıtları", "Ekip Yönetimi"] },
  employee: { var: [...TEMEL, "Doçentlik Puanı"], yok: ["Asistan Kayıtları", "Ekip Yönetimi"] },
  system_admin: { var: [...TEMEL, "Doçentlik Puanı", "Asistan Kayıtları", "Ekip Yönetimi"], yok: [] },
}[ROL];
if (!BEKLENEN) throw new Error(`bilinmeyen rol: ${ROL}`);
const MUKERRER_BES = ["Doçentlik Puanı", "Kullanım Kılavuzu", "Abonelik ve Kredi", "Asistan Kayıtları", "Ekip Yönetimi"];

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

async function sayfaAc({ w = 1366, h = 800, yol = "/dashboard", dar } = {}) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h } });
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

const paletAcik = (s) => s.evaluate(() => Boolean(document.querySelector("dialog.os-palette")?.open));
async function ctrlK(s) {
  await s.keyboard.press("Control+k");
  await s.waitForFunction(() => document.querySelector("dialog.os-palette")?.open, null, { timeout: 5000 });
  // Çalışmalar ilk açılışta bir kez okunur; listenin oturmasını bekle.
  await s.waitForTimeout(600);
}
/** Görünen sonuçlar: [grup, etiket]. */
const sonucListesi = (s) =>
  s.evaluate(() => {
    let grup = "";
    return [...document.querySelectorAll("#os-palette-list > li")].flatMap((li) => {
      const g = li.querySelector(".os-palette-group");
      if (g) grup = g.textContent.trim();
      const b = li.querySelector("[role=option]");
      return b ? [[grup, b.querySelector(".os-palette-label").textContent.trim()]] : [];
    });
  });
async function ara(s, metin) {
  await s.locator(".os-palette-input input").fill(metin);
  await s.waitForTimeout(150);
  return sonucListesi(s);
}

await senaryo(`[${ROL}] Ctrl+K açar, kutu odakta; boş listede hiçbir sonuç iki kez yok, 'Sayfalar' grubu boş`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc();
  await ctrlK(sayfa);
  const odak = await sayfa.evaluate(() => document.activeElement?.matches(".os-palette-input input"));
  bekle(odak, "arama kutusu odakta değil");
  const liste = await sonucListesi(sayfa);
  const anahtarlar = liste.map(([g, l]) => `${g}|${l}`);
  const etiketler = liste.map(([, l]) => l);
  const tekrar = etiketler.filter((l, i) => etiketler.indexOf(l) !== i);
  bekle(!tekrar.length, `iki kez çıkan: ${[...new Set(tekrar)].join(", ")}`);
  bekle(new Set(anahtarlar).size === anahtarlar.length, "grup+etiket tekrarı");
  bekle(!liste.some(([g]) => g === "Sayfalar"), "'Sayfalar' grubu hâlâ var (alt bölüm yokken)");
  const uygulamalar = liste.filter(([g]) => g === "Uygulamalar").map(([, l]) => l);
  bekle(JSON.stringify([...uygulamalar].sort()) === JSON.stringify([...BEKLENEN.var].sort()), `Uygulamalar: ${uygulamalar.join(", ")}`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return `${liste.length} sonuç, ${uygulamalar.length} uygulama`;
});

await senaryo(`[${ROL}] beş eski mükerrer komut aramada en fazla bir kez; yetkisizler hiç yok`, async () => {
  const { ctx, sayfa } = await sayfaAc();
  await ctrlK(sayfa);
  const sayim = [];
  for (const ad of MUKERRER_BES) {
    const liste = await ara(sayfa, ad);
    const n = liste.filter(([, l]) => l === ad).length;
    const beklenen = BEKLENEN.var.includes(ad) ? 1 : 0;
    bekle(n === beklenen, `${ad}: ${n} (beklenen ${beklenen})`);
    sayim.push(`${ad}=${n}`);
  }
  for (const ad of BEKLENEN.yok) {
    const liste = await ara(sayfa, ad);
    bekle(!liste.some(([, l]) => l === ad), `yetkisiz komut görünüyor: ${ad}`);
  }
  await ctx.close();
  return sayim.join(" ");
});

await senaryo(`[${ROL}] hızlı işlemler yerinde (yeni çalışma, kaynak, analiz); aynı adrese giden Analiz uygulaması da duruyor`, async () => {
  const { ctx, sayfa } = await sayfaAc();
  await ctrlK(sayfa);
  const liste = await sonucListesi(sayfa);
  const hizli = liste.filter(([g]) => g === "Hızlı işlemler").map(([, l]) => l);
  for (const ad of ["Yeni çalışma oluştur", "Kaynak ekle (DOI ya da arama)", "Veri analizi başlat"]) bekle(hizli.includes(ad), `eksik hızlı işlem: ${ad} (${hizli.join(", ")})`);
  bekle(liste.some(([g, l]) => g === "Uygulamalar" && l === "Analiz Merkezi"), "Analiz Merkezi uygulaması yok");
  bekle(liste.some(([g]) => g === "Komutlar"), "Komutlar grubu yok");
  await ctx.close();
  return hizli.join(" · ");
});

await senaryo(`[${ROL}] ok tuşları seçimi değiştirir; Enter seçili komutun adresine gider`, async () => {
  const { ctx, sayfa } = await sayfaAc();
  await ctrlK(sayfa);
  const hedef = ROL === "system_admin" ? ["Ekip Yönetimi", "/dashboard/team"] : ROL === "employee" ? ["Doçentlik Puanı", "/dashboard/associate-professorship"] : ["Abonelik ve Kredi", "/dashboard/abonelik"];
  await ara(sayfa, hedef[0]);
  const once = await sayfa.evaluate(() => document.querySelector("[role=option][aria-selected=true] .os-palette-label")?.textContent);
  bekle(once === hedef[0], `ilk seçili: ${once}`);
  await sayfa.locator(".os-palette-input input").fill("a");
  const a0 = await sayfa.evaluate(() => document.querySelector("[role=option][aria-selected=true]")?.id);
  await sayfa.keyboard.press("ArrowDown");
  const a1 = await sayfa.evaluate(() => document.querySelector("[role=option][aria-selected=true]")?.id);
  bekle(a0 !== a1, "ArrowDown seçimi değiştirmedi");
  await sayfa.keyboard.press("ArrowUp");
  const a2 = await sayfa.evaluate(() => document.querySelector("[role=option][aria-selected=true]")?.id);
  bekle(a2 === a0, "ArrowUp geri dönmedi");
  await ara(sayfa, hedef[0]);
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForURL((u) => u.pathname === hedef[1], { timeout: 60000 });
  bekle(!(await paletAcik(sayfa)), "Enter'dan sonra palet açık kaldı");
  await ctx.close();
  return `${hedef[0]} → ${hedef[1]}`;
});

await senaryo(`[${ROL}] DOI yapıştırılınca en üstte 'DOI ile kaynak ekle'; Enter literatüre DOI ile gider`, async () => {
  const { ctx, sayfa } = await sayfaAc();
  await ctrlK(sayfa);
  const liste = await ara(sayfa, "10.1234/abc.567");
  bekle(liste[0]?.[1]?.startsWith("DOI ile kaynak ekle"), `ilk sonuç: ${liste[0]?.[1]}`);
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForURL((u) => u.pathname === "/dashboard/literature" && u.searchParams.get("doi") === "10.1234/abc.567", { timeout: 60000 });
  await ctx.close();
});

await senaryo(`[${ROL}] arama düğmesiyle açılır; Escape kapatır, odak düğmeye döner; Ctrl+K ikinci basışta kapatır`, async () => {
  const { ctx, sayfa } = await sayfaAc();
  const dugme = sayfa.locator(".os-search");
  await dugme.focus();
  await sayfa.keyboard.press("Enter");
  await sayfa.waitForFunction(() => document.querySelector("dialog.os-palette")?.open);
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(150);
  const s1 = await sayfa.evaluate(() => ({ acik: document.querySelector("dialog.os-palette").open, odak: document.activeElement?.classList.contains("os-search") }));
  bekle(!s1.acik && s1.odak, `Escape: ${JSON.stringify(s1)}`);
  await ctrlK(sayfa);
  await sayfa.keyboard.press("Control+k");
  await sayfa.waitForTimeout(150);
  bekle(!(await paletAcik(sayfa)), "Ctrl+K ikinci basışta kapatmadı");
  await ctx.close();
});

await senaryo(`[${ROL}] editörde: Ctrl+K paleti açar, Escape odağı belgeye geri verir, belge değişmez`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ yol: `/dashboard/editor/${TEZ}/write` });
  const belge = sayfa.locator(".ProseMirror").first();
  await belge.click();
  const once = await belge.evaluate((e) => e.textContent.length);
  await ctrlK(sayfa);
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(150);
  const s = await sayfa.evaluate(() => ({ acik: document.querySelector("dialog.os-palette").open, belgede: Boolean(document.activeElement?.closest(".ProseMirror")) }));
  bekle(!s.acik && s.belgede, `Escape sonrası: ${JSON.stringify(s)}`);
  const sonra = await belge.evaluate((e) => e.textContent.length);
  bekle(once === sonra, `belge uzunluğu değişti ${once} → ${sonra}`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
});

await senaryo(`[${ROL}] kenar çubuğu tercihi paletle değişmez (dar kalır, kayıt aynı)`, async () => {
  const { ctx, sayfa } = await sayfaAc({ dar: true });
  const once = await sayfa.evaluate(() => [document.documentElement.getAttribute("data-gezinme"), localStorage.getItem("arvolab.gezinme.dar")]);
  await ctrlK(sayfa);
  await ara(sayfa, "Ayarlar");
  await sayfa.keyboard.press("Escape");
  const sonra = await sayfa.evaluate(() => [document.documentElement.getAttribute("data-gezinme"), localStorage.getItem("arvolab.gezinme.dar")]);
  bekle(JSON.stringify(once) === JSON.stringify(["dar", "1"]) && JSON.stringify(sonra) === JSON.stringify(once), `${once} → ${sonra}`);
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
