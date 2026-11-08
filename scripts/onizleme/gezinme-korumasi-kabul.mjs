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

  GEÇMİŞ HAREKETLERİ (Aşama 2.1). Tarayıcının geri/ileri düğmesi
  DURDURULAMAZ (Next popstate'i kendisi işliyor); onun yerine kayıt kabuğa
  devredilir (lib/bekleyen-kayit.ts) ve gezinme bitince gönderilir; düşerse
  vardığı sayfada kalıcı uyarı. İki ayrı durum sınanır:
    - uygulama içi geçmiş (editöre bağlantıyla gelinmiş): devir;
    - belgeler arası geçmiş (editör doğrudan adresle açılmış), yenileme ve
      sekme kapatma: tarayıcının "ayrılmak istiyor musunuz" uyarısı ve
      tarayıcı taslağı.
  Sahte veriyle sınanır: gerçek Supabase'teki oturum kapanması ve sürüm
  çakışması bu betiğin DIŞINDA (UNVERIFIED).

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

await senaryo("kayıt hatası penceresi taslağın GERÇEK durumunu söyler: depo doluyken 'tarayıcıya da kaydedilemedi'", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("dolu", "QuotaExceededError");
    };
  });
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard/literature"]').first().click();
  const pencere = s.getByRole("dialog").filter({ hasText: /kaydedilemedi/ });
  await pencere.waitFor({ state: "visible", timeout: 30000 });
  const metin = await pencere.innerText();
  bekle(/tarayıcıya da kaydedilemedi/.test(metin), `depo doluyken yanlış güvence: ${metin.slice(0, 200)}`);
  bekle(!/bu tarayıcıda saklanıyor/.test(metin), "depo doluyken 'saklanıyor' deniyor");
  await s.unroute("**/*");
  await pencere.getByRole("button", { name: /Sayfada kal/ }).click();
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(1500);
  await ctx.close();
});

// ---------------- GEÇMİŞ HAREKETLERİ (Aşama 2.1) ----------------

/** Editöre UYGULAMA İÇİNDEN (bağlantıyla) gelinir: geri/ileri Next'in popstate'iyle işlenir. */
async function editoreBaglantiyla(ctx) {
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.locator('main a[href$="/write"]').first().click();
  await sayfa.waitForURL(/\/write/, { timeout: 60000 });
  await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  await sayfa.waitForTimeout(800);
  return sayfa;
}

await senaryo("geçmiş: yaz → hemen GERİ (uygulama içi) → kayıt devredilir, metin sunucuda", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editoreBaglantiyla(ctx);
  const isaret = await yaz(s);
  await s.goBack();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await s.waitForTimeout(4000);
  bekle(!(await s.locator(".devir-uyari").isVisible().catch(() => false)), "başarılı devirde hata uyarısı görünüyor");
  await ctx.close();
  bekle(await sunucudaMi(isaret), "geri sonrası metin sunucuda yok");
});

await senaryo("geçmiş: yaz → hemen İLERİ (uygulama içi) → metin sunucuda", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editoreBaglantiyla(ctx);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForURL(`${TABAN}/dashboard`);
  await s.goBack();
  await s.waitForURL(/\/write/);
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  await s.waitForTimeout(800);
  const isaret = await yaz(s);
  await s.goForward();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await s.waitForTimeout(4000);
  await ctx.close();
  bekle(await sunucudaMi(isaret), "ileri sonrası metin sunucuda yok");
});

await senaryo("geçmiş: otomatik kayıt SÜRERKEN geri → süren kayıt ve devir çakışmaz, metin sunucuda, uyarı yok", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editoreBaglantiyla(ctx);
  await s.route("**/*", async (route) => {
    if (kayitIstegiMi(route.request())) await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  const istek = s.waitForRequest(kayitIstegiMi, { timeout: 15000 });
  const isaret = await yaz(s);
  await istek; // otomatik kayıt başladı ve yavaş sürüyor
  await s.keyboard.type(" sonra", { delay: 5 }); // kayıt sürerken yeni harfler
  await s.goBack();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await s.waitForTimeout(9000);
  bekle(!(await s.locator(".devir-uyari").isVisible().catch(() => false)), `çakışma ya da hata uyarısı: ${await s.locator(".devir-uyari").innerText().catch(() => "")}`);
  await s.unroute("**/*");
  await ctx.close();
  bekle(await sunucudaMi(`${isaret} sonra`), "süren kayıtla geri sonrası son metin sunucuda yok");
});

await senaryo("geçmiş: kayıt HATASI varken geri → vardığı sayfada kalıcı uyarı (taslak yeri doğru), 'Yeniden dene' kaydeder", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editoreBaglantiyla(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  const isaret = await yaz(s);
  await s.goBack();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  const uyari = s.locator(".devir-uyari[role='alert']");
  await uyari.waitFor({ state: "visible", timeout: 30000 });
  const metin = await uyari.innerText();
  bekle(/bu tarayıcıda/i.test(metin), `uyarı taslağın yerini söylemiyor: ${metin}`);
  bekle((await uyari.getByRole("link", { name: /Çalışmaya dön/ }).getAttribute("href"))?.endsWith("/write"), "Çalışmaya dön bağlantısı yok");
  await s.waitForTimeout(1500);
  bekle(await uyari.isVisible(), "uyarı kendiliğinden kalktı (sessiz kayıp)");
  await s.unroute("**/*");
  await uyari.getByRole("button", { name: /Yeniden dene/ }).click();
  // Uyarı önce "kaydediliyor" satırına döner; kayıt BİTENE kadar (ikisi de kalkana kadar) beklenir.
  await s.waitForFunction(() => !document.querySelector(".devir-uyari, .devir-durum"), null, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "yeniden denemeden sonra metin sunucuda yok");
});

await senaryo("çalışma DEĞİŞTİRİRKEN kayıt: switcher kaydı bekler, metin sunucuda ve aynı bölüme gidilir", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", async (route) => {
    if (kayitIstegiMi(route.request())) await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  const isaret = await yaz(s);
  await s.locator(".proje-secici-dugme").click();
  await s.locator(".proje-secici-oge").nth(1).click();
  await s.waitForTimeout(600);
  bekle(s.url().startsWith(YAZIM), "kayıt bitmeden çalışma değişti");
  await s.waitForURL(/0000000000b2\/write/, { timeout: 30000 });
  await s.unroute("**/*");
  await ctx.close();
  bekle(await sunucudaMi(isaret), "çalışma değiştirdikten sonra metin sunucuda yok");
});

await senaryo("YENİLEME: tarayıcı uyarır; reddedilince metin yerinde, kabul edilince taslak geri yükleme önerilir", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  const isaret = await yaz(s);
  await s.waitForTimeout(800); // taslak tarayıcıya yazılsın
  let kabul = false;
  const diyaloglar = [];
  s.on("dialog", async (d) => {
    diyaloglar.push(d.type());
    if (kabul) await d.accept();
    else await d.dismiss();
  });
  await s.reload({ timeout: 5000 }).catch(() => {});
  await s.waitForTimeout(800);
  bekle(diyaloglar.includes("beforeunload"), "yenilemede tarayıcı uyarısı çıkmadı");
  bekle(await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret), "uyarı reddedildiği hâlde metin gitti");
  kabul = true;
  await s.reload({ waitUntil: "networkidle" });
  await s.unroute("**/*");
  await s.getByText(/Bu tarayıcıda kaydedilmemiş değişiklikleriniz bulundu|unsaved changes in this browser/).waitFor({ timeout: 30000 });
  await ctx.close();
});

await senaryo("SEKME KAPATMA: kaydedilmemiş metin varken tarayıcı uyarır", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  await yaz(s);
  const diyalog = new Promise((coz) => s.once("dialog", async (d) => { coz(d.type()); await d.dismiss(); }));
  await s.close({ runBeforeUnload: true });
  bekle((await Promise.race([diyalog, new Promise((r) => setTimeout(() => r("yok"), 5000))])) === "beforeunload", "sekme kapatmada uyarı çıkmadı");
  await ctx.close();
});

await senaryo("belgeler arası GERİ (editör doğrudan adresle açılmış): tarayıcı uyarır, reddedilince metin yerinde", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  await s.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle" });
  await s.goto(YAZIM, { waitUntil: "networkidle" });
  await s.locator(".ProseMirror").first().waitFor();
  await s.waitForTimeout(800);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  const isaret = await yaz(s);
  const diyaloglar = [];
  s.on("dialog", async (d) => { diyaloglar.push(d.type()); await d.dismiss(); });
  await s.goBack({ timeout: 5000 }).catch(() => {});
  await s.waitForTimeout(800);
  bekle(diyaloglar.includes("beforeunload"), "belgeler arası geride uyarı çıkmadı");
  bekle(s.url().startsWith(YAZIM), "uyarı reddedildiği hâlde sayfa değişti");
  bekle(await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret), "metin gitti");
  await s.unroute("**/*");
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(1500);
  await ctx.close();
});

await senaryo("TELEFON (iPhone 13 öykünmesi): yaz → hemen geri (uygulama içi) → metin sunucuda", async () => {
  const { devices } = require("playwright");
  const ctx = await tarayici.newContext({ ...devices["iPhone 13"] });
  const s = await ctx.newPage();
  await s.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle", timeout: 180000 });
  await s.locator('main a[href$="/write"]').first().tap();
  await s.waitForURL(/\/write/, { timeout: 60000 });
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  await s.waitForTimeout(800);
  const isaret = `KORUMA${Date.now().toString(36)}`;
  await s.locator(".ProseMirror").first().tap();
  await s.keyboard.type(` ${isaret}`, { delay: 5 });
  await s.goBack();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await s.waitForTimeout(4000);
  await ctx.close();
  bekle(await sunucudaMi(isaret), "telefonda geri sonrası metin sunucuda yok");
});

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
