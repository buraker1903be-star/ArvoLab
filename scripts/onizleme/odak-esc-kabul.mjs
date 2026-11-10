/*
  ODAK MODUNDAN Esc İLE ÇIKIŞ KABULÜ (Phase 4.6 TB-3, 10.11.2026).

  Eskiden tablet ve masaüstünde Esc odak modundan HİÇ çıkarmıyordu
  (düğmenin etiketi "Odak modundan çık (Esc)" dediği hâlde). İki neden
  vardı, ikisi de tarayıcıda doğrulandı:
    1) Kapalı çekmeceler DOM'da role="dialog" taşıyor (18 adet, inert);
       işleyicinin "açık pencere var mı" denetimi
       (document.querySelector("dialog[open], [role=dialog]")) hep "var"
       diyordu.
    2) ProseMirror editör içindeki HER Esc'te koşulsuz preventDefault
       çağırıyor (prosemirror-view captureKeyDown: code 27 → true);
       işleyicinin "!e.defaultPrevented" denetimi editörde hiç geçmiyordu.
  Bu betik 768 / 1024 / 1440 px'te:
    - odakta editörden Esc → odaktan çıkar; imleç editörde kalır, belge
      ve seçim değişmez, sunucuya istek gitmez, kayıt durumu değişmez;
    - "⋯" menüsü açıkken Esc önce menüyü kapatır, odak sürer; ikinci Esc çıkar;
    - bul şeridinde Esc önce şeridi kapatır, odak sürer; ikinci Esc çıkar;
    - Esc ile çıktıktan sonra Tab yine girinti yapar (editörden çıkış
      kurulmamış), Ctrl+B ve Ctrl+Z çalışır;
    - (--ai) satır içi öneri açıkken Esc önce öneriyi kapatır, odak sürer;
    - 390 px: odak çıkış düğmesi (D1) görünür ve çalışır.
  Önizleme: npm run onizleme   (--ai için: npm run onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/odak-esc-kabul.mjs [taban] [--ai]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const arg = process.argv.slice(2);
const AI = arg.includes("--ai");
const TABAN = arg.find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("odak-esc-kabul", TABAN, AI ? "ai" : "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let toplam = 0;
const hatalar = [];
const denetle = (kosul, mesaj) => {
  toplam++;
  if (!kosul) hatalar.push(mesaj);
};
const tarayici = await chromium.launch();

async function ac(w) {
  const tel = w < 761;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: tel ? 844 : 900 }, hasTouch: w < 1200, isMobile: tel });
  await ctx.addInitScript(() => { localStorage.setItem("arvolab:inceleme-paneli", "0"); localStorage.setItem("arvolab.theme", "light"); });
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.locator(".ProseMirror").waitFor();
  await sayfa.waitForTimeout(400);
  return { ctx, sayfa };
}
const odakta = (sayfa) => sayfa.evaluate(() => Boolean(document.querySelector(".manuscript-layout[data-odak]")));
const durum = (sayfa) => sayfa.evaluate(() => {
  const ed = document.querySelector(".ProseMirror").editor;
  return { json: JSON.stringify(ed.getJSON()), secim: `${ed.state.selection.from}-${ed.state.selection.to}`, editordeOdak: document.querySelector(".ProseMirror").contains(document.activeElement), kayit: document.querySelector(".save-status")?.getAttribute("data-state") ?? null };
});
async function odakAc(sayfa) {
  const cubukta = sayfa.locator(".manuscript-araclar [data-arac-grup=odak]:not([hidden]) button");
  if (await cubukta.count()) await cubukta.first().click();
  else {
    await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Bul, sayfa ayarı|^Find, page setup/ }).first().click();
    await sayfa.getByRole("button", { name: /^Odak modu|^Focus mode/ }).first().click();
  }
  await sayfa.waitForTimeout(200);
}
async function imleciKoy(sayfa) {
  await sayfa.evaluate(() => {
    const ed = document.querySelector(".ProseMirror").editor;
    let son = 0;
    ed.state.doc.descendants((n, pos) => { if (n.type.name === "paragraph" && n.textContent.length > 80 && !son) son = pos + n.nodeSize - 1; });
    ed.chain().focus().setTextSelection(son).run();
  });
  await sayfa.waitForTimeout(100);
}

for (const w of [1440, 1024, 768]) {
  // S1: editörden Esc → odaktan çıkış; belge, seçim, kayıt değişmez; istek yok.
  {
    const ad = `${w} editörden Esc`;
    const { ctx, sayfa } = await ac(w);
    await odakAc(sayfa);
    await imleciKoy(sayfa);
    denetle(await odakta(sayfa), `${ad}: odak açılamadı`);
    const once = await durum(sayfa);
    const istekler = [];
    sayfa.on("request", (r) => { if (r.method() !== "GET") istekler.push(`${r.method()} ${r.url()}`); });
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(1800);
    const sonra = await durum(sayfa);
    denetle(!(await odakta(sayfa)), `${ad}: Esc odaktan çıkarmadı`);
    denetle(sonra.json === once.json, `${ad}: belge değişti`);
    denetle(sonra.secim === once.secim, `${ad}: seçim değişti (${once.secim} → ${sonra.secim})`);
    denetle(sonra.editordeOdak, `${ad}: imleç editörden çıktı`);
    denetle(sonra.kayit === once.kayit, `${ad}: kayıt durumu ${once.kayit} → ${sonra.kayit}`);
    denetle(istekler.length === 0, `${ad}: sunucuya istek gitti (${istekler.join(", ")})`);
    // Esc ile çıktıktan sonra Tab girinti yapar (editörden çıkış KURULMAMIŞ); Ctrl+Z geri alır.
    const tabOnce = (await durum(sayfa)).json;
    await sayfa.keyboard.press("Tab"); await sayfa.waitForTimeout(150);
    const tabSonra = await durum(sayfa);
    denetle(tabSonra.editordeOdak && tabSonra.json !== tabOnce, `${ad}: Esc'ten sonra Tab girinti yapmadı (odak editörde: ${tabSonra.editordeOdak})`);
    await sayfa.keyboard.press("Control+z"); await sayfa.waitForTimeout(150);
    denetle((await durum(sayfa)).json === tabOnce, `${ad}: Ctrl+Z girintiyi geri almadı`);
    await ctx.close();
  }
  // S2: menü açıkken Esc önce menüyü kapatır.
  {
    const ad = `${w} menü açıkken Esc`;
    const { ctx, sayfa } = await ac(w);
    await odakAc(sayfa);
    await imleciKoy(sayfa);
    await sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Bul, sayfa ayarı|^Find, page setup/ }).first().click();
    await sayfa.waitForTimeout(150);
    const menuAcik = () => sayfa.evaluate(() => Boolean(document.querySelector(".arac-menu-pencere:not([hidden])")));
    denetle(await menuAcik(), `${ad}: menü açılmadı`);
    await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(150);
    denetle(!(await menuAcik()), `${ad}: Esc menüyü kapatmadı`);
    denetle(await odakta(sayfa), `${ad}: Esc menüyle birlikte odaktan da çıktı (önce katman kapanmalı)`);
    await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(150);
    denetle(!(await odakta(sayfa)), `${ad}: ikinci Esc odaktan çıkarmadı`);
    await ctx.close();
  }
  // S3: bul şeridinde Esc önce şeridi kapatır.
  {
    const ad = `${w} bul şeridinde Esc`;
    const { ctx, sayfa } = await ac(w);
    await odakAc(sayfa);
    await imleciKoy(sayfa);
    await sayfa.keyboard.press("Control+f");
    const serit = sayfa.locator(".manuscript-ust");
    const acildi = await serit.waitFor({ timeout: 5000 }).then(() => true, () => false);
    denetle(acildi, `${ad}: bul şeridi açılmadı`);
    if (acildi) {
      await sayfa.keyboard.type("enflasyon"); await sayfa.waitForTimeout(200);
      await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(200);
      denetle(!(await serit.count()) || !(await serit.isVisible()), `${ad}: Esc bul şeridini kapatmadı`);
      denetle(await odakta(sayfa), `${ad}: Esc şeritle birlikte odaktan da çıktı`);
      await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(150);
      denetle(!(await odakta(sayfa)), `${ad}: ikinci Esc odaktan çıkarmadı`);
    }
    await ctx.close();
  }
  // S4: odakta öteki kısayollar çalışır (Ctrl+B kalın, Ctrl+Z geri alır).
  {
    const ad = `${w} kısayollar`;
    const { ctx, sayfa } = await ac(w);
    await odakAc(sayfa);
    await imleciKoy(sayfa);
    await sayfa.keyboard.press("Shift+Home"); await sayfa.waitForTimeout(80);
    const once = (await durum(sayfa)).json;
    await sayfa.keyboard.press("Control+b"); await sayfa.waitForTimeout(150);
    const kalin = (await durum(sayfa)).json;
    denetle(kalin !== once && /"bold"/.test(kalin), `${ad}: Ctrl+B kalın yapmadı`);
    await sayfa.keyboard.press("Control+z"); await sayfa.waitForTimeout(150);
    denetle((await durum(sayfa)).json === once, `${ad}: Ctrl+Z geri almadı`);
    denetle(await odakta(sayfa), `${ad}: kısayollar odaktan çıkardı`);
    await ctx.close();
  }
  // S5 (--ai): satır içi öneri açıkken Esc önce öneriyi kapatır.
  if (AI) {
    const ad = `${w} satır içi öneri açıkken Esc`;
    const { ctx, sayfa } = await ac(w);
    await odakAc(sayfa);
    await imleciKoy(sayfa);
    await sayfa.keyboard.press("Alt+/");
    const geldi = await sayfa.locator(".ProseMirror .satir-ici-oneri").waitFor({ timeout: 20000 }).then(() => true, () => false);
    denetle(geldi, `${ad}: öneri gelmedi`);
    if (geldi) {
      const once = (await durum(sayfa)).json;
      await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(200);
      denetle((await sayfa.locator(".ProseMirror .satir-ici-oneri").count()) === 0, `${ad}: Esc öneriyi kapatmadı`);
      denetle(await odakta(sayfa), `${ad}: Esc öneriyle birlikte odaktan da çıktı`);
      denetle((await durum(sayfa)).json === once, `${ad}: Esc öneriyi belgeye yazdı`);
      await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(150);
      denetle(!(await odakta(sayfa)), `${ad}: ikinci Esc odaktan çıkarmadı`);
    }
    await ctx.close();
  }
}

// S6: telefon (D1) — görünür çıkış düğmesi korunur ve çalışır.
{
  const { ctx, sayfa } = await ac(390);
  await odakAc(sayfa);
  const cik = sayfa.locator(".manuscript-araclar").getByRole("button", { name: /^Odaktan çık|^Exit focus/ }).first();
  const k = (await cik.isVisible().catch(() => false)) ? await cik.boundingBox() : null;
  denetle(k && k.width >= 43.5 && k.height >= 43.5, `390: "Odaktan çık" görünmüyor ya da 44 px'ten küçük`);
  if (k) { await cik.click(); await sayfa.waitForTimeout(200); denetle(!(await odakta(sayfa)), "390: \"Odaktan çık\" çıkarmadı"); }
  await ctx.close();
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Odak Esc kabulü: ${hatalar.length} denetim düştü (${toplam - hatalar.length}/${toplam})` : `Odak Esc kabulü temiz (${toplam} denetim${AI ? ", satır içi öneri dahil" : ""})`);
process.exit(hatalar.length ? 1 : 0);
