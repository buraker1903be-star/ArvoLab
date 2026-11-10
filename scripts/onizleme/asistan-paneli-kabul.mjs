/*
  ARVO AI PANELİ KABULÜ (UX S2, 07.11.2026).

  Sınanan (karar lib/yazim-yan-panel.ts, çizim manuscript-editor.tsx):
    1. Başlıktaki Arvo AI, paneldeki sekme ve komut paleti AYNI görünüme
       ulaşır: istem kutusu ve odak istem kutusunda.
    2. İlk tıklamada panel boş kalmaz: ya istem kutusu ya yükleniyor
       iskeleti (aria-busy) görünür; eskiden yalnızca "Satır içi öneri"
       anahtarı görünüyordu.
    3. Editör içindeki komut paleti sayfaya gitmez, AKTİF çalışmanın
       asistanını açar (eskiden adres değişiyor, panel İnceleme'de kalıyordu).
    4. İstem metni sekme değişince ve panel kapanıp açılınca korunur.
    5. Paneli açmak hiçbir sunucu isteği (üretim dahil) göndermez.
  ÖNKOŞUL: npm run onizleme:ai (ya da onizleme), sonra
    NODE_PATH=$(npm root -g) node scripts/onizleme/asistan-paneli-kabul.mjs [taban-adres]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("asistan-paneli-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let hata = 0;
const bekle = (kosul, mesaj) => {
  if (!kosul) hata++;
  console.log(`${kosul ? "✓" : "✗"} ${mesaj}`);
};

const tarayici = await chromium.launch();
async function editor(genislik = 1440) {
  const ctx = await tarayici.newContext({ viewport: { width: genislik, height: 900 } });
  const sayfa = await ctx.newPage();
  const istekler = [];
  sayfa.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) istekler.push(Date.now());
  });
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 30000 });
  await sayfa.waitForTimeout(500);
  return { ctx, sayfa, istekler };
}
const gorunum = (sayfa) =>
  sayfa.evaluate(() => {
    const p = document.querySelector("#yazim-yan-panel");
    const g = p && [...p.querySelectorAll("[role=tabpanel]")].find((x) => !x.hidden);
    const ta = g?.querySelector(".yazim-girdi textarea");
    return {
      acik: p ? !p.hidden : false,
      gorunum: g?.dataset.gorunum ?? null,
      istemKutusu: Boolean(ta),
      iskelet: Boolean(g?.querySelector("[aria-busy=true]")),
      odakIstemde: Boolean(ta) && document.activeElement === ta,
      istem: ta?.value ?? null,
    };
  });
async function asistanaUlasti(sayfa, ad) {
  const hemen = await gorunum(sayfa);
  bekle(hemen.acik && hemen.gorunum === "asistan" && (hemen.istemKutusu || hemen.iskelet), `${ad}: ilk anda boş değil (istem kutusu ${hemen.istemKutusu}, iskelet ${hemen.iskelet})`);
  await sayfa.locator("#yazim-yan-panel .yazim-girdi textarea").waitFor({ state: "visible", timeout: 15000 });
  await sayfa.waitForTimeout(200);
  const sonra = await gorunum(sayfa);
  bekle(sonra.istemKutusu && !sonra.iskelet, `${ad}: istem kutusu geldi, iskelet kalktı`);
  bekle(sonra.odakIstemde, `${ad}: odak istem kutusunda`);
}

// 1) başlıktaki Arvo AI (soğuk: paket henüz inmemiş olabilir)
{
  const { ctx, sayfa, istekler } = await editor();
  const once = istekler.length;
  await sayfa.locator("button.yazma-ai").click();
  await asistanaUlasti(sayfa, "başlık düğmesi");
  bekle(istekler.length === once, `başlık düğmesi: sunucu isteği yok (${istekler.length - once})`);
  // 4) istem korunur
  await sayfa.locator("#yazim-yan-panel .yazim-girdi textarea").fill("Giriş için bir paragraf");
  await sayfa.locator("#yazim-yan-panel [role=tab]", { hasText: "İnceleme" }).click();
  await sayfa.locator("#yazim-yan-panel [role=tab]", { hasText: "Arvo AI" }).click();
  bekle((await gorunum(sayfa)).istem === "Giriş için bir paragraf", "istem sekme değişince korundu");
  await sayfa.locator("button.yazma-ai").click(); // asistan açıkken kapatır
  bekle(!(await gorunum(sayfa)).acik, "başlık düğmesi asistan açıkken paneli kapatıyor");
  await sayfa.locator("button.yazma-ai").click();
  const g = await gorunum(sayfa);
  bekle(g.acik && g.istem === "Giriş için bir paragraf", "istem panel kapanıp açılınca korundu");
  bekle(istekler.length === once, `aç/kapa/sekme boyunca sunucu isteği yok (${istekler.length - once})`);
  await ctx.close();
}

// 2) paneldeki sekme
{
  const { ctx, sayfa, istekler } = await editor();
  const once = istekler.length;
  await sayfa.locator("#yazim-yan-panel [role=tab]", { hasText: "Arvo AI" }).click();
  await asistanaUlasti(sayfa, "panel sekmesi");
  bekle(istekler.length === once, "panel sekmesi: sunucu isteği yok");
  await ctx.close();
}

// 3) komut paleti, yazım ekranının içinden
{
  const { ctx, sayfa, istekler } = await editor();
  const adres = sayfa.url();
  await sayfa.keyboard.press("Control+k");
  const oge = sayfa.getByRole("option", { name: /Yazım asistanını aç/ }).first();
  await oge.waitFor({ timeout: 10000 });
  // Palet açılırken çalışma listesini okur (komutCalismalari); sayım öğeye basıldıktan sonra.
  await sayfa.waitForLoadState("networkidle");
  const once = istekler.length;
  await oge.click();
  await asistanaUlasti(sayfa, "komut paleti");
  bekle(sayfa.url() === adres, `komut paleti sayfaya gitmedi (${sayfa.url().replace(TABAN, "")})`);
  bekle(istekler.length === once, "komut paleti: sunucu isteği yok");
  await ctx.close();
}

// telefon: panel sayfa biçiminde, aynı yol
{
  const { ctx, sayfa } = await editor(390);
  await sayfa.locator("button.yazma-ai").click();
  await asistanaUlasti(sayfa, "telefon başlık düğmesi");
  await ctx.close();
}

await tarayici.close();
console.log(hata ? `\n${hata} denetim düştü` : "\nArvo AI paneli kabulü temiz");
process.exit(hata ? 1 : 0);
