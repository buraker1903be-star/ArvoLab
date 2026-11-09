/*
  GEÇ GELEN AI YANITI KABULÜ (V4.3-C2-5, 09.11.2026).

  Kullanıcı yazım asistanına istek gönderir ve cevap gelmeden ÇALIŞMA
  DEĞİŞTİRİR (istemci tarafı gezinme, sayfa yeniden yüklenmez; neden
  seçici değil: makaleyeGec'teki not). Sahte sağlayıcı "YAVAS" ile 3 sn bekler.
  Sınanan:
    1. Başarılı geç cevap: yeni çalışmanın panelinde eski cevabın kartı
       YOK, yeni çalışmanın belgesi değişmedi, sayfa hatası yok.
    2. Reddedilen geç cevap (YAVAS + UYDURMA_SAYI): eskiden ret yolu
       izlenen aralığı bırakmak için YOK EDİLMİŞ editöre işlem
       gönderiyordu (TipTap hatasız yutuyordu; sayaçla ölçülür); hiç
       çağrı yok, sayfa hatası ya da konsol hatası yok, yeni çalışmada
       uyarı mesajı yok, belge değişmedi.
    4. Satır içi öneri (Alt+/) geç cevabı: yok edilmiş editöre işlem yok.
    3. Aynı çalışmada başka bir bölüme (Kanıt) gidip dönme: editör yok
       edilip yeniden kuruluyor; dönüşte eski isteğin kartı ya da
       mesajı yok, hata yok.
  Önizleme: ONIZLEME_YAZ=1 npm run onizleme:ai
    NODE_PATH=$(npm root -g) node scripts/onizleme/gec-yanit-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir senaryo düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const MAKALE = "00000000-0000-4000-8000-0000000000b2";
const ORNEK_CEVAP = "kuramsal çerçevesi ele alınmaktadır";
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

async function ac() {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  // Panel kapalı başlasın: yalnız Arvo AI düğmesiyle açılır, eski oturumun tercihi karışmaz.
  await ctx.addInitScript(() => localStorage.setItem("arvolab:inceleme-paneli", "0"));
  const sayfa = await ctx.newPage();
  const hatalar = [];
  sayfa.on("pageerror", (e) => hatalar.push(`pageerror: ${e.message}`));
  sayfa.on("console", (m) => {
    if (m.type() !== "error") return;
    const metin = m.text();
    // Geliştirme sunucusunun gürültüsü (HMR, kaynak haritası, yazı tipi) sayılmaz; editör ve React hataları sayılır.
    if (/Failed to load resource|favicon|webpack-hmr|Download the React DevTools/i.test(metin)) return;
    hatalar.push(`console: ${metin.slice(0, 200)}`);
  });
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.locator(".ProseMirror").waitFor();
  return { ctx, sayfa, hatalar };
}
/*
  Yok edilmiş editöre işlem sayacı: TipTap yok edilmiş editörün işlemini
  hata vermeden yedek bir nesneye düşürüyor (görünmez, ama çağrı yine
  yapılıyor ve editörün iç durumu değişiyor). Ölçüt "hiç çağrılmasın":
  gezinmeden ÖNCE eski editörün işlem yöntemi sarılır, yok edildikten
  sonraki her çağrı sayılır.
*/
const oluEditorSayaci = (s) =>
  s.evaluate(() => {
    const ed = document.querySelector(".ProseMirror").editor;
    window.__eskiEditor = ed;
    window.__oluIslem = 0;
    const asil = ed.dispatchTransaction.bind(ed);
    ed.dispatchTransaction = (tr) => {
      if (ed.isDestroyed) window.__oluIslem++;
      return asil(tr);
    };
  });
const belgeMetni = (s) => s.evaluate(() => document.querySelector(".ProseMirror")?.textContent ?? "");
async function istekGonder(s, metin) {
  await s.locator("button.yazma-ai").click();
  await s.locator(".yazim-girdi textarea").waitFor();
  await s.locator(".yazim-girdi textarea").fill(metin);
  await s.locator(".yazim-girdi textarea").press("Enter");
  // İstek yolda: gönder düğmesi bekleme durumunda (kullanıcı mesajı listeye düştü).
  await s.waitForFunction(() => document.querySelectorAll(".yazim-mesaj[data-rol='kullanici']").length >= 1, null, { timeout: 15000 });
}
/*
  Çalışma değiştirme İSTEMCİ YÖNLENDİRİCİSİYLE (konum yolu, Çalışmalarım
  listesi, Ctrl+K bağlantılarının yaptığı gezinme). Kenar çubuğundaki
  seçici listesini bir sunucu işlemiyle yüklüyor ve Next sunucu
  işlemlerini istemci başına SIRAYLA işletiyor: seçiciyle gezinme yoldaki
  AI cevabını bekliyor, "geç cevap" hiç oluşmuyordu (09.11.2026'da
  ölçüldü). Bu yol beklemez: cevap gezinmeden SONRA gelir.
*/
async function makaleyeGec(s) {
  await s.evaluate((id) => window.next.router.push(`/dashboard/editor/${id}/write`), MAKALE);
  await s.waitForURL(new RegExp(`/dashboard/editor/${MAKALE}`), { timeout: 60000 });
  // Makalenin belgesi boş olabilir: ölçüt metin değil, YENİ bir editörün kurulması.
  await s.waitForFunction(() => {
    const ed = document.querySelector(".ProseMirror")?.editor;
    return Boolean(ed) && ed !== window.__eskiEditor;
  }, null, { timeout: 60000 });
}
const paneldeki = (s) =>
  s.evaluate(() => [...document.querySelectorAll(".yazim-mesaj")].map((m) => `${m.getAttribute("data-rol")}: ${m.textContent.trim().slice(0, 120)}`));

for (const [ad, istek, beklenenEski] of [
  ["başarılı", "YAVAS bu bölüm için bir paragraf yaz", ORNEK_CEVAP],
  ["reddedilen", "YAVAS UYDURMA_SAYI bu bölüm için bir paragraf yaz", "gösterilmedi"],
]) {
  await senaryo(`${ad} geç cevap: başka çalışmaya geçilince yeni çalışmada görünmez, belge değişmez, hata yok`, async () => {
    const { ctx, sayfa, hatalar } = await ac();
    // Tam yükleme olmadığını kanıtlamak için pencereye bir işaret konur; istemci gezinmesinde kalır.
    await sayfa.evaluate(() => (window.__gecYanitIsareti = 1));
    await oluEditorSayaci(sayfa);
    await istekGonder(sayfa, istek);
    await makaleyeGec(sayfa);
    bekle(await sayfa.evaluate(() => window.__gecYanitIsareti === 1), "gezinme tam sayfa yüklemesi oldu; senaryo istemci gezinmesini ölçmüyor");
    const belgeOnce = await belgeMetni(sayfa);
    await sayfa.waitForTimeout(4500); // sahte sağlayıcı 3 sn bekliyor
    const belgeSonra = await belgeMetni(sayfa);
    const panel = await paneldeki(sayfa);
    bekle(!panel.some((m) => m.includes(beklenenEski)), `eski cevap yeni çalışmanın panelinde: ${JSON.stringify(panel)}`);
    bekle(!panel.some((m) => m.startsWith("kullanici:") && m.includes("YAVAS")), `eski istek yeni çalışmanın panelinde: ${JSON.stringify(panel)}`);
    bekle(belgeSonra === belgeOnce, "yeni çalışmanın belgesi geç cevaptan sonra değişti");
    bekle(!(await sayfa.locator(".ProseMirror .yazim-izlenen, .ProseMirror [data-oneri]").count()), "yeni belgede izlenen aralık süslemesi var");
    bekle(hatalar.length === 0, `sayfa hatası: ${hatalar.join(" | ")}`);
    const olu = await sayfa.evaluate(() => window.__oluIslem);
    bekle(olu === 0, `yok edilmiş editöre ${olu} işlem gönderildi`);
    await ctx.close();
  });
}

await senaryo("aynı çalışmada Kanıt'a gidip dönünce eski isteğin izi yok, hata yok", async () => {
  const { ctx, sayfa, hatalar } = await ac();
  const belgeOnce = await belgeMetni(sayfa);
  await oluEditorSayaci(sayfa);
  await istekGonder(sayfa, "YAVAS UYDURMA_SAYI bu bölüm için bir paragraf yaz");
  await sayfa.evaluate((id) => window.next.router.push(`/dashboard/editor/${id}/kanit`), TEZ);
  await sayfa.waitForURL(/\/kanit$/, { timeout: 60000 });
  await sayfa.waitForTimeout(4500);
  await sayfa.evaluate((id) => window.next.router.push(`/dashboard/editor/${id}/write`), TEZ);
  await sayfa.waitForURL(/\/write$/, { timeout: 60000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 60000 });
  await sayfa.waitForTimeout(800);
  bekle((await belgeMetni(sayfa)) === belgeOnce, "dönüşte belge değişmiş");
  const panel = await paneldeki(sayfa);
  bekle(!panel.some((m) => m.includes("YAVAS") || m.includes("gösterilmedi")), `eski isteğin izi panelde: ${JSON.stringify(panel)}`);
  bekle(hatalar.length === 0, `sayfa hatası: ${hatalar.join(" | ")}`);
  const olu = await sayfa.evaluate(() => window.__oluIslem);
  bekle(olu === 0, `yok edilmiş editöre ${olu} işlem gönderildi`);
  await ctx.close();
});

await senaryo("satır içi öneri (Alt+/) geç cevabı: başka çalışmaya geçilince yok edilmiş editöre işlem yok, hata yok", async () => {
  const { ctx, sayfa, hatalar } = await ac();
  // Uzun bir paragrafın sonuna "YAVAS" yazılır: sahte sağlayıcı imleçten önceki metinde görünce 3 sn bekler.
  await sayfa.evaluate(() => {
    const ed = document.querySelector(".ProseMirror").editor;
    let son = 0;
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent.length > 80 && !son) son = pos + node.nodeSize - 1;
    });
    ed.chain().focus().setTextSelection(son).insertContent(" YAVAS").run();
  });
  await oluEditorSayaci(sayfa);
  await sayfa.keyboard.press("Alt+/");
  await sayfa.waitForTimeout(400);
  await makaleyeGec(sayfa);
  const belgeOnce = await belgeMetni(sayfa);
  await sayfa.waitForTimeout(4500);
  bekle((await belgeMetni(sayfa)) === belgeOnce, "yeni çalışmanın belgesi değişti");
  bekle(!(await sayfa.locator(".ProseMirror .satir-ici-oneri").count()), "eski önerinin süslemesi yeni belgede");
  bekle(hatalar.length === 0, `sayfa hatası: ${hatalar.join(" | ")}`);
  const olu = await sayfa.evaluate(() => window.__oluIslem);
  bekle(olu === 0, `yok edilmiş editöre ${olu} işlem gönderildi`);
  await ctx.close();
});

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
