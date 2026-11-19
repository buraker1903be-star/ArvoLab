// Yeni çalışma: düğmelerin görsel sırası ile Tab / Shift+Tab sırası (telefon 390, masaüstü 1440). Pozitif tabindex var mı?
import { chromium, oturum, ac } from "./ortak.mjs";
const b = await chromium.launch();
for (const [ad, g, h, mobil] of [["telefon", 390, 844, true], ["masaustu", 1440, 900, false]]) {
  const { c, s } = await oturum(b, { genislik: g, yukseklik: h, mobil });
  await ac(s, "/dashboard?yeni=1");
  if (!(await s.locator(".yeni-calisma-formu").count())) {
    await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click().catch(() => s.getByRole("link", { name: /^Yeni çalışma$/ }).first().click());
  }
  await s.waitForSelector(".yeni-calisma-formu .pencere-dugmeler button", { timeout: 30000 }); await s.waitForTimeout(900);
  const r = await s.evaluate(() => {
    const d = [...document.querySelectorAll(".yeni-calisma-formu .pencere-dugmeler button")];
    const gorsel = [...d].sort((a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return Math.abs(x.top - y.top) > 4 ? x.top - y.top : x.left - y.left; }).map((e) => e.value);
    return { dom: d.map((e) => e.value), gorsel, pozitifTabindex: document.querySelectorAll('.yeni-calisma-formu [tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length };
  });
  // Formun son alanından Tab ile ileri, sonra Shift+Tab ile geri.
  const odakAl = () => s.evaluate(() => { const a = document.activeElement; return a?.closest(".pencere-dugmeler") ? a.value : (a?.getAttribute("name") || a?.tagName || "?"); });
  await s.evaluate(() => { const alanlar = [...document.querySelectorAll(".yeni-calisma-formu :is(input:not([type=hidden]),select,textarea,button)")].filter((e) => !e.closest(".pencere-dugmeler") && e.offsetParent); alanlar.at(-1).focus(); });
  const ileri = [];
  for (let i = 0; i < 2; i++) { await s.keyboard.press("Tab"); ileri.push(await odakAl()); }
  const geri = [];
  for (let i = 0; i < 2; i++) { await s.keyboard.press("Shift+Tab"); geri.push(await odakAl()); }
  console.log(ad, JSON.stringify({ ...r, tabIleri: ileri, shiftTabGeri: geri, eslesiyor: JSON.stringify(ileri) === JSON.stringify(r.gorsel) }));
  await s.screenshot({ path: `y/yeni-calisma-${ad}.png` });
  await c.close();
}
await b.close();
