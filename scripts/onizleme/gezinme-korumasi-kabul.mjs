/*
  GEZİNME KORUMASI KABULÜ (Signature OS 2.0 Aşama 2, 08.11.2026).

  Şart (kurum sahibi): "Project Switcher ve diğer navigasyon geçişlerinde
  kaydedilmemiş metin kaybı olmamalı. Otomatik kayıt tamamlanmadan güvenli
  olmayan geçişe izin verme. Bu davranışı gerçek senaryolarla test et."

  Her senaryo editöre benzersiz bir işaret yazar ve HEMEN geçiş dener
  (otomatik kayıt zamanlayıcısı henüz çalışmadan). Metnin kaybolmadığı,
  yerel taslaktan değil SUNUCUDAN geldiği, boş tarayıcı depolamalı YENİ bir
  oturumda editör açılarak doğrulanır. Kayıt isteği Playwright ile
  yavaşlatılır ya da düşürülür (yalnızca belge kaydı: gövdesinde "content"
  olan sunucu eylemi).

  ÖNKOŞUL: yazma modu önizlemesi (ONIZLEME_YAZ=1 npm run onizleme:ai) ve
  TAZE sunucu (sahte veri bellekte; yazılan işaretler birikir ama
  benzersiz oldukları için senaryolar birbirini etkilemez).
    node scripts/onizleme/gezinme-korumasi-kabul.mjs [taban]
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const YAZIM = `${TABAN}/dashboard/editor/${TEZ}/write`;

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
    console.log(`✗ ${ad}\n    ${String(hata?.message ?? hata).split("\n")[0].slice(0, 220)}`);
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

async function editorAc(ctx) {
  const sayfa = await ctx.newPage();
  await sayfa.goto(YAZIM, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  // Belge yüklendi mi: kaydedilmiş durum çizilene kadar (ilk yüklemede kirli sayılmasın).
  await sayfa.waitForTimeout(800);
  return sayfa;
}

async function yaz(sayfa) {
  const isaret = `KORUMA${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ed = sayfa.locator(".ProseMirror").first();
  await ed.click({ position: { x: 40, y: 40 } });
  await sayfa.keyboard.press("Control+End");
  await sayfa.keyboard.type(` ${isaret}`, { delay: 5 });
  return isaret;
}

/** Sunucuda mı? Boş depolamalı yeni oturumda editörü açıp bakar. */
async function sunucudaMi(isaret) {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  const var_ = await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret);
  await ctx.close();
  return var_;
}

const kayitIstegiMi = (istek) => istek.method() === "POST" && Boolean(istek.headers()["next-action"]) && (istek.postData() ?? "").includes('"content"');

await senaryo("temiz editörde geçiş beklemeden olur (kayıt yok, durum etiketi yok)", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  let kayit = 0;
  s.on("request", (r) => kayitIstegiMi(r) && kayit++);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 20000 });
  bekle(kayit === 0, `temiz editör ${kayit} kayıt gönderdi`);
  await ctx.close();
});

await senaryo("yazdıktan HEMEN sonra kenar çubuğundan çıkış: önce kaydedilir, metin sunucuda", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "yazılan metin sunucuda yok");
});

await senaryo("yavaş kayıt (3 sn): geçiş kayıt bitene kadar bekler, durum etiketi görünür", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", async (route) => {
    if (kayitIstegiMi(route.request())) await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForTimeout(800);
  bekle(s.url().startsWith(YAZIM), `kayıt sürerken sayfadan çıkıldı: ${s.url()}`);
  bekle(await s.locator(".gecis-durumu").isVisible(), "kayıt sürerken durum etiketi görünmüyor");
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await s.unroute("**/*");
  await ctx.close();
  bekle(await sunucudaMi(isaret), "yavaş kayıttan sonra metin sunucuda yok");
});

await senaryo("kayıt DÜŞERSE geçiş olmaz; uyarı çıkar, 'Sayfada kal' metni editörde bırakır", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard/literature"]').first().click();
  const uyari = s.getByRole("dialog").filter({ hasText: /kaydedilemedi|couldn't be saved/ });
  await uyari.waitFor({ state: "visible", timeout: 30000 });
  bekle(s.url().startsWith(YAZIM), `kayıt düştüğü hâlde sayfadan çıkıldı: ${s.url()}`);
  await uyari.getByRole("button", { name: /Sayfada kal|Stay on this page/ }).click();
  await uyari.waitFor({ state: "hidden", timeout: 5000 });
  bekle(s.url().startsWith(YAZIM), "Sayfada kal sonrası sayfa değişti");
  bekle(await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret), "metin editörden kayboldu");
  // Bağlantı geri gelince yeniden denemek kaydeder ve geçer.
  await s.unroute("**/*");
  await s.locator('#os-gezinme a[href="/dashboard/literature"]').first().click();
  await s.waitForURL(/\/dashboard\/literature/, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "bağlantı dönünce kaydedilen metin sunucuda yok");
});

await senaryo("kayıt düşerken ÇIKIŞ yapılamaz (form da korunur)", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  await yaz(s);
  await s.locator("details.os-kullanici > summary").first().click();
  const cikis = s.locator(".os-kullanici-cikis button[type='submit'], .os-kullanici-cikis button").first();
  if (!(await cikis.isVisible().catch(() => false))) {
    // Menü düğmesinin sınıfı değişirse: formu doğrudan gönder (aynı yol).
    await s.locator("form.os-kullanici-cikis").evaluate((f) => f.requestSubmit());
  } else await cikis.click();
  await s.getByRole("dialog").filter({ hasText: /kaydedilemedi|couldn't be saved/ }).waitFor({ state: "visible", timeout: 30000 });
  bekle(s.url().startsWith(YAZIM), `kayıt düşerken çıkış yapıldı: ${s.url()}`);
  await s.unroute("**/*");
  await s.getByRole("button", { name: /Sayfada kal|Stay on this page/ }).click();
  // Temiz bırak: kaydı tamamla ki sonraki senaryolar kirli taslakla açılmasın.
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(1500);
  await ctx.close();
});

await senaryo("Ctrl+K ile geçiş: önce kaydedilir, metin sunucuda", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  const isaret = await yaz(s);
  await s.keyboard.press("Control+k");
  const kutu = s.locator(".os-palette-input input");
  await kutu.waitFor({ state: "visible", timeout: 5000 });
  await kutu.fill("Belge Kontrol");
  await s.keyboard.press("Enter");
  await s.waitForURL(/\/dashboard\/documents/, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "Ctrl+K geçişinden sonra metin sunucuda yok");
});

await senaryo("yeni sekmede açma (Ctrl+tık) araya girmez: editör yerinde kalır", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await yaz(s);
  const yeni = ctx.waitForEvent("page", { timeout: 10000 }).catch(() => null);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click({ modifiers: ["Control"] });
  await yeni;
  bekle(s.url().startsWith(YAZIM), "Ctrl+tık bu sekmeyi değiştirdi");
  bekle(!(await s.locator(".gecis-durumu").isVisible()), "Ctrl+tıkta durum etiketi çıktı");
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(1500);
  await ctx.close();
});

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
