/*
  PHASE 4.3.5 — KAYNAK GÜVENLİĞİ VE VERİ TUTARLILIĞI KABUL TESTİ (05.11.2026).

  Önizlemede (sahte Supabase; iki çalışma: b1 tez, 3 kaynak — b2 makale,
  kaynaksız) gerçek tarayıcıda sınar:
  - B1: Kaynaklar / Analiz / Belgeler geçersiz, erişilemeyen ya da
    belirtilmemiş çalışmada BAŞKA ÇALIŞMAYA GEÇMEZ;
  - iki çalışma arasında geçiş: her biri kendi kaynaklarını gösterir;
  - B2: komut paletinden DOI — aktif çalışmaya gider, ekleme isteği
    yalnızca o çalışmanın kimliğini taşır; bağlam yoksa seçtirir;
  - B6: istemcide değiştirilmiş çalışma kimliğiyle kaynak oluşturma
    sunucuda reddedilir;
  - B7: kaydedildikten sonra özet ve editör aynı kelime sayısını gösterir
    (ONIZLEME_YAZ=1 gerekir; yoksa senaryo atlanır ve öyle yazılır);
  - açık/koyu tema ve telefonda temel akış (seçim ekranı, DOI hedefi).
  Birim ve editör testleri kuralları ayrıca sınıyor; burada ekranın ve
  sunucu eyleminin gerçekten o kuralla çalıştığı görülür.

  CI'da DEĞİL. Kullanım:
    ONIZLEME_YAZ=1 npm run onizleme
    NODE_PATH=$(npm root -g) node scripts/onizleme/kaynak-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("kaynak-kabul", TABAN, "varsayilan");
const B1 = "00000000-0000-4000-8000-0000000000b1";
const B2 = "00000000-0000-4000-8000-0000000000b2";
const YABANCI = "00000000-0000-4000-8000-0000000000ff";
const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    const sonuc = await govde();
    sonuclar.push({ ad, tamam: true, not: typeof sonuc === "string" ? sonuc : "" });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).slice(0, 240) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const tarayici = await chromium.launch();
const git = (s, yol) => s.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
const durum = (s) =>
  s.evaluate(() => ({
    baslik: document.querySelector(".empty-state-baslik")?.textContent ?? null,
    secenekler: [...document.querySelectorAll(".calisma-secim-listesi a")].map((a) => a.getAttribute("href")),
    b1Kaynak: document.body.textContent.includes("Phillips eğrisinin istikrarı"),
  }));

// ---- B1: yanlış çalışmaya sessiz yönlendirme yok ----
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  for (const sayfa of ["literature", "analysis", "documents"]) {
    await senaryo(`B1 ${sayfa}: geçersiz ve erişilemeyen kimlik başka çalışmayı AÇMAZ, kimlik hakkında bilgi vermez`, async () => {
      for (const id of ["abc", YABANCI]) {
        await git(s, `/dashboard/${sayfa}?calisma=${id}`);
        const d = await durum(s);
        bekle(d.baslik === "Bu çalışma açılamadı", `${id}: başlık ${d.baslik}`);
        bekle(!d.b1Kaynak, `${id}: b1'in verisi göründü`);
        bekle(d.secenekler.length === 2 && d.secenekler.every((h) => h.includes(B1) || h.includes(B2)), `${id}: seçenekler ${d.secenekler}`);
        bekle(!(await s.locator("main").textContent()).includes(id === "abc" ? "abc" : YABANCI), "istenen kimlik ekrana yazıldı");
        bekle(await s.getByRole("link", { name: "Çalışmalarıma dön" }).count(), "Çalışmalarıma dön yok");
      }
    });
    await senaryo(`B1 ${sayfa}: çalışma belirtilmemişse (iki çalışma) seçim istenir, varsayılan açılmaz`, async () => {
      await git(s, `/dashboard/${sayfa}`);
      const d = await durum(s);
      bekle(d.baslik === "Hangi çalışma?", `başlık ${d.baslik}`);
      bekle(!d.b1Kaynak, "b1'in verisi göründü");
    });
  }
  await senaryo("İki çalışma arasında geçiş: her çalışma yalnızca kendi kaynaklarını gösterir", async () => {
    await git(s, `/dashboard/literature?calisma=${B1}`);
    bekle((await durum(s)).b1Kaynak, "b1'in kaynakları görünmedi");
    await git(s, `/dashboard/literature?calisma=${B2}`);
    bekle(!(await durum(s)).b1Kaynak, "b2'de b1'in kaynağı göründü");
    bekle(/Öğrenci öğretmen farkı/.test(await s.locator(".doi-kutusu-hedef").textContent()), "b2'nin DOI hedefi yanlış");
  });
  await ctx.close();
}

// ---- B2: palet DOI aktif çalışmaya ----
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  const istekler = [];
  await s.route("**/*", (r) => {
    const q = r.request();
    if (q.method() === "POST" && q.headers()["next-action"]) istekler.push(q.postData() ?? "");
    return r.continue();
  });
  const palettenDoi = async () => {
    await s.keyboard.press("Control+k");
    await s.locator(".os-palette-input input").fill("10.1000/abc");
    await s.waitForTimeout(300);
    await s.keyboard.press("Enter");
    await s.waitForURL(/literature/, { timeout: 60000 });
    await s.waitForLoadState("networkidle");
  };
  await senaryo("B2: b2 editöründen palet DOI → b2; ekleme isteği yalnızca b2 kimliğini taşır", async () => {
    await git(s, `/dashboard/editor/${B2}/write`);
    await palettenDoi();
    const u = new URL(s.url());
    bekle(u.searchParams.get("calisma") === B2, `adresteki çalışma ${u.searchParams.get("calisma")}`);
    bekle(/Öğrenci öğretmen farkı/.test(await s.locator(".doi-kutusu-hedef").textContent()), "hedef b2 değil");
    bekle(!(await s.locator('.doi-kutusu-durum [data-tone="success"]').count()), "kendiliğinden eklendi");
    istekler.length = 0;
    await s.locator(".doi-kutusu button[type=submit]").click();
    await s.waitForTimeout(2500);
    const govde = istekler.join("\n");
    bekle(govde.includes(B2) && !govde.includes(B1), "ekleme isteği yanlış çalışmayı taşıyor");
  });
  await senaryo("B2: bağlamsız palet DOI → çalışma seçtirilir, seçim DOI'yi korur", async () => {
    await git(s, "/dashboard");
    await palettenDoi();
    bekle(!new URL(s.url()).searchParams.get("calisma"), "bağlamsız adreste çalışma var");
    bekle((await durum(s)).baslik === "Hangi çalışma?", "seçim istenmedi");
    bekle((await durum(s)).secenekler.every((h) => h.includes("doi=10.1000")), "seçim DOI'yi korumuyor");
  });
  await ctx.close();
}

// ---- B6: değiştirilmiş çalışma kimliğiyle kaynak oluşturma reddedilir ----
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  await senaryo("B6: elle ekleme formunda gizli çalışma kimliği başka bir çalışmaya çevrilince sunucu reddeder", async () => {
    await git(s, `/dashboard/literature?calisma=${B1}`);
    // "Kaynak bul" penceresi → "Manuel kaynak ekle" (pencere içi pencere, literatur-penceresi.tsx).
    await s.locator(".kaynak-bul-tetik").click();
    await s.getByRole("button", { name: "Manuel kaynak ekle" }).first().click();
    await s.locator('input[name="title"]:visible').first().waitFor({ timeout: 15000 });
    await s.evaluate((yabanci) => {
      for (const g of document.querySelectorAll('input[name="projectId"]')) g.value = yabanci;
    }, YABANCI);
    await s.locator('input[name="title"]:visible').first().fill("Yetkisiz kaynak denemesi");
    await s.locator('form:has(input[name="projectId"]) button[type="submit"]:visible').first().click();
    await s.getByText(/Bu çalışmaya kaynak eklenemiyor/).first().waitFor({ timeout: 15000 });
    await git(s, `/dashboard/literature?calisma=${B1}`);
    bekle(!(await s.locator("body").textContent()).includes("Yetkisiz kaynak denemesi"), "kaynak yine de eklendi");
  });
  await ctx.close();
}

// ---- B7: kayıttan sonra özet = editör ----
{
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const s = await ctx.newPage();
  await senaryo("B7: kaydedildikten sonra özet ve editör aynı kelime sayısını gösterir", async () => {
    await git(s, `/dashboard/editor/${B1}/write`);
    await s.locator(".ProseMirror").first().click();
    await s.keyboard.press("End");
    await s.keyboard.type(" deneme kelimesi");
    await s.waitForFunction(() => /Kaydedildi|Saved/.test(document.querySelector(".save-status")?.textContent ?? ""), null, { timeout: 30000 });
    const editorSayi = Number((await s.locator(".yazim-durum-cubugu span").first().textContent()).replace(/\D/g, ""));
    await git(s, `/dashboard/editor/${B1}`);
    const ozet = await s.locator("main").textContent();
    const sayilar = [...ozet.matchAll(/([\d.]+)\s*(kelime|sözcük)/g)].map((m) => Number(m[1].replace(/\./g, "")));
    if (!sayilar.includes(editorSayi) && sayilar.every((n) => n === 6172)) return "ATLANDI: önizleme yazma kipi kapalı (ONIZLEME_YAZ=1), kayıt kalıcı değil";
    bekle(sayilar.includes(editorSayi), `editör ${editorSayi}, özet ${sayilar.join("/")}`);
  });
  await ctx.close();
}

// ---- Tema ve telefon: seçim ekranı ve DOI hedefi ----
for (const [ad, secenek] of [
  ["açık masaüstü", { viewport: { width: 1440, height: 900 }, colorScheme: "light" }],
  ["koyu masaüstü", { viewport: { width: 1440, height: 900 }, colorScheme: "dark" }],
  ["açık telefon", { ...devices["iPhone 13"], colorScheme: "light" }],
  ["koyu telefon", { ...devices["iPhone 13"], colorScheme: "dark" }],
]) {
  await senaryo(`Görünüm (${ad}): seçim ekranı ve DOI hedefi taşmıyor, seçenekler en az 44 px`, async () => {
    const ctx = await tarayici.newContext(secenek);
    const s = await ctx.newPage();
    await git(s, "/dashboard/literature?doi=10.1000%2Fabc");
    const olcu = await s.evaluate(() => ({
      tasma: document.documentElement.scrollWidth - innerWidth,
      kucuk: [...document.querySelectorAll(".calisma-secim-listesi a")].filter((a) => a.getBoundingClientRect().height < 44).length,
    }));
    bekle(olcu.tasma <= 0, `taşma ${olcu.tasma}px`);
    bekle(olcu.kucuk === 0, `${olcu.kucuk} seçenek 44 pikselden alçak`);
    await s.locator(`.calisma-secim-listesi a[href*="${B2}"]`).click();
    await s.waitForURL(new RegExp(B2), { timeout: 60000 });
    await s.waitForLoadState("networkidle");
    bekle(await s.locator(".doi-kutusu-hedef").isVisible(), "hedef görünmüyor");
    bekle((await s.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "kütüphane taşıyor");
    await ctx.close();
  });
}

await tarayici.close();
let dusen = 0;
for (const s of sonuclar) {
  if (!s.tamam) dusen++;
  console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? (s.not ? `\n    ${s.not}` : "") : `\n    ${s.neden}`}`);
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti`);
process.exit(dusen ? 1 : 0);
