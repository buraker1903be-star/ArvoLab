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
    8. (V4.3-B1) Ray 64 px, kenar çubuğu 236 px; rayda yalnız simge,
       erişilebilir ad tam, hedef ≥44 px, klavye odağında ipucu, Esc kapatır.
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

/*
  Aşama 2.1: daraltılmışken bağlamdan YALNIZCA switcher simgesi kalır
  (44 px); bölüm bağlantıları gizlenir, sayfadaki sekmeler geri gelir.
  Eskiden (Aşama 2) bağlamın tamamı kayboluyordu ve daraltılmış kenar
  çubuğundan çalışma değiştirilemiyordu.
*/
await senaryo("1440: daraltılınca bölüm bağlantıları gizlenir, switcher simgesi kalır (≥44 px), sekmeler GERİ gelir; tercih sayfa değişince korunur", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/kanit`);
  await sayfa.locator(".os-gezinme-daralt").click();
  await sayfa.waitForTimeout(300);
  bekle(!(await gorunur(sayfa, ".os-gezinme-baglam a[href*='/kanit']")), "daraltılmışken bölüm bağlantıları hâlâ görünüyor");
  const simge = await sayfa.locator(".proje-secici-dugme").boundingBox();
  bekle(simge && simge.width >= 44 && simge.height >= 44, `daraltılmış switcher: ${JSON.stringify(simge)}`);
  bekle(!(await gorunur(sayfa, ".proje-secici-ad-kisa")), "daraltılmışken başlık metni görünüyor");
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
  bekle(!(await sayfa.locator(".proje-secici-pencere").isVisible()), "Esc listeyi kapatmadı");
  await ctx.close();
});

/*
  Aşama 2.1: liste üst katmanda açılır. Eskiden kenar çubuğunun içinde
  açılıp altındaki bölüm ve uygulama bağlantılarını aşağı itiyordu.
*/
await senaryo("switcher: liste açılınca kenar çubuğundaki bağlantılar YERİNDE kalır; dışarı tıklama kapatır", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/kanit`);
  const ana = sayfa.locator('.os-gezinme-ana a[href="/dashboard"]').first();
  const bolum = sayfa.locator(".os-gezinme-baglam a[aria-current='page']").first();
  const once = [(await ana.boundingBox()).y, (await bolum.boundingBox()).y];
  await sayfa.locator(".proje-secici-dugme").click();
  await sayfa.locator(".proje-secici-oge").first().waitFor({ timeout: 20000 });
  const sonra = [(await ana.boundingBox()).y, (await bolum.boundingBox()).y];
  bekle(once[0] === sonra[0] && once[1] === sonra[1], `bağlantılar kaydı: ${once} → ${sonra}`);
  const ust = await sayfa.evaluate(() => document.querySelector(".proje-secici-pencere")?.matches(":popover-open"));
  bekle(ust, "liste üst katmanda değil");
  await sayfa.mouse.click(900, 500);
  await sayfa.waitForTimeout(200);
  bekle(!(await sayfa.locator(".proje-secici-pencere").isVisible()), "dışarı tıklama listeyi kapatmadı");
  bekle((await tasma(sayfa)) <= 0, "yatay taşma");
  await ctx.close();
});

await senaryo("switcher: daraltılmış kenar çubuğunda simge listeyi açar, liste ekranın içinde; seçim aynı bölüme gider", async () => {
  const { ctx, sayfa } = await ac(1440, `/dashboard/editor/${TEZ}/kanit`, { dar: true });
  await sayfa.locator(".proje-secici-dugme").click();
  await sayfa.locator(".proje-secici-oge").nth(1).waitFor({ timeout: 20000 });
  const k = await sayfa.locator(".proje-secici-pencere").boundingBox();
  bekle(k && k.x >= 0 && k.x + k.width <= 1440 && k.width >= 260, `pencere: ${JSON.stringify(k)}`);
  await sayfa.locator(".proje-secici-oge").nth(1).click();
  await sayfa.waitForURL((u) => u.pathname.includes(MAKALE), { timeout: 30000 });
  bekle(new URL(sayfa.url()).pathname === `/dashboard/editor/${MAKALE}/kanit`, sayfa.url());
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

/*
  V4.3-B1 (K-1): ray 64 px, kenar çubuğu 236 px (v4 --ray / --kenar-genis).
  Rayda yalnızca simge: her öğenin ERİŞİLEBİLİR adı tam ad olmalı (eskiden
  ad display:none idi, "Daha fazla" düğmesinin adı yoktu), dokunma hedefi
  ≥44 px, adın görünen kopyası klavye odağında çıkan ipucu (ray-ipucu.tsx).
*/
const rayDenetle = async (sayfa, w) => {
  const nav = await sayfa.locator("#os-gezinme").boundingBox();
  bekle(nav && Math.round(nav.width) === 64, `${w}: ray ${nav?.width} px, beklenen 64`);
  const ogeler = await sayfa.locator("#os-gezinme :is(.os-gezinme-oge, .os-gezinme-yeni, .os-gezinme-marka)").evaluateAll((l) =>
    l.filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, sag: r.right, title: e.getAttribute("title") }; }),
  );
  bekle(ogeler.length >= 8, `${w}: rayda ${ogeler.length} öğe`);
  for (const o of ogeler) {
    bekle(o.w >= 44 && o.h >= 44, `${w}: rayda 44 px altı öğe ${JSON.stringify(o)}`);
    bekle(o.sag <= 64.5, `${w}: öğe raydan taşıyor ${JSON.stringify(o)}`);
    bekle(!o.title, `${w}: öğede title var (ipucuyla iki balon olur)`);
  }
  const agac = await sayfa.locator("#os-gezinme").ariaSnapshot();
  for (const ad of ["Ana Sayfa", "Çalışmalarım", "Kaynak Kütüphanesi", "Analiz Merkezi", "Yeni çalışma"]) bekle(agac.includes(`link "${ad}"`), `${w}: erişilebilir ad yok: ${ad}`);
  bekle(!/(link|button)\s*(\[|:|$)/m.test(agac.replace(/link "[^"]+"|button "[^"]+"/g, "")), `${w}: adsız bağlantı/düğme var:\n${agac}`);
};
for (const w of [1024, 768]) {
  await senaryo(`${w}: ray 64 px; öğeler ≥44 px, yalnız simge, erişilebilir adı tam`, async () => {
    const { ctx, sayfa } = await ac(w, "/dashboard");
    await rayDenetle(sayfa, w);
    bekle(!(await gorunur(sayfa, "#os-gezinme .os-gezinme-kisa")), "rayda kısa ad hâlâ görünüyor");
    await ctx.close();
  });
}
await senaryo("1024: klavye odağında ipucu adı gösterir, raydan dışarı çizilir, Esc kapatır; editörde aynı ray", async () => {
  for (const yol of ["/dashboard", `/dashboard/editor/${TEZ}/write`]) {
    const { ctx, sayfa } = await ac(1024, yol);
    let bulundu = false;
    /*
      Editörde Tab belgenin içinde girinti/sekme (Word klavyesi, lib/tiptap-klavye.ts)
      ve odak editörden çıkmıyor; ray oraya ileri Tab'la ulaşılamıyor. Ray DOM'da
      içerikten sonra: sayfanın başından GERİ (Shift+Tab) ilk durak onun.
    */
    const tus = yol.includes("/write") ? "Shift+Tab" : "Tab";
    for (let i = 0; i < 80 && !bulundu; i++) {
      await sayfa.keyboard.press(tus);
      bulundu = await sayfa.evaluate(() => Boolean(document.activeElement?.classList.contains("os-gezinme-oge")));
    }
    bekle(bulundu, `${yol}: Tab ile raya ulaşılamadı`);
    await sayfa.waitForTimeout(150);
    const ad = await sayfa.evaluate(() => document.activeElement.querySelector(".os-gezinme-ad")?.textContent?.trim());
    const ip = sayfa.locator(".ray-ipucu");
    bekle((await ip.textContent().catch(() => null))?.trim() === ad, `${yol}: ipucu "${await ip.textContent().catch(() => null)}", beklenen "${ad}"`);
    const k = await ip.boundingBox();
    bekle(k && k.x >= 64 && k.x + k.width <= 1024, `${yol}: ipucu konumu ${JSON.stringify(k)}`);
    bekle((await ip.getAttribute("aria-hidden")) === "true", "ipucu ikinci kez okunuyor (aria-hidden yok)");
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(100);
    bekle((await ip.count()) === 0, `${yol}: Esc ipucunu kapatmadı`);
    bekle((await sayfa.locator("nav.os-gezinme").count()) === 1, `${yol}: birden fazla ana gezinme`);
    await ctx.close();
  }
});
await senaryo("1440: kenar çubuğu 236 px; daraltılınca 64 px ray ve aynı denetimler", async () => {
  {
    const { ctx, sayfa } = await ac(1440, "/dashboard");
    const nav = await sayfa.locator("#os-gezinme").boundingBox();
    bekle(nav && Math.round(nav.width) === 236, `kenar çubuğu ${nav?.width} px, beklenen 236`);
    bekle(!(await gorunur(sayfa, ".ray-ipucu")), "geniş kenar çubuğunda ipucu çıkıyor");
    await ctx.close();
  }
  const { ctx, sayfa } = await ac(1440, "/dashboard", { dar: true });
  await rayDenetle(sayfa, "1440 dar");
  await ctx.close();
});
for (const w of [390, 360]) {
  await senaryo(`${w}: alt çubukta erişilebilir ad tam ad, hedefler ≥44 px`, async () => {
    const { ctx, sayfa } = await ac(w, "/dashboard");
    const agac = await sayfa.locator("#os-gezinme").ariaSnapshot();
    for (const ad of ["Ana Sayfa", "Çalışmalarım", "Kaynak Kütüphanesi", "Analiz Merkezi"]) bekle(agac.includes(`link "${ad}"`), `${w}: erişilebilir ad yok: ${ad}\n${agac}`);
    bekle(agac.includes('button "Daha fazla"'), `${w}: "Daha fazla" adsız`);
    const kucuk = await sayfa.locator("#os-gezinme li:visible :is(a, button):visible").evaluateAll((l) => l.map((e) => e.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
    bekle(kucuk === 0, `${w}: ${kucuk} hedef 44 px altı`);
    await ctx.close();
  });
}

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
