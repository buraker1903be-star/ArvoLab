/*
  P52a1 OTOMATİK KAYIT KABULÜ (15.11.2026).

  Kayıt kararları lib/otomatik-kayit.ts'e taşındı (birim testi:
  tests/unit/otomatik-kayit.test.ts). Bu betik gerçek tarayıcıda, sentetik
  önizleme verisiyle sınar:
    - tekrarlanan istek: art arda 5 Ctrl+S → tek kayıt isteği, eşzamanlı yok;
    - ağ kesintisi: kayıt istekleri düşürülür; yeniden denemeler 10 sn ve
      20 sn arayla (±%20) gelir, eskisi gibi sabit 10 sn değil; bu sırada
      metin bu sekmenin taslağında durur; ağ açılınca kaydedilir ve taslak
      silinir;
    - eşzamanlı sekme: aynı çalışmanın iki sekmesi ayrı taslak anahtarına
      yazar, biri ötekini ezmez; yeniden açılışta en yeni önerilir, "Yok
      say" yalnızca onu siler, öteki bir sonraki açılışta önerilir;
    - kayıttan sonra yeniden açma: taslak kalmaz, öneri çıkmaz.
  Hayalet kayıt: scripts/onizleme/hayalet-kayit-kabul.mjs.

  Önizlemenin sahte Supabase istemcisi yazmaları uygulamaz: sunucu tarafı
  çakışma (updated_at) burada GÖZLENEMEZ; o, saf modülde ve Test ortamında.

  CI'da DEĞİL. Kullanım (sunucu: ARVOLAB_ONIZLEME=1 next dev -p 3123):
    node scripts/onizleme/otomatik-kayit-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const YOL = `/dashboard/editor/${TEZ}/write`;
const ONEK = `arvolab:manuscript-draft:${TEZ}:${KULLANICI}`;

const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    sonuclar.push({ ad, tamam: true, not: await govde() });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n")[0].slice(0, 500) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const tarayici = await chromium.launch();
const kayitIstegiMi = (r) => r.method() === "POST" && (r.postData() || "").includes('"content":{"type":"doc"');

/* Bağlam başına kayıt istekleri: başlangıç/bitiş zamanı ve eşzamanlılık. `agKapali()` true iken kayıtlar düşürülür. */
async function baglam() {
  const ctx = await tarayici.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.addInitScript(() => {
    const gizle = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) gizle(); else document.addEventListener("DOMContentLoaded", gizle);
  });
  const durum = { kapali: false, istekler: [], ucusta: 0, enCok: 0 };
  await ctx.route("**/*", async (route) => {
    const r = route.request();
    if (!kayitIstegiMi(r)) return route.continue();
    durum.istekler.push({ t: Date.now(), dusuruldu: durum.kapali });
    if (durum.kapali) return route.abort("internetdisconnected");
    durum.ucusta += 1;
    durum.enCok = Math.max(durum.enCok, durum.ucusta);
    try {
      // Yavaş bir bağlantıyı taklit et: eşzamanlı istek olsaydı burada üst üste binerdi.
      await new Promise((z) => setTimeout(z, 700));
      await route.continue();
    } finally {
      setTimeout(() => { durum.ucusta -= 1; }, 50);
    }
  });
  return { ctx, durum };
}
async function ac(ctx) {
  const s = await ctx.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 160)));
  await s.goto(TABAN + YOL, { waitUntil: "networkidle", timeout: 150000 });
  await s.locator(".ProseMirror").first().waitFor();
  return { s, hatalar };
}
const sonaYaz = async (s, metin) => {
  await s.locator(".ProseMirror").first().click();
  await s.keyboard.press("Control+End");
  await s.keyboard.type(metin);
};
const taslaklar = (s) =>
  s.evaluate((onek) => Object.keys(localStorage).filter((k) => k === onek || k.startsWith(`${onek}:`)).map((k) => ({ k, metin: JSON.stringify(JSON.parse(localStorage.getItem(k)).content) })), ONEK);
const durumYazisi = (s) => s.locator("[aria-live='polite']").first().innerText();
const teklifBandi = (s) => s.locator(".editor-notice", { hasText: "kaydedilmemiş değişiklikleriniz" });

await senaryo("tekrarlanan istek: art arda 5 Ctrl+S → tek kayıt isteği, eşzamanlı istek yok", async () => {
  const { ctx, durum } = await baglam();
  const { s, hatalar } = await ac(ctx);
  await s.waitForTimeout(2500);
  await sonaYaz(s, " Q");
  for (let i = 0; i < 5; i++) await s.keyboard.press("Control+s");
  await s.waitForTimeout(5000);
  bekle(durum.istekler.length === 1, `${durum.istekler.length} kayıt isteği (1 beklenir)`);
  bekle(durum.enCok === 1, `en çok ${durum.enCok} eşzamanlı istek`);
  bekle(/Kaydedildi/.test(await durumYazisi(s)), `durum: ${await durumYazisi(s)}`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return "5 Ctrl+S → 1 istek, eşzamanlı en çok 1";
});

await senaryo("ağ kesintisi: 10 sn → 20 sn geri çekilme; metin taslakta; ağ açılınca kaydediliyor ve taslak siliniyor", async () => {
  const { ctx, durum } = await baglam();
  const { s } = await ac(ctx);
  await s.waitForTimeout(2500);
  durum.kapali = true;
  await sonaYaz(s, " AGYOK");
  // İlk deneme otomatik kayıtla (~1,5 sn), sonra 10 sn (±%20), sonra 20 sn (±%20).
  const t0 = Date.now();
  while (durum.istekler.filter((x) => x.dusuruldu).length < 3 && Date.now() - t0 < 45000) await s.waitForTimeout(250);
  const d = durum.istekler.filter((x) => x.dusuruldu).map((x) => x.t);
  bekle(d.length >= 3, `45 sn'de ${d.length} deneme`);
  const ara1 = d[1] - d[0];
  const ara2 = d[2] - d[1];
  bekle(ara1 >= 7500 && ara1 <= 12800, `1. ara ${ara1} ms (10 sn ±%20 beklenir)`);
  bekle(ara2 >= 15500 && ara2 <= 24800, `2. ara ${ara2} ms (20 sn ±%20 beklenir; eskiden 10 sn)`);
  const kayip = (await taslaklar(s)).filter((x) => x.metin.includes("AGYOK"));
  bekle(kayip.length === 1, `kesinti sırasında taslakta ${kayip.length} kayıt`);
  bekle(/Kaydedilemedi/.test(await durumYazisi(s)), `durum: ${await durumYazisi(s)}`);
  durum.kapali = false;
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(3000);
  bekle(/Kaydedildi/.test(await durumYazisi(s)), `ağ açılınca durum: ${await durumYazisi(s)}`);
  const kalan = await taslaklar(s);
  bekle(kalan.length === 0, `kayıttan sonra ${kalan.length} taslak kaldı`);
  await ctx.close();
  return `aralar ${ara1} ms, ${ara2} ms; kayıt sonrası taslak 0`;
});

await senaryo("eşzamanlı sekme: iki sekme ayrı taslağa yazıyor, biri ötekini ezmiyor; öneri en yeniden başlıyor", async () => {
  const { ctx, durum } = await baglam();
  durum.kapali = true; // iki sekmenin de metni taslakta kalsın
  const a = await ac(ctx);
  const b = await ac(ctx);
  await sonaYaz(a.s, " SEKMEA");
  await a.s.waitForTimeout(1200);
  await sonaYaz(b.s, " SEKMEB");
  await b.s.waitForTimeout(1200);
  const ikisi = await taslaklar(a.s);
  const aVar = ikisi.filter((x) => x.metin.includes("SEKMEA") && !x.metin.includes("SEKMEB"));
  const bVar = ikisi.filter((x) => x.metin.includes("SEKMEB") && !x.metin.includes("SEKMEA"));
  bekle(ikisi.length === 2 && aVar.length === 1 && bVar.length === 1, `taslaklar: ${ikisi.map((x) => x.k.slice(ONEK.length)).join(", ")} (A ${aVar.length}, B ${bVar.length})`);
  await a.s.close({ runBeforeUnload: false });
  await b.s.close({ runBeforeUnload: false });
  durum.kapali = false;
  // Yeniden aç: en yeni (B) önerilir.
  const c = await ac(ctx);
  const bant = teklifBandi(c.s);
  await bant.waitFor({ timeout: 10000 });
  await bant.getByRole("button", { name: "Yok say" }).click();
  await c.s.waitForTimeout(500);
  const kalan = await taslaklar(c.s);
  bekle(kalan.length === 1 && kalan[0].metin.includes("SEKMEA"), `'Yok say' sonrası kalan: ${kalan.map((x) => x.metin.includes("SEKMEA") ? "A" : x.metin.includes("SEKMEB") ? "B" : "?").join(",")}`);
  await c.s.close({ runBeforeUnload: false });
  // Bir sonraki açılışta A önerilir ve geri yüklenebilir.
  const d = await ac(ctx);
  const bant2 = teklifBandi(d.s);
  await bant2.waitFor({ timeout: 10000 });
  await bant2.getByRole("button", { name: "Geri yükle" }).click();
  /* Geri yükleme önce sunucudaki metni sürüm geçmişine yedekliyor (saveNamedVersion), sonra metni koyuyor.
     textContent: tez ~200 KB ve eklenen cümle en sonda; innerText ekran dışında çizilmeyen
     paragrafları (content-visibility) saymıyor. */
  await d.s.waitForFunction(() => document.querySelector(".ProseMirror")?.textContent.includes("SEKMEA"), null, { timeout: 10000 }).catch(() => {});
  const metin = await d.s.locator(".ProseMirror").first().textContent();
  bekle(metin.includes("SEKMEA") && !metin.includes("SEKMEB"), `A'nın metni geri yüklenmedi (A ${metin.includes("SEKMEA")}, B ${metin.includes("SEKMEB")}; bildirim: ${JSON.stringify(await d.s.locator(".toast").allInnerTexts())}; bant: ${await bant2.isVisible()})`);
  // Geri yüklenen metin kaydedilince önerilen taslak da silinir.
  await d.s.waitForTimeout(4000);
  bekle(/Kaydedildi/.test(await durumYazisi(d.s)), `geri yükleme sonrası durum: ${await durumYazisi(d.s)}`);
  const son = await taslaklar(d.s);
  bekle(son.length === 0, `geri yükleyip kaydettikten sonra ${son.length} taslak`);
  await ctx.close();
  return "A ve B ayrı anahtarda; öneri B → (yok say) → A → geri yüklendi, kaydedildi, taslak 0";
});

await senaryo("kayıttan sonra yeniden açma: taslak kalmıyor, öneri çıkmıyor", async () => {
  const { ctx } = await baglam();
  const a = await ac(ctx);
  await a.s.waitForTimeout(2000);
  await sonaYaz(a.s, " KAYITLI");
  await a.s.waitForTimeout(4500);
  bekle(/Kaydedildi/.test(await durumYazisi(a.s)), `durum: ${await durumYazisi(a.s)}`);
  bekle((await taslaklar(a.s)).length === 0, "kayıttan sonra taslak kaldı");
  await a.s.close();
  const b = await ac(ctx);
  await b.s.waitForTimeout(2500);
  bekle(!(await teklifBandi(b.s).isVisible()), "yeniden açılışta taslak önerisi çıktı");
  bekle((await b.s.locator(".ProseMirror").first().getAttribute("contenteditable")) === "true", "editör salt okunur kaldı");
  await ctx.close();
  return "taslak 0, öneri yok, editör yazılabilir";
});

await tarayici.close();
let dusen = 0;
for (const r of sonuclar) {
  console.log(`${r.tamam ? "PASS" : "FAIL"}  ${r.ad}${r.tamam ? (r.not ? `  — ${r.not}` : "") : `\n      → ${r.neden}`}`);
  if (!r.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
