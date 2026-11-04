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
  await senaryo("konum yolu: Çalışmalarım › çalışma › Yazım; son öğe bağlantısız, marka kenar çubuğunda (Signature OS)", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const yol = sayfa.locator("nav.konum-yolu");
    await yol.locator("li").nth(2).waitFor({ state: "visible", timeout: 10000 });
    bekle((await yol.locator("li").count()) === 3, `konum yolunda ${await yol.locator("li").count()} öğe var (3 beklenir)`);
    bekle((await yol.locator("a").first().getAttribute("href")) === "/dashboard/editor", "ilk öğe Çalışmalarım'a gitmiyor");
    const son = yol.locator('[aria-current="page"]');
    bekle((await son.count()) === 1 && (await son.innerText()) === "Yazım", `son öğe: ${await son.allInnerTexts()}`);
    // Uygulama ve bölüm adı kısalmaz; yalnızca çalışmanın adı kısalır.
    const kesik = await yol.locator("li > :is(a, span)").evaluateAll((el) => el.filter((e, i) => i !== 1 && e.scrollWidth > e.clientWidth + 1).length);
    bekle(kesik === 0, `${kesik} kısa öğe üç noktayla kesilmiş`);
    bekle(!(await sayfa.locator(".dashboard-header > .os-marka").isVisible()), "masaüstünde marka üst çubukta da görünüyor");
    bekle(await sayfa.locator(".os-gezinme-marka").isVisible(), "marka kenar çubuğunda yok");
  });
  await senaryo("kenar çubuğu: daraltılır, tercih kalır, yeniden açılışta parlama yok, geri genişler", async () => {
    // Kanıt sayfası: sayfa içi sekmeleri olan bir çalışma sayfası (yazım ekranında sekme yok).
    await git(sayfa, `/dashboard/editor/${TEZ}/kanit`);
    const dugme = sayfa.locator(".os-gezinme-daralt");
    bekle((await dugme.getAttribute("aria-expanded")) === "true", "geniş hâlde aria-expanded true değil");
    await dugme.click();
    await sayfa.waitForTimeout(400);
    bekle((await dugme.getAttribute("aria-expanded")) === "false", "daraltınca aria-expanded false olmadı");
    const genislik = (await sayfa.locator("nav.os-gezinme").boundingBox())?.width ?? 0;
    bekle(genislik <= 100, `daraltılmış kenar çubuğu ${genislik}px`);
    bekle(await sayfa.locator(".calisma-sekmeleri").first().isVisible(), "daraltınca çalışma sekmeleri sayfaya dönmeli");
    bekle((await sayfa.evaluate(() => localStorage.getItem("arvolab.kenar"))) === "dar", "tercih kaydedilmedi");
    // Yeniden açılış: JS paketleri 3 sn gecikse de ilk boyamada dar.
    await sayfa.route("**/*", async (r) => {
      if (r.request().resourceType() === "script") await new Promise((c) => setTimeout(c, 3000));
      r.continue().catch(() => {});
    });
    sayfa.goto(TABAN + "/dashboard", { timeout: 150000 }).catch(() => {});
    await sayfa.waitForEvent("domcontentloaded", { timeout: 150000 });
    bekle((await sayfa.evaluate(() => document.documentElement.getAttribute("data-kenar"))) === "dar", "JS gelmeden kenar çubuğu geniş");
    await sayfa.unroute("**/*");
    await sayfa.waitForLoadState("networkidle");
    await sayfa.locator(".os-gezinme-daralt").click();
    await sayfa.waitForTimeout(400);
    bekle(((await sayfa.locator("nav.os-gezinme").boundingBox())?.width ?? 0) >= 200, "geri genişlemedi");
    bekle((await sayfa.evaluate(() => localStorage.getItem("arvolab.kenar"))) === "genis", "genişletme kaydedilmedi");
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
  await sayfa.close();
}

// ---- YAZIM STÜDYOSU (Signature OS Phase 2): tek sağ panel, başlık satırı, işlev matrisi ----
{
  const YAZ = `/dashboard/editor/${TEZ}/write`;
  const yeniSayfa = async (viewport, yol = YAZ, ek = {}) => {
    const ctx = await tarayici.newContext({ viewport, ...ek });
    const sayfa = await ctx.newPage();
    await git(sayfa, yol);
    await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
    // Next'in geliştirme araçları düğmesi sol alt köşede bazı düğmelerin üstüne biniyor (yalnızca dev).
    await sayfa.addStyleTag({ content: "nextjs-portal { display: none !important }" });
    return { ctx, sayfa };
  };

  await senaryo("stüdyo: masaüstünde tek panel sütun; dört sekme, ok tuşu sekme değiştirir", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 1440, height: 900 });
    const panel = sayfa.locator("#yazim-yan-panel");
    bekle(await panel.isVisible(), "panel masaüstünde varsayılan açık değil");
    bekle((await panel.getAttribute("data-bicim")) === "sutun", "panel sütun biçiminde değil");
    const sekmeler = panel.getByRole("tab");
    bekle((await sekmeler.count()) === 4, `${await sekmeler.count()} sekme var (4 beklenir)`);
    bekle((await panel.getByRole("tab", { selected: true }).innerText()).includes("İnceleme"), "varsayılan görünüm İnceleme değil");
    await panel.getByRole("tab", { selected: true }).focus();
    await sayfa.keyboard.press("ArrowRight");
    bekle((await panel.getByRole("tab", { selected: true }).innerText()).includes("Kaynaklar"), "→ Kaynaklar'a geçmedi");
    bekle(await sayfa.evaluate(() => document.activeElement?.getAttribute("role") === "tab"), "odak sekmede kalmadı");
    // Asistan kutusu ayrı bir sabit kutu değil: yalnızca panelin içinde var.
    bekle((await sayfa.locator(".yazim-paneli").count()) <= 1, "birden fazla asistan kutusu");
    await ctx.close();
  });

  await senaryo("stüdyo: Arvo AI asistanı panelde açar; panel kapanınca belge sütunu genişler", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 1440, height: 900 });
    const once = (await sayfa.locator(".manuscript-main").boundingBox()).width;
    await sayfa.locator(".yazma-ai").click();
    const panel = sayfa.locator("#yazim-yan-panel");
    await sayfa.waitForTimeout(300);
    bekle((await panel.getByRole("tab", { selected: true }).innerText()).includes("Asistan"), "Arvo AI asistan görünümünü açmadı");
    bekle(await panel.locator(".yazim-paneli textarea").isVisible(), "asistanın istek kutusu görünmüyor");
    const kutu = await panel.locator(".yazim-paneli textarea").boundingBox();
    bekle(kutu.y + kutu.height <= 900, `istek kutusu ekranın altına taşıyor (${Math.round(kutu.y + kutu.height)})`);
    await panel.getByRole("button", { name: "Paneli kapat" }).click();
    await sayfa.waitForTimeout(300);
    bekle(!(await panel.isVisible()), "panel kapanmadı");
    const sonra = (await sayfa.locator(".manuscript-main").boundingBox()).width;
    bekle(sonra > once + 150, `belge sütunu genişlemedi (${Math.round(once)} → ${Math.round(sonra)})`);
    bekle((await sayfa.evaluate(() => localStorage.getItem("arvolab:inceleme-paneli"))) === "0", "kapalı tercih kaydedilmedi");
    await ctx.close();
  });

  await senaryo("stüdyo: ?teslim=… Teslim görünümünü açar ve maddeyi vurgular", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 1440, height: 900 }, `${YAZ}?teslim=cover`);
    const panel = sayfa.locator("#yazim-yan-panel");
    bekle((await panel.getByRole("tab", { selected: true }).innerText()).includes("Teslim"), "Teslim görünümü açılmadı");
    bekle(await panel.locator(".checklist").isVisible(), "teslim listesi panelde değil");
    bekle(await panel.getByRole("button", { name: /Kılavuz ve kaynakça kontrolü/ }).isVisible(), "kılavuz kontrolü düğmesi Teslim görünümünde değil");
    await ctx.close();
  });

  /*
    İŞLEV MATRİSİ: Phase 2'den önce editörde olan her denetimin yeni
    yerleşimde hâlâ ULAŞILABİLİR olduğu. Menüler açılarak taranır; ad
    aria-label, title ya da görünen metinden okunur. Bir işlev sessizce
    kaybolursa burası düşer.
  */
  await senaryo("stüdyo: işlev matrisi — eski editörün bütün denetimleri yeni yerleşimde var", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 1440, height: 900 });
    const adlar = new Set();
    const topla = async (kok) => {
      for (const ad of await sayfa.locator(`${kok} :is(button, select, a, h3, [role=switch], [role=tab])`).evaluateAll((el) =>
        el.filter((e) => e.checkVisibility()).map((e) => `${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("title") ?? ""} ${e.textContent ?? ""}`),
      )) adlar.add(ad.replace(/\s+/g, " "));
    };
    await topla(".yazma-basligi");
    await topla(".manuscript-araclar");
    for (const menu of await sayfa.locator(".manuscript-araclar .arac-menu-dugme, .yazma-eylemleri [aria-haspopup=menu]").all()) {
      await menu.click();
      await sayfa.waitForTimeout(150);
      await topla(".arac-menu-pencere:not([hidden])");
      await sayfa.keyboard.press("Escape");
    }
    const panel = sayfa.locator("#yazim-yan-panel");
    for (const sekme of ["Asistan", "İnceleme", "Kaynaklar", "Teslim"]) {
      await panel.getByRole("tab", { name: new RegExp(sekme) }).click();
      await sayfa.waitForTimeout(250);
      await topla("#yazim-yan-panel");
    }
    const hepsi = [...adlar].join(" | ");
    const GEREKEN = [
      "Geri al", "Yinele", "Kalın", "İtalik", "Altı çizili", "Üst simge", "Paragraf stili", "Yazı tipi", "Yazı boyutu",
      "Madde işaretli liste", "Numaralı liste", "Alıntı", "Sola hizala", "Ortala", "Sağa hizala", "İki yana yasla", "Satır aralığı", "İlk satır girintisi",
      "Tablo ekle", "Resim ekle", "Dipnot ekle", "Analiz sonucu ekle", "Resimlerim", "Şekil başlığı", "Tablo başlığı", "Word dosyasından aktar",
      "Kaynaktan atıf ekle", "Bul ve değiştir", "Sayfa ayarları", "Kapak sayfası", "Sürüm geçmişi", "Klavye kısayolları", "Odak modu",
      "Danışmana paylaş", "Word (.docx)", "PDF / Yazdır", "LaTeX", "Arvo AI", "Otomatik satır içi öneri", "Seçili cümleye kaynak bul",
      "Kılavuz ve kaynakça kontrolü", "Teslim kontrolü", "İçindekiler", "Yazım ipuçları", "Yazarlık", "Yorumlar", "yapı uyarısı", "Kaynak kütüphanesini aç",
    ];
    const eksik = GEREKEN.filter((g) => !hepsi.includes(g));
    bekle(eksik.length === 0, `ulaşılamayan işlevler: ${eksik.join(", ")}`);
    await ctx.close();
  });

  await senaryo("stüdyo: tablette panel kapalı başlar, Arvo AI sayfa olarak açar, Esc kapatır ve odak geri döner", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 820, height: 1180 });
    const panel = sayfa.locator("#yazim-yan-panel");
    bekle(!(await panel.isVisible()), "tablette panel belgeyi örterek açık başladı");
    await sayfa.locator(".yazma-ai").click();
    await sayfa.waitForTimeout(400);
    bekle(await panel.isVisible() && (await panel.getAttribute("data-bicim")) === "sayfa", "panel sayfa biçiminde açılmadı");
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(300);
    bekle(!(await panel.isVisible()), "Esc paneli kapatmadı");
    bekle(await sayfa.evaluate(() => document.activeElement?.classList.contains("yazma-ai")), "odak Arvo AI düğmesine dönmedi");
    await ctx.close();
  });

  await senaryo("stüdyo: telefonda panel alttan açılan sayfa, yatay kayma yok", async () => {
    const { ctx, sayfa } = await yeniSayfa({ width: 390, height: 844 }, YAZ, { hasTouch: true, isMobile: true });
    await sayfa.locator(".yazma-panel-dugmesi").click();
    await sayfa.waitForTimeout(400);
    const kutu = await sayfa.locator("#yazim-yan-panel").boundingBox();
    bekle(kutu && kutu.width >= 389 && kutu.y + kutu.height >= 843, `alttan açılan sayfa değil: ${JSON.stringify(kutu)}`);
    const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 1, `sayfa ${tasma}px taşıyor`);
    await ctx.close();
  });
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
  await senaryo("tablet: Daha fazla penceresinde adlar yazılı (rayın kuralları pencereye sızmıyor)", async () => {
    await git(sayfa, "/dashboard");
    // Next'in geliştirme araçları düğmesi sol alt köşede rayın "Daha fazla"sının üstüne biniyor (yalnızca dev).
    await sayfa.addStyleTag({ content: "nextjs-portal { display: none !important }" });
    await sayfa.locator(".os-gezinme-daha").click();
    const ad = sayfa.locator("dialog.os-daha .os-gezinme-ad").first();
    bekle(await ad.isVisible(), "pencerede uygulama adı görünmüyor");
    await sayfa.keyboard.press("Escape");
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
    bekle(await pencere.locator(".os-gezinme-ad").first().isVisible(), "pencerede uygulama adları gizli");
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
    bekle(metalar.length > 0 && metalar.every((r) => r === "#0d1219"), `theme-color ${metalar.join(",")}`);
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

  await senaryo("tipografi: arayüz her yerde Inter; belge kâğıdı kendi yazı yığınında (Signature OS)", async () => {
    const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
    const sayfa = await ctx.newPage();
    const aile = (sec) => sayfa.$eval(sec, (e) => getComputedStyle(e).fontFamily);
    await git(sayfa, "/dashboard/editor");
    const baslik = await aile(".projects-header h1");
    bekle(/inter/i.test(baslik.split(",")[0]) && !/newsreader/i.test(baslik), `sayfa başlığı Inter değil: ${baslik}`);
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    await sayfa.locator(".manuscript-editor-content.kagit h1").first().waitFor({ state: "visible", timeout: 30000 });
    // Belgenin yazısı arayüzden bağımsız: kâğıt --font-belge yığınında (SF Pro önde), arayüz değişince değişmez.
    const kagit = await aile(".manuscript-editor-content.kagit");
    bekle(/SF Pro Text/.test(kagit), `kâğıt belge yığınında değil: ${kagit}`);
    bekle(/SF Pro Text/.test(await aile(".manuscript-editor-content.kagit h1")), "belge başlığı belge yığınında değil");
    const govde = await sayfa.evaluate(() => getComputedStyle(document.body).fontFamily);
    bekle(/inter/i.test(govde.split(",")[0]), `arayüz gövdesi Inter değil: ${govde}`);
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
