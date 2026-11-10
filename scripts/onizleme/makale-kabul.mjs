/*
  MAKALE AŞAMA 2 KABUL TESTİ (05.11.2026): makale profili → Yazım editörü
  ve Arvo AI, gerçek sayfalarda.

  Önizlemede çalışır: sahte Supabase (bellek içi yazma) ve sahte yapay
  zekâ (scripts/onizleme/saglayici.ts, "PROFIL" tetiği). Ücretli çağrı
  yok, gerçek veri yok. CI'da DEĞİL.
    ARVOLAB_ONIZLEME=1 ONIZLEME_YAZ=1 ONIZLEME_AI=1 AI_ANAHTAR=onizleme npx next dev -p 3123
    NODE_PATH=$(npm root -g) node scripts/onizleme/makale-kabul.mjs [taban-adres]
  Sunucu yeni başlatılmış olmalı (profil yazmaları bellekte birikir).
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("makale-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const MAKALE = "00000000-0000-4000-8000-0000000000b2";
const SORU = "Staj öğretmen adaylarının öz yeterliğini artırıyor mu?";
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
const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
const sayfa = await ctx.newPage();

/** Yazım asistanına "PROFIL" sorar, asistanın son cevabını döndürür. */
async function profilSor(calisma) {
  await sayfa.goto(`${TABAN}/dashboard/editor/${calisma}/write?asistan=1`, { waitUntil: "networkidle", timeout: 150000 });
  const kutu = sayfa.locator(".yazim-girdi textarea");
  await kutu.waitFor({ timeout: 30000 });
  await kutu.fill("PROFIL");
  await kutu.press("Enter");
  await sayfa.waitForFunction(() => [...document.querySelectorAll('.yazim-mesaj[data-rol="asistan"]')].some((e) => /Test: makale profili/.test(e.textContent)), null, { timeout: 30000 });
  return sayfa.evaluate(() => [...document.querySelectorAll('.yazim-mesaj[data-rol="asistan"]')].map((e) => e.textContent).at(-1));
}
/** Editörün teslim listesindeki satırların metni. */
async function teslimSatirlari(calisma) {
  await sayfa.goto(`${TABAN}/dashboard/editor/${calisma}/write?teslim=1`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").first().waitFor();
  await sayfa.waitForTimeout(800);
  return sayfa.evaluate(() => [...document.querySelectorAll(".teslim-madde, .checklist-item, [data-teslim-madde], li")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean));
}

await senaryo("2) makale, profil yok → asistan profilsiz çalışır", async () => {
  const cevap = await profilSor(MAKALE);
  bekle(/profili YOK/.test(cevap), cevap);
});

await senaryo("editör (makale, profil yok): 'Makale bilgileri' yapılacak, kılavuzun tez sınırı yok", async () => {
  const satirlar = (await teslimSatirlari(MAKALE)).join(" | ");
  bekle(/Makale bilgileri/.test(satirlar) && /Varsayılan bir sınır kullanılmıyor/.test(satirlar), satirlar.slice(0, 300));
  bekle(!/kılavuz .* kelimeye izin veriyor/.test(satirlar), "tez sınırı uygulanmış");
});

await senaryo("Makale bilgileri kaydedilir (önizleme belleği)", async () => {
  await sayfa.goto(`${TABAN}/dashboard/editor/${MAKALE}/makale`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.getByRole("button", { name: "Makale bilgilerini girin" }).first().click();
  await sayfa.fill('[name="arastirma_sorusu"]', SORU);
  await sayfa.fill('[name="hedef_dergi"]', "Örnek Eğitim Dergisi");
  await sayfa.fill('[name="kelime_siniri"]', "100");
  await sayfa.getByRole("button", { name: "Kaydet" }).click();
  await sayfa.waitForFunction(() => /Makale bilgileri kaydedildi/.test(document.body.textContent), null, { timeout: 30000 });
});

await senaryo("Makale başlığında durum göstergeleri", async () => {
  await sayfa.goto(`${TABAN}/dashboard/editor/${MAKALE}/makale`, { waitUntil: "networkidle", timeout: 150000 });
  const metin = await sayfa.locator(".makale-durumlar").textContent();
  bekle(/Makale profili tanımlı/.test(metin) && /Dergi sınırları girildi/.test(metin) && /doğrulanmadı/.test(metin), metin);
});

await senaryo("1) profil dolu → asistan doğru çalışmanın sorusunu ve sınırlarını görür", async () => {
  const cevap = await profilSor(MAKALE);
  bekle(cevap.includes(`soru: ${SORU}`) && /dergi sınırları: istemde/.test(cevap), cevap);
});

await senaryo("3/4) tez çalışması → aynı kullanıcının makale profili karışmaz", async () => {
  const cevap = await profilSor(TEZ);
  bekle(/profili YOK/.test(cevap), cevap);
});

await senaryo("5) editör (makale, profil var): dergi kelime sınırı Makale sekmesiyle aynı cümle", async () => {
  const satirlar = (await teslimSatirlari(MAKALE)).join(" | ");
  await sayfa.goto(`${TABAN}/dashboard/editor/${MAKALE}/makale`, { waitUntil: "networkidle", timeout: 150000 });
  const makaleSekmesi = await sayfa.evaluate(() => [...document.querySelectorAll(".makale-kontrol-liste li")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).find((m) => /^Kelime sınırı/.test(m)));
  const cumle = makaleSekmesi.replace(/^Kelime sınırı/, "").trim();
  bekle(satirlar.includes(cumle), `editörde yok: ${cumle}`);
});

await senaryo("8) bölüm denetimi → Yazım bağlantısı (başlıksız müsveddede düz Yazım)", async () => {
  await sayfa.goto(`${TABAN}/dashboard/editor/${MAKALE}/makale`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.getByRole("button", { name: "Bölüm denetimi" }).first().click();
  const baglantilar = await sayfa.evaluate(() => [...document.querySelectorAll(".drawer-root.open a")].map((a) => a.getAttribute("href")));
  bekle(baglantilar.some((h) => /\/write(\?|$)/.test(h ?? "")), JSON.stringify(baglantilar));
});

await senaryo("8) Yazım ?baslik= → editör o başlığa gider", async () => {
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").first().waitFor();
  const basliklar = await sayfa.evaluate(() => [...document.querySelectorAll(".ProseMirror h1, .ProseMirror h2")].map((h) => h.textContent.trim()).filter(Boolean));
  const hedef = basliklar.at(-1);
  bekle(hedef, "örnek belgede başlık yok");
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write?baslik=${encodeURIComponent(hedef)}`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").first().waitFor();
  await sayfa.waitForTimeout(800);
  const imlec = await sayfa.evaluate(() => {
    const s = getSelection();
    const el = s?.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement : s?.anchorNode;
    return el?.closest?.("h1, h2, h3, h4")?.textContent?.trim() ?? null;
  });
  bekle(imlec === hedef, `imleç: ${imlec}, beklenen: ${hedef}`);
});

await tarayici.close();
for (const s of sonuclar) console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
const dusen = sonuclar.filter((s) => !s.tamam).length;
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti.`);
process.exit(dusen ? 1 : 0);
