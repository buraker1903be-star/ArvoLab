/*
  PHASE 3 TARAYICI KABUL TESTİ (04.11.2026).

  Yerel önizlemede (npm run onizleme, sahte Supabase) gezinmenin üç
  biçimini, Ctrl+K komut merkezini ve DOI akışını gerçek tarayıcıda
  sınar. Birim testleri gezinme LİSTESİNİ sınıyor (os-uygulamalar.test.ts);
  hangi biçimin hangi genişlikte göründüğü, klavyenin çalışıp çalışmadığı
  CSS ve tarayıcı işi, onlar yalnızca burada görünür.

  CI'da DEĞİL: önizleme sunucusu ve Chromium ister. Kullanım:
    NODE_PATH=$(npm root -g) node scripts/onizleme/kabul.mjs [taban-adres]
  Bir senaryo düşerse çıkış kodu 1.

  DOI'nin Crossref'e gidip kaynak eklemesi burada SINANMIYOR: önizleme
  ağı kapalı ve yazmalar sahte. Sınanan, DOI'nin kutuya kendiliğinden
  ve EKLENMEDEN gelmesi (sayfa yenilenince habersiz kaynak eklenmesin).
*/
import { createRequire } from "node:module";

// playwright projenin bağımlılığı değil (gereksiz bağımlılık eklenmedi); genel kurulumdan NODE_PATH ile gelir, onu yalnızca require okur.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const sonuclar = [];

async function senaryo(ad, govde) {
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).slice(0, 200) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const git = (sayfa, yol) => sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });

const tarayici = await chromium.launch();

// ---- MASAÜSTÜ (1440×900): kenar çubuğu, çalışma bağlamı, Ctrl+K, DOI ----
{
  const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
  await senaryo("masaüstü: kenar çubuğunda adlar yazılı, alt çubuk yok", async () => {
    await git(sayfa, "/dashboard");
    const nav = sayfa.locator("nav.os-gezinme");
    const kutu = await nav.boundingBox();
    bekle(kutu && kutu.x === 0 && kutu.width >= 200 && kutu.height > 600, `kenar çubuğu beklenen yerde değil: ${JSON.stringify(kutu)}`);
    bekle(await nav.getByText("Kaynaklar", { exact: true }).first().isVisible(), "Kaynaklar adı görünmüyor");
    bekle(!(await sayfa.locator(".os-gezinme-daha").isVisible()), "masaüstünde 'Daha fazla' görünmemeli");
  });
  await senaryo("masaüstü: çalışmanın içinde bağlam bölümü ve tek etkin bağlantı", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const baglam = sayfa.locator(".os-gezinme-baglam");
    bekle(await baglam.isVisible(), "çalışma bağlamı görünmüyor");
    const etkin = baglam.locator('[aria-current="page"]');
    bekle((await etkin.count()) === 1, `bağlamda ${await etkin.count()} etkin bağlantı var`);
    bekle(!(await sayfa.locator(".calisma-sekmeleri").first().isVisible().catch(() => false)), "sayfa içi sekmeler masaüstünde gizlenmeli");
  });
  await senaryo("masaüstü: genel sayfada çalışma bağlamı gizli", async () => {
    await git(sayfa, "/dashboard/analysis");
    bekle(await sayfa.locator("nav.os-gezinme").isVisible(), "gezinme çizilmedi (sayfa açılmadı mı?)");
    bekle(!(await sayfa.locator(".os-gezinme-baglam").isVisible()), "genel sayfada bağlam görünmemeli");
  });
  await senaryo("Ctrl+K: açılır, yazılan DOI tanınır, Enter Kaynaklar'a götürür, ekleme yapılmaz", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.keyboard.press("Control+k");
    const girdi = sayfa.locator(".os-palette-input input");
    await girdi.waitFor({ state: "visible", timeout: 5000 });
    bekle(await girdi.evaluate((el) => el === document.activeElement), "palet açılınca odak arama kutusunda değil");
    await girdi.fill("https://doi.org/10.1002/jae.616");
    const ilk = sayfa.locator(".os-palette-list [role=option]").first();
    bekle(/DOI/i.test(await ilk.innerText()), `ilk sonuç DOI eylemi değil: ${await ilk.innerText()}`);
    await sayfa.keyboard.press("Enter");
    await sayfa.waitForURL(/\/dashboard\/literature\?doi=/, { timeout: 60000 });
    await sayfa.waitForLoadState("networkidle");
    const kutu = sayfa.locator(".doi-kutusu input");
    await kutu.waitFor({ state: "visible", timeout: 10000 });
    bekle((await kutu.inputValue()).includes("10.1002/jae.616"), "DOI kutuya gelmedi");
    bekle(!(await sayfa.locator('.doi-kutusu-durum [data-tone="success"]').count()), "DOI kendiliğinden eklenmemeli");
  });
  await senaryo("Ctrl+K: Esc paleti kapatır", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.keyboard.press("Control+k");
    await sayfa.locator(".os-palette-input input").waitFor({ state: "visible", timeout: 5000 });
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(300);
    bekle(!(await sayfa.locator(".os-palette-input input").isVisible()), "Esc paleti kapatmadı");
  });
  await senaryo("DOI kutusu: DOI olmayan metinde ipucu, Ekle kapalı", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    const kutu = sayfa.locator(".doi-kutusu input");
    await kutu.fill("enflasyon işsizlik");
    bekle(await sayfa.locator(".doi-kutusu button[type=submit]").first().isDisabled(), "DOI değilken Ekle açık");
    bekle(await sayfa.getByText(/DOI'ye benzemiyor|doesn't look like a DOI/).isVisible(), "ipucu görünmüyor");
  });
  await senaryo("klavye: Tab ilk odakta görünür bir odak halkası çizer", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.keyboard.press("Tab");
    const halka = await sayfa.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "odak yok";
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 ? "var" : s.boxShadow !== "none" ? "var" : `yok (${el.tagName}.${el.className})`;
    });
    bekle(halka === "var", `odak halkası ${halka}`);
  });
  await sayfa.close();
}

// ---- TABLET (820×1180): dar ray, sayfa sekmeleri ----
{
  const sayfa = await tarayici.newPage({ viewport: { width: 820, height: 1180 } });
  await senaryo("tablet: ray solda dar, kısa adlar yazılı", async () => {
    await git(sayfa, "/dashboard");
    const kutu = await sayfa.locator("nav.os-gezinme").boundingBox();
    bekle(kutu && kutu.x === 0 && kutu.width <= 100 && kutu.height > 600, `ray beklenen yerde değil: ${JSON.stringify(kutu)}`);
    bekle(await sayfa.locator(".os-gezinme-kisa").first().isVisible(), "kısa ad görünmüyor");
  });
  await senaryo("tablet: çalışmada sayfa sekmeleri görünür, bağlam rayda yok", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/kanit`);
    bekle(await sayfa.locator("nav.os-gezinme").isVisible(), "gezinme çizilmedi (sayfa açılmadı mı?)");
    bekle(await sayfa.locator(".calisma-sekmeleri").first().isVisible(), "çalışma sekmeleri görünmüyor");
    bekle(!(await sayfa.locator(".os-gezinme-baglam").isVisible()), "rayda bağlam görünmemeli");
  });
  await sayfa.close();
}

// ---- TELEFON (390×844): alt çubuk, Daha fazla, taşma ----
{
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await senaryo("telefon: altta dört uygulama + Daha fazla", async () => {
    await git(sayfa, "/dashboard");
    const kutu = await sayfa.locator("nav.os-gezinme").boundingBox();
    bekle(kutu && kutu.y + kutu.height >= 840 && kutu.height <= 100, `alt çubuk beklenen yerde değil: ${JSON.stringify(kutu)}`);
    const gorunen = await sayfa.locator("nav.os-gezinme a:visible, nav.os-gezinme button:visible").count();
    bekle(gorunen === 5, `alt çubukta ${gorunen} öğe var (5 beklenir)`);
  });
  await senaryo("telefon: Daha fazla penceresi açılır, Esc kapatır", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.locator(".os-gezinme-daha").click();
    const pencere = sayfa.locator("dialog.os-daha");
    bekle(await pencere.isVisible(), "pencere açılmadı");
    bekle((await pencere.locator("a").count()) >= 3, "pencerede bölüm yok");
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(200);
    bekle(!(await pencere.isVisible()), "Esc pencereyi kapatmadı");
  });
  await senaryo("telefon: yazım ekranı yatay kaymıyor", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    // Yalnızca "taşma yok" demek boş bir hata sayfasında da geçer: önce editör çizilmiş olmalı.
    await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 30000 });
    const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 1, `sayfa ${tasma}px taşıyor`);
  });
  await sayfa.close();
}

await tarayici.close();

let dusen = 0;
for (const s of sonuclar) {
  if (!s.tamam) dusen++;
  console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti`);
process.exit(dusen ? 1 : 0);
