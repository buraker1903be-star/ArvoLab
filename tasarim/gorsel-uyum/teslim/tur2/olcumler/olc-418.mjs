// Madde 4: React #418 hedefli kontrol. Editör + kaynaklar + PDF; soğuk açılış (yeni bağlam, ilk istek),
// yeniden yükleme ve TR/EN × açık/koyu; dört genişlik; normal ve 6× yavaş CPU. pageerror + console.error toplanır.
import { chromium, H, UYG } from "./ortak.mjs";
const yaz = `/dashboard/editor/${H.PR}/write?sol=kaynaklar&sag=pdf`;
const TUR = Number(process.env.TUR ?? 1);
const b = await chromium.launch();
let acilis = 0; const bulgular = [];
for (let tur = 1; tur <= TUR; tur++)
for (const cpu of [1, 6])
for (const [g, h, mobil] of [[1440, 900, false], [1280, 800, false], [1200, 800, false], [390, 844, true]])
for (const dil of ["tr", "en"])
for (const tema of ["light", "dark"]) {
  const c = await b.newContext({ baseURL: UYG, viewport: { width: g, height: h }, isMobile: mobil, hasTouch: mobil, colorScheme: tema });
  await c.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  await c.addInitScript((t) => { try { localStorage.setItem("arvolab.theme", t); } catch {} }, tema);
  const s = await c.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(`pageerror: ${e.message.slice(0, 300)}`));
  s.on("console", (m) => { if (m.type() === "error" && /418|hydrat|Hydrat|did not match|didn't match/.test(m.text())) hatalar.push(`console: ${m.text().slice(0, 300)}`); });
  await s.goto("/"); await s.fill('input[name="email"]', H.A.adres); await s.fill('input[name="password"]', H.A.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  const cdp = await c.newCDPSession(s); await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  for (const adim of ["soğuk", "yeniden-yükle", "yeniden-yükle-2"]) {
    hatalar.length = 0;
    if (adim === "soğuk") await s.goto(yaz); else await s.reload();
    await s.waitForSelector(".ProseMirror", { timeout: 90000 }); await s.waitForTimeout(2500);
    acilis++;
    if (hatalar.length) bulgular.push({ tur, cpu, g, dil, tema, adim, hatalar: [...hatalar] });
  }
  await c.close();
}
console.log(`açılış: ${acilis}, hata görülen: ${bulgular.length}`);
for (const x of bulgular) console.log(JSON.stringify(x));
await b.close();
