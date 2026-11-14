/*
  R1 HAYALET KAYIT KABULÜ (14.11.2026).

  Yazım editörü açılıştan ~1,5 sn sonra, kullanıcı hiçbir şey yazmadan
  belgeyi bir kez kaydediyordu (saveManuscript). Kök neden: taslak/uyumsuz
  içerik kilidini kuran efekt editor.setEditable(...) çağırıyor; Tiptap
  v3'te ikinci parametre (emitUpdate) varsayılan true ve belge değişmeden
  bir "update" olayı yayıyor; onUpdate → markDirty → scheduleSave. Kayıt
  her seferinde updated_at'i ileri alıyor, 10 dakikada bir otomatik sürüm
  ekliyor ve iki sekmede yanlış "başka sekmede değiştirildi" çakışmasına
  yol açabiliyordu.

  Bu betik gerçek tarayıcıda, sentetik önizleme verisiyle sınar: açılışta,
  yeniden açılışta, yalnızca tıklamada ve taslak teklifinde içerik taşıyan
  kayıt isteği 0; gerçek karakter ve Ctrl+S kaydediyor; araç çubuğu, Ctrl+B
  ve Ctrl+Z çalışıyor. "Kayıt isteği" = gövdesinde belge içeriği
  ("content":{"type":"doc") taşıyan POST (saveManuscript).

  Önizlemenin sahte Supabase istemcisi yazmaları uygulamaz: updated_at,
  sürüm ve iki sekme çakışması burada GÖZLENEMEZ; onlar Test ortamında
  sınanmalı.

  CI'da DEĞİL. Kullanım (sunucu: ARVOLAB_ONIZLEME=1 next dev -p 3123):
    node scripts/onizleme/hayalet-kayit-kabul.mjs [taban-adres]
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const YOL = `/dashboard/editor/${TEZ}/write`;
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KAYNAK = JSON.parse(fs.readFileSync(path.join(KOK, "tests/fixtures/tez-enflasyon-issizlik.json"), "utf8"));
const ozet = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 12);
const KAYNAK_HASH = ozet(KAYNAK);

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

async function baglam({ taslak } = {}) {
  const ctx = await tarayici.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.addInitScript(() => {
    const gizle = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) gizle(); else document.addEventListener("DOMContentLoaded", gizle);
  });
  if (taslak) {
    await ctx.addInitScript(({ anahtar, deger }) => {
      try { if (!sessionStorage.getItem("taslak-kuruldu")) { sessionStorage.setItem("taslak-kuruldu", "1"); localStorage.setItem(anahtar, deger); } } catch {}
    }, { anahtar: `arvolab:manuscript-draft:${TEZ}:${KULLANICI}`, deger: JSON.stringify(taslak) });
  }
  return ctx;
}
async function ac(ctx, kayitlar) {
  const s = await ctx.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 160)));
  s.on("request", (r) => {
    const g = r.postData() || "";
    if (r.method() === "POST" && g.includes('"content":{"type":"doc"')) {
      try { kayitlar.push({ t: Date.now(), hash: ozet(JSON.parse(g)[1].content) }); } catch { kayitlar.push({ t: Date.now(), hash: "?" }); }
    }
  });
  await s.goto(TABAN + YOL, { waitUntil: "networkidle", timeout: 150000 });
  await s.locator(".ProseMirror").first().waitFor();
  return { s, hatalar };
}
const yazilabilir = (s) => s.evaluate(() => document.querySelector(".ProseMirror").getAttribute("contenteditable"));
const sonaYaz = async (s, metin) => {
  await s.locator(".ProseMirror").first().click();
  await s.keyboard.press("Control+End");
  await s.keyboard.type(metin);
};

await senaryo("aç, 15 sn bekle: kayıt isteği 0", async () => {
  const ctx = await baglam(); const k = [];
  const { s, hatalar } = await ac(ctx, k);
  await s.waitForTimeout(15000);
  bekle(k.length === 0, `${k.length} kayıt isteği (hash ${[...new Set(k.map((x) => x.hash))]})`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return "0 istek";
});

await senaryo("kapat ve yeniden aç: kayıt isteği 0", async () => {
  const ctx = await baglam(); const k = [];
  let { s } = await ac(ctx, k);
  await s.waitForTimeout(5000);
  await s.close();
  ({ s } = await ac(ctx, k));
  await s.waitForTimeout(8000);
  bekle(k.length === 0, `${k.length} kayıt isteği`);
  await ctx.close();
  return "iki açılış, 0 istek";
});

await senaryo("yalnızca editöre tıkla: kayıt isteği 0", async () => {
  const ctx = await baglam(); const k = [];
  const { s } = await ac(ctx, k);
  await s.locator(".ProseMirror").first().click();
  await s.waitForTimeout(8000);
  bekle(k.length === 0, `${k.length} kayıt isteği`);
  await ctx.close();
  return "0 istek";
});

await senaryo("gerçek karakter: tam bir otomatik kayıt, içerik değişmiş", async () => {
  const ctx = await baglam(); const k = [];
  const { s } = await ac(ctx, k);
  await s.waitForTimeout(4000);
  const once = k.length;
  await sonaYaz(s, "R");
  await s.waitForTimeout(6000);
  const yeni = k.slice(once);
  bekle(once === 0, `karakterden önce ${once} hayalet kayıt`);
  bekle(yeni.length === 1, `karakterden sonra ${yeni.length} kayıt`);
  bekle(yeni[0].hash !== KAYNAK_HASH, "kaydedilen içerik değişmemiş");
  await ctx.close();
  return `1 kayıt, hash ${KAYNAK_HASH} → ${yeni[0].hash}`;
});

await senaryo("Ctrl+S: gerçek değişiklik otomatik kayıt beklenmeden kaydediliyor", async () => {
  const ctx = await baglam(); const k = [];
  const { s } = await ac(ctx, k);
  await s.waitForTimeout(3000);
  await sonaYaz(s, "S");
  const t0 = Date.now();
  await s.keyboard.press("Control+s");
  await s.waitForTimeout(1000);
  const erken = k.filter((x) => x.t >= t0 && x.t - t0 < 1000);
  bekle(erken.length >= 1 && erken[0].hash !== KAYNAK_HASH, `Ctrl+S sonrası 1 sn içinde ${erken.length} kayıt`);
  await s.waitForTimeout(4000);
  bekle(k.length === 1, `toplam ${k.length} kayıt (yalnızca Ctrl+S'in kaydı beklenir)`);
  await ctx.close();
  return `Ctrl+S → ${erken[0].t - t0} ms içinde kayıt`;
});

await senaryo("taslak teklifi: açıkken salt okunur ve kayıt yok; 'Yok say' sonrası yazılabilir ve kayıt yok; sonra yazınca kaydediyor", async () => {
  // Kaynaktan FARKLI bir taslak: teklif ancak öyle çıkar (aynıysa taslak sessizce silinir).
  const farkli = JSON.parse(JSON.stringify(KAYNAK));
  farkli.content.push({ type: "paragraph", content: [{ type: "text", text: "Taslakta kalan cümle." }] });
  const ctx = await baglam({ taslak: { content: farkli, baseUpdatedAt: null, writtenAt: new Date().toISOString() } });
  const k = [];
  const { s, hatalar } = await ac(ctx, k);
  const bant = s.locator(".editor-notice", { hasText: "kaydedilmemiş değişiklikleriniz" });
  await bant.waitFor({ timeout: 10000 });
  bekle((await yazilabilir(s)) === "false", `teklif açıkken contenteditable=${await yazilabilir(s)}`);
  await s.waitForTimeout(8000);
  bekle(k.length === 0, `teklif açıkken ${k.length} kayıt`);
  await bant.getByRole("button", { name: "Yok say" }).click();
  await s.waitForTimeout(300);
  bekle(!(await bant.isVisible()), "bant kapanmadı");
  bekle((await yazilabilir(s)) === "true", `'Yok say' sonrası contenteditable=${await yazilabilir(s)}`);
  await s.waitForTimeout(6000);
  bekle(k.length === 0, `'Yok say' sonrası ${k.length} hayalet kayıt`);
  await sonaYaz(s, "T");
  await s.waitForTimeout(6000);
  bekle(k.length === 1 && k[0].hash !== KAYNAK_HASH, `yazınca ${k.length} kayıt`);
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return "salt okunur → yazılabilir; hayalet 0, gerçek 1";
});

await senaryo("araç çubuğu ve kısayollar: Ctrl+B kalın yapar, Kalın düğmesi işaretlenir, Ctrl+Z geri alır", async () => {
  const ctx = await baglam(); const k = [];
  const { s } = await ac(ctx, k);
  await sonaYaz(s, " kalinsina");
  /*
    Seçim, yazılan metin işlenmeden yapılırsa boş kalıyor (ilk koşularda
    düzeltmeden bağımsız olarak arada bir böyle düştü: editör yazılabilir ve
    odaktaydı, yalnızca seçim boştu). Seçilen metin doğrulanana kadar yinelenir.
  */
  for (let deneme = 0; deneme < 5; deneme++) {
    await s.waitForTimeout(250);
    await s.keyboard.press("Shift+Control+ArrowLeft");
    const secim = await s.evaluate(() => window.getSelection()?.toString() ?? "");
    if (secim.trim() === "kalinsina") break;
    await s.keyboard.press("Control+End");
  }
  bekle((await s.evaluate(() => window.getSelection()?.toString().trim())) === "kalinsina", "sözcük seçilemedi");
  const dugme = s.locator("button[aria-label='Kalın (Ctrl+B)']").first();
  const durum = async () => s.evaluate(() => ({ strong: document.querySelector(".ProseMirror").querySelectorAll("strong").length, basili: document.querySelector("button[aria-label='Kalın (Ctrl+B)']")?.getAttribute("aria-pressed") }));
  const once = await durum();
  await s.keyboard.press("Control+b");
  await s.waitForTimeout(200);
  const sonra = await durum();
  bekle(sonra.strong === once.strong + 1, `Ctrl+B: strong ${once.strong} → ${sonra.strong}`);
  bekle(sonra.basili === "true", `Kalın düğmesi aria-pressed=${sonra.basili}`);
  await s.keyboard.press("Control+z");
  await s.waitForTimeout(200);
  const geri = await durum();
  bekle(geri.strong === once.strong, `Ctrl+Z: strong ${geri.strong}`);
  bekle(geri.basili !== "true", `geri alınca Kalın düğmesi hâlâ basılı`);
  bekle(await dugme.isEnabled(), "Kalın düğmesi devre dışı");
  await ctx.close();
  return `strong ${once.strong} → ${sonra.strong} → ${geri.strong}; düğme ${sonra.basili} → ${geri.basili}`;
});

await tarayici.close();
let dusen = 0;
for (const r of sonuclar) {
  console.log(`${r.tamam ? "PASS" : "FAIL"}  ${r.ad}${r.tamam ? (r.not ? `  — ${r.not}` : "") : `\n      → ${r.neden}`}`);
  if (!r.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
