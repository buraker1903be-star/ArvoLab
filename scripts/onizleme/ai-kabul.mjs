/*
  PHASE 4.3 — ARVO AI KABUL TESTİ (05.11.2026).

  Yazım asistanının KARAR akışını gerçek tarayıcıda, önizleme test
  asistanıyla (scripts/onizleme/saglayici.ts, sabit cevaplı) sınar.
  Editör testleri (tests/editor/asistan-araligi.test.ts) mekanizmayı
  tarayıcısız sınıyor; panelin düğmeleri, seçimin DOM'dan gelmesi,
  odak ve sürüm eyleminin ağ hatası yalnızca burada görünür.

  CI'da DEĞİL. ÖNKOŞULLAR (ikisi de gerekli):
    1. Test asistanı açık: `npm run onizleme:ai` (ARVOLAB_ONIZLEME=1,
       ONIZLEME_AI=1, AI_ANAHTAR=onizleme). Düz `npm run onizleme` ile
       asistan yapılandırılmamış sayılır ve asistan düğmeleri hiç çıkmaz.
    2. Yazma kipi açık: ONIZLEME_YAZ=1. Yenileme senaryosu kaydın bellekte
       kalıcı olmasını ister; kapalıyken "kayıt kalıcı değil" diye düşer.
  Sunucu temiz veriyle başlamalı: yazma kipi veriyi bellekte değiştirir ve
  önceki bir koşunun metni belgede kalır (yeniden başlatınca veri.ts'e
  döner). Chromium ve NODE_PATH ile genel playwright gerekir.
    ONIZLEME_YAZ=1 npm run onizleme:ai
    NODE_PATH=$(npm root -g) node scripts/onizleme/ai-kabul.mjs [taban-adres]
  Çıkış kodu: 0 temiz, 1 bir senaryo düştü, 2 önkoşul yok (senaryolara
  girilmedi). Önkoşul 1 başta denetlenir; 2'nin dışarıdan görünen bir
  işareti yok, yalnızca ilgili senaryonun mesajı söyler.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).slice(0, 240) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}

const tarayici = await chromium.launch();

/*
  Önkoşul: test asistanı açık mı? Ürünün kendi işaretine bakılır —
  Kaynaklar'ın ⋯ menüsündeki "Tarama asistanı" yalnızca asistan
  yapılandırılmışsa çizilir (literaturAsistaniAcik → aiYapilandirildi).
  Eskiden yanlış sunucuya karşı koşunca her senaryo ayrı ayrı ve
  anlaşılmaz biçimde (düğme bulunamadı, zaman aşımı) düşüyordu.
*/
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  let asistanAcik = false;
  try {
    await s.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
    await s.locator(".sayfa-tasma-dugme").first().click({ timeout: 30000 });
    await s.waitForTimeout(300);
    asistanAcik = (await s.locator(".sayfa-tasma-menu:not([hidden]) button", { hasText: "Tarama asistanı" }).count()) > 0;
  } catch (hata) {
    console.log(`Önkoşul denetlenemedi (${TABAN} açılmıyor mu?): ${String(hata?.message ?? hata).slice(0, 160)}`);
    await tarayici.close();
    process.exit(2);
  }
  await ctx.close();
  if (!asistanAcik) {
    console.log("ÖNKOŞUL YOK: test asistanı kapalı. Sunucuyu `ONIZLEME_YAZ=1 npm run onizleme:ai` ile başlatın.");
    await tarayici.close();
    process.exit(2);
  }
  console.log("✓ önkoşul: test asistanı açık");
}
async function editorAc(secenek = { viewport: { width: 1440, height: 900 } }, hazirla) {
  const ctx = await tarayici.newContext(secenek);
  const sayfa = await ctx.newPage();
  if (hazirla) await hazirla(sayfa);
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").first().waitFor();
  return { ctx, sayfa };
}
const paragraflar = (s) => s.evaluate(() => [...document.querySelectorAll(".ProseMirror p")].map((e) => e.textContent));
const belgeJson = (s) => s.evaluate(() => JSON.stringify(document.querySelector(".ProseMirror").editor.getJSON()));
/**
 * n. uzun paragrafın tamamını (ya da ilk `uzunluk` karakterini) DOM seçimiyle seçer
 * ve ProseMirror'ın bu seçimi OKUMASINI bekler (koşul, sabit süre değil).
 * Eskiden DOM seçimi kurulur kurulmaz dönülüyordu; ProseMirror seçimi
 * eşzamansız (selectionchange) okuduğu için hemen gelen tuş boş seçim
 * görebiliyordu (R3, 08.11.2026). Ürün tarafı da artık bu yarışa dayanıklı
 * (secim-ai.tsx); yardımcı, kullanıcı gibi seçimin yerleşmesini bekler.
 */
const sec = async (s, n = 0, uzunluk) => {
  const metin = await s.evaluate(
    ([n, uzunluk]) => {
      const par = [...document.querySelectorAll(".ProseMirror p")].filter((e) => e.textContent.trim().length > 60)[n];
      const r = document.createRange();
      if (uzunluk) {
        const tn = document.createTreeWalker(par, NodeFilter.SHOW_TEXT).nextNode();
        r.setStart(tn, 0);
        r.setEnd(tn, Math.min(uzunluk, tn.length));
      } else r.selectNodeContents(par);
      const se = getSelection();
      se.removeAllRanges();
      se.addRange(r);
      return par.textContent;
    },
    [n, uzunluk],
  );
  await s.waitForFunction(() => {
    const ed = document.querySelector(".ProseMirror")?.editor;
    const dom = getSelection();
    return Boolean(ed) && !ed.state.selection.empty && dom && !dom.isCollapsed;
  }, null, { timeout: 5000 });
  return metin;
};
const imlec = (s, n, ofset) =>
  s.evaluate(
    ([n, ofset]) => {
      const par = [...document.querySelectorAll(".ProseMirror p")].filter((e) => e.textContent.trim().length > 60)[n];
      const tn = document.createTreeWalker(par, NodeFilter.SHOW_TEXT).nextNode();
      const r = document.createRange();
      r.setStart(tn, ofset);
      r.collapse(true);
      const se = getSelection();
      se.removeAllRanges();
      se.addRange(r);
    },
    [n, ofset],
  );
const kart = (s) => s.locator(".yazim-oneri").last();
const kartBekle = (s, sayi) => s.waitForFunction((n) => document.querySelectorAll(".yazim-oneri").length >= n, sayi, { timeout: 30000 });
const asistaniAc = async (s) => {
  await s.locator("button.yazma-ai").click();
  await s.locator(".yazim-girdi textarea").waitFor();
};
const iste = async (s, metin) => {
  await s.locator(".yazim-girdi textarea").fill(metin);
  await s.locator(".yazim-girdi textarea").press("Enter");
};

// ---- Fark, kabul, geri al, reddet, düzenleyerek kabul ----
{
  const { ctx, sayfa } = await editorAc();
  const ilkJson = await belgeJson(sayfa);
  const ilk = await paragraflar(sayfa);
  let secilen;

  await senaryo("Kısalt: kelime farkı görünür, belge karar verilene kadar DEĞİŞMEZ", async () => {
    secilen = await sec(sayfa, 0);
    await asistaniAc(sayfa);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Kısalt" }).click();
    await kartBekle(sayfa, 1);
    bekle((await kart(sayfa).locator("del").count()) > 0 && (await kart(sayfa).locator("ins").count()) > 0, "fark yok");
    bekle(/kelime/.test(await kart(sayfa).locator(".yazim-oneri-ozet").textContent()), "özet yok");
    bekle(await kart(sayfa).locator("del .sr-only").count(), "ekran okuyucu öneki yok");
    bekle(JSON.stringify(await paragraflar(sayfa)) === JSON.stringify(ilk), "belge kendiliğinden değişti");
  });
  await senaryo("Fark işaretleri belgeye ve belge JSON'una girmez", async () => {
    bekle(!/<del|<ins|diff-/.test(await sayfa.evaluate(() => document.querySelector(".ProseMirror").innerHTML)), "belgede fark işareti");
    bekle((await belgeJson(sayfa)) === ilkJson, "JSON değişti");
  });
  await senaryo("Kabul et seçimin yerine koyar; Geri al belgeyi eski hâline döndürür", async () => {
    await kart(sayfa).getByRole("button", { name: "Kabul et", exact: true }).click();
    await sayfa.waitForTimeout(300);
    bekle(!(await paragraflar(sayfa)).includes(secilen), "seçim değişmedi");
    bekle((await kart(sayfa).getAttribute("data-durum")) === "uygulandi", "durum uygulandı değil");
    await kart(sayfa).getByRole("button", { name: "Geri al" }).click();
    await sayfa.waitForTimeout(300);
    bekle(JSON.stringify(await paragraflar(sayfa)) === JSON.stringify(ilk), "geri alma eski hâli getirmedi");
    bekle((await belgeJson(sayfa)) === ilkJson, "geri almadan sonra JSON farklı");
  });
  await senaryo("Reddet belgeye dokunmaz", async () => {
    await sec(sayfa, 0);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Akademikleştir" }).click();
    await kartBekle(sayfa, 2);
    await kart(sayfa).getByRole("button", { name: "Reddet" }).click();
    bekle((await kart(sayfa).getAttribute("data-durum")) === "reddedildi", "durum reddedildi değil");
    bekle((await belgeJson(sayfa)) === ilkJson, "reddetme belgeyi değiştirdi");
  });
  await senaryo("Düzenleyerek kabul: kullanıcının düzenlediği metin girer", async () => {
    await sec(sayfa, 0);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Genişlet" }).click();
    await kartBekle(sayfa, 3);
    await kart(sayfa).getByRole("button", { name: "Düzenleyerek kabul et" }).click();
    await kart(sayfa).locator("textarea").fill("ÖĞRENCİNİN DÜZENLEDİĞİ METİN.");
    await kart(sayfa).locator("textarea").press("Control+Enter");
    await sayfa.waitForTimeout(300);
    bekle((await paragraflar(sayfa)).some((p) => p.includes("ÖĞRENCİNİN DÜZENLEDİĞİ METİN.")), "düzenlenen metin yok");
  });
  await senaryo("AI metni sonradan düzenlendiyse Geri al YAPILMAZ, Sürümler önerilir", async () => {
    await sayfa.evaluate(() => {
      const par = [...document.querySelectorAll(".ProseMirror p")].find((e) => e.textContent.includes("ÖĞRENCİNİN"));
      const tn = document.createTreeWalker(par, NodeFilter.SHOW_TEXT).nextNode();
      const r = document.createRange();
      r.setStart(tn, 3);
      r.collapse(true);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.type("XYZ");
    await kart(sayfa).getByRole("button", { name: "Geri al" }).click();
    await sayfa.waitForTimeout(200);
    bekle((await paragraflar(sayfa)).some((p) => p.includes("XYZ")), "kullanıcının yazdığı silindi");
    bekle(await kart(sayfa).locator(".yazim-oneri-uyari").count(), "uyarı yok");
    bekle(await kart(sayfa).getByRole("button", { name: "Sürümleri aç" }).count(), "Sürümleri aç yok");
  });
  await senaryo("Ctrl+Z: önce kullanıcının yazdığı, sonra AI değişikliği ayrı ayrı geri alınır", async () => {
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.press("Control+z");
    await sayfa.waitForTimeout(150);
    const bir = await paragraflar(sayfa);
    bekle(!bir.some((p) => p.includes("XYZ")) && bir.some((p) => p.includes("ÖĞRENCİNİN")), "ilk Ctrl+Z AI metnini de aldı");
    await sayfa.keyboard.press("Control+z");
    await sayfa.waitForTimeout(150);
    bekle((await paragraflar(sayfa)).includes(secilen), "ikinci Ctrl+Z AI değişikliğini almadı");
  });
  await senaryo("Bayat seçim: cevap beklenirken seçimin içine yazılırsa değiştirme REDDEDİLİR", async () => {
    await sec(sayfa, 0);
    await iste(sayfa, "YAVAS bunu düzelt");
    await sayfa.waitForTimeout(300);
    await imlec(sayfa, 0, 5);
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.type("ARA ");
    await kartBekle(sayfa, 4);
    const once = await paragraflar(sayfa);
    await kart(sayfa).getByRole("button", { name: "Kabul et", exact: true }).click();
    await sayfa.waitForTimeout(200);
    bekle(JSON.stringify(await paragraflar(sayfa)) === JSON.stringify(once), "bayat seçim değiştirildi");
    bekle(/değişti/.test(await kart(sayfa).locator(".yazim-oneri-uyari").textContent()), "uyarı yok");
  });
  await senaryo("Uydurma sayı içeren cevap düşer, öneri kartı çıkmaz", async () => {
    const kartSayisi = await sayfa.locator(".yazim-oneri").count();
    await iste(sayfa, "UYDURMA_SAYI yaz");
    await sayfa.waitForFunction(() => !document.querySelector(".yazim-yaziyor"), null, { timeout: 30000 });
    await sayfa.waitForTimeout(300);
    bekle((await sayfa.locator(".yazim-oneri").count()) === kartSayisi, "uydurma sayılı öneri gösterildi");
  });
  await senaryo("Kararlar memnuniyet puanı değil, yalnızca oturumda", async () => {
    const kararlar = JSON.parse(await sayfa.evaluate(() => sessionStorage.getItem("arvolab.ai-kararlari") ?? "[]"));
    const turler = kararlar.map((k) => k.karar);
    for (const k of ["kabul", "geri_alindi", "reddedildi", "duzenleyerek_kabul"]) bekle(turler.includes(k), `${k} kaydı yok`);
  });
  await ctx.close();
}

// ---- Otomatik sürüm ZORUNLU: alınamazsa uygulanmaz, sürümsüz seçenek yok (4.3 ek) ----
{
  let dusur = true;
  let surumIstegi = 0;
  const { ctx, sayfa } = await editorAc(undefined, (s) =>
    s.route("**/*", (route) => {
      const r = route.request();
      if (r.method() === "POST" && r.headers()["next-action"] && /Asistan değişikliğinden önce|Ana hat eklenmeden önce/.test(r.postData() ?? "")) {
        surumIstegi++;
        if (dusur) return route.fulfill({ status: 500, body: "x" });
      }
      return route.continue();
    }),
  );
  await asistaniAc(sayfa);
  const eylemler = () => kart(sayfa).locator(".yazim-oneri-eylem button").allTextContents();
  await senaryo("150 kelimeyi aşan değişiklikte sürüm alınamazsa UYGULANMAZ; yalnızca Tekrar dene / Vazgeç", async () => {
    await sayfa.evaluate(() => getSelection().collapse(document.querySelector(".ProseMirror p"), 0));
    await iste(sayfa, "UZUN paragraf yaz");
    await kartBekle(sayfa, 1);
    const once = await belgeJson(sayfa);
    await kart(sayfa).getByRole("button", { name: "Paragrafın altına ekle" }).click();
    await sayfa.waitForFunction(() => document.querySelector(".yazim-oneri .yazim-oneri-uyari"), null, { timeout: 15000 });
    bekle((await belgeJson(sayfa)) === once, "sürümsüz büyük değişiklik uygulandı");
    const d = (await eylemler()).map((x) => x.trim());
    bekle(JSON.stringify(d) === JSON.stringify(["Tekrar dene", "Vazgeç"]), `düğmeler: ${d.join(", ")}`);
    bekle(!(await sayfa.getByText("Sürüm almadan uygula").count()), "sürümsüz seçenek görünüyor");
  });
  await senaryo("Tekrar dene yine başarısızsa yine uygulanmaz", async () => {
    const once = await belgeJson(sayfa);
    const istek = surumIstegi;
    await kart(sayfa).getByRole("button", { name: "Tekrar dene" }).click();
    await sayfa.waitForTimeout(1500);
    bekle(surumIstegi > istek, "sürüm yeniden denenmedi");
    bekle((await belgeJson(sayfa)) === once, "ikinci hatada uygulandı");
    bekle((await kart(sayfa).getAttribute("data-durum")) === "oneri", "durum değişti");
  });
  await senaryo("Vazgeç: işlem iptal, belge aynı, öneri kararı bekler", async () => {
    const once = await belgeJson(sayfa);
    await kart(sayfa).getByRole("button", { name: "Vazgeç" }).click();
    bekle((await belgeJson(sayfa)) === once, "vazgeçince belge değişti");
    bekle(!(await kart(sayfa).locator(".yazim-oneri-uyari").count()), "uyarı kalmadı olmalı");
    bekle((await eylemler()).some((x) => x.includes("Paragrafın altına ekle")), "öneri eylemleri dönmedi");
  });
  await senaryo("Yeniden uygulamada sürüm yine ZORUNLU; sürüm alınınca uygulanır", async () => {
    const istek = surumIstegi;
    await kart(sayfa).getByRole("button", { name: "Paragrafın altına ekle" }).click();
    await sayfa.waitForFunction(() => document.querySelector(".yazim-oneri .yazim-oneri-uyari"), null, { timeout: 15000 });
    bekle(surumIstegi === istek + 1, "sürüm denenmeden geçildi");
    dusur = false;
    await kart(sayfa).getByRole("button", { name: "Tekrar dene" }).click();
    await sayfa.waitForFunction(() => document.querySelector(".yazim-oneri")?.dataset.durum === "uygulandi", null, { timeout: 15000 });
  });
  await ctx.close();
}

// ---- Seçimdeki Arvo AI ----
for (const [ad, secenek] of [
  ["masaüstü", { viewport: { width: 1440, height: 900 } }],
  ["telefon", { ...devices["iPhone 13"] }],
]) {
  const { ctx, sayfa } = await editorAc(secenek);
  await senaryo(`Seçim düğmesi (${ad}): seçimi örtmez, ekranda kalır`, async () => {
    const par = sayfa.locator(".ProseMirror p").filter({ hasText: /.{80,}/ }).nth(2);
    await par.scrollIntoViewIfNeeded();
    if (ad === "telefon") await par.tap();
    else await par.click();
    /*
      Telefonda bu senaryo aralıklı düşüyordu ("düğme görünmüyor"; R0,
      07.11.2026: 3 koşunun 2'sinde). Neden ÜRÜN değil, test kurgusu:
      sentetik dokunmanın hemen ardından JavaScript ile kurulan DOM seçimi
      bazen ProseMirror'a geçmiyor, editör dokunmanın bıraktığı boş imleçte
      kalıyor (ölçüldü: seçim 1013–1013, boş) ve düğme doğal olarak
      çıkmıyor. Gerçek kullanıcı seçimi uzun basarak, dokunmadan çok sonra
      yapar. Bu yüzden seçimin EDİTÖRE geçtiği beklenir, geçmediyse bir kez
      daha kurulur; düğmenin görünürlük ve örtme denetimi aynen kalır.
    */
    const edSecimi = () => sayfa.evaluate(() => !document.querySelector(".ProseMirror").editor.state.selection.empty);
    /*
      sec() seçim editöre geçmezse 5 sn sonra FIRLATIR (R3, 07.11.2026).
      O değişiklikten beri aşağıdaki "bir kez daha kur" döngüsüne hiç sıra
      gelmiyordu: ilk kurulum geçmeyince senaryo zaman aşımıyla düşüyordu
      (08.11.2026, taban kodda 6 koşunun 3'ü). Burada fırlatma yakalanır,
      döngü çalışır; üç denemede de geçmezse alttaki denetim yine düşer.
    */
    const kur = () => sec(sayfa, 2, 60).catch(() => null);
    await kur();
    for (let deneme = 0; deneme < 2 && !(await edSecimi()); deneme++) {
      await sayfa.waitForTimeout(400);
      await kur();
    }
    bekle(await edSecimi(), "seçim editöre geçmedi (test kurgusu)");
    await sayfa.locator(".secim-ai-dugme").waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    const k = await sayfa.evaluate(() => {
      const d = document.querySelector(".secim-ai-dugme")?.getBoundingClientRect();
      if (!d || !d.width) return null;
      const rs = [...getSelection().getRangeAt(0).getClientRects()];
      return { ortuyor: rs.some((r) => !(d.bottom <= r.top || d.top >= r.bottom || d.right <= r.left || d.left >= r.right)), ekranda: d.left >= 0 && d.right <= innerWidth && d.bottom <= innerHeight, yukseklik: d.height };
    });
    bekle(k, "düğme görünmüyor");
    bekle(!k.ortuyor, "seçimi örtüyor");
    bekle(k.ekranda, "ekran dışında");
    if (ad === "telefon") bekle(k.yukseklik >= 44, `dokunma hedefi ${k.yukseklik}px`);
  });
  if (ad === "masaüstü") {
    await senaryo("Seçim düğmesi: Alt+Enter → menü, oklar, Esc editöre döner; görev panele gider", async () => {
      await sayfa.locator(".ProseMirror").first().focus();
      await sec(sayfa, 2, 60);
      await sayfa.keyboard.press("Alt+Enter");
      // Sabit bekleme yerine: odak menüye girene kadar (en çok 3 sn); girmezse aşağıdaki denetim düşer.
      await sayfa.waitForFunction(() => Boolean(document.activeElement?.closest(".secim-ai-menu")), null, { timeout: 3000 }).catch(() => {});
      bekle((await sayfa.evaluate(() => document.activeElement.textContent)) === "Akademikleştir", "ilk öğe odakta değil");
      await sayfa.keyboard.press("Escape");
      /*
        TipTap'in focus() komutu odağı bir SONRAKİ karede verir
        (@tiptap/core commands/focus.ts: requestAnimationFrame). Esc'ten
        hemen sonra bakmak bu kareyle yarışıyordu: taze sunucuda 4 koşunun
        2'sinde "Esc editöre dönmedi" (08.11.2026). Koşul beklenir; odak
        hiç dönmezse 2 sn sonra senaryo yine düşer.
      */
      await sayfa.waitForFunction(() => document.activeElement?.classList.contains("ProseMirror"), null, { timeout: 2000 }).catch(() => {});
      bekle(await sayfa.evaluate(() => document.activeElement.classList.contains("ProseMirror")), "Esc editöre dönmedi");
      await sayfa.keyboard.press("Alt+Enter");
      await sayfa.waitForFunction(() => Boolean(document.activeElement?.closest(".secim-ai-menu")), null, { timeout: 3000 }).catch(() => {});
      await sayfa.keyboard.press("ArrowDown");
      await sayfa.keyboard.press("Enter");
      await sayfa.locator(".yazim-oneri").last().waitFor({ timeout: 30000 });
      bekle(/Kısaltılmış/.test(await sayfa.locator(".yazim-oneri-bas small").last().textContent()), "görev Kısalt değil");
    });
    await senaryo("Kısayollar penceresinde Arvo AI grubu (Alt+/, Tab, Alt+Enter)", async () => {
      await sayfa.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Kısayollar")?.click());
      const metin = await sayfa.locator(".shortcut-grup", { hasText: "Arvo AI" }).textContent({ timeout: 10000 });
      for (const t of ["/", "Tab", "Enter"]) bekle(metin.includes(t), `${t} yok`);
    });
  }
  await ctx.close();
}

// ---- Sayfa yenilenince AI geri alması (4.3 ek; ONIZLEME_YAZ=1 gerekir: kayıt bellekte kalıcı olsun) ----
{
  const { ctx, sayfa } = await editorAc();
  await senaryo("Yenilemeden sonra Ctrl+Z eski AI işlemini ALMAZ; kullanıcı Sürümler'e yönlendirilir, öteki düzenlemeler kalır", async () => {
    bekle(!(await sayfa.locator(".guideline-applied-banner", { hasText: "Asistan değişiklikleri" }).count()), "yenilemeden önce uyarı var");
    await sec(sayfa, 1);
    await asistaniAc(sayfa);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Kısalt" }).click();
    await kartBekle(sayfa, 1);
    await kart(sayfa).getByRole("button", { name: "Kabul et", exact: true }).click();
    await sayfa.waitForTimeout(300);
    // Kullanıcının başka bir yerdeki düzenlemesi
    await imlec(sayfa, 0, 0);
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.type("KULLANICI ");
    await sayfa.waitForFunction(() => /Kaydedildi|Saved/.test(document.querySelector(".save-status")?.textContent ?? ""), null, { timeout: 30000 });
    const kayitli = await belgeJson(sayfa);
    bekle(kayitli.includes("KULLANICI"), "kullanıcı düzenlemesi yok");
    await sayfa.reload({ waitUntil: "networkidle", timeout: 150000 });
    await sayfa.locator(".ProseMirror").first().waitFor();
    const yenidenJson = await belgeJson(sayfa);
    bekle(yenidenJson === kayitli, "yenilemeden sonra belge farklı (kayıt kalıcı değil mi? ONIZLEME_YAZ=1)");
    const uyari = sayfa.locator(".guideline-applied-banner", { hasText: "Asistan değişiklikleri" });
    await uyari.waitFor({ timeout: 10000 });
    // Ctrl+Z: yeni yüklemede geçmiş boş; eski AI işlemi ve kullanıcı düzenlemesi yerinde kalır.
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.press("Control+z");
    await sayfa.keyboard.press("Control+z");
    await sayfa.waitForTimeout(200);
    bekle((await belgeJson(sayfa)) === kayitli, "Ctrl+Z yenilemeden sonra belgeyi değiştirdi");
    await uyari.getByRole("button", { name: "Sürümleri aç" }).click();
    await sayfa.getByRole("dialog").first().waitFor({ timeout: 10000 });
    await sayfa.keyboard.press("Escape");
    await uyari.getByRole("button", { name: "Anladım" }).click();
    bekle(!(await uyari.count()), "Anladım uyarıyı kapatmadı");
    await sayfa.reload({ waitUntil: "networkidle", timeout: 150000 });
    await sayfa.locator(".ProseMirror").first().waitFor();
    bekle(!(await sayfa.locator(".guideline-applied-banner", { hasText: "Asistan değişiklikleri" }).count()), "Anladım'dan sonra uyarı geri geldi");
  });
  await ctx.close();
}

// ---- Logo: koyu temada LAB yeşil, filtre yok ----
for (const tema of ["light", "dark"]) {
  await senaryo(`Logo (${tema}): doğru dosya, filtre yok`, async () => {
    const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: tema });
    const sayfa = await ctx.newPage();
    for (const yol of ["/dashboard", "/"]) {
      await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
      const l = await sayfa.evaluate(() => [...document.querySelectorAll(".arvolab-logo")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ koyu: e.currentSrc.includes("koyu"), filtre: getComputedStyle(e).filter })));
      bekle(l.length === 1, `${yol}: görünen logo sayısı ${l.length}`);
      bekle(l[0].koyu === (tema === "dark"), `${yol}: yanlış dosya`);
      bekle(l[0].filtre === "none", `${yol}: filtre ${l[0].filtre}`);
    }
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
