/*
  BİRLEŞİK UYGULAMA KABUĞU KABULÜ (Signature OS 2.0 Aşama 2, 08.11.2026).

  Kurum sahibinin Aşama 2 öncelikleri, 1440/1200/1024/768/390/360'ta:
    1. Masaüstünde kalıcı, daraltılabilir, çalışma bağlamıyla bütünleşik
       kenar çubuğu (daraltma tercihi sayfa değişince korunur).
    2. Project Switcher: son çalışmalar, klavye (↓ açar, oklar gezer, Esc
       kapatıp odağı düğmeye verir), tam başlık (listede kesilmez), seçilen
       çalışmanın AYNI bölümüne gider.
    3. Masaüstünde yinelenen çalışma sekmeleri yok (kenar çubuğu bağlamı
       varken); daraltılınca, tablette ve telefonda sekmeler geri gelir.
    4. "Kaynak Kütüphanesi" (genel) ve "Kaynaklar" (çalışmanın) ayrımı.
    5. Ctrl+K çalışma bağlamında "Bu çalışmada" ve "Çalışma değiştir".
    6. Editörde ana gezinme ve çalışma bağlamı korunur.
    7. Telefonda alt çubuk beş öğe: Ana Sayfa, Çalışmalar, Kaynaklar,
       Analiz, Daha fazla.
  Her ekranda yatay taşma yok.

  Salt okunur önizleme yeter (npm run onizleme:ai). Daraltma tercihini
  sınayan senaryo kendi tarayıcı bağlamında, sonunda geri alır.
    node scripts/onizleme/kabuk-kabul.mjs [taban]
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const MAKALE = "00000000-0000-4000-8000-0000000000b2";
let gecen = 0;
let toplam = 0;
const tarayici = await chromium.launch();

async function senaryo(ad, fn) {
  toplam++;
  try {
    await fn();
    gecen++;
    console.log(`✓ ${ad}`);
  } catch (hata) {
    console.log(`✗ ${ad}\n    ${String(hata?.message ?? hata).split("\n")[0].slice(0, 240)}`);
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};
async function ac(w, yol, { dar = false } = {}) {
  const dokunma = w < 1200;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: dokunma, isMobile: w < 761 });
  if (dar) await ctx.addInitScript(() => localStorage.setItem("arvolab.kenar", "dar"));
  const sayfa = await ctx.newPage();
  await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 180000 });
  return { ctx, sayfa };
}
const tasma = (s) => s.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const gorunur = (s, sec) => s.locator(sec).first().isVisible().catch(() => false);

for (const w of [1440, 1200]) {
  await senaryo(`${w}: kenar çubuğu kalıcı; editörde bağlam, switcher ve "Yazım" etkin`, async () => {
    const { ctx, sayfa } = await ac(w, `/dashboard/editor/${TEZ}/write`);
    const nav = await sayfa.locator("nav#os-gezinme").boundingBox();
    bekle(nav && nav.x === 0 && nav.width >= 200, `kenar çubuğu yok/dar: ${JSON.stringify(nav)}`);
    bekle(await gorunur(sayfa, ".os-gezinme-baglam"), "editörde çalışma bağlamı görünmüyor");
    bekle(await gorunur(sayfa, ".proje-secici-dugme[aria-haspopup='listbox']"), "switcher yok");
    const etkin = await sayfa.locator(".os-gezinme-baglam a[aria-current='page']").innerText();
    bekle(/Yazım|Writing/.test(etkin), `etkin bölüm "${etkin}"`);
    bekle((await tasma(sayfa)) <= 0, "yatay taşma");
    await ctx.close();
  });
  await senaryo(`${w}: kanıt sayfasında sekme şeridi YOK (bağlam kenar çubuğunda); taşma yok`, async () => {
    const { ctx, sayfa } = await ac(w, `/dashboard/editor/${TEZ}/kanit`);
    bekle(await gorunur(sayfa, ".os-gezinme-baglam"), "bağlam görünmüyor");
    bekle(!(await gorunur(sayfa, ".calisma-sekmeleri")), "masaüstünde yinelenen sekme şeridi görünüyor");
    bekle((await tasma(sayfa)) <= 0, "yatay taşma");
    await ctx.close();
  });
}

await senaryo("1440: daraltılınca bağlam kenar çubuğundan çıkar, sekmeler GERİ gelir; tercih sayfa değişince korunur", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/kanit`);
  await sayfa.locator(".os-gezinme-daralt").click();
  await sayfa.waitForTimeout(300);
  bekle(!(await gorunur(sayfa, ".os-gezinme-baglam")), "daraltılmışken bağlam hâlâ görünüyor");
  bekle(await gorunur(sayfa, ".calisma-sekmeleri"), "daraltılmışken sekmeler geri gelmedi (bölümlere ulaşılamaz)");
  await sayfa.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await sayfa.waitForURL(`${TABAN}/dashboard`);
  bekle((await sayfa.evaluate(() => document.documentElement.getAttribute("data-kenar"))) === "dar", "daraltma sayfa değişince unutuldu");
  await sayfa.locator(".os-gezinme-daralt").click();
  bekle((await sayfa.evaluate(() => localStorage.getItem("arvolab.kenar"))) !== "dar", "genişletme kaydedilmedi");
  await ctx.close();
});

await senaryo("switcher: ↓ açar (odak açık çalışmada, işaretli), ↓ gezer, Esc kapatıp odağı düğmeye verir", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/kanit`);
  await sayfa.locator(".proje-secici-dugme").focus();
  await sayfa.keyboard.press("ArrowDown");
  await sayfa.locator(".proje-secici-oge").first().waitFor({ timeout: 20000 });
  await sayfa.waitForTimeout(200);
  const ilk = await sayfa.evaluate(() => ({ rol: document.activeElement?.getAttribute("role"), secili: document.activeElement?.getAttribute("aria-selected") }));
  bekle(ilk.rol === "option" && ilk.secili === "true", `açılınca odak ${JSON.stringify(ilk)}`);
  bekle((await sayfa.locator(".proje-secici-dugme").getAttribute("aria-expanded")) === "true", "aria-expanded true değil");
  await sayfa.keyboard.press("ArrowDown");
  bekle((await sayfa.evaluate(() => document.activeElement?.getAttribute("aria-selected"))) === "false", "↓ sonraki çalışmaya geçmedi");
  await sayfa.keyboard.press("Escape");
  bekle(await sayfa.evaluate(() => document.activeElement?.classList.contains("proje-secici-dugme")), "Esc sonrası odak düğmede değil");
  bekle((await sayfa.locator(".proje-secici-pencere").count()) === 0, "Esc listeyi kapatmadı");
  await ctx.close();
});

await senaryo("switcher: tam başlık listede kesilmez, düğmenin erişilebilir adında tam başlık", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/write`);
  const tam = "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)";
  bekle((await sayfa.locator(".proje-secici-dugme").getAttribute("aria-label")).includes(tam), "düğmenin adında tam başlık yok");
  await sayfa.locator(".proje-secici-dugme").click();
  const ad = sayfa.locator(".proje-secici-oge[aria-selected='true'] .proje-secici-ad");
  await ad.waitFor({ timeout: 20000 });
  bekle((await ad.innerText()).trim() === tam, `listedeki başlık: ${await ad.innerText()}`);
  const kesik = await ad.evaluate((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === "ellipsis");
  bekle(!kesik, "başlık listede kesiliyor");
  await ctx.close();
});

await senaryo("switcher: kanıttan öteki çalışmaya → AYNI bölüm; yazımdan → yazım", async () => {
  for (const bolum of ["kanit", "write"]) {
    const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/${bolum}`);
    await sayfa.locator(".proje-secici-dugme").click();
    await sayfa.locator(".proje-secici-oge").nth(1).click();
    await sayfa.waitForURL((u) => u.pathname.includes(MAKALE), { timeout: 30000 });
    bekle(new URL(sayfa.url()).pathname === `/dashboard/editor/${MAKALE}/${bolum}`, `${bolum} → ${sayfa.url()}`);
    await ctx.close();
  }
});

await senaryo("adlar: genel 'Kaynak Kütüphanesi', çalışmanın içinde 'Kaynaklar'", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/write`);
  bekle(await sayfa.locator(".os-gezinme-ana").getByText("Kaynak Kütüphanesi", { exact: true }).isVisible(), "genel ad yok");
  bekle(await sayfa.locator(".os-gezinme-baglam").getByRole("link", { name: "Kaynaklar", exact: true }).isVisible(), "bağlamda 'Kaynaklar' yok");
  await sayfa.goto(`${TABAN}/dashboard/literature`, { waitUntil: "networkidle" });
  bekle((await sayfa.locator("main h1").first().innerText()).trim() === "Kaynak Kütüphanesi", "genel girişte sayfa adı");
  await sayfa.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle" });
  bekle((await sayfa.locator("main h1").first().innerText()).trim() === "Kaynaklar", "çalışmadan girişte sayfa adı");
  await ctx.close();
});

for (const w of [1024, 768, 390, 360]) {
  await senaryo(`${w}: bağlam kenar çubuğunda değil; kanıt sayfasında sekme şeridi VAR; Ctrl+K'da 'Bu çalışmada'; taşma yok`, async () => {
    const { ctx, sayfa } = await ac(w, `/dashboard/editor/${TEZ}/kanit`);
    bekle(!(await gorunur(sayfa, ".os-gezinme-baglam")), "bağlam bu ekranda görünmemeli");
    bekle(await gorunur(sayfa, ".calisma-sekmeleri"), "sekme şeridi yok: çalışma bölümlerine ulaşılamaz");
    bekle((await tasma(sayfa)) <= 0, "yatay taşma");
    await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle" });
    bekle((await tasma(sayfa)) <= 0, "editörde yatay taşma");
    await sayfa.evaluate(() => window.dispatchEvent(new Event("os:ara")));
    await sayfa.locator(".os-palette-input input").waitFor({ timeout: 5000 });
    await sayfa.waitForTimeout(300);
    const metin = await sayfa.locator(".os-palette").innerText();
    bekle(/Bu çalışmada/.test(metin) && /Kanıt matrisi/.test(metin) && /Etik kurul/.test(metin), "editörde Ctrl+K 'Bu çalışmada' bölümleri yok");
    await ctx.close();
  });
}

for (const w of [390, 360]) {
  await senaryo(`${w}: alt çubuk beşli düzen (Ana Sayfa, Çalışmalar, Kaynaklar, Analiz, Daha fazla)`, async () => {
    const { ctx, sayfa } = await ac(w, "/dashboard");
    const ogeler = (await sayfa.locator("#os-gezinme li:visible :is(a, button):visible").allInnerTexts()).map((x) => x.trim().split("\n").pop());
    bekle(JSON.stringify(ogeler) === JSON.stringify(["Ana Sayfa", "Çalışmalar", "Kaynaklar", "Analiz", "Daha fazla"]), `alt çubuk: ${JSON.stringify(ogeler)}`);
    await ctx.close();
  });
}

await senaryo("1024/768: rayda 'Çalışmalar' editörde etkin (ana gezinme editörde de yerinde)", async () => {
  for (const w of [1024, 768]) {
    const { ctx, sayfa } = await ac(w, `/dashboard/editor/${TEZ}/write`);
    const etkin = await sayfa.locator("#os-gezinme .os-gezinme-oge.is-active").first().innerText().catch(() => "");
    bekle(/Çalışma/.test(etkin), `${w}: etkin öğe "${etkin}"`);
    await ctx.close();
  }
});

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
