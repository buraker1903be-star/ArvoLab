/*
  TARAYICI KABULÜ: yazım editörü açılışta kendiliğinden KAYDETMEZ.

  14.11.2026'ya kadar (Signature OS 5.1d final kabulünde bulundu; 5.1c'de
  de vardı) editör her açılışta, hiçbir etkileşim olmadan bir saveManuscript
  POST'u gönderiyordu. Neden: taslak teklifi/uyumsuz içerik için çağrılan
  editor.setEditable(), Tiptap'ta belge aynıyken de "update" yayıyor; onUpdate
  bunu değişiklik sayıp kaydı zamanlıyordu. updated_at yalnızca açıldı diye
  değişiyor, aynı belgeyi daha önce açmış ikinci sekme ilk gerçek kaydında
  yanlış "başka bir sekmede değiştirildi" çakışmasına düşüyordu.
  Düzeltme: lib/editor-kirlenme.ts + setEditable(..., false).

  Senaryolar:
    1. Üç ardışık açılış: her birinde içerik taşıyan POST sayısı 0.
    2. Değişiklik yokken Ctrl+S: POST 0 (kaydedilecek bir şey yok).
    3. Taslak teklifi "Yok say" ile yanıtlanınca: POST 0 (editör yeniden
       yazılabilir olur, belge değişmez).
    4. Gerçek yazım hâlâ kaydediliyor: bir harf → en az bir POST. Bu olmadan
       1–3, kaydı tamamen bozan bir değişiklikte de yeşil kalırdı.

  CI'da DEĞİL (önizleme sunucusu ister). Kullanım:
    ARVOLAB_ONIZLEME=1 next dev -p 3123
    node scripts/onizleme/acilis-kaydi-kabul.mjs [taban-adres]
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const KULLANICI = "00000000-0000-4000-8000-0000000000a1"; // scripts/onizleme/veri.ts
const YOL = `/dashboard/editor/${TEZ}/write`;
/* Otomatik kayıt gecikmesi büyük belgede 4 sn (manuscript-editor.tsx autosaveDelay); payı bol tutuyoruz. */
const BEKLEME_MS = 10000;

const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    const not = await govde();
    sonuclar.push({ ad, tamam: true, not });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n")[0].slice(0, 600) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}

const tarayici = await chromium.launch();

/* Gövdesinde belge JSON'u taşıyan POST: saveManuscript (app/actions/manuscript.ts). */
async function editoruAc({ taslak } = {}) {
  const ctx = await tarayici.newContext({ viewport: { width: 1366, height: 800 } });
  if (taslak) {
    await ctx.addInitScript(
      ([anahtar, deger]) => {
        try {
          if (!sessionStorage.getItem("kabul-kuruldu")) {
            sessionStorage.setItem("kabul-kuruldu", "1");
            localStorage.setItem(anahtar, deger);
          }
        } catch {}
      },
      [`arvolab:manuscript-draft:${TEZ}:${KULLANICI}`, JSON.stringify(taslak)],
    );
  }
  const sayfa = await ctx.newPage();
  const kayitlar = [];
  sayfa.on("request", (istek) => {
    if (istek.method() === "POST" && (istek.postData() ?? "").includes('"type":"doc"')) kayitlar.push(Date.now());
  });
  await sayfa.goto(TABAN + YOL, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.waitForSelector(".ProseMirror", { timeout: 60000 });
  return { ctx, sayfa, kayitlar };
}

await senaryo("açılışta kayıt yok (üç ardışık açılış)", async () => {
  const sayilar = [];
  for (let i = 0; i < 3; i += 1) {
    const { ctx, sayfa, kayitlar } = await editoruAc();
    await sayfa.waitForTimeout(BEKLEME_MS);
    sayilar.push(kayitlar.length);
    await ctx.close();
  }
  bekle(sayilar.every((n) => n === 0), `içerik taşıyan POST: ${sayilar.join(", ")} (beklenen 0, 0, 0)`);
  return `POST: ${sayilar.join(", ")}`;
});

await senaryo("değişiklik yokken Ctrl+S kayıt göndermiyor", async () => {
  const { ctx, sayfa, kayitlar } = await editoruAc();
  await sayfa.click(".ProseMirror");
  await sayfa.keyboard.press("Control+s");
  await sayfa.waitForTimeout(BEKLEME_MS);
  await ctx.close();
  bekle(kayitlar.length === 0, `içerik taşıyan POST: ${kayitlar.length} (beklenen 0)`);
});

await senaryo("taslak teklifi 'Yok say' ile yanıtlanınca kayıt yok", async () => {
  const taslak = {
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Kabul betiğinin taslağı." }] }] },
    baseUpdatedAt: null,
    writtenAt: new Date().toISOString(),
  };
  const { ctx, sayfa, kayitlar } = await editoruAc({ taslak });
  const yokSay = sayfa.getByRole("button", { name: "Yok say" });
  await yokSay.waitFor({ timeout: 30000 });
  bekle(!(await sayfa.evaluate(() => document.querySelector(".ProseMirror")?.getAttribute("contenteditable") === "true")), "teklif açıkken editör yazılabilir");
  await yokSay.click();
  await sayfa.waitForFunction(() => document.querySelector(".ProseMirror")?.getAttribute("contenteditable") === "true", null, { timeout: 10000 });
  await sayfa.waitForTimeout(BEKLEME_MS);
  await ctx.close();
  bekle(kayitlar.length === 0, `içerik taşıyan POST: ${kayitlar.length} (beklenen 0)`);
});

await senaryo("gerçek yazım hâlâ kaydediliyor", async () => {
  const { ctx, sayfa, kayitlar } = await editoruAc();
  await sayfa.click(".ProseMirror p");
  await sayfa.keyboard.press("End");
  await sayfa.keyboard.type("x");
  await sayfa.waitForTimeout(BEKLEME_MS);
  await ctx.close();
  bekle(kayitlar.length >= 1, `içerik taşıyan POST: ${kayitlar.length} (beklenen en az 1)`);
  return `POST: ${kayitlar.length}`;
});

await tarayici.close();
for (const s of sonuclar) console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.not ? ` — ${s.not}` : ""}${s.neden ? ` — ${s.neden}` : ""}`);
process.exit(sonuclar.every((s) => s.tamam) ? 0 : 1);
