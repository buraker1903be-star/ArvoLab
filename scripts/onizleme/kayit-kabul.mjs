/*
  HAYALET KAYIT KABUL TESTİ (05.11.2026): editörü açmak ya da değiştirmeden
  kapatmak kayıt GÖNDERMEMELİ; gerçek düzenleme, ayar değişikliği ve taslak
  geri yükleme kaydedilmeli; eşzamanlı düzenleme koruması bozulmamalı.

  Eskiden editör her açılışta setEditable'ın belgeye dokunmadan yayınladığı
  "update" olayıyla belgenin tamamını kaydediyordu (lib/tiptap-belge-degisti.ts).
  Açık ikinci bir sekme ya da danışman, öğrencinin bir sonraki kaydını yersiz
  "Çakışma var" uyarısına düşürüyordu.

  Önizlemede çalışır: sahte Supabase (bellek içi yazma), gerçek veri yok,
  Production'a bağlanmaz. CI'da DEĞİL.
    ARVOLAB_ONIZLEME=1 ONIZLEME_YAZ=1 npx next dev -p 3123
    NODE_PATH=$(npm root -g) node scripts/onizleme/kayit-kabul.mjs [taban-adres]
  Veri senaryoları (scripts/onizleme/veri.ts) ayrı sunucu başlatmasıyla:
    ONIZLEME_SENARYO=kilavuz-eski … next dev  →  kayit-kabul.mjs --senaryo=kilavuz-eski
    ONIZLEME_SENARYO=uyumsuz      … next dev  →  kayit-kabul.mjs --senaryo=uyumsuz
  Sunucu yeni başlatılmış olmalı (yazmalar bellekte birikir; senaryolar
  sırayla çalışır ve son senaryo örnek metni değiştirir).
  Kayıt isteği = gövdesinde belge ("type":"doc") taşıyan sunucu eylemi.
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
/* Sunucu hangi ONIZLEME_SENARYO ile başlatıldıysa aynısı verilmeli; yalnızca o grubun senaryoları çalışır. */
const SENARYO = process.argv.find((a) => a.startsWith("--senaryo="))?.slice("--senaryo=".length) ?? "varsayilan";
const PROJE = "00000000-0000-4000-8000-0000000000b1";
const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const EDITOR = `${TABAN}/dashboard/editor/${PROJE}/write`;
/* Otomatik kayıt gecikmesi (1,5 sn; büyük belgede 4 sn) ve yeniden deneme payı. */
const KAYIT_BEKLEME = 6500;

const sonuclar = [];
async function senaryo(ad, govde, grup = "varsayilan") {
  if (grup !== SENARYO) return;
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: hata instanceof Error ? hata.message.split("\n")[0] : String(hata) });
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

const tarayici = await chromium.launch();

/** Yeni bağlam + sayfa; içerik taşıyan kayıt isteklerini sayar. */
async function sekme(initScript) {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  if (initScript) await ctx.addInitScript(initScript.fn, initScript.arg);
  const sayfa = await ctx.newPage();
  const kayitlar = [];
  sayfa.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && /"type":"doc"/.test(r.postData() ?? "")) kayitlar.push(Date.now());
  });
  return { ctx, sayfa, kayitlar };
}
async function editoruAc(sayfa) {
  await sayfa.goto(EDITOR, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
}
async function yaz(sayfa, metin) {
  await sayfa.locator(".ProseMirror p").first().click();
  await sayfa.keyboard.press("End");
  await sayfa.keyboard.type(metin);
}
const durum = (sayfa) => sayfa.evaluate(() => document.body.innerText);

await senaryo("1) editörü açmak kayıt göndermez", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  bekle(!/Çakışma var/.test(await durum(sayfa)), "çakışma gösteriliyor");
  await ctx.close();
});

await senaryo("2) değiştirmeden kapatmak (uygulama içi geçiş + sekme gizlenmesi) kayıt göndermez", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(500);
  await sayfa.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sayfa.locator('a[href="/dashboard/editor"]').first().click();
  await sayfa.waitForURL(/\/dashboard\/editor$/, { timeout: 60000 });
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  await ctx.close();
});

await senaryo("3) gerçek metin düzenlemesi otomatik kaydedilir (tek istek)", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  await yaz(sayfa, " deneme");
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 1, `${kayitlar.length} kayıt isteği (beklenen 1)`);
  bekle(/Kaydedildi/.test(await durum(sayfa)), "'Kaydedildi' görünmüyor");
  await ctx.close();
});

await senaryo("4) ayar değişikliği (kılavuz uygulamasıyla aynı doğrudan kayıt yolu) kaydedilir", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  /* "Sayfa ayarları" araç çubuğunun "Belge" menüsünde (erişilebilir adı menünün açıklaması). */
  const ayarlar = sayfa.locator('button[aria-label="Sayfa ayarları"]').first();
  if (!(await ayarlar.isVisible())) await sayfa.locator('button[aria-label^="Bul, sayfa ayarı"]').first().click();
  await ayarlar.click();
  await sayfa.getByLabel("İçindekiler tablosu (Word ve PDF)").click();
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 1, `${kayitlar.length} kayıt isteği (beklenen 1)`);
  await ctx.close();
});

const TASLAK = {
  fn: ({ anahtar, deger }) => {
    if (sessionStorage.getItem("taslak-kuruldu")) return;
    sessionStorage.setItem("taslak-kuruldu", "1");
    localStorage.setItem(anahtar, deger);
  },
  arg: {
    anahtar: `arvolab:manuscript-draft:${PROJE}:${KULLANICI}`,
    deger: JSON.stringify({
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Kaydedilmemiş eski taslak" }] }] },
      baseUpdatedAt: null,
      writtenAt: new Date().toISOString(),
    }),
  },
};

await senaryo("5) taslak teklifini reddetmek kayıt oluşturmaz; editör yazılabilir olur", async () => {
  const { ctx, sayfa, kayitlar } = await sekme(TASLAK);
  await editoruAc(sayfa);
  await sayfa.getByRole("button", { name: "Yok say" }).click();
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  bekle((await sayfa.locator(".ProseMirror").first().getAttribute("contenteditable")) === "true", "editör salt okunur kaldı");
  bekle((await sayfa.evaluate((k) => localStorage.getItem(k), TASLAK.arg.anahtar)) === null, "taslak silinmedi");
  await ctx.close();
});

await senaryo("6) eşzamanlılık: açık ikinci sekme ilkinin kaydını bozmaz; gerçek çakışma yine yakalanır", async () => {
  const a = await sekme();
  const b = await sekme();
  await editoruAc(a.sayfa);
  await editoruAc(b.sayfa);
  await a.sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(a.kayitlar.length + b.kayitlar.length === 0, "açılışta kayıt gitti");
  // A yazar: B yalnızca açık durduğu için A çakışmaya düşmemeli (eskiden düşüyordu).
  await yaz(a.sayfa, " A sekmesi");
  await a.sayfa.waitForTimeout(KAYIT_BEKLEME);
  const metinA = await durum(a.sayfa);
  bekle(a.kayitlar.length === 1 && /Kaydedildi/.test(metinA) && !/Çakışma var/.test(metinA), `A: ${a.kayitlar.length} kayıt, çakışma: ${/Çakışma var/.test(metinA)}`);
  // B eski sürümün üzerine yazmaya kalkar: koruma onu durdurmalı.
  await yaz(b.sayfa, " B sekmesi");
  await b.sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(/Çakışma var/.test(await durum(b.sayfa)), "B'de çakışma gösterilmedi (koruma bozuk)");
  await a.ctx.close();
  await b.ctx.close();
});

await senaryo("7) taslağı geri yüklemek gerçek değişikliktir ve kaydedilir", async () => {
  const { ctx, sayfa, kayitlar } = await sekme(TASLAK);
  await editoruAc(sayfa);
  await sayfa.getByRole("button", { name: "Geri yükle" }).click();
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length >= 1, "geri yüklenen taslak kaydedilmedi");
  bekle(/Kaydedilmemiş eski taslak/.test(await sayfa.locator(".ProseMirror").first().innerText()), "taslak editöre gelmedi");
  await ctx.close();
});

/*
  KILAVUZUN YENİ SÜRÜMÜ (ONIZLEME_SENARYO=kilavuz-eski). Hayalet kayıt
  süzgeci bu kaydı ENGELLEMEMELİ: ayarlar kılavuzdan kendiliğinden
  güncellenir ve kalıcı olması için kaydedilir (bir kez).
*/
await senaryo("K1) kılavuzun yeni sürümü açılışta uygulanır ve tek kayıtla kalıcı olur", async () => {
  const { ctx, sayfa } = await sekme();
  const govdeler = [];
  sayfa.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && /"type":"doc"/.test(r.postData() ?? "")) govdeler.push(r.postData() ?? "");
  });
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(govdeler.length === 1, `${govdeler.length} kayıt isteği (beklenen 1)`);
  bekle(govdeler[0].includes("2026-11-01T09:00:00.000Z#2"), "kayıtta kılavuzun yeni sürüm damgası yok");
  bekle(/"left":4\b/.test(govdeler[0]), "kayıtta kılavuzun yeni kenar boşluğu (sol 4 cm) yok");
  await ctx.close();
}, "kilavuz-eski");

await senaryo("K2) uygulandıktan sonra yeniden açmak kayıt göndermez (sürüm güncel)", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  await ctx.close();
}, "kilavuz-eski");

/*
  UYUMSUZ İÇERİK (ONIZLEME_SENARYO=uyumsuz). Kayıtlı metinde editörün
  tanımadığı bir düğüm var; Tiptap böyle bir belgeyi açamayınca editörü BOŞ
  başlatıyor. Eskiden "Yedekle ve devam et"ten sonra hayalet kayıt bu BOŞ
  belgeyi sunucuya yazıyordu (512 bayt): tezin canlı metni sessizce
  boşalıyor, sonraki açılışta uyarı da çıkmıyordu (05.11.2026, ölçüldü).
  Doğru davranış: yedek alınır, kayıt kullanıcı gerçekten yazana kadar
  GİTMEZ; yazmadan ayrılırsa sunucudaki metin olduğu gibi kalır ve uyarı
  sonraki açılışta yine görünür.
*/
await senaryo("U1) uyumsuz metin açılınca kayıt kilitli: uyarı var, editör salt okunur, kayıt yok", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(/editörde açılamadı/.test(await durum(sayfa)), "uyumsuz içerik uyarısı yok");
  bekle((await sayfa.locator(".ProseMirror").first().getAttribute("contenteditable")) === "false", "editör yazılabilir açıldı");
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  await ctx.close();
}, "uyumsuz");

await senaryo("U2) 'Yedekle ve devam et': yedek alınır, belge KAYDEDİLMEZ; yazmadan ayrılınca da kaydedilmez", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  const yedekler = [];
  sayfa.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && /Uyumsuz içerik düzenlenmeden önce/.test(r.postData() ?? "")) yedekler.push(1);
  });
  await editoruAc(sayfa);
  await sayfa.getByRole("button", { name: "Yedekle ve devam et" }).click();
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(yedekler.length === 1, `${yedekler.length} yedek isteği (beklenen 1)`);
  bekle((await sayfa.locator(".ProseMirror").first().getAttribute("contenteditable")) === "true", "editör açılmadı");
  bekle(kayitlar.length === 0, `devam edince ${kayitlar.length} kayıt gitti (boş belge sunucuya yazılır)`);
  await sayfa.locator('a[href="/dashboard/editor"]').first().click();
  await sayfa.waitForURL(/\/dashboard\/editor$/, { timeout: 60000 });
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayitlar.length === 0, `ayrılırken ${kayitlar.length} kayıt gitti`);
  await ctx.close();
}, "uyumsuz");

await senaryo("U3) sunucudaki metin korunur: liste eski kelime sayısını gösterir, uyarı yeniden açılışta yine görünür", async () => {
  const { ctx, sayfa, kayitlar } = await sekme();
  await sayfa.goto(`${TABAN}/dashboard/editor`, { waitUntil: "networkidle", timeout: 180000 });
  bekle(/\b11 kelime/.test(await durum(sayfa)), "listede sunucudaki 11 kelime görünmüyor (metin boşaltılmış olabilir)");
  await editoruAc(sayfa);
  await sayfa.waitForTimeout(KAYIT_BEKLEME);
  bekle(/editörde açılamadı/.test(await durum(sayfa)), "uyumsuz içerik uyarısı yeniden çıkmadı");
  bekle(kayitlar.length === 0, `${kayitlar.length} kayıt isteği gitti`);
  await ctx.close();
}, "uyumsuz");

await tarayici.close();
for (const s of sonuclar) console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
const dusen = sonuclar.filter((s) => !s.tamam).length;
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti.`);
process.exit(dusen ? 1 : 0);
