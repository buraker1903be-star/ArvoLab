#!/usr/bin/env node
/*
  SUPABASE TEST — KAYIT GÜVENLİĞİ KABULÜ (O1, V4.3; 08.11.2026).
  BU BETİK HENÜZ GERÇEK TEST HESABINDA ÇALIŞTIRILMADI. Varsayılan KURU:
  hedefi ve yapılacak veri işlemlerini yazar, hiçbir yere bağlanmaz,
  giriş yapmaz. Gerçek koşu yalnızca `--calistir` ile.

  Neden: kayıt güvenliği (otomatik kayıt, hayalet kayıt, ağ kesintisi,
  yavaş kayıt, gezinme, eşzamanlı sekme, geri/ileri, sekme kapatma)
  bugüne kadar yalnızca önizleme sunucusunda, sahte Supabase ile
  sınandı. Burada aynı davranışlar GERÇEK Supabase Test projesinde,
  normal giriş formuyla ve uygulamanın kendi akışlarıyla sınanır.

  ÜRETİME DOKUNMAYI DÖRT KAPI ENGELLER (hepsi aranır):
    1. Kodda sabit üretim kimliği: adres ya da taban adres onu içeriyorsa
       durur (uretimProjesiniGosteriyor).
    2. Ortam değişkenleri: adresteki proje ARVOLAB_TEST_SUPABASE_REF
       olmalı (betikHedefKarari, "sentetik-veri": üretimde hiçbir bayrakla
       açılmaz) ve ARVOLAB_SUPABASE_ORTAMI=test.
    3. ÇALIŞAN SUNUCUNUN hedefi: betiğin ortamı ile yerel sunucunun ortamı
       farklı olabilir. Sunucunun tarayıcıya verdiği JS paketindeki
       Supabase adresi okunur; Test projesi değilse ya da okunamazsa
       giriş yapılmadan durulur.
    4. Koşu sırasında tarayıcıdan üretim projesine giden her istek
       engellenir ve koşu düşer.

  HESAP: yalnızca sentetik D hesabı (arvolab-test-d@example.com). Başka
  e-postayla çalışmaz.

  VERİ İŞLEMLERİ (yalnızca bunlar):
    - D hesabına normal giriş formuyla giriş.
    - Uygulamanın "Yeni çalışma" penceresiyle TEK yeni çalışma
      ("V4.3 O1 kabul <tarih-saat>"). Bu çalışmada sentetik metin yazılır
      (otomatik kayıt ve sürümler oluşur).
    - Hesaptaki başka hiçbir çalışma açılmaz, değiştirilmez.
    - Yapay zekâ çağrılmaz (dış maliyet yok).
    - HİÇBİR ŞEY SİLİNMEZ. Oluşturulan çalışmanın kimliği yerel bir
      kayıt dosyasına yazılır; temizlik ayrıca onaylanır.

  GİZLİLİK: parola yalnızca bu süreçte, giriş kutusuna yazılır. Konsola,
  dosyaya, ekran görüntüsüne yazılmaz; iz (trace) alınmaz; giriş
  adımının hata ayrıntısı bastırılır (Playwright çağrı günlüğü yazılan
  değeri içerebilir).

  ORTAM (yalnızca kendi terminalinizde; sohbete yazmayın):
    NEXT_PUBLIC_SUPABASE_URL, ARVOLAB_TEST_SUPABASE_REF,
    ARVOLAB_URETIM_SUPABASE_REF, ARVOLAB_SUPABASE_ORTAMI=test,
    TEST_HESAP_EPOSTA=arvolab-test-d@example.com,
    TEST_HESAP_PAROLASI (yalnızca --calistir için),
    ARVOLAB_KABUL_TABAN (varsayılan http://localhost:3000; yalnız localhost).

  Kullanım:
    node scripts/test-ortami/kayit-guvenligi-kabul.mjs            # kuru: plan
    node scripts/test-ortami/kayit-guvenligi-kabul.mjs --calistir # gerçek koşu
  Çıkış: 0 temiz, 1 senaryo düştü, 2 kapı reddetti (hiçbir işlem yapılmadı).
*/
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { betikHedefKarari, projeKimligi, SABIT_URETIM_SUPABASE_REF, uretimProjesiniGosteriyor } from "../../lib/supabase/ortam-guvenligi.ts";

const require = createRequire(import.meta.url);

const IZINLI_HESAP = "arvolab-test-d@example.com";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const TABAN = (process.env.ARVOLAB_KABUL_TABAN ?? "http://localhost:3000").replace(/\/$/, "");
const EPOSTA = (process.env.TEST_HESAP_EPOSTA ?? "").trim().toLowerCase();
const CALISTIR = process.argv.includes("--calistir");

function durdur(mesaj) {
  console.error(`✗ Kabul durduruldu (hiçbir işlem yapılmadı): ${mesaj}`);
  process.exit(2);
}

/* ---------------- Kapılar (ağsız) ---------------- */
if (uretimProjesiniGosteriyor(URL_, TABAN)) durdur(`Hedef üretim projesi (${SABIT_URETIM_SUPABASE_REF}).`);
const karar = betikHedefKarari({ tur: "sentetik-veri", hedefRef: projeKimligi(URL_), uretimRef: process.env.ARVOLAB_URETIM_SUPABASE_REF, testRef: process.env.ARVOLAB_TEST_SUPABASE_REF });
if (karar.tur !== "izin" || karar.hedef !== "test") durdur(karar.tur === "red" ? karar.mesaj : "Hedef test projesi değil.");
if (process.env.ARVOLAB_SUPABASE_ORTAMI !== "test") durdur("ARVOLAB_SUPABASE_ORTAMI=test değil.");
let tabanHost;
try {
  tabanHost = new URL(TABAN).hostname;
} catch {
  durdur("ARVOLAB_KABUL_TABAN geçerli bir adres değil.");
}
if (!["localhost", "127.0.0.1"].includes(tabanHost)) durdur("Taban adres yalnızca yerel sunucu olabilir (localhost).");
if (EPOSTA !== IZINLI_HESAP) durdur(`Yalnızca sentetik D hesabı (${IZINLI_HESAP}) kullanılabilir.`);

const TEST_REF = projeKimligi(URL_);
const BASLIK = `V4.3 O1 kabul ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
const KAYIT_DOSYASI = path.join(os.tmpdir(), `arvolab-o1-${Date.now()}.json`);

console.log(`Hedef Supabase projesi : ${TEST_REF} (Test)`);
console.log(`Yerel sunucu           : ${TABAN}`);
console.log(`Hesap                  : ${EPOSTA}`);
console.log(`Oluşturulacak çalışma  : "${BASLIK}" (1 adet, uygulamanın Yeni çalışma penceresiyle)`);
console.log(`Silme                  : YOK (kimlik ${KAYIT_DOSYASI} dosyasına yazılır; temizlik ayrıca onaylanır)`);
console.log("Yapay zekâ çağrısı     : YOK");
if (!CALISTIR) {
  console.log("\nKURU KİP: hiçbir yere bağlanılmadı. Gerçek koşu için --calistir ekleyin (onaydan sonra).");
  process.exit(0);
}
const PAROLA = process.env.TEST_HESAP_PAROLASI ?? "";
if (PAROLA.length < 12) durdur("TEST_HESAP_PAROLASI tanımlı değil ya da 12 karakterden kısa.");

/* ---------------- Kapı 3: çalışan sunucunun hedefi ---------------- */
async function sunucuHedefi() {
  const html = await (await fetch(`${TABAN}/`)).text();
  const betikler = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], TABAN).href).filter((u) => u.startsWith(TABAN));
  const refler = new Set();
  for (const u of betikler) {
    const metin = await (await fetch(u)).text();
    for (const m of metin.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)) refler.add(m[1]);
  }
  return [...refler];
}
const refler = await sunucuHedefi().catch(() => null);
if (!refler) durdur(`Yerel sunucuya ulaşılamadı (${TABAN}).`);
if (refler.some((r) => uretimProjesiniGosteriyor(r))) durdur("Yerel sunucu ÜRETİM projesine bağlı.");
if (refler.length !== 1 || refler[0] !== TEST_REF) durdur(`Yerel sunucunun Supabase projesi doğrulanamadı (bulunan: ${refler.join(", ") || "yok"}).`);
console.log(`✓ Yerel sunucu Test projesine bağlı (${refler[0]}).`);

/* ---------------- Koşu ---------------- */
const { chromium } = require("playwright");
const tarayici = await chromium.launch();
const sonuclar = [];
let uretimeIstek = 0;
const KAYIT_BEKLEME = 4000;
const kayitIstegiMi = (istek) => istek.method() === "POST" && Boolean(istek.headers()["next-action"]) && (istek.postData() ?? "").includes('"content"');
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};
async function senaryo(ad, govde) {
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).slice(0, 240) });
  }
}

async function baglam(secenek = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await tarayici.newContext({ ...secenek, storageState: oturum ?? undefined });
  // Kapı 4: üretim projesine giden her istek engellenir.
  await ctx.route(new RegExp(SABIT_URETIM_SUPABASE_REF), (r) => {
    uretimeIstek++;
    return r.abort("blockedbyclient");
  });
  return ctx;
}
let oturum = null;

// Giriş: hata ayrıntısı BASTIRILIR (çağrı günlüğü yazılan değeri içerebilir).
{
  const ctx = await baglam();
  const s = await ctx.newPage();
  try {
    await s.goto(`${TABAN}/`, { waitUntil: "networkidle", timeout: 120000 });
    await s.locator("#email").fill(EPOSTA);
    await s.locator("#password").fill(PAROLA);
    await s.locator('button[type="submit"]').first().click();
    await s.waitForURL(/\/dashboard/, { timeout: 60000 });
  } catch {
    await tarayici.close();
    durdur("Giriş yapılamadı (ayrıntı gizlilik nedeniyle yazılmadı). Hesabı ve parolayı kontrol edin.");
  }
  oturum = await ctx.storageState();
  await ctx.close();
}
console.log("✓ Giriş yapıldı.");

// Hesaptaki mevcut çalışmalar: yalnızca SAYILIR, açılmaz.
let calismaId;
{
  const ctx = await baglam();
  const s = await ctx.newPage();
  await s.goto(`${TABAN}/dashboard/editor`, { waitUntil: "networkidle", timeout: 120000 });
  const mevcut = await s.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/dashboard/editor?sec="]')].map((a) => new URL(a.href).searchParams.get("sec")))]);
  console.log(`Hesapta önceden ${mevcut.length} çalışma var (dokunulmayacak).`);
  await s.goto(`${TABAN}/dashboard/editor?yeni=1`, { waitUntil: "networkidle", timeout: 120000 });
  await s.locator('input[name="title"]').fill(BASLIK);
  await s.locator('button[type="submit"]', { hasText: "Çalışmayı oluştur" }).click();
  await s.waitForURL(/sec=[0-9a-f-]{36}/, { timeout: 60000 });
  calismaId = new URL(s.url()).searchParams.get("sec");
  bekle(calismaId && !mevcut.includes(calismaId), "yeni çalışmanın kimliği alınamadı");
  fs.writeFileSync(KAYIT_DOSYASI, JSON.stringify({ proje: TEST_REF, hesap: EPOSTA, olusturulan: [{ id: calismaId, baslik: BASLIK }], tarih: new Date().toISOString() }, null, 2));
  console.log(`✓ Sentetik çalışma oluşturuldu: ${calismaId} (kayıt: ${KAYIT_DOSYASI})`);
  await ctx.close();
}
const EDITOR = `${TABAN}/dashboard/editor/${calismaId}/write`;

async function editorAc(ctx) {
  const s = await ctx.newPage();
  await s.goto(EDITOR, { waitUntil: "networkidle", timeout: 120000 });
  await s.locator(".ProseMirror").first().waitFor({ timeout: 60000 });
  return s;
}
let sayac = 0;
async function yaz(s, metin) {
  const isaret = metin ?? ` O1-KABUL-${Date.now().toString(36)}-${++sayac}`;
  await s.locator(".ProseMirror").first().click();
  await s.keyboard.press("Control+End");
  await s.keyboard.type(isaret);
  return isaret.trim();
}
async function sunucudaMi(isaret) {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  const var_ = await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret);
  await ctx.close();
  return var_;
}
const durumMetni = (s) => s.evaluate(() => document.querySelector(".save-status")?.textContent ?? "");

await senaryo("S1 editörü açmak kayıt göndermez (hayalet kayıt yok)", async () => {
  const ctx = await baglam();
  const s = await ctx.newPage();
  let kayit = 0;
  s.on("request", (r) => kayitIstegiMi(r) && kayit++);
  await s.goto(EDITOR, { waitUntil: "networkidle", timeout: 120000 });
  await s.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayit === 0, `açılışta ${kayit} kayıt`);
  await ctx.close();
});

await senaryo("S2 yazınca otomatik kaydedilir ('Kaydedildi'), yenilemeden sonra metin yerinde", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  let kayit = 0;
  s.on("request", (r) => kayitIstegiMi(r) && kayit++);
  const isaret = await yaz(s);
  await s.waitForTimeout(KAYIT_BEKLEME);
  bekle(kayit >= 1, "kayıt gitmedi");
  bekle(/Kaydedildi/.test(await durumMetni(s)), "'Kaydedildi' görünmüyor");
  await ctx.close();
  bekle(await sunucudaMi(isaret), "metin sunucuda yok");
});

await senaryo("S3 yazdıktan hemen sonra kenar çubuğundan çıkış: önce kaydedilir", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "metin sunucuda yok");
});

await senaryo("S4 ağ kesintisi: çevrimdışıyken yazılan metin bağlantı gelince kaydedilir", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  await ctx.setOffline(true);
  const isaret = await yaz(s);
  await s.waitForTimeout(KAYIT_BEKLEME);
  bekle(!/^\s*Kaydedildi/.test(await durumMetni(s)), "çevrimdışıyken 'Kaydedildi' dedi");
  await ctx.setOffline(false);
  await s.waitForFunction(() => /Kaydedildi/.test(document.querySelector(".save-status")?.textContent ?? ""), null, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "bağlantı gelince metin sunucuya ulaşmadı");
});

await senaryo("S5 yavaş kayıt (3 sn): gezinme kaydın bitmesini bekler", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  await s.route("**/*", async (route) => {
    if (kayitIstegiMi(route.request())) await new Promise((coz) => setTimeout(coz, 3000));
    return route.continue();
  });
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForURL(`${TABAN}/dashboard`, { timeout: 30000 });
  await ctx.close();
  bekle(await sunucudaMi(isaret), "metin sunucuda yok");
});

await senaryo("S6 kayıt düşerken geçiş olmaz; metin editörde kalır", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  const isaret = await yaz(s);
  await s.locator('#os-gezinme a[href="/dashboard"]').first().click();
  await s.waitForTimeout(6000);
  bekle(s.url().startsWith(EDITOR), "kayıt düşerken sayfadan çıkıldı");
  bekle(await s.locator(".ProseMirror").first().evaluate((e, i) => e.textContent.includes(i), isaret), "metin editörden kayboldu");
  await s.unroute("**/*");
  await ctx.close();
});

await senaryo("S7 eşzamanlılık: ikinci sekme ilkinin kaydını bozmaz; eski sürümün üzerine yazma 'Çakışma var' der", async () => {
  const a = await baglam();
  const b = await baglam();
  const sa = await editorAc(a);
  const sb = await editorAc(b);
  const isaret = await yaz(sa);
  await sa.waitForTimeout(KAYIT_BEKLEME);
  bekle(/Kaydedildi/.test(await durumMetni(sa)), "A kaydedilmedi");
  await yaz(sb, " O1-B-sekmesi");
  await sb.waitForTimeout(KAYIT_BEKLEME);
  bekle(/Çakışma var/.test(await sb.evaluate(() => document.body.innerText)), "B'de çakışma gösterilmedi");
  await a.close();
  await b.close();
  bekle(await sunucudaMi(isaret), "A'nın metni sunucuda yok (B üzerine yazdı)");
});

await senaryo("S8 geri: yaz → hemen tarayıcı GERİ → metin sunucuda", async () => {
  const ctx = await baglam();
  const s = await ctx.newPage();
  await s.goto(`${TABAN}/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
  await s.goto(EDITOR, { waitUntil: "networkidle", timeout: 120000 });
  await s.locator(".ProseMirror").first().waitFor();
  const isaret = await yaz(s);
  s.on("dialog", (d) => d.dismiss().catch(() => {}));
  await s.goBack({ timeout: 30000 }).catch(() => {});
  await s.waitForTimeout(KAYIT_BEKLEME);
  await ctx.close();
  bekle(await sunucudaMi(isaret), "metin sunucuda yok");
});

await senaryo("S9 sekme yenileme: kaydedilmemiş metin varken tarayıcı uyarır", async () => {
  const ctx = await baglam();
  const s = await editorAc(ctx);
  await s.route("**/*", (route) => (kayitIstegiMi(route.request()) ? route.abort("failed") : route.continue()));
  await yaz(s);
  let uyari = false;
  s.on("dialog", (d) => {
    if (d.type() === "beforeunload") uyari = true;
    d.dismiss().catch(() => {});
  });
  await s.reload({ timeout: 5000 }).catch(() => {});
  await s.waitForTimeout(1000);
  bekle(uyari, "beforeunload uyarısı gelmedi");
  await s.unroute("**/*").catch(() => {});
  await ctx.close();
});

await tarayici.close();
let dusen = 0;
for (const r of sonuclar) {
  if (!r.tamam) dusen++;
  console.log(`${r.tamam ? "✓" : "✗"} ${r.ad}${r.tamam ? "" : `\n    ${r.neden}`}`);
}
if (uretimeIstek) {
  console.log(`\n✗ Tarayıcı üretim projesine ${uretimeIstek} istek denedi (engellendi). Koşu geçersiz sayılır.`);
  dusen++;
}
console.log(`\n${sonuclar.length - (dusen - (uretimeIstek ? 1 : 0))}/${sonuclar.length} senaryo geçti. Oluşturulan çalışma: ${calismaId} (silinmedi; kayıt ${KAYIT_DOSYASI})`);
process.exit(dusen ? 1 : 0);
