/*
  AI YETKİ, ABONELİK VE KOTA KABULÜ (V4.3-C2-6, 09.11.2026) — yazım
  asistanının GERÇEK sunucu işlemi.

  Kaynak koddaki çağrının varlığını değil, işlemin davranışını sınar:
  tarayıcının gönderdiği asistan isteği yakalanır ve
    yabanci    — çalışma kimliği başka (görünmeyen) bir çalışmanınkiyle
                 değiştirilerek gönderilir: işlem reddeder, kart oluşmaz,
                 belge ve kayıt durumu değişmez. Önizlemede RLS yok; sahte
                 istemci kimliği süzer, yani RLS'in başkasının çalışmasına
                 verdiği "satır yok" cevabının AYNI kod yolu sınanır.
                 Yakalanan (meşru) istek oynatma için dosyaya yazılır.
    oturumsuz  — (ONIZLEME_OTURUM=yok) aynı istek oynatılır: "Oturum bulunamadı".
    abonelik   — (ONIZLEME_ABONELIK=bitti) "Aboneliğiniz sona erdi".
    hak        — (ONIZLEME_HAK=bitti, scripts/onizleme/admin.ts) saatlik hak doldu.
  Oynatmada her ret için ayrıca: modele HİÇ ulaşılmadı (sahte sağlayıcının
  metni cevapta yok) ve cevapta eklenebilir metin yok.
  Önizleme: ONIZLEME_AI=1 ile (npm run onizleme:ai) ve kipe göre bayrak.
    NODE_PATH=$(npm root -g) node scripts/onizleme/ai-yetki-kabul.mjs <kip> <yakalama.json> [taban]
  Çıkış: 0 temiz, 1 bir senaryo düştü.
*/
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [KIP, YAKALAMA, TABAN = "http://localhost:3123"] = process.argv.slice(2);
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const YABANCI = "00000000-0000-4000-8000-0000000000f9";
const MODEL_METNI = "kuramsal çerçevesi ele alınmaktadır";
let gecen = 0;
let toplam = 0;
const tarayici = await chromium.launch();

async function senaryo(ad, fn) {
  toplam++;
  try {
    await fn();
    gecen++;
    console.log(`✓ ${ad}`);
  } catch (hata) {
    console.log(`✗ ${ad}\n    ${String(hata?.message ?? hata).split("\n")[0].slice(0, 300)}`);
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

if (KIP === "yabanci") {
  await senaryo("başkasının çalışma kimliğiyle asistan çağrısı reddedilir; kart yok, belge ve kayıt durumu değişmez", async () => {
    const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("arvolab:inceleme-paneli", "0"));
    const sayfa = await ctx.newPage();
    let yakalanan = null;
    const sonrakiIslemler = [];
    await sayfa.route("**/*", async (route) => {
      const istek = route.request();
      const eylem = istek.headers()["next-action"];
      const govde = istek.postData() ?? "";
      if (istek.method() === "POST" && eylem && govde.includes('"gorev"') && govde.includes(TEZ)) {
        yakalanan = { eylem, durumAgaci: istek.headers()["next-router-state-tree"] ?? null, govde, adres: istek.url() };
        return route.continue({ postData: govde.split(TEZ).join(YABANCI) });
      }
      if (istek.method() === "POST" && eylem && yakalanan) sonrakiIslemler.push(govde.slice(0, 80));
      return route.continue();
    });
    await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
    const belge = () => sayfa.evaluate(() => JSON.stringify(document.querySelector(".ProseMirror").editor.getJSON()));
    const kayitDurumu = () => sayfa.locator(".save-status").first().getAttribute("data-state");
    const belgeOnce = await belge();
    const durumOnce = await kayitDurumu();
    await sayfa.locator("button.yazma-ai").click();
    await sayfa.locator(".yazim-girdi textarea").fill("bu bölüm için bir paragraf yaz");
    await sayfa.locator(".yazim-girdi textarea").press("Enter");
    await sayfa.waitForFunction(() => document.querySelectorAll(".yazim-mesaj[data-rol='asistan']").length >= 1, null, { timeout: 30000 });
    await sayfa.waitForTimeout(1500);
    bekle(yakalanan, "asistan isteği yakalanamadı");
    const mesaj = await sayfa.locator(".yazim-mesaj[data-rol='asistan']").last().innerText();
    bekle(/Çalışma okunamadı|could not be read/.test(mesaj), `ret mesajı yok: "${mesaj.slice(0, 120)}"`);
    bekle((await sayfa.locator(".yazim-oneri").count()) === 0, "başkasının çalışmasıyla öneri kartı oluştu");
    bekle(!mesaj.includes(MODEL_METNI), "modelin metni gösterildi");
    bekle((await belge()) === belgeOnce, "ret belgeyi değiştirdi");
    bekle((await kayitDurumu()) === durumOnce, `kayıt durumu değişti (${durumOnce} → ${await kayitDurumu()})`);
    bekle(sonrakiIslemler.length === 0, `retten sonra sunucu işlemi gönderildi (kayıt?): ${sonrakiIslemler.join(" | ")}`);
    writeFileSync(YAKALAMA, JSON.stringify(yakalanan));
    await ctx.close();
  });
} else {
  const BEKLENEN = {
    oturumsuz: /Oturum bulunamadı|No session found/,
    abonelik: /Aboneliğiniz sona erdi|subscription has ended/,
    hak: /Saatlik asistan hakkınız doldu|hourly assistant limit/,
  }[KIP];
  if (!BEKLENEN) throw new Error(`bilinmeyen kip: ${KIP}`);
  await senaryo(`${KIP}: aynı asistan isteği sunucuda reddedilir; modele ulaşılmaz, eklenebilir metin yok`, async () => {
    const y = JSON.parse(readFileSync(YAKALAMA, "utf8"));
    const ctx = await tarayici.newContext();
    const sayfa = await ctx.newPage();
    // Aynı kökenden bir sayfa (giriş sayfası oturumsuzken de açılır); istek oradan gönderilir.
    await sayfa.goto(`${TABAN}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
    const cevap = await sayfa.evaluate(async (y) => {
      const basliklar = { "next-action": y.eylem, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" };
      if (y.durumAgaci) basliklar["next-router-state-tree"] = y.durumAgaci;
      const r = await fetch(y.adres, { method: "POST", headers: basliklar, body: y.govde });
      return { durum: r.status, metin: await r.text() };
    }, y);
    bekle(cevap.durum === 200, `HTTP ${cevap.durum}: ${cevap.metin.slice(0, 160)}`);
    bekle(BEKLENEN.test(cevap.metin), `beklenen ret yok; cevap: ${cevap.metin.slice(-300)}`);
    bekle(!cevap.metin.includes(MODEL_METNI), "modele ulaşıldı (sahte sağlayıcının metni cevapta)");
    bekle(!/"metin":"[^"]/.test(cevap.metin), "cevapta eklenebilir metin var");
    await ctx.close();
  });
}

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
