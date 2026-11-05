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
  Sunucu yeni başlatılmış olmalı (yazmalar bellekte birikir; senaryolar
  sırayla çalışır ve son senaryo örnek metni değiştirir).
  Kayıt isteği = gövdesinde belge ("type":"doc") taşıyan sunucu eylemi.
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const PROJE = "00000000-0000-4000-8000-0000000000b1";
const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const EDITOR = `${TABAN}/dashboard/editor/${PROJE}/write`;
/* Otomatik kayıt gecikmesi (1,5 sn; büyük belgede 4 sn) ve yeniden deneme payı. */
const KAYIT_BEKLEME = 6500;

const sonuclar = [];
async function senaryo(ad, govde) {
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

await tarayici.close();
for (const s of sonuclar) console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
const dusen = sonuclar.filter((s) => !s.tamam).length;
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti.`);
process.exit(dusen ? 1 : 0);
