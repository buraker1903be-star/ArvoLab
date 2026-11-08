/*
  PHASE 3 TARAYICI KABUL TESTİ (04.11.2026).

  Yerel önizlemede (npm run onizleme, sahte Supabase) gezinmenin üç
  biçimini, Ctrl+K komut merkezini ve DOI akışını gerçek tarayıcıda
  sınar. Birim testleri gezinme LİSTESİNİ sınıyor (os-uygulamalar.test.ts);
  hangi biçimin hangi genişlikte göründüğü, klavyenin çalışıp çalışmadığı
  CSS ve tarayıcı işi, onlar yalnızca burada görünür.

  CI'da DEĞİL: önizleme sunucusu ve Chromium ister. Sunucu TEST
  ASİSTANI AÇIK başlatılmalı (`npm run onizleme:ai`): Kaynaklar ⋯
  menüsündeki "Tarama asistanı" yalnızca asistan yapılandırılmışsa
  çizilir ve düz `npm run onizleme` ile o senaryo düşer (R0, 07.11.2026'ya
  kadar burada `npm run onizleme` yazıyordu). Yazma kipi GEREKMEZ;
  açıksa sunucu temiz veriyle başlatılmış olmalı, çünkü senaryolar sabit
  veriye göre yazıldı ve başka bir betiğin yazdığı veri onları bozar. Kullanım:
    npm run onizleme:ai
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
  await senaryo("Ctrl+K: açılır, yazılan DOI tanınır, Enter Kaynaklar'a götürür, çalışma seçtirilir, ekleme yapılmaz", async () => {
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
    /*
      Ana sayfada aktif çalışma yok (4.3.5, B2): kütüphane en son oluşturulan
      çalışmayı SEÇMEZ, "Hangi çalışma?" diye sorar; seçim DOI'yi korur.
    */
    bekle((await sayfa.locator(".empty-state-baslik").textContent()) === "Hangi çalışma?", "çalışma seçimi istenmedi");
    bekle(!(await sayfa.locator(".doi-kutusu").count()), "seçimden önce ekleme kutusu açıldı");
    await sayfa.locator(`.calisma-secim-listesi a[href*="${TEZ}"]`).click();
    await sayfa.waitForURL(new RegExp(`calisma=${TEZ}.*doi=|doi=.*calisma=${TEZ}`), { timeout: 60000 });
    await sayfa.waitForLoadState("networkidle");
    bekle(/Eklenecek çalışma/.test(await sayfa.locator(".doi-kutusu-hedef").textContent()), "hedef çalışma yazmıyor");
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
    bekle((await panel.getByRole("tab", { selected: true }).innerText()).includes("Arvo AI"), "Arvo AI asistan görünümünü açmadı");
    // Asistan ayrı bir paket (dynamic import): soğuk sunucuda ilk derleme birkaç saniye sürebilir.
    await panel.locator(".yazim-paneli textarea").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
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
    // Yalnızca çubukta görünen gruplar (UX S3+S4): sığmayan grubun araçları "⋯" menüsünde, o da bu döngüde açılıyor.
    // Yalnızca GÖRÜNEN menüler: telefonun "Belge" menüsü masaüstünde gizli (Premium Simplicity Aşama 1); aynı işlevler masaüstünde başlıkta.
    for (const menu of await sayfa.locator(".manuscript-araclar > .arac-grup:not([hidden]) .arac-menu-dugme:visible, .yazma-eylemleri button[aria-expanded][aria-controls]:not([aria-controls=yazim-yan-panel]):visible").all()) {
      await menu.click();
      await sayfa.waitForTimeout(150);
      await topla(".arac-menu-pencere:not([hidden])");
      await sayfa.keyboard.press("Escape");
    }
    const panel = sayfa.locator("#yazim-yan-panel");
    for (const sekme of ["Arvo AI", "İnceleme", "Kaynaklar", "Teslim"]) {
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
    // Telefonda panel düğmesi "Belge" menüsünde (Premium Simplicity Aşama 1, 08.11.2026).
    await sayfa.locator("button.yazma-belge-menu").click();
    await sayfa.locator(".arac-menu-pencere:popover-open button", { hasText: "Yazım paneli" }).click();
    await sayfa.waitForTimeout(400);
    const kutu = await sayfa.locator("#yazim-yan-panel").boundingBox();
    bekle(kutu && kutu.width >= 389 && kutu.y + kutu.height >= 843, `alttan açılan sayfa değil: ${JSON.stringify(kutu)}`);
    const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 1, `sayfa ${tasma}px taşıyor`);
    await ctx.close();
  });
}

// ---- RESEARCH HOME ve ÇALIŞMALARIM (Signature OS Phase 3): üç soru, tek ana eylem, işlev matrisi ----
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const sayfa = await ctx.newPage();
  /* Görünen her etkileşimli öğenin adı (aria-label, title, metin). */
  const adlar = async (kok) =>
    (await sayfa.locator(`${kok} :is(a, button, summary, h2, h3)`).evaluateAll((el) =>
      el.filter((e) => e.checkVisibility()).map((e) => `${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("title") ?? ""} ${e.textContent ?? ""}`.replace(/\s+/g, " ")),
    )).join(" | ");

  await senaryo("ana sayfa: ilk bakışta hangi çalışma, ne kadar ilerleme, şimdi ne — tek ana eylem", async () => {
    await git(sayfa, "/dashboard");
    const kart = sayfa.locator("section.tez-kart");
    await kart.waitFor({ state: "visible", timeout: 30000 });
    bekle((await kart.locator("h2").innerText()).length > 5, "aktif çalışmanın adı yok");
    bekle((await kart.locator(".tez-olcu").count()) === 3, "üç ölçü yok (teslim, yazılan, hazırlık)");
    bekle(await kart.locator(".tez-simdi").isVisible(), "'Şimdi' satırı yok");
    const kutu = await kart.boundingBox();
    bekle(kutu.y < 200, `aktif çalışma ekranın üstünde değil (y=${Math.round(kutu.y)})`);
    // Ana içerikte yalnızca BİR birincil düğme: "Yazmaya devam et".
    const birincil = await sayfa.locator("main .projects-primary-button").evaluateAll((el) => el.filter((e) => e.checkVisibility()).map((e) => e.textContent.trim()));
    bekle(birincil.length === 1 && /Yazmaya/.test(birincil[0]), `birincil düğmeler: ${birincil.join(", ")}`);
    // İçinde kart yok: ölçüler kutu değil.
    const olcuZemin = await kart.locator(".tez-olcu").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    bekle(/rgba\(0, 0, 0, 0\)|transparent/.test(olcuZemin), `ölçü kutusu zeminli: ${olcuZemin}`);
  });

  await senaryo("ana sayfa: işlev matrisi — eski ana sayfanın bütün bağlantı ve eylemleri yerinde", async () => {
    await git(sayfa, "/dashboard");
    await sayfa.locator("details.ana-detay > summary").click();
    await sayfa.waitForTimeout(200);
    const hepsi = await adlar("main");
    /*
      Premium Simplicity Aşama 2 (08.11.2026): "Dikkat isteyenler" kartı tek
      satırlık "Teslim listesi"ne indi (aynı hedef: write?teslim=1; maddeler
      editörün Teslim sekmesinde ve Çalışmalarım'da). "Takvim" tez kartında
      yalnız sıradaki adım oysa görünür; her zaman Çalışmalarım'daki
      çalışmanın araçlarında (o senaryonun listesinde). Taşınan her hedefin
      erişilebilirliğini genel-bakis-sadelik-kabul.mjs sınar.
    */
    const GEREKEN = [
      "Yazmaya devam et", "Çalışma özeti",
      "Teslim listesi", "Bölümlerim", "Editörde aç", "Yazım ritmi",
      "Literatür", "Kaynakça denetimi", "Kanıt matrisi", "Etik kurul", "Belge kontrolü",
      "Danışman", "Abonelik ve kredi", "Ayrıntı", "Kredi satın al",
      // "Veri analizi" hızlı eylemi kalktı (Aşama 2/A2-3): kenar çubuğundaki Analiz Merkezi'nin tekrarıydı; genel-bakis-sadelik-kabul.mjs kenar çubuğunda arar.
      "Son kaynaklar", "Bütün kaynaklar", "Son belge kontrolleri", "DOI ile kaynak ekle", "Yazım asistanını aç", "Kaynağa sor",
    ];
    const eksik = GEREKEN.filter((g) => !hepsi.includes(g));
    bekle(eksik.length === 0, `ana sayfada ulaşılamayan: ${eksik.join(", ")}`);
  });

  await senaryo("çalışmalarım: satırda tür, son düzenleme ve teslim; seçili satır işaretli", async () => {
    await git(sayfa, `/dashboard/editor?sec=${TEZ}`);
    const secili = sayfa.locator('.calisma-secim .gb-satir[aria-current="true"]');
    bekle((await secili.count()) === 1, `${await secili.count()} seçili satır`);
    const metin = await secili.innerText();
    bekle(/Tez/.test(metin) && /önce|ago/.test(metin), `tür/son düzenleme yok: ${metin}`);
    bekle(await secili.locator(".calisma-teslim").isVisible(), "teslim satırı yok");
  });

  await senaryo("çalışmalarım: ayrıntı kartı içerik yüksekliğinde, araçların altında boşluk yok (Signature OS 4.0)", async () => {
    await git(sayfa, `/dashboard/editor?sec=${TEZ}`);
    const kart = await sayfa.locator(".calisma-durum").boundingBox();
    const araclar = await sayfa.locator(".calisma-durum .calisma-araclari").boundingBox();
    const bosluk = kart.y + kart.height - (araclar.y + araclar.height);
    bekle(bosluk <= 40, `araçların altında ${Math.round(bosluk)} px boşluk`);
  });
  await senaryo("çalışmalarım: tek ana eylem 'Yazmaya devam et'; seyrek işler ⋯ menüsünde, araçların hepsi yerinde", async () => {
    await git(sayfa, `/dashboard/editor?sec=${TEZ}`);
    const kart = sayfa.locator(".calisma-durum");
    const birincil = await sayfa.locator("main .projects-primary-button").evaluateAll((el) => el.filter((e) => e.checkVisibility()).map((e) => e.textContent.trim()));
    bekle(birincil.length === 1 && /Yazmaya/.test(birincil[0]), `birincil düğmeler: ${birincil.join(", ")}`);
    await kart.locator(".kart-menu-asagi > summary").click();
    await sayfa.waitForTimeout(200);
    const menu = kart.locator(".kart-menu-asagi .kart-menu-liste");
    const menuKutu = await menu.boundingBox();
    const ozet = await kart.locator(".kart-menu-asagi > summary").boundingBox();
    bekle(menuKutu.y > ozet.y, "menü aşağı açılmadı");
    const hepsi = await adlar(".calisma-durum");
    const GEREKEN = ["Teslim paketi", "Bilgileri düzenle", "Belge yükle", "Çalışmayı sil", "Kılavuz", "Takvim", "Literatür", "Kaynakça", "Kanıt matrisi", "Etik kurul", "Analiz", "Başka neler var"];
    const eksik = GEREKEN.filter((g) => !hepsi.includes(g));
    bekle(eksik.length === 0, `çalışmalarımda ulaşılamayan: ${eksik.join(", ")}`);
    await sayfa.keyboard.press("Escape");
  });
  /*
    R0 (07.11.2026): birden çok çalışma varken adreste ?calisma= yoksa
    Kaynaklar listeyi DEĞİL çalışma seçiciyi çizer (lib/calisma-secimi.ts →
    "secim-gerekli"). yazma.mjs bu yüzden aylarca "Inflation" kaynağını
    bulamayıp zaman aşımına düşüyordu: betik adressiz açıyordu, önizlemede
    iki çalışma var. Bu senaryo davranışın kendisini sabitler: seçici
    görünür, her çalışma için doğru adres (DOI kutuya taşınır), seçince
    o çalışmanın listesi gelir.
  */
  await senaryo("kaynaklar: iki çalışma varken adressiz açılış çalışma seçiciyi gösterir, seçim doğru listeyi açar (R0)", async () => {
    const DOI = "10.1086/261725";
    await git(sayfa, `/dashboard/literature?doi=${encodeURIComponent(DOI)}`);
    const liste = sayfa.locator("ul.calisma-secim-listesi");
    await liste.waitFor({ state: "visible", timeout: 30000 });
    bekle((await sayfa.locator(".kaynak-ad").count()) === 0, "seçim yapılmadan kaynak listesi çizilmemeli");
    const adresler = await liste.locator("a[href]").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    bekle(adresler.length === 2, `iki çalışma bekleniyordu, ${adresler.length} bağlantı var`);
    for (const kimlik of [TEZ, "00000000-0000-4000-8000-0000000000b2"]) {
      const adres = adresler.find((h) => h.includes(`calisma=${kimlik}`));
      bekle(adres, `çalışma bağlantısı yok: ${kimlik}`);
      bekle(new URL(adres, TABAN).searchParams.get("doi") === DOI, `DOI seçim bağlantısına taşınmadı: ${adres}`);
    }
    await liste.locator(`a[href*="calisma=${TEZ}"]`).click();
    await sayfa.waitForURL((u) => u.searchParams.get("calisma") === TEZ, { timeout: 30000 });
    await sayfa.locator(".kaynak-ad", { hasText: "Inflation" }).waitFor({ state: "visible", timeout: 30000 });
    bekle((await sayfa.locator("ul.calisma-secim-listesi").count()) === 0, "seçimden sonra seçici kalmamalı");
  });
  await senaryo("kaynaklar: kaynağın adı ayrıntıyı açar, bütün künye ve not; Esc odağı satıra geri verir (Signature OS 4.1)", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    const ad = sayfa.locator(".kaynak-ad").first();
    await ad.waitFor({ state: "visible", timeout: 30000 });
    const baslik = (await ad.textContent()).trim();
    await ad.focus();
    await sayfa.keyboard.press("Enter");
    const pencere = sayfa.locator(".drawer-root.open[data-boy='yan']");
    await pencere.waitFor({ state: "visible", timeout: 10000 });
    const metin = await pencere.textContent();
    for (const g of ["Okuma durumu", "Künye", "Notlarım", baslik]) bekle(metin.includes(g), `ayrıntıda yok: ${g}`);
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(500);
    const odak = await sayfa.evaluate(() => document.activeElement?.className ?? "");
    bekle(odak.includes("kaynak-ad"), `odak satıra dönmedi: ${odak}`);
  });
  await senaryo("kaynaklar: tek birincil eylem; seyrek eylemler ⋯ menüsünde, menüden açılan pencere kapanınca odak menü düğmesinde", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    // DOI kutusunun "Ekle"si boşken devre dışı: alanın kendi gönder düğmesi, sayfa eylemi değil.
    const birincil = await sayfa.locator("main .projects-primary-button:not(:disabled)").evaluateAll((el) => el.filter((e) => e.checkVisibility()).map((e) => e.textContent.trim()));
    bekle(birincil.length === 1 && /Kaynak bul/.test(birincil[0]), `birincil düğmeler: ${birincil.join(", ")}`);
    const menu = sayfa.locator(".sayfa-tasma-dugme").first();
    await menu.focus();
    await sayfa.keyboard.press("ArrowDown");
    await sayfa.waitForTimeout(200);
    const ogeler = await sayfa.locator(".sayfa-tasma-menu:not([hidden]) button").allTextContents();
    for (const g of ["Tarama asistanı", "Dışa aktar"]) bekle(ogeler.some((o) => o.includes(g)), `menüde yok: ${g}${g === "Tarama asistanı" ? " (test asistanı kapalı mı? sunucu `npm run onizleme:ai` ile başlatılmalı)" : ""}`);
    await sayfa.keyboard.press("Enter");
    await sayfa.locator(".drawer-root.open").waitFor({ state: "visible", timeout: 10000 });
    await sayfa.keyboard.press("Escape");
    await sayfa.waitForTimeout(500);
    const odak = await sayfa.evaluate(() => document.activeElement?.className ?? "");
    bekle(odak.includes("sayfa-tasma-dugme"), `odak menü düğmesine dönmedi: ${odak}`);
  });
  await senaryo("kaynak ayrıntısı: çalışmadaki yeri metinden, kanıttan ve DOI'den; künye aynı formla düzenlenir (Signature OS 4.2)", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    await sayfa.locator(".kaynak-ad", { hasText: "ARDL" }).click();
    const pencere = sayfa.locator(".drawer-root.open[data-boy='yan']");
    await pencere.waitFor({ state: "visible", timeout: 10000 });
    const yeri = (await pencere.locator("section[aria-labelledby$='-yeri']").textContent()).replace(/\s+/g, " ");
    bekle(/Evet: ilk yazarın adı ve yıl metinde/.test(yeri), `metinde atıf okunmadı: ${yeri}`);
    bekle(/1 iddiada kaynak olarak bağlı/.test(yeri), "kanıt matrisi bağı yok");
    bekle(/DOI'si aynı bir PDF var/.test(yeri), "PDF eşleşmesi yok");
    await pencere.getByRole("button", { name: "Düzenle" }).click();
    for (const ad of ["title", "authors", "year", "doiOrUrl", "containerTitle", "volume", "issue", "pages", "notes"]) {
      bekle((await pencere.locator(`[name=${ad}]`).count()) === 1, `düzenleme formunda alan yok: ${ad}`);
    }
    await pencere.getByRole("button", { name: "Vazgeç" }).click();
    bekle((await pencere.locator("[name=title]").count()) === 0, "Vazgeç formu kapatmadı");
    await sayfa.keyboard.press("Escape");
  });
  await senaryo("kaynak ayrıntısı: dizin karşılaştırması ulaşılamayınca 'doğrulanamadı' demez, sonuç kaydedilmez (Signature OS 4.2)", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    await sayfa.locator(".kaynak-ad", { hasText: "Inflation" }).click();
    const bolum = sayfa.locator(".drawer-root.open section[aria-labelledby$='-dogrulama']");
    await bolum.getByRole("button", { name: /Karşılaştır/ }).click();
    await bolum.locator(".alert, table, .status-pill").first().waitFor({ state: "visible", timeout: 45000 });
    const metin = (await bolum.textContent()).replace(/\s+/g, " ");
    // Önizleme ortamında dış ağ kapalı: ulaşılamadı yolu. Ağ açıksa tablo gelir; ikisinde de "Doğrulanamadı" hükmü ULAŞILAMAMADAN çıkmamalı.
    bekle(/ulaşılamıyor|Eşleşti|Farklı|Doğrulanamadı/.test(metin), `beklenmeyen sonuç: ${metin.slice(0, 200)}`);
    if (/ulaşılamıyor/.test(metin)) bekle(!/Doğrulanamadı/.test(metin), "geçici arıza 'doğrulanamadı' diye gösterildi");
    await sayfa.keyboard.press("Escape");
  });
  await senaryo("elle eklenen tekrar kaynak: eklenir ve UYARI bildirimi çıkar, 'İşlem tamamlanamadı' değil (Signature OS 4.2)", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    await sayfa.locator(".kaynak-bul-tetik").click();
    await sayfa.locator(".drawer-root.open button", { hasText: "Manuel kaynak ekle" }).click();
    const form = sayfa.locator(".drawer-root.open").filter({ has: sayfa.getByRole("heading", { name: "Manuel kaynak ekle" }) });
    await form.locator("input[name=title]").fill("ARDL Sınır Testi Yaklaşımı");
    await form.locator("input[name=year]").fill("2001");
    await form.locator("button[type=submit]", { hasText: "Ekle" }).click();
    const bildirim = sayfa.locator(".toast.is-uyari");
    await bildirim.waitFor({ state: "visible", timeout: 15000 });
    const metin = await bildirim.textContent();
    bekle(/Olası tekrar/.test(metin) && !/tamamlanamadı/.test(metin), `bildirim: ${metin}`);
    await sayfa.keyboard.press("Escape");
    await sayfa.keyboard.press("Escape");
  });
  await senaryo("kanıt matrisi: tablo taşıyorsa söylüyor, iddia sütunu yapışık, sıralama aria-sort ile; sayfa kaymıyor (Signature OS 4.1)", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/kanit`);
    const tablo = sayfa.locator(".veri-tablo");
    await tablo.waitFor({ state: "visible", timeout: 30000 });
    bekle((await tablo.locator("thead th").count()) === 9, "dokuz sütun yok");
    const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 0, `sayfa ${tasma}px taşıyor`);
    const tasiyor = await sayfa.locator(".veri-tablo-sarici[data-tasiyor]").count();
    if (tasiyor) bekle(await sayfa.locator(".veri-tablo-ipucu").isVisible(), "taşan tablo bunu söylemiyor");
    await tablo.locator("thead button", { hasText: "Destek" }).click();
    bekle((await tablo.locator("th[aria-sort='ascending']").count()) === 1, "aria-sort yazılmadı");
  });
  await senaryo("dört temsilî ekran 820 ve 1440 pikselde yatay kaymıyor (Signature OS 4.1)", async () => {
    for (const w of [820, 1440]) {
      const c = await tarayici.newContext({ viewport: { width: w, height: 1000 } });
      const s2 = await c.newPage();
      for (const yol of [`/dashboard/literature?calisma=${TEZ}`, `/dashboard/editor/${TEZ}/kanit`, `/dashboard/analysis?calisma=${TEZ}`, `/dashboard/documents?calisma=${TEZ}`]) {
        await git(s2, yol);
        await s2.locator("main h1").first().waitFor({ state: "visible", timeout: 30000 });
        const tasma = await s2.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        bekle(tasma <= 0, `${w}px ${yol}: ${tasma}px taşıyor`);
      }
      await c.close();
    }
  });
  await ctx.close();
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
  await senaryo("telefon: ana sayfanın ilk ekranında aktif çalışma, ölçüler ve 'Şimdi' (Signature OS 4.0)", async () => {
    await git(sayfa, "/dashboard");
    const simdi = sayfa.locator(".tez-kart .tez-simdi");
    await simdi.waitFor({ state: "visible", timeout: 30000 });
    const alt = (await simdi.boundingBox()).y + (await simdi.boundingBox()).height;
    // Alt çubuk (64 px + güvenli alan) ekranın altını kaplıyor: "Şimdi" onun üstünde bitmeli.
    bekle(alt <= 844 - 64, `'Şimdi' ilk ekranın dışında (alt kenar ${Math.round(alt)} px)`);
    bekle((await sayfa.locator(".tez-kart .tez-olcu").count()) === 3, "üç ölçü yok");
  });
  await senaryo("telefon: giriş sayfası yatay kaymıyor (ipucu balonu kaydırma alanını büyütmüyor)", async () => {
    const ctx = await tarayici.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const giris = await ctx.newPage();
    await git(giris, "/");
    const tasma = await giris.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 0, `giriş sayfası ${tasma}px taşıyor`);
    await ctx.close();
  });
  await senaryo("telefon: yazım ekranı yatay kaymıyor", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    // Yalnızca "taşma yok" demek boş bir hata sayfasında da geçer: önce editör çizilmiş olmalı.
    await sayfa.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 30000 });
    const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    bekle(tasma <= 1, `sayfa ${tasma}px taşıyor`);
  });
  await senaryo("telefon: sunucu ilk çizimde de kart listesi çiziyor (hidrasyonda tablo → kart sıçraması yok, Signature OS 4.2)", async () => {
    const yanit = await sayfa.request.get(`${TABAN}/dashboard/editor/${TEZ}/kanit`, {
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    });
    const html = await yanit.text();
    bekle(html.includes("veri-karti") && !html.includes('class="veri-tablo"'), "sunucu çıktısında telefon için tablo var");
  });
  await senaryo("telefon: kanıt matrisi kart listesi, dokuz sütunun hepsi başlığıyla; sütun gizlenmiyor (Signature OS 4.1)", async () => {
    await git(sayfa, `/dashboard/editor/${TEZ}/kanit`);
    const kart = sayfa.locator(".veri-karti").first();
    await kart.waitFor({ state: "visible", timeout: 30000 });
    bekle((await sayfa.locator(".veri-tablo").count()) === 0, "telefonda tablo çizildi");
    const basliklar = await kart.locator("dt").allTextContents();
    bekle(basliklar.length === 8, `kartta ${basliklar.length} alan (8 beklenirdi: iddia başlıkta)`);
    for (const g of ["Destek düzeyi", "Eksik kanıt", "Önerilen düzeltme"]) bekle(basliklar.includes(g), `kartta yok: ${g}`);
  });
  await senaryo("telefon: kaynaklarda ikinci eylemler ⋯ menüsünde, birincil görünür; temsilî ekranlarda taşma ve 40 pikselden küçük hedef yok", async () => {
    await git(sayfa, `/dashboard/literature?calisma=${TEZ}`);
    await sayfa.locator(".kaynak-bul-tetik").waitFor({ state: "visible", timeout: 30000 });
    bekle(!(await sayfa.locator("main button", { hasText: "İçe aktar" }).first().isVisible()), "İçe aktar telefonda satırda kaldı");
    for (const yol of [`/dashboard/literature?calisma=${TEZ}`, `/dashboard/editor/${TEZ}/kanit`, `/dashboard/analysis?calisma=${TEZ}`, `/dashboard/documents?calisma=${TEZ}`]) {
      await git(sayfa, yol);
      await sayfa.locator("main h1").first().waitFor({ state: "visible", timeout: 30000 });
      const tasma = await sayfa.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      bekle(tasma <= 0, `${yol}: ${tasma}px taşıyor`);
      const kucuk = await sayfa.evaluate(() =>
        [...document.querySelectorAll(".sayfa-basligi :is(a, button, select), .sayfa-eylemleri button, .liste-araclari :is(button, select, .kaynak-arama), .veri-karti button, .kaynak-ad")]
          .filter((e) => e.checkVisibility())
          .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 39.5; })
          .map((e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30)),
      );
      bekle(kucuk.length === 0, `${yol}: küçük hedef: ${kucuk.join(", ")}`);
    }
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

  await senaryo("tema: belge kâğıdı koyu temada açık (#ECE9E2) ve koyu mürekkepli (Phase 4.3, UX S8)", async () => {
    // Akademik belgenin sayfası uygulama temasından bağımsız: .kagit açık tokenları kendi üzerinde kurar.
    // UX S8 (07.11.2026): koyu temada ekrandaki kâğıt saf beyaz değil #ECE9E2 (ayrıntı: kagit-kabul.mjs).
    const ctx = await tarayici.newContext({ colorScheme: "dark" });
    const sayfa = await ctx.newPage();
    await git(sayfa, `/dashboard/editor/${TEZ}/write`);
    const kagit = sayfa.locator(".manuscript-editor-content.kagit").first();
    await kagit.waitFor({ state: "visible", timeout: 30000 });
    const renk = await kagit.evaluate((el) => ({ zemin: getComputedStyle(el).backgroundColor, yazi: getComputedStyle(el).color, tema: document.documentElement.getAttribute("data-theme") }));
    bekle(renk.tema === "dark", `tema ${renk.tema}`);
    bekle(renk.zemin === "rgb(236, 233, 226)", `kâğıt zemini ${renk.zemin}`);
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
