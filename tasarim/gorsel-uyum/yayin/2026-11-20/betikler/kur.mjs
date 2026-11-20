// PR #112 canlı kontrolü için test verisi (test düzeneği, uygulama kodu DEĞİL).
// Hesap: …yayin-832748@resend.dev (Resend test alıcısı). TEK giriş denemesi; düşerse durur.
// Oluşturulan her kimlik iz.json'a yazılır; temizlik oradan yapılır.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/home/user/arvolab-tasarim/package.json");
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = "https://lab.arvo-os.com";
const H = JSON.parse(fs.readFileSync(process.env.HESAP_DOSYASI, "utf8")); // { adres, parola } — dosya depoda DEĞİL
const IZ = `${D}iz.json`;
const iz = () => (fs.existsSync(IZ) ? JSON.parse(fs.readFileSync(IZ, "utf8")) : {});
const izYaz = (o) => fs.writeFileSync(IZ, JSON.stringify({ ...iz(), ...o }, null, 2));
const ADIM = process.argv[2];
const b = await chromium.launch();
const STATE = `${D}oturum.json`;
let c;
if (ADIM === "giris") {
  c = await b.newContext({ baseURL: URL0, viewport: { width: 1440, height: 900 } });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage();
  await s.goto("/"); await s.fill('input[name="email"]', H.adres); await s.fill('input[name="password"]', H.parola);
  await s.press('input[name="password"]', "Enter");
  await s.waitForURL((u) => /dashboard|error=/.test(u.href), { timeout: 60000 });
  if (!/dashboard/.test(s.url())) { console.log("GIRIS_DUSTU", new URL(s.url()).search); process.exit(3); }
  await c.storageState({ path: STATE }); console.log("giris tamam");
  await b.close(); process.exit(0);
}
c = await b.newContext({ baseURL: URL0, storageState: STATE, viewport: { width: 1440, height: 900 } });
const s = await c.newPage();
const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
try {
  if (ADIM === "calisma") {
    await s.goto("/dashboard"); await s.getByRole("button", { name: /^(Yeni çalışma|İlk çalışmayı oluştur)$/ }).or(s.getByRole("link", { name: /^İlk çalışmayı oluştur$/ })).first().click();
    const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible" });
    await f.locator('input[name="title"]').fill("Canlı kontrol PR112 (silinecek)");
    await f.locator('button[value="yaz"]').click();
    await s.waitForURL(/\/dashboard\/editor\/[0-9a-f-]{36}\/write/, { timeout: 60000 });
    const id = s.url().match(/editor\/([0-9a-f-]{36})/)[1]; izYaz({ calisma: id });
    await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
    await s.getByRole("button", { name: /^(Anladım|Got it)$/ }).first().click({ timeout: 1500 }).catch(() => {});
    await s.locator(".ProseMirror").first().click();
    await s.keyboard.type("Uzaktan öğrenme yalnızlığı artırdı (Deneme, 2020). Canlı kontrol cümlesi.");
    await s.waitForTimeout(4000);
    console.log("calisma", id);
  }
  if (ADIM === "kaynak") {
    const { calisma } = iz();
    await s.goto(`/dashboard/literature?calisma=${calisma}`); await s.waitForLoadState("networkidle");
    await s.locator("details:has(.kaynak-bul-tetik) > summary").first().click();
    await s.getByRole("button", { name: /Dizinlerde ara/ }).first().click();
    await s.getByRole("button", { name: /Manuel kaynak ekle/ }).first().click();
    const f = s.locator("form:has(input[name=title])").last();
    await f.locator('input[name="title"]').fill("Synthetic release check source");
    await f.locator('input[name="authors"]').fill("Deneme, A.");
    await f.locator('input[name="year"]').fill("2020");
    await f.getByRole("button", { name: /^Ekle$/ }).click();
    await s.getByText(/Kaynak eklendi/).first().waitFor({ timeout: 30000 });
    console.log("kaynak eklendi");
  }
  if (ADIM === "pdf") {
    const { calisma } = iz();
    await s.goto(`/dashboard/literature?calisma=${calisma}&sekme=kaynakca`); await s.waitForLoadState("networkidle");
    await s.getByRole("button", { name: /Kaynakçamı denetle/ }).first().click();
    await s.getByRole("button", { name: /Manuel ekle/ }).first().click();
    await s.locator("textarea").last().fill("Deneme, A. (2020). Synthetic release check source. Journal of Testing, 1(1), 1-2.");
    await s.getByRole("button", { name: /Yapıştırdığımı denetle/ }).click();
    const yukle = s.getByRole("button", { name: /PDF yükle/ }).first();
    await yukle.waitFor({ timeout: 120000 });
    const [secici] = await Promise.all([s.waitForEvent("filechooser"), yukle.click()]);
    await secici.setFiles(process.env.SENTETIK_PDF);
    await s.getByText(/PDF yüklendi/).first().waitFor({ timeout: 60000 });
    console.log("pdf yuklendi");
  }
  if (ADIM === "bag") {
    const { calisma } = iz();
    await s.goto(`/dashboard/editor/${calisma}/write?sag=pdf`, { timeout: 120000 });
    await s.waitForSelector(".pdf-bag-durum", { timeout: 120000 });
    await s.getByRole("button", { name: /Kaynağa bağla/ }).click();
    const sec = s.locator(".pdf-bag-sec select");
    const deger = await sec.locator("option", { hasText: "Synthetic release check source" }).getAttribute("value");
    await sec.selectOption(deger);
    await s.getByRole("button", { name: /^Bağla$/ }).click();
    await s.locator(".pdf-bag-durum", { hasText: /Kaynağa bağlı/ }).waitFor({ timeout: 30000 });
    console.log("bag tamam");
  }
} catch (h) { console.log("HATA", String(h.message).split("\n")[0]); await s.screenshot({ path: `${D}hata-kur-${ADIM}.png` }).catch(() => {}); process.exitCode = 1; }
console.log("sayfaHatasi", JSON.stringify(hata));
await b.close();
