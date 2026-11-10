/*
  AKADEMİK KÂĞIT GÖRÜNÜMÜ KABULÜ (Phase 4.6 D4, 10.11.2026).

  Karar: uygulama teması ile kâğıt görünümü bağımsız. Açık temada kâğıt
  her zaman açık; koyu temada VARSAYILAN açık kâğıt, kullanıcı isterse
  loş kâğıt. Eskiden koyu temada herkes loş kâğıdı görüyordu. Sınananlar:
    - tema × kâğıt × 360/390/768/1024/1366/1440: kâğıt rengi, belge
      sütunu ve satır kırılımı (iki kâğıtta aynı), yatay taşma yok;
    - kontrol: "⋯" menüsünde, yalnızca koyu temada; adı "Loş kâğıt…",
      aria-pressed seçimi söyler; klavyeyle çalışır;
    - kâğıt değişimi temayı, tema değişimi kâğıt tercihini değiştirmez;
    - yeniden yüklemede kalıcı;
    - kâğıt değişimi sunucuya hiçbir istek göndermez (kayıt / sürüm /
      updated_at yok) ve kayıt durumu "değişti"ye dönmez;
    - geriye uyumluluk göçü: bu sürümden önce koyu temayı açıkça seçmiş
      kullanıcı loş kâğıtla devam eder; sistem teması ve yeni kullanıcı
      açık kâğıt; göç bir kez;
    - panel açık, Arvo AI açık, mobil odak modu loş kâğıtla;
    - yazdırmada kâğıt her iki seçimde de beyaz.
  Önizleme: npm run onizleme
    NODE_PATH=$(npm root -g) node scripts/onizleme/kagit-gorunumu-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const YOL = `/dashboard/editor/${TEZ}/write`;
const BEYAZ = "rgb(255, 255, 255)";
const LOS = "rgb(27, 38, 54)";
let toplam = 0;
const hatalar = [];
const denetle = (kosul, mesaj) => {
  toplam++;
  if (!kosul) hatalar.push(mesaj);
};
const tarayici = await chromium.launch();

/* depo: başlangıç localStorage'ı (null → hiç yazma). gocIsareti yoksa göç ilk açılışta çalışır. */
async function ac(w, depo, { renkSemasi } = {}) {
  const tel = w < 761;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: tel ? 844 : 900 }, hasTouch: w < 1200, isMobile: tel, colorScheme: renkSemasi ?? "light" });
  await ctx.addInitScript((d) => {
    if (sessionStorage.getItem("__kurulu")) return; // yeniden yüklemede depoya dokunma
    sessionStorage.setItem("__kurulu", "1");
    localStorage.clear();
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
  }, depo);
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}${YOL}`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.locator(".ProseMirror").waitFor();
  await sayfa.evaluate(() => document.fonts.ready);
  await sayfa.waitForTimeout(400);
  return { ctx, sayfa };
}

const durum = (sayfa) => sayfa.evaluate(() => {
  const pm = document.querySelector(".ProseMirror"); const s = getComputedStyle(pm);
  const p = [...pm.querySelectorAll("p")].find((x) => x.textContent.trim().length > 120);
  const satir = p ? (() => { const r = document.createRange(); r.selectNodeContents(p); return new Set([...r.getClientRects()].map((k) => Math.round(k.top))).size; })() : 0;
  return {
    kagit: s.backgroundColor, tema: document.documentElement.getAttribute("data-theme"), kagitOz: document.documentElement.getAttribute("data-kagit"),
    sutun: Math.round((pm.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)) * 10) / 10, satir,
    tasma: document.documentElement.scrollWidth > innerWidth + 1,
    depoTema: localStorage.getItem("arvolab.theme"), depoKagit: localStorage.getItem("arvolab.kagit"), goc: localStorage.getItem("arvolab.kagit-gocu"),
    kayit: document.querySelector(".save-status")?.getAttribute("data-state") ?? null,
  };
});

const menuyuAc = async (sayfa) => {
  await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Bul, sayfa ayarı|^Find, page setup/ }).first().click();
  await sayfa.waitForTimeout(150);
};
const kagitDugmesi = (sayfa) => sayfa.getByRole("button", { name: /^Loş kâğıt|^Dim paper/ });
const kapat = (sayfa) => sayfa.keyboard.press("Escape");

/* 1) Tema × kâğıt × genişlik */
for (const w of [360, 390, 768, 1024, 1366, 1440]) {
  let taban = null;
  for (const [tema, kagit, beklenen] of [["light", null, BEYAZ], ["light", "los", BEYAZ], ["dark", null, BEYAZ], ["dark", "los", LOS]]) {
    const ad = `${w} ${tema} kâğıt=${kagit ?? "varsayılan"}`;
    const depo = { "arvolab.theme": tema, "arvolab:inceleme-paneli": "0", "arvolab.kagit-gocu": "1" };
    if (kagit) depo["arvolab.kagit"] = kagit;
    const { ctx, sayfa } = await ac(w, depo);
    const o = await durum(sayfa);
    denetle(o.tema === tema, `${ad}: tema ${o.tema}`);
    denetle(o.kagit === beklenen, `${ad}: kâğıt ${o.kagit} (beklenen ${beklenen})`);
    denetle(!o.tasma, `${ad}: yatay taşma`);
    if (!taban) taban = o; else denetle(o.sutun === taban.sutun && o.satir === taban.satir, `${ad}: geometri değişti (sütun ${taban.sutun}→${o.sutun}, satır ${taban.satir}→${o.satir})`);
    // Kontrol yalnızca koyu temada, menüde.
    await menuyuAc(sayfa);
    const gorunur = await kagitDugmesi(sayfa).first().isVisible().catch(() => false);
    denetle(gorunur === (tema === "dark"), `${ad}: "Loş kâğıt" ${gorunur ? "görünüyor" : "görünmüyor"} (yalnızca koyu temada olmalı)`);
    if (gorunur) denetle((await kagitDugmesi(sayfa).first().getAttribute("aria-pressed")) === String(kagit === "los"), `${ad}: aria-pressed seçimi söylemiyor`);
    await kapat(sayfa);
    await ctx.close();
  }
}

/* 2) Değiştirme: tema değişmez, istek gitmez, kayıt durumu değişmez, kalıcı; klavyeyle de */
{
  const { ctx, sayfa } = await ac(1440, { "arvolab.theme": "dark", "arvolab:inceleme-paneli": "1", "arvolab.kagit-gocu": "1" });
  const once = await durum(sayfa);
  const istekler = [];
  sayfa.on("request", (r) => { if (r.method() !== "GET") istekler.push(`${r.method()} ${r.url()}`); });
  await menuyuAc(sayfa);
  const dugmeVar = await kagitDugmesi(sayfa).first().isVisible().catch(() => false);
  denetle(dugmeVar, "değiştirme: \"Loş kâğıt\" düğmesi yok");
  if (dugmeVar) await kagitDugmesi(sayfa).first().click();
  await sayfa.waitForTimeout(2500); // otomatik kaydın beklemesinden uzun
  const sonra = await durum(sayfa);
  denetle(sonra.kagit === LOS && sonra.kagitOz === "los" && sonra.depoKagit === "los", `değiştirme: loş kâğıda geçmedi (${JSON.stringify(sonra)})`);
  denetle(sonra.tema === "dark" && sonra.depoTema === "dark", "değiştirme: tema değişti");
  denetle(istekler.length === 0, `değiştirme: sunucuya istek gitti (${istekler.join(", ")})`);
  denetle(sonra.kayit === once.kayit, `değiştirme: kayıt durumu ${once.kayit} → ${sonra.kayit}`);
  denetle(sonra.sutun === once.sutun && sonra.satir === once.satir, "değiştirme: geometri değişti");
  await kapat(sayfa);
  await sayfa.reload({ waitUntil: "networkidle" }); await sayfa.locator(".ProseMirror").waitFor(); await sayfa.waitForTimeout(300);
  const yeniden = await durum(sayfa);
  denetle(yeniden.kagit === LOS, `yeniden yükleme: loş kâğıt kalıcı değil (${yeniden.kagit})`);
  // Klavye: menüdeki düğmeye odaklanıp Enter → açık kâğıt.
  await menuyuAc(sayfa);
  const d = kagitDugmesi(sayfa).first();
  if (await d.isVisible().catch(() => false)) {
    await d.focus();
    denetle(await d.evaluate((e) => e === document.activeElement), "klavye: düğme odak alamıyor");
    await sayfa.keyboard.press("Enter"); await sayfa.waitForTimeout(200);
    denetle((await durum(sayfa)).kagit === BEYAZ, "klavye: Enter kâğıdı açığa çevirmedi");
  } else denetle(false, "klavye: düğme yok");
  await ctx.close();
}

/* 3) Tema değişimi kâğıt tercihini değiştirmez */
{
  const { ctx, sayfa } = await ac(1440, { "arvolab.theme": "dark", "arvolab.kagit": "los", "arvolab.kagit-gocu": "1", "arvolab:inceleme-paneli": "0" });
  await sayfa.evaluate(() => localStorage.setItem("arvolab.theme", "light"));
  await sayfa.reload({ waitUntil: "networkidle" }); await sayfa.locator(".ProseMirror").waitFor(); await sayfa.waitForTimeout(300);
  let o = await durum(sayfa);
  denetle(o.tema === "light" && o.kagit === BEYAZ && o.depoKagit === "los", `tema → açık: kâğıt ${o.kagit}, tercih ${o.depoKagit}`);
  await sayfa.evaluate(() => localStorage.setItem("arvolab.theme", "dark"));
  await sayfa.reload({ waitUntil: "networkidle" }); await sayfa.locator(".ProseMirror").waitFor(); await sayfa.waitForTimeout(300);
  o = await durum(sayfa);
  denetle(o.tema === "dark" && o.kagit === LOS, `tema → koyu: loş tercih geri gelmedi (${o.kagit})`);
  await ctx.close();
}

/* 4) Geriye uyumluluk göçü */
for (const [ad, depo, renkSemasi, beklenen, beklenenDepo] of [
  ["açıkça koyu seçmiş eski kullanıcı", { "arvolab.theme": "dark" }, "light", LOS, "los"],
  ["sistem teması (cihaz koyu), tercih yok", {}, "dark", BEYAZ, null],
  ["göç yapılmış, sonradan koyu seçen", { "arvolab.theme": "dark", "arvolab.kagit-gocu": "1" }, "light", BEYAZ, null],
  ["koyu + açık kâğıt tercihi var", { "arvolab.theme": "dark", "arvolab.kagit": "acik" }, "light", BEYAZ, "acik"],
]) {
  const { ctx, sayfa } = await ac(1440, { ...depo, "arvolab:inceleme-paneli": "0" }, { renkSemasi });
  const o = await durum(sayfa);
  denetle(o.kagit === beklenen && o.depoKagit === beklenenDepo && o.goc === "1", `göç (${ad}): kâğıt ${o.kagit}, tercih ${o.depoKagit}, işaret ${o.goc}`);
  await ctx.close();
}

/* 5) Panel açık, Arvo AI açık, mobil odak — loş kâğıtla */
{
  const depo = { "arvolab.theme": "dark", "arvolab.kagit": "los", "arvolab.kagit-gocu": "1" };
  for (const w of [1440, 1024]) {
    const { ctx, sayfa } = await ac(w, { ...depo, "arvolab:inceleme-paneli": "1" });
    const sekme = sayfa.getByRole("tab", { name: /Arvo AI/ }).first();
    if (!(await sekme.isVisible().catch(() => false))) { await sayfa.locator(".yazma-eylemleri").getByRole("button", { name: /Arvo AI/ }).first().click(); await sayfa.waitForTimeout(300); }
    if (await sekme.isVisible().catch(() => false)) await sekme.click();
    await sayfa.waitForTimeout(300);
    const o = await durum(sayfa);
    denetle(o.kagit === LOS && !o.tasma, `${w} Arvo AI açık: kâğıt ${o.kagit}, taşma ${o.tasma}`);
    await ctx.close();
  }
  const { ctx, sayfa } = await ac(390, { ...depo, "arvolab:inceleme-paneli": "0" });
  await menuyuAc(sayfa);
  await sayfa.getByRole("button", { name: /^Odak modu/ }).first().click(); await sayfa.waitForTimeout(250);
  const o = await durum(sayfa);
  const cik = await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Odaktan çık/ }).first().isVisible().catch(() => false);
  denetle(o.kagit === LOS && !o.tasma && cik, `390 odak + loş: kâğıt ${o.kagit}, taşma ${o.tasma}, çıkış ${cik}`);
  await ctx.close();
}

/* 6) Yazdırma: kâğıt her iki seçimde beyaz */
for (const kagit of ["acik", "los"]) {
  const { ctx, sayfa } = await ac(1440, { "arvolab.theme": "dark", "arvolab.kagit": kagit, "arvolab.kagit-gocu": "1", "arvolab:inceleme-paneli": "0" });
  await sayfa.emulateMedia({ media: "print" });
  const baski = await sayfa.evaluate(() => getComputedStyle(document.querySelector(".ProseMirror")).backgroundColor);
  denetle(baski === BEYAZ, `yazdırma (${kagit}): kâğıt ${baski}`);
  await ctx.close();
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Kâğıt görünümü kabulü: ${hatalar.length} denetim düştü (${toplam - hatalar.length}/${toplam})` : `Kâğıt görünümü kabulü temiz (${toplam} denetim)`);
process.exit(hatalar.length ? 1 : 0);
