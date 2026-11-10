/*
  DOKUNMA HEDEFLERİ VE MOBİL ATIF ODAĞI KABULÜ (UX M2 + M3, 07.11.2026).

  360 / 390 / 768 / 1024 (dokunmatik) × açık/koyu:
    - AI panelinin kapat düğmesi en az 40×40;
    - atıf penceresinde görünen her giriş, seçim kutusu, sekme ve
      kapsam düğmesi en az 40 piksel yüksek; pencere ekranın içinde;
    - kaynak kütüphanesinde DOI "Ekle" ve Kaynakça kartının düğmesi 40×40;
    - telefonda atıf penceresi açılınca odak bir giriş alanında DEĞİL
      (sanal klavye açılmasın).
  1440 (fare) × açık: atıf penceresi açılınca odak Sayfa alanında (klavye
  erişimi eskisi gibi).
  Hepsinde: Esc ile kapanınca odak editöre döner; listeden kaynak
  seçilince atıf imlecin olduğu yere girer ve odak editörde kalır.
  Atıf ekleme yalnızca tarayıcıdaki belgeyi değiştirir (önizleme salt
  okunurken kayıt sahte istemciye gider).
    npm run onizleme     (ya da onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/dokunma-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("dokunma-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let hata = 0;
let denetim = 0;
const bekle = (kosul, mesaj) => {
  denetim++;
  if (!kosul) {
    hata++;
    console.log(`✗ ${mesaj}`);
  }
};

const kucukler = (sayfa, secici, yalnizYukseklik = false) =>
  sayfa.evaluate(
    ([sec, yy]) =>
      [...document.querySelectorAll(sec)]
        .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { ad: (e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((x) => x.h < 39.5 || (!yy && x.w < 39.5))
        .map((x) => `${x.ad} ${x.w}×${x.h}`),
    [secici, yalnizYukseklik],
  );

const odak = (sayfa) =>
  sayfa.evaluate(() => {
    const a = document.activeElement;
    if (!a) return "yok";
    if (a.closest(".ProseMirror")) return "editör";
    return a.matches("input, textarea, select") ? `alan:${a.getAttribute("placeholder") ?? a.getAttribute("aria-label") ?? ""}` : a.tagName.toLowerCase();
  });

const tarayici = await chromium.launch();
const durumlar = [
  ...[360, 390, 768, 1024].flatMap((w) => ["light", "dark"].map((tema) => ({ w, tema, dokunma: true }))),
  { w: 1440, tema: "light", dokunma: false },
];
for (const { w, tema, dokunma } of durumlar) {
  const ad = `${w} ${tema}${dokunma ? " dokunma" : " fare"}`;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 800 : 900 }, hasTouch: dokunma, isMobile: dokunma && w < 761 });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("arvolab.theme", t);
    } catch {}
  }, tema);
  const sayfa = await ctx.newPage();
  const bas = (loc) => (dokunma ? loc.tap() : loc.click());

  if (dokunma) {
    // Kaynak kütüphanesi: DOI "Ekle" ve Kaynakça kartının düğmesi.
    await sayfa.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
    await sayfa.locator(".kaynak-satiri").first().waitFor({ timeout: 30000 });
    const k = await kucukler(sayfa, ".doi-kutusu button, .kaynaklar-ikili .gb-kart-bas button");
    bekle(k.length === 0, `${ad}: kütüphane 40×40 altı: ${k.join("; ")}`);
  }

  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 30000 });
  await sayfa.waitForTimeout(600);

  if (dokunma) {
    await bas(sayfa.locator("button.yazma-ai").first());
    await sayfa.locator("#yazim-yan-panel .yazim-girdi textarea").waitFor({ timeout: 15000 });
    const k = await kucukler(sayfa, "#yazim-yan-panel .yan-panel-kapat");
    bekle(k.length === 0, `${ad}: panel kapat 40×40 altı: ${k.join("; ")}`);
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(300);
  }

  // İmleci bir paragrafın içine koy; atıf oraya girmeli.
  const p = sayfa.locator(".ProseMirror p").nth(3);
  await p.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pk = await p.boundingBox();
  await sayfa.mouse.click(pk.x + 30, pk.y + 6);
  const once = await sayfa.evaluate(() => {
    const r = getSelection().getRangeAt(0);
    return { metin: r.startContainer.textContent, o: r.startOffset };
  });

  const atif = sayfa.locator('.manuscript-araclar [aria-label="Kaynaktan atıf ekle"]').first();
  await bas(atif);
  const pencere = sayfa.locator(".drawer-root.open [role=dialog]").last();
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  // Telefonda alttan kayan sayfa: konum, açılış animasyonu bittikten sonra ölçülür.
  await pencere.evaluate((d) => Promise.all(d.getAnimations({ subtree: false }).map((a) => a.finished)));
  await sayfa.waitForTimeout(500);
  const acilis = await odak(sayfa);
  if (w < 761) bekle(!acilis.startsWith("alan:"), `${ad}: telefonda atıf penceresi açılınca odak giriş alanında (${acilis})`);
  if (!dokunma) bekle(acilis.startsWith("alan:ör. 14"), `${ad}: masaüstünde odak Sayfa alanında değil (${acilis})`);
  if (dokunma) {
    const k = await kucukler(sayfa, ".drawer-root.open [role=dialog] :is(input, select, [role=tab], .picker-kapsam button, .drawer-close)", true);
    bekle(k.length === 0, `${ad}: atıf penceresinde 40 altı: ${k.join("; ")}`);
  }
  const ekranda = await pencere.evaluate((d) => {
    const r = d.getBoundingClientRect();
    return r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  });
  bekle(ekranda, `${ad}: atıf penceresi ekranın dışına taşıyor`);
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(300);
  bekle((await odak(sayfa)) === "editör", `${ad}: Esc sonrası odak editöre dönmedi`);

  await bas(atif);
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  await sayfa.waitForTimeout(400);
  await bas(sayfa.locator(".drawer-root.open .picker-main").first());
  await sayfa.waitForTimeout(600);
  const sonra = await sayfa.evaluate(() => {
    const r = getSelection().getRangeAt(0);
    return { metin: r.startContainer.textContent, o: r.startOffset };
  });
  const yerinde = sonra.metin.startsWith(once.metin.slice(0, once.o)) && sonra.metin.endsWith(once.metin.slice(once.o)) && sonra.metin.length > once.metin.length;
  bekle(yerinde, `${ad}: atıf imlecin olduğu yere girmedi`);
  bekle((await odak(sayfa)) === "editör", `${ad}: atıftan sonra odak editörde değil`);
  console.log(`${ad}: açılışta odak ${acilis}`);
  await ctx.close();
}
await tarayici.close();
console.log(hata ? `\n${hata}/${denetim} denetim düştü` : `\nDokunma kabulü temiz (${denetim} denetim)`);
process.exit(hata ? 1 : 0);
