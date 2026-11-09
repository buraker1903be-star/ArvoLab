/*
  KLAVYE KABULÜ (V4.3-B2, 09.11.2026) — editörden klavyeyle çıkış ve
  gezinmenin klavye sırası.

  Sınanan:
    1. Gezinme içerikten ÖNCE: sayfanın başından Tab "atla bağlantısı →
       ana gezinme" (eskiden gezinme DOM'da en sondaydı). Ekran okuyucu
       ağacında da gezinme ana içerikten önce.
    2. Klavyeyle editöre giriş: Tab'la editöre ulaşılır.
    3. Tab editörde girinti/sekme olarak KALIR (Word klavyesi, 27.10.2026).
    4. Esc, ardından Tab: odak editörün dışındaki SONRAKİ denetime geçer;
       Esc, ardından Shift+Tab: ÖNCEKİ denetime. Bu tuşlar belgeyi
       değiştirmez, kayıt isteği göndermez, AI kartı kabul etmez.
    5. Dışarıdan Shift+Tab editöre geri döner.
    6. Esc'ten sonra başka bir tuş kurulumu bozar: Tab yine girinti.
    7. Esc önceliği: satır içi öneri açıkken Esc yalnızca öneriyi kapatır,
       çıkış kurulmaz; atıf penceresi açıkken Esc pencereyi kapatır,
       belge değişmez; telefonda AI paneli açıkken Esc paneli kapatır,
       belge ve kartlar değişmez.
  Önizleme: ONIZLEME_YAZ=1 npm run onizleme:ai (satır içi öneri ve AI paneli için)
    NODE_PATH=$(npm root -g) node scripts/onizleme/klavye-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir senaryo düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
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
    console.log(`✗ ${ad}\n    ${String(hata?.message ?? hata).split("\n")[0].slice(0, 260)}`);
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};
async function ac(w, yol) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: w < 761 ? 844 : 900 }, hasTouch: w < 1200, isMobile: w < 761 });
  const sayfa = await ctx.newPage();
  await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 180000 });
  return { ctx, sayfa };
}
const EDITOR = `/dashboard/editor/${TEZ}/write`;
const belgeJson = (s) => s.evaluate(() => JSON.stringify(document.querySelector(".ProseMirror").editor.getJSON()));
const editordeMi = (s) => s.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
const odakAdi = (s) => s.evaluate(() => {
  const e = document.activeElement;
  return `${e?.tagName.toLowerCase()}.${e?.classList[0] ?? ""} «${(e?.getAttribute("aria-label") || e?.textContent || "").trim().slice(0, 30)}»`;
});
/** İmleci uzun bir paragrafın başına koyar ve editöre odaklanır (klavyeyle girişi ayrı senaryo sınıyor). */
const paragrafBasi = (s, n = 0) =>
  s.evaluate((n) => {
    const ed = document.querySelector(".ProseMirror").editor;
    const hedefler = [];
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent.length > 80 && !node.attrs.firstLineIndent) hedefler.push(pos + 1);
    });
    ed.chain().focus().setTextSelection(hedefler[n]).run();
  }, n);
/** Belgeyi değiştiren ya da kaydeden istekleri sayar (sunucu eylemi POST'ları). */
const istekSayaci = (s) => {
  let n = 0;
  s.on("request", (r) => {
    if (r.method() === "POST") n++;
  });
  return () => n;
};

await senaryo("1440/1024/390: sayfanın başından Tab sırası 'İçeriğe atla → ana gezinme'; gezinme ekran okuyucu ağacında içerikten önce", async () => {
  for (const w of [1440, 1024, 390]) {
    const { ctx, sayfa } = await ac(w, "/dashboard");
    await sayfa.keyboard.press("Tab");
    bekle(await sayfa.evaluate(() => document.activeElement?.classList.contains("skip-link")), `${w}: ilk Tab atla bağlantısında değil (${await odakAdi(sayfa)})`);
    await sayfa.keyboard.press("Tab");
    bekle(await sayfa.evaluate(() => Boolean(document.activeElement?.closest("#os-gezinme"))), `${w}: ikinci Tab gezinmede değil (${await odakAdi(sayfa)})`);
    const sira = await sayfa.evaluate(() => {
      const nav = document.querySelector("#os-gezinme");
      const icerik = document.querySelector("#panel-icerik");
      return Boolean(nav.compareDocumentPosition(icerik) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    bekle(sira, `${w}: gezinme DOM'da içerikten sonra`);
    await ctx.close();
  }
});

await senaryo("1440: klavyeyle editöre giriş (Tab ile .ProseMirror'a ulaşılır)", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  let ulasti = false;
  for (let i = 0; i < 150 && !ulasti; i++) {
    await sayfa.keyboard.press("Tab");
    ulasti = await editordeMi(sayfa);
  }
  bekle(ulasti, "150 Tab'da editöre ulaşılamadı");
  await ctx.close();
});

await senaryo("1440: Tab editörde girinti/sekme olarak kalır (odak editörde)", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  await paragrafBasi(sayfa);
  const once = await belgeJson(sayfa);
  await sayfa.keyboard.press("Tab");
  bekle(await editordeMi(sayfa), `Tab editörden çıktı (${await odakAdi(sayfa)})`);
  bekle((await belgeJson(sayfa)) !== once, "Tab girinti yapmadı (belge değişmedi)");
  await ctx.close();
});

await senaryo("1440: Esc → Tab sonraki denetime, Esc → Shift+Tab önceki denetime; belge, kayıt ve AI değişmez", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  const istekler = istekSayaci(sayfa);
  await paragrafBasi(sayfa);
  await sayfa.waitForTimeout(1500);
  const once = await belgeJson(sayfa);
  const kartlar = await sayfa.locator(".yazim-oneri").count();
  const istekOnce = istekler();
  await sayfa.keyboard.press("Escape");
  await sayfa.keyboard.press("Tab");
  bekle(!(await editordeMi(sayfa)), `Esc→Tab editörden çıkmadı (${await odakAdi(sayfa)})`);
  const ileri = await sayfa.evaluate(() => Boolean(document.querySelector(".ProseMirror").compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING));
  bekle(ileri, `Tab ileri değil, öndeki bir öğeye gitti (${await odakAdi(sayfa)})`);
  // Dışarıdan Shift+Tab editöre geri döner.
  await sayfa.keyboard.press("Shift+Tab");
  bekle(await editordeMi(sayfa), `Shift+Tab editöre dönmedi (${await odakAdi(sayfa)})`);
  await sayfa.keyboard.press("Escape");
  await sayfa.keyboard.press("Shift+Tab");
  bekle(!(await editordeMi(sayfa)), "Esc→Shift+Tab editörden çıkmadı");
  const geri = await sayfa.evaluate(() => Boolean(document.querySelector(".ProseMirror").compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_PRECEDING));
  bekle(geri, `Shift+Tab geri değil (${await odakAdi(sayfa)})`);
  await sayfa.waitForTimeout(2500);
  bekle((await belgeJson(sayfa)) === once, "çıkış tuşları belgeyi değiştirdi");
  bekle(istekler() === istekOnce, `çıkış tuşları ${istekler() - istekOnce} istek gönderdi (kayıt/AI tetiklenmemeli)`);
  bekle((await sayfa.locator(".yazim-oneri").count()) === kartlar, "AI kartı sayısı değişti");
  await ctx.close();
});

await senaryo("1440: Esc'ten sonra başka bir tuş kurulumu bozar; Tab yine girinti yapar", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  await paragrafBasi(sayfa, 1);
  await sayfa.keyboard.press("Escape");
  await sayfa.keyboard.press("ArrowRight");
  await sayfa.keyboard.press("ArrowLeft");
  const once = await belgeJson(sayfa);
  await sayfa.keyboard.press("Tab");
  bekle(await editordeMi(sayfa), `bozulmuş kurulumla Tab editörden çıktı (${await odakAdi(sayfa)})`);
  bekle((await belgeJson(sayfa)) !== once, "Tab girinti yapmadı");
  await ctx.close();
});

await senaryo("1440: satır içi öneri açıkken Esc yalnızca öneriyi kapatır, çıkış kurulmaz", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  await sayfa.evaluate(() => {
    const ed = document.querySelector(".ProseMirror").editor;
    let son = 0;
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent.length > 80 && !son) son = pos + node.nodeSize - 1;
    });
    ed.chain().focus().setTextSelection(son).run();
  });
  await sayfa.keyboard.press("Alt+/");
  await sayfa.locator(".ProseMirror .satir-ici-oneri").waitFor({ timeout: 20000 });
  const once = await belgeJson(sayfa);
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(150);
  bekle((await sayfa.locator(".ProseMirror .satir-ici-oneri").count()) === 0, "Esc öneriyi kapatmadı");
  bekle((await belgeJson(sayfa)) === once, "Esc öneriyi belgeye yazdı");
  await sayfa.keyboard.press("Tab");
  bekle(await editordeMi(sayfa), `öneriyi kapatan Esc çıkışı da kurdu: Tab editörden çıktı (${await odakAdi(sayfa)})`);
  await ctx.close();
});

await senaryo("1440: atıf penceresi açıkken Esc pencereyi kapatır, belge değişmez", async () => {
  const { ctx, sayfa } = await ac(1440, EDITOR);
  await paragrafBasi(sayfa);
  const once = await belgeJson(sayfa);
  await sayfa.locator('.manuscript-araclar [aria-label="Kaynaktan atıf ekle"]').first().click();
  const pencere = sayfa.locator(".drawer-root.open [role=dialog]").last();
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(400);
  bekle(!(await pencere.isVisible().catch(() => false)), "Esc atıf penceresini kapatmadı");
  bekle((await belgeJson(sayfa)) === once, "Esc ile pencere kapanırken belge değişti");
  await ctx.close();
});

await senaryo("390: AI paneli açıkken Esc paneli kapatır; belge ve kartlar değişmez", async () => {
  const { ctx, sayfa } = await ac(390, EDITOR);
  const once = await belgeJson(sayfa);
  await sayfa.locator("button.yazma-ai").first().click();
  const girdi = sayfa.locator("#yazim-yan-panel .yazim-girdi textarea");
  await girdi.waitFor({ timeout: 15000 });
  await girdi.focus();
  const kartlar = await sayfa.locator(".yazim-oneri").count();
  await sayfa.keyboard.press("Escape");
  await sayfa.waitForTimeout(400);
  bekle(!(await girdi.isVisible().catch(() => false)), "Esc AI panelini kapatmadı");
  bekle((await belgeJson(sayfa)) === once, "Esc ile panel kapanırken belge değişti");
  bekle((await sayfa.locator(".yazim-oneri").count()) === kartlar, "AI kartı sayısı değişti");
  await ctx.close();
});

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
