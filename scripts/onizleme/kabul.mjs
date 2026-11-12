/*
  PHASE 3 TARAYICI KABUL TESTİ (04.11.2026; Signature OS 5 / Phase 3
  kabuk senaryoları 12.11.2026'da eklendi: "os5 kabuk: …").

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
/*
  Yazım ekranında 40 pikselden küçük dokunma hedefleri (Phase 3
  stabilizasyonu). Telefonda 39 hedefin 15'i küçüktü; artık sıfır olmalı.
  Editörün metni (ProseMirror) ve gizli öğeler sayılmaz.
*/
async function kucukHedefler(sayfa) {
  await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 30000 });
  return sayfa.evaluate(() =>
    [...document.querySelectorAll("a[href], button, [role=button], input, select, textarea")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const gorunur = el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && getComputedStyle(el).pointerEvents !== "none";
        return gorunur && r.width > 0 && r.top < innerHeight && r.bottom > 0 && (r.width < 40 || r.height < 40) && !el.closest(".ProseMirror");
      })
      .map((el) => `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 20)}`),
  );
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
  await senaryo("Çalışmalarım'dayken Ctrl+K 'Yeni çalışma' pencereyi açar, kapanınca ?yeni adresten silinir", async () => {
    // Eskiden pencere ?yeni=1'i yalnızca ilk çizimde okuyordu: aynı sayfada adres değişince hiçbir şey olmuyordu.
    await git(sayfa, "/dashboard/editor");
    await sayfa.keyboard.press("Control+k");
    await sayfa.locator(".os-palette-input input").fill("Yeni çalışma");
    await sayfa.waitForTimeout(300);
    await sayfa.keyboard.press("Enter");
    await sayfa.waitForURL(/yeni=1/, { timeout: 30000 });
    const pencere = sayfa.locator("[role=dialog][aria-modal=true]:visible");
    await pencere.first().waitFor({ state: "visible", timeout: 10000 });
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForURL((u) => !u.search.includes("yeni=1"), { timeout: 10000 });
    // Kapanış animasyonu var; beklenen süre içinde gizlenmezse düşer.
    await pencere.first().waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    bekle((await pencere.count()) === 0, "Esc pencereyi kapatmadı");
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

  /* ---- Signature OS 5 / Phase 3: kabuk ---- */
  await senaryo("os5 kabuk: kenar çubuğu 240 px koyu lacivert, logo üstte, içerik sağında", async () => {
    await git(sayfa, "/dashboard");
    const olcu = await sayfa.evaluate(() => {
      const nav = document.querySelector("nav.os-gezinme");
      const r = nav.getBoundingClientRect();
      const logo = nav.querySelector(".os-gezinme-logo img");
      const ust = document.querySelector(".dashboard-header").getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), zemin: getComputedStyle(nav).backgroundColor, logo: logo?.getAttribute("src") ?? "", logoY: logo ? Math.round(logo.getBoundingClientRect().top) : -1, ustX: Math.round(ust.left) };
    });
    bekle(olcu.w === 240 && olcu.h === 900, `kenar çubuğu ${olcu.w}×${olcu.h}`);
    bekle(/rgb\(0, 23, 51\)|rgb\(0, 13, 31\)/.test(olcu.zemin), `zemin lacivert değil: ${olcu.zemin}`);
    bekle(/arvolab-logo-koyu/.test(olcu.logo) && olcu.logoY < 64, `logo: ${olcu.logo} @${olcu.logoY}`);
    bekle(olcu.ustX === 240, `üst çubuk kenar çubuğunun sağında başlamıyor (${olcu.ustX})`);
  });
  await senaryo("os5 kabuk: gezinmede tek etkin işaret (aria-current) ve doğru sayfa", async () => {
    for (const [yol, ad] of [["/dashboard", "Ana Sayfa"], ["/dashboard/literature", "Kaynaklar"], [`/dashboard/editor/${TEZ}/write`, "Yazım"], [`/dashboard/literature?calisma=${TEZ}`, "Kaynaklar"]]) {
      await git(sayfa, yol);
      const etkin = sayfa.locator('nav.os-gezinme [aria-current="page"]');
      bekle((await etkin.count()) === 1, `${yol}: ${await etkin.count()} etkin işaret`);
      bekle((await etkin.innerText()).includes(ad), `${yol}: etkin "${await etkin.innerText()}"`);
    }
  });
  await senaryo("os5 kabuk: Çalışmalarım alt menüsü fare ve klavyeyle açılır/kapanır", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const dugme = sayfa.locator(".os-gezinme-ac");
    const menu = sayfa.locator("#os-gezinme-calisma");
    bekle((await dugme.getAttribute("aria-expanded")) === "true" && (await menu.isVisible()), "çalışmanın içinde alt menü açık başlamalı");
    await dugme.click();
    bekle((await dugme.getAttribute("aria-expanded")) === "false" && !(await menu.isVisible()), "tıklayınca kapanmadı");
    await dugme.focus();
    await sayfa.keyboard.press("Enter");
    bekle((await dugme.getAttribute("aria-expanded")) === "true" && (await menu.isVisible()), "Enter açmadı");
    await sayfa.keyboard.press("Space");
    bekle((await dugme.getAttribute("aria-expanded")) === "false", "Space kapatmadı");
  });
  await senaryo("os5 kabuk: Diğer alt menüsü açılır, tercih hatırlanır", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.evaluate(() => localStorage.removeItem("arvolab.gezinme.diger"));
    await git(sayfa, "/dashboard");
    const dugme = sayfa.locator(".os-gezinme-grup");
    const liste = sayfa.locator("#os-gezinme-diger");
    bekle((await dugme.getAttribute("aria-expanded")) === "false" && !(await liste.isVisible()), "Diğer kapalı başlamalı");
    await dugme.click();
    bekle((await dugme.getAttribute("aria-expanded")) === "true" && (await liste.isVisible()), "Diğer açılmadı");
    bekle(await liste.getByText("Kullanım Kılavuzu").isVisible(), "Kullanım Kılavuzu görünmüyor");
    await git(sayfa, "/dashboard/analysis");
    bekle((await sayfa.locator(".os-gezinme-grup").getAttribute("aria-expanded")) === "true", "açık tercihi hatırlanmadı");
    await sayfa.locator(".os-gezinme-grup").click();
    await git(sayfa, "/dashboard/yardim");
    bekle((await sayfa.locator(".os-gezinme-grup").getAttribute("aria-expanded")) === "true", "etkin sayfa Diğer'deyken grup açık olmalı");
  });
  await senaryo("os5 kabuk: hesap menüsü kenar çubuğunun dibinde, yukarı açılır; üst çubukta yok", async () => {
    await git(sayfa, "/dashboard");
    bekle(!(await sayfa.locator(".dashboard-header .os-kullanici").isVisible()), "masaüstünde üst çubukta hesap menüsü görünmemeli");
    const ozet = sayfa.locator("nav.os-gezinme .os-kullanici > summary");
    bekle(await ozet.isVisible(), "kenar çubuğunda hesap satırı yok");
    await ozet.click();
    const menu = sayfa.locator("nav.os-gezinme .os-kullanici-menu");
    const [m, o] = [await menu.boundingBox(), await ozet.boundingBox()];
    bekle(m && o && m.y + m.height <= o.y, `menü yukarı açılmadı: ${JSON.stringify({ m, o })}`);
    bekle(await menu.getByRole("button", { name: /Çıkış yap/ }).isVisible(), "çıkış düğmesi yok");
    bekle(m.y >= 0, "menü ekranın üstünden taşıyor");
  });
  await senaryo("os5 kabuk: öğrenci rolünde personel sayfaları gezinmede yok", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.locator(".os-gezinme-grup").click().catch(() => {});
    const metin = await sayfa.locator("nav.os-gezinme").innerText();
    for (const ad of ["Ekip Yönetimi", "Asistan Kayıtları", "Doçentlik Puanı"]) bekle(!metin.includes(ad), `öğrencide "${ad}" görünüyor`);
  });
  await senaryo("os5 kabuk: editörden Ana Sayfa'ya ve geri; gezinme editörde kaybolmaz", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 30000 });
    bekle(await sayfa.locator("nav.os-gezinme").isVisible(), "editörde ana gezinme yok");
    bekle((await sayfa.locator("nav").count()) >= 1 && (await sayfa.locator("nav.os-gezinme").count()) === 1, "ikinci bir ana gezinme var");
    await sayfa.locator("nav.os-gezinme").getByRole("link", { name: "Ana Sayfa", exact: true }).click();
    await sayfa.waitForURL((u) => u.pathname === "/dashboard", { timeout: 60000 });
    await sayfa.locator("nav.os-gezinme").getByRole("link", { name: "Çalışmalarım", exact: true }).click();
    await sayfa.waitForURL((u) => u.pathname === "/dashboard/editor", { timeout: 60000 });
  });
  await senaryo("os5 kabuk: editörde yazıp kenar çubuğundan çıkınca değişiklik korunur", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const editor = sayfa.locator(".ProseMirror").first();
    await editor.waitFor({ state: "visible", timeout: 30000 });
    let kayit = 0;
    // Kayıt bir sunucu eylemi; istek, adres zaten yeni sayfaya geçmişken gidebiliyor (next-action başlığıyla tanınır).
    sayfa.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) kayit++; });
    await sayfa.waitForTimeout(1500);
    await editor.locator("p").nth(3).click();
    await sayfa.keyboard.press("End");
    await sayfa.keyboard.type(" os5-deneme");
    bekle(await editor.evaluate((e) => e.textContent.includes("os5-deneme")), "metin editöre yazılmadı");
    kayit = 0;
    await sayfa.locator("nav.os-gezinme").getByRole("link", { name: "Ana Sayfa", exact: true }).click();
    await sayfa.waitForURL((u) => u.pathname === "/dashboard", { timeout: 60000 });
    await sayfa.waitForTimeout(500);
    const taslak = await sayfa.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("arvolab:manuscript-draft:")));
    bekle(kayit > 0 || taslak, "ayrılırken kayıt isteği gitmedi ve taslak saklanmadı");
    await sayfa.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("arvolab:manuscript-draft:")).forEach((k) => localStorage.removeItem(k)));
  });
  await senaryo("os5 kabuk: yatay taşma yok (masaüstü)", async () => {
    for (const yol of ["/dashboard", `/dashboard/editor/${TEZ}/write`, "/dashboard/literature"]) {
      await git(sayfa, yol);
      const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      bekle(tasma <= 1, `${yol}: ${tasma}px taşıyor`);
    }
  });
  await sayfa.close();
}

// ---- TABLET (820×1180): dar ray, sayfa sekmeleri ----
{
  const sayfa = await tarayici.newPage({ viewport: { width: 820, height: 1180 } });
  /*
    Signature OS 5 / Phase 3 (12.11.2026): ray 64 px ve yalnızca simge.
    Eskiden 88 px ve simgenin altında kısa ad yazılıydı. Ad artık üzerine
    gelince ya da klavye odağında yanında beliriyor; erişilebilir ad her
    zaman bağlantının içinde.
  */
  await senaryo("tablet: ray solda 64 px, her bağlantının adı var, ad üzerine gelince belirir", async () => {
    await git(sayfa, "/dashboard");
    const kutu = await sayfa.locator("nav.os-gezinme").boundingBox();
    bekle(kutu && kutu.x === 0 && kutu.width <= 72 && kutu.height > 600, `ray beklenen yerde değil: ${JSON.stringify(kutu)}`);
    const adsiz = await sayfa.locator("nav.os-gezinme a:visible, nav.os-gezinme button:visible").evaluateAll((els) =>
      els.filter((el) => !(el.textContent ?? "").trim() && !el.getAttribute("aria-label")).length,
    );
    bekle(adsiz === 0, `${adsiz} bağlantının adı yok`);
    const ilk = sayfa.locator("nav.os-gezinme .os-gezinme-ana a").nth(1);
    const ad = ilk.locator(".os-gezinme-ad");
    bekle((await ad.evaluate((el) => getComputedStyle(el).opacity)) === "0", "ad baştan görünür olmamalı");
    await ilk.hover();
    await sayfa.waitForTimeout(250);
    bekle((await ad.evaluate((el) => getComputedStyle(el).opacity)) === "1", "ad üzerine gelince belirmedi");
    await sayfa.mouse.move(600, 500);
    await ilk.focus();
    await sayfa.keyboard.press("Shift+Tab");
    await sayfa.keyboard.press("Tab");
    await sayfa.waitForTimeout(250);
    bekle((await ad.evaluate((el) => getComputedStyle(el).opacity)) === "1", "ad klavye odağında belirmedi");
  });
  await senaryo("tablet: çalışmada sayfa sekmeleri görünür, bağlam rayda yok", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/kanit`);
    bekle(await sayfa.locator("nav.os-gezinme").isVisible(), "gezinme çizilmedi (sayfa açılmadı mı?)");
    bekle(await sayfa.locator(".calisma-sekmeleri").first().isVisible(), "çalışma sekmeleri görünmüyor");
    bekle(!(await sayfa.locator(".os-gezinme-baglam").isVisible()), "rayda bağlam görünmemeli");
  });
  await senaryo("tablet: yazım ekranında 40 pikselden küçük dokunma hedefi yok", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const kucuk = await kucukHedefler(sayfa);
    bekle(kucuk.length === 0, `${kucuk.length} küçük hedef: ${kucuk.slice(0, 4).join(" | ")}`);
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
  await senaryo("telefon: yazım ekranında 40 pikselden küçük dokunma hedefi yok", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const kucuk = await kucukHedefler(sayfa);
    bekle(kucuk.length === 0, `${kucuk.length} küçük hedef: ${kucuk.slice(0, 4).join(" | ")}`);
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

// ---- TEMA: Açık / Koyu / Sistem (Phase 4.1) ----
{
  const tema = (sayfa) => sayfa.evaluate(() => `${document.documentElement.getAttribute("data-theme")}/${document.documentElement.getAttribute("data-theme-tercih")}`);
  const kayit = (sayfa) => sayfa.evaluate(() => localStorage.getItem("arvolab.theme"));

  await senaryo("tema: kaydı olmayan kullanıcı sisteme uyar, sistem değişince sayfa da değişir", async () => {
    const ctx = await tarayici.newContext({ colorScheme: "dark" });
    const sayfa = await ctx.newPage();
    await git(sayfa, "/dashboard");
    bekle((await tema(sayfa)) === "dark/system", `ilk tema ${await tema(sayfa)}`);
    await sayfa.emulateMedia({ colorScheme: "light" });
    await sayfa.waitForTimeout(150);
    bekle((await tema(sayfa)) === "light/system", `sistem açığa dönünce ${await tema(sayfa)}`);
    await ctx.close();
  });

  await senaryo("tema: eski kayıt ('dark') korunur ve sistem değişikliği onu ezmez", async () => {
    const ctx = await tarayici.newContext({ colorScheme: "light" });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem("k")) { localStorage.setItem("arvolab.theme", "dark"); sessionStorage.setItem("k", "1"); } });
    const sayfa = await ctx.newPage();
    await git(sayfa, "/dashboard");
    bekle((await tema(sayfa)) === "dark/dark", `tema ${await tema(sayfa)}`);
    await sayfa.emulateMedia({ colorScheme: "dark" });
    await sayfa.emulateMedia({ colorScheme: "light" });
    await sayfa.waitForTimeout(150);
    bekle((await tema(sayfa)) === "dark/dark", `sistem değişince ${await tema(sayfa)}`);
    // Phase 4.2: cihaz açıkken uygulamada Koyu seçiliyse tarayıcı çubuğu da koyu renkte olmalı.
    const metalar = await sayfa.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content")));
    bekle(metalar.length > 0 && metalar.every((r) => r === "#0f1626"), `theme-color ${metalar.join(",")}`);
    await ctx.close();
  });

  await senaryo("tema: üst çubuk menüsünden Sistem seçilir, kaydedilir; Esc odağı düğmeye verir", async () => {
    const ctx = await tarayici.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem("k")) { localStorage.setItem("arvolab.theme", "light"); sessionStorage.setItem("k", "1"); } });
    const sayfa = await ctx.newPage();
    await git(sayfa, "/dashboard");
    const dugme = sayfa.locator(".dashboard-header .tema-secici > button");
    await dugme.click();
    const menu = sayfa.locator(".tema-menu[role=menu]");
    await menu.waitFor({ state: "visible", timeout: 5000 });
    bekle((await menu.locator('[aria-checked="true"]').innerText()).includes("Açık"), "seçili seçenek Açık değil");
    await menu.getByRole("menuitemradio", { name: /Sistem/ }).click();
    bekle((await tema(sayfa)) === "dark/system", `Sistem seçilince ${await tema(sayfa)}`);
    bekle((await kayit(sayfa)) === "system", `kayıt ${await kayit(sayfa)}`);
    await sayfa.reload({ waitUntil: "networkidle" });
    bekle((await tema(sayfa)) === "dark/system", `yenileyince ${await tema(sayfa)}`);
    await dugme.click();
    await menu.waitFor({ state: "visible", timeout: 5000 });
    await sayfa.keyboard.press("ArrowDown");
    await sayfa.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden", timeout: 5000 });
    bekle(await dugme.evaluate((el) => el === document.activeElement), "Esc sonrası odak düğmede değil");
    await ctx.close();
  });

  await senaryo("tema: Ctrl+K 'Tema: Koyu' uygular; başka sekme de değişir", async () => {
    const ctx = await tarayici.newContext({ colorScheme: "light" });
    const sayfa = await ctx.newPage();
    const diger = await ctx.newPage();
    await git(sayfa, "/dashboard");
    await git(diger, "/dashboard/analysis");
    await sayfa.keyboard.press("Control+k");
    await sayfa.locator(".os-palette-input input").fill("Tema: Koyu");
    await sayfa.waitForTimeout(200);
    await sayfa.keyboard.press("Enter");
    await sayfa.waitForTimeout(200);
    bekle((await tema(sayfa)) === "dark/dark", `Ctrl+K sonrası ${await tema(sayfa)}`);
    await diger.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", null, { timeout: 5000 }).catch(() => {});
    bekle((await tema(diger)) === "dark/dark", `öteki sekme ${await tema(diger)}`);
    await ctx.close();
  });

  await senaryo("tema: belge kâğıdı koyu temada da beyaz ve koyu mürekkepli (Phase 4.3)", async () => {
    // Akademik belgenin sayfası uygulama temasından bağımsız: .kagit açık tokenları kendi üzerinde kurar.
    const ctx = await tarayici.newContext({ colorScheme: "dark" });
    const sayfa = await ctx.newPage();
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const kagit = sayfa.locator(".manuscript-editor-content.kagit").first();
    await kagit.waitFor({ state: "visible", timeout: 30000 });
    const renk = await kagit.evaluate((el) => ({ zemin: getComputedStyle(el).backgroundColor, yazi: getComputedStyle(el).color, tema: document.documentElement.getAttribute("data-theme") }));
    bekle(renk.tema === "dark", `tema ${renk.tema}`);
    bekle(renk.zemin === "rgb(255, 255, 255)", `kâğıt zemini ${renk.zemin}`);
    const [r, g, b] = renk.yazi.match(/\d+/g).map(Number);
    bekle(r + g + b < 150, `kâğıt yazısı koyu değil: ${renk.yazi}`);
    await ctx.close();
  });

  await senaryo("tipografi: Newsreader yalnızca rol başlıklarında; belge içeriği ve kart başlıkları etkilenmez (Phase 4.4)", async () => {
    const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
    const sayfa = await ctx.newPage();
    const aile = (sec) => sayfa.$eval(sec, (e) => getComputedStyle(e).fontFamily);
    await git(sayfa, "/dashboard/editor");
    bekle(/newsreader/i.test(await aile(".projects-header h1")), "sayfa başlığı Newsreader değil");
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    await sayfa.locator(".manuscript-editor-content.kagit h1").first().waitFor({ state: "visible", timeout: 30000 });
    bekle(/newsreader/i.test(await aile(".yazma-basligi h1")), "çalışma adı Newsreader değil");
    // Belgenin kendi başlığı ve paragrafı arayüz başlık yazısını ALMAMALI (element seçiciyle sızma olmasın).
    bekle(!/newsreader/i.test(await aile(".manuscript-editor-content.kagit h1")), "belge başlığına Newsreader sızmış");
    bekle(!/newsreader/i.test(await aile(".manuscript-editor-content.kagit p")), "belge paragrafına Newsreader sızmış");
    await git(sayfa, "/dashboard");
    bekle(!/newsreader/i.test(await aile(".gb-kart-bas h2")), "kart başlığına Newsreader uygulanmış");
    await ctx.close();
  });

  await senaryo("tema: ilk boyama doğru temada (JS paketleri gecikse bile parlama yok)", async () => {
    // Eskiden betik Next'in kuyruğundaydı ve JS gelene kadar data-theme yoktu: koyu tercihli kullanıcı açık zemin görüyordu.
    const ctx = await tarayici.newContext({ colorScheme: "light" });
    await ctx.addInitScript(() => { try { localStorage.setItem("arvolab.theme", "dark"); } catch {} });
    const sayfa = await ctx.newPage();
    await sayfa.route("**/*", async (r) => {
      if (r.request().resourceType() === "script") await new Promise((c) => setTimeout(c, 3000));
      r.continue().catch(() => {});
    });
    sayfa.goto(TABAN + "/dashboard", { timeout: 150000 }).catch(() => {});
    await sayfa.waitForEvent("domcontentloaded", { timeout: 150000 });
    const ilk = await sayfa.evaluate(() => ({ tema: document.documentElement.getAttribute("data-theme") }));
    bekle(ilk.tema === "dark", `JS gelmeden tema ${ilk.tema}`);
    await ctx.close();
  });
}

await tarayici.close();

let dusen = 0;
for (const s of sonuclar) {
  if (!s.tamam) dusen++;
  console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti`);
process.exit(dusen ? 1 : 0);
